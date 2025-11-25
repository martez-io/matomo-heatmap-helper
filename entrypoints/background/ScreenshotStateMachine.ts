/**
 * State machine for screenshot orchestration
 * Handles the complete screenshot workflow independently of popup/bar
 * Resilient to browser restarts and tab navigation
 */

import { browser } from 'wxt/browser';
import { getStorage, setStorage, getCredentials } from '@/lib/storage';
import { createMatomoClient, type MatomoApiClient } from '@/lib/matomo-api';
import { sendToContentScript, triggerMatomoScreenshot, cleanAndInjectTracker, waitForMatomoReady } from '@/lib/messaging';
import { logger } from '@/lib/logger';
import type { ProcessingStep, ScreenshotProgress } from '@/types/storage';

export type ScreenshotState =
  | 'idle'
  | 'validating'
  | 'expanding'
  | 'capturing'
  | 'verifying'
  | 'restoring'
  | 'complete'
  | 'error';

export interface ScreenshotContext {
  heatmapId: number;
  tabId: number;
  siteId: number;
  startTime: number;
  error?: string;
  retryCount?: number;
}

export class ScreenshotStateMachine {
  private currentState: ScreenshotState = 'idle';
  private context: ScreenshotContext | null = null;
  private apiClient: MatomoApiClient | null = null;

  constructor() {
    // Attempt to restore from storage on initialization
    this.restoreFromStorage();
  }

  /**
   * Start a new screenshot process
   */
  async start(params: { heatmapId: number; tabId: number; siteId: number }): Promise<void> {
    // Auto-reset if stuck in error or complete state
    if (this.currentState === 'error' || this.currentState === 'complete') {
      logger.debug('StateMachine', `Resetting from ${this.currentState} to idle`);
      await this.reset();
    }

    if (this.currentState !== 'idle') {
      throw new Error(`Cannot start: current state is ${this.currentState}`);
    }

    logger.debug('StateMachine', 'Starting screenshot:', params);

    this.context = {
      ...params,
      startTime: Date.now(),
      retryCount: 0,
    };

    // Initialize API client
    const creds = await getCredentials();
    if (!creds) {
      throw new Error('No credentials configured');
    }
    this.apiClient = createMatomoClient(creds.apiUrl, creds.authToken);

    // Persist initial state
    await this.persistState();

    // Begin execution
    await this.transition('validating');
  }

  /**
   * Transition to a new state and execute it
   */
  private async transition(newState: ScreenshotState): Promise<void> {
    logger.debug('StateMachine', `${this.currentState} → ${newState}`);

    this.currentState = newState;
    await this.persistState();

    try {
      await this.executeState();
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Execute the current state's logic
   */
  private async executeState(): Promise<void> {
    if (!this.context) {
      throw new Error('No context available');
    }

    switch (this.currentState) {
      case 'validating':
        await this.validateHeatmap();
        break;

      case 'expanding':
        await this.expandElements();
        break;

      case 'capturing':
        await this.captureScreenshot();
        break;

      case 'verifying':
        await this.verifyScreenshot();
        break;

      case 'restoring':
        await this.restoreLayout();
        break;

      case 'complete':
        await this.completeScreenshot();
        break;

      case 'error':
        // Error state is terminal, wait for user action
        break;

      case 'idle':
        // Nothing to do
        break;
    }
  }

  /**
   * STEP 1: Validate heatmap configuration
   */
  private async validateHeatmap(): Promise<void> {
    logger.debug('StateMachine', 'Validating heatmap...');

    if (!this.apiClient || !this.context) return;

    // Fetch current heatmap config
    const heatmap = await this.apiClient.getHeatmap(
      this.context.siteId,
      this.context.heatmapId,
      false
    );

    // Enable manual capture if needed
    if (heatmap.capture_manually === 0) {
      logger.debug('StateMachine', 'Enabling manual capture...');
      await this.apiClient.updateHeatmap({ ...heatmap, capture_manually: 1 });
    }

    // Resume if ended
    if (heatmap.status === 'ended') {
      logger.debug('StateMachine', 'Resuming ended heatmap...');
      await this.apiClient.resumeHeatmap(this.context.siteId, this.context.heatmapId);
    }

    // Exit interactive mode if active
    try {
      const status = await sendToContentScript(this.context.tabId, { action: 'getStatus' });
      if ('isInteractiveMode' in status && status.isInteractiveMode) {
        logger.debug('StateMachine', 'Exiting interactive mode...');
        await sendToContentScript(this.context.tabId, { action: 'exitInteractiveMode' });
      }
    } catch (err) {
      logger.warn('StateMachine', 'Could not check/exit interactive mode:', err);
    }

    // Proceed to expansion
    await this.transition('expanding');
  }

  /**
   * STEP 2: Expand scrollable elements
   */
  private async expandElements(): Promise<void> {
    logger.debug('StateMachine', 'Expanding elements...');

    if (!this.context) return;

    // Show scanner animation
    await sendToContentScript(this.context.tabId, { action: 'showScanner' });

    // Trigger layout preparation
    const response = await sendToContentScript(this.context.tabId, {
      action: 'prepareLayout',
    });

    if (!('success' in response) || !response.success) {
      throw new Error('Element expansion failed');
    }

    await this.transition('capturing');
  }

  /**
   * STEP 3: Trigger Matomo screenshot
   */
  private async captureScreenshot(): Promise<void> {
    logger.debug('StateMachine', 'Capturing screenshot...');

    if (!this.context) return;

    // Check if enforcement is enabled
    const enforceEnabled = await getStorage('enforce:enabled');

    if (enforceEnabled) {
      logger.debug('StateMachine', 'Enforce mode enabled, injecting tracker...');

      const creds = await getCredentials();
      if (!creds || !creds.apiUrl) {
        throw new Error('Missing Matomo API URL for enforced tracker');
      }

      const siteId = this.context.siteId;
      if (!siteId) {
        throw new Error('Missing site ID for enforced tracker');
      }

      // STEP 1: Clean and inject enforced tracker
      const injectResult = await cleanAndInjectTracker(
        this.context.tabId,
        creds.apiUrl,
        siteId
      );

      if (!injectResult.success) {
        throw new Error(`Failed to inject enforced tracker: ${injectResult.error}`);
      }

      logger.debug('StateMachine', 'Enforced tracker injected, waiting for Matomo to load...');

      // STEP 2: Wait for Matomo and HeatmapSessionRecording to load
      const readyResult = await waitForMatomoReady(this.context.tabId, 10000);

      if (!readyResult.success) {
        throw new Error(
          readyResult.error ||
          'Timeout waiting for Matomo to load. Ensure the Heatmap plugin is installed on your instance.'
        );
      }

      logger.debug('StateMachine', 'Matomo ready, proceeding with screenshot capture');
    }

    // Execute Matomo API call in page context
    const result = await triggerMatomoScreenshot(
      this.context.tabId,
      this.context.heatmapId
    );

    if (!result.success) {
      throw new Error(result.error || 'Screenshot capture failed');
    }

    await this.transition('verifying');
  }

  /**
   * STEP 4: Verify screenshot was captured
   */
  private async verifyScreenshot(): Promise<void> {
    logger.debug('StateMachine', 'Verifying screenshot...');

    if (!this.apiClient || !this.context) return;

    const verified = await this.apiClient.waitForScreenshotCapture(
      this.context.siteId,
      this.context.heatmapId,
      50, // max attempts
      300 // delay ms
    );

    if (!verified) {
      throw new Error('Screenshot verification timeout');
    }

    await this.transition('restoring');
  }

  /**
   * STEP 5: Restore page layout
   */
  private async restoreLayout(): Promise<void> {
    logger.debug('StateMachine', 'Restoring layout...');

    if (!this.context) return;

    try {
      await sendToContentScript(this.context.tabId, { action: 'restoreLayout' });
    } catch (err) {
      logger.warn('StateMachine', 'Restore failed (tab may be closed):', err);
    }

    await this.transition('complete');
  }

  /**
   * STEP 6: Complete and show success
   */
  private async completeScreenshot(): Promise<void> {
    logger.debug('StateMachine', 'Screenshot complete!');

    if (!this.context) return;

    // Clear processing state IMMEDIATELY before animations
    // This ensures the persistent bar returns to normal state right away
    await setStorage('state:isProcessing', false);
    await setStorage('state:processingStep', null);

    // Show border glow animation
    try {
      await sendToContentScript(this.context.tabId, { action: 'showBorderGlow' });
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err) {
      logger.warn('StateMachine', 'Border glow failed:', err);
    }

    // Create heatmap view tab
    const creds = await getCredentials();
    if (creds && this.apiClient) {
      try {
        const heatmap = await this.apiClient.getHeatmap(
          this.context.siteId,
          this.context.heatmapId,
          false
        );

        if (heatmap.heatmapViewUrl) {
          const baseUrl = `${creds.apiUrl}/${heatmap.heatmapViewUrl}`.replace(
            '&token_auth=' + creds.authToken,
            ''
          );

          // Build URL with success params for feedback bar
          const successUrl = new URL(baseUrl);
          successUrl.searchParams.set('mhh_success', '1');
          successUrl.searchParams.set('mhh_heatmap', String(this.context.heatmapId));
          successUrl.searchParams.set('mhh_ts', String(Date.now()));

          await browser.tabs.create({ url: successUrl.toString(), active: true });
        }
      } catch (err) {
        logger.error('StateMachine', 'Failed to open heatmap tab:', err);
      }
    }

    // Clear state
    await this.reset();
  }

  /**
   * Handle errors during state execution
   */
  private async handleError(error: unknown): Promise<void> {
    logger.error('StateMachine', 'Error:', error);

    this.context = {
      ...this.context!,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    // Hide scanner if active
    try {
      if (this.context.tabId) {
        await sendToContentScript(this.context.tabId, { action: 'hideScanner' });
      }
    } catch (err) {
      logger.warn('StateMachine', 'Could not hide scanner:', err);
    }

    await this.transition('error');
  }

  /**
   * Retry from current/previous step
   */
  async retry(): Promise<void> {
    if (!this.context) {
      throw new Error('No context to retry');
    }

    this.context.retryCount = (this.context.retryCount || 0) + 1;

    if (this.context.retryCount > 3) {
      throw new Error('Maximum retry attempts exceeded');
    }

    // Clear error
    delete this.context.error;

    // Restart from validating
    await this.transition('validating');
  }

  /**
   * Cancel the current screenshot process
   */
  async cancel(): Promise<void> {
    logger.debug('StateMachine', 'Cancelling screenshot');

    // Attempt cleanup
    if (this.context?.tabId) {
      try {
        await sendToContentScript(this.context.tabId, { action: 'restoreLayout' });
        await sendToContentScript(this.context.tabId, { action: 'hideScanner' });
      } catch (err) {
        logger.warn('StateMachine', 'Cleanup failed:', err);
      }
    }

    await this.reset();
  }

  /**
   * Reset to idle state
   */
  private async reset(): Promise<void> {
    this.currentState = 'idle';
    this.context = null;
    this.apiClient = null;

    await setStorage('state:screenshotInProgress', null);
    await setStorage('state:isProcessing', false);
    await setStorage('state:processingStep', null);
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    // Clear state for terminal or non-processing states
    if (this.currentState === 'idle' || this.currentState === 'complete' || this.currentState === 'error' || !this.context) {
      await setStorage('state:screenshotInProgress', null);
      await setStorage('state:isProcessing', false);
      await setStorage('state:processingStep', null);
      return;
    }

    // Determine if current state is a valid ProcessingStep
    // 'restoring' is internal-only and should not be shown to users
    const validProcessingSteps: ProcessingStep[] = ['validating', 'expanding', 'capturing', 'verifying'];
    const processingStep = validProcessingSteps.includes(this.currentState as ProcessingStep)
      ? (this.currentState as ProcessingStep)
      : null;

    // Only create progress object if we have a valid step
    if (processingStep) {
      const progress: ScreenshotProgress = {
        heatmapId: this.context.heatmapId,
        tabId: this.context.tabId,
        siteId: this.context.siteId,
        step: processingStep,
        startTime: this.context.startTime,
        error: this.context.error,
      };

      await setStorage('state:screenshotInProgress', progress);
      await setStorage('state:isProcessing', true);
      await setStorage('state:processingStep', processingStep);
    } else {
      // For 'restoring' or other non-user-visible states, clear processing indicators
      await setStorage('state:screenshotInProgress', null);
      await setStorage('state:isProcessing', false);
      await setStorage('state:processingStep', null);
    }
  }

  /**
   * Restore state from storage (after extension restart)
   */
  private async restoreFromStorage(): Promise<void> {
    const progress = await getStorage('state:screenshotInProgress');

    if (!progress) return;

    // Check if stale (> 5 minutes)
    if (Date.now() - progress.startTime > 5 * 60 * 1000) {
      logger.warn('StateMachine', 'Found stale process, clearing');
      await this.reset();
      return;
    }

    logger.debug('StateMachine', 'Restoring from storage:', progress);

    this.context = {
      heatmapId: progress.heatmapId,
      tabId: progress.tabId,
      siteId: progress.siteId,
      startTime: progress.startTime,
      error: progress.error,
    };

    // Check if tab still exists
    try {
      await browser.tabs.get(progress.tabId);
    } catch (err) {
      logger.warn('StateMachine', 'Tab no longer exists, cancelling');
      await this.cancel();
      return;
    }

    // Restore API client
    const creds = await getCredentials();
    if (creds) {
      this.apiClient = createMatomoClient(creds.apiUrl, creds.authToken);
    } else {
      logger.error('StateMachine', 'No credentials, cannot restore');
      await this.cancel();
      return;
    }

    // Resume from last step
    this.currentState = progress.step as ScreenshotState;

    // Safety: Don't re-execute risky steps after restart
    if (this.currentState === 'expanding' || this.currentState === 'capturing') {
      logger.warn('StateMachine', 'Unsafe to resume from', this.currentState);
      // Skip directly to verification
      await this.transition('verifying');
    } else {
      // Safe to continue
      await this.executeState();
    }
  }

  /**
   * Get current state (for debugging)
   */
  getState(): ScreenshotState {
    return this.currentState;
  }

  /**
   * Get current context (for debugging)
   */
  getContext(): ScreenshotContext | null {
    return this.context ? { ...this.context } : null;
  }
}
