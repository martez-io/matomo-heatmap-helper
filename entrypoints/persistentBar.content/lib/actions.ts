/**
 * Action handlers for persistent bar
 * Communicates with main content script via custom events
 */

import { storage } from 'wxt/utils/storage';
import { browser } from 'wxt/browser';
import { logger } from '@/lib/logger';
import type { MatomoHeatmap } from '@/types/matomo';
import type { BarAction } from '../types';

/**
 * Toggle interactive mode (lock mode)
 */
export async function toggleInteractiveMode(
  isCurrentlyInteractive: boolean,
  dispatch: React.Dispatch<BarAction>
) {
  logger.debug('Actions', 'Toggling interactive mode:', !isCurrentlyInteractive);

  // Dispatch custom event to main content script
  window.dispatchEvent(
    new CustomEvent('mhh:toggleInteractiveMode', {
      detail: { enable: !isCurrentlyInteractive },
    })
  );

  // Update local state immediately for responsiveness
  dispatch({
    type: 'SET_INTERACTIVE_MODE',
    payload: !isCurrentlyInteractive,
  });
}

/**
 * Handle heatmap selection
 */
export async function selectHeatmap(
  heatmap: MatomoHeatmap,
  dispatch: React.Dispatch<BarAction>
) {
  logger.debug('Actions', 'Selecting heatmap:', heatmap.idsitehsr);

  // Save to storage
  await storage.setItem('local:ui:selectedHeatmapId', heatmap.idsitehsr);

  // Update local state
  dispatch({
    type: 'SELECT_HEATMAP',
    payload: heatmap,
  });

  // Dispatch event to main content script to start tracking
  window.dispatchEvent(
    new CustomEvent('mhh:startTracking', {
      detail: { heatmapId: heatmap.idsitehsr },
    })
  );

  dispatch({
    type: 'SET_TRACKING',
    payload: true,
  });
}

/**
 * Handle screenshot request
 */
export async function takeScreenshot(
  heatmap: MatomoHeatmap,
  siteId: number,
  dispatch: React.Dispatch<BarAction>
) {
  logger.debug('Actions', 'Taking screenshot for heatmap:', heatmap.idsitehsr);

  try {
    // Clear any existing errors
    dispatch({ type: 'CLEAR_ERROR' });

    // Set processing state
    dispatch({ type: 'SET_PROCESSING', payload: true });
    dispatch({ type: 'SET_PROCESSING_STEP', payload: 'validating' });

    // Send message to background worker to execute screenshot
    const response = await browser.runtime.sendMessage({
      action: 'executeScreenshot',
      heatmapId: heatmap.idsitehsr,
      siteId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Screenshot failed');
    }

    logger.debug('Actions', 'Screenshot completed successfully');

    // Processing will be updated via storage watchers
    // Background worker will handle tab creation after border glow
  } catch (error) {
    logger.error('Actions', 'Screenshot failed:', error);

    dispatch({
      type: 'SET_ERROR',
      payload: error instanceof Error ? error.message : 'Unknown error',
    });

    dispatch({ type: 'SET_PROCESSING', payload: false });
    dispatch({ type: 'SET_PROCESSING_STEP', payload: null });
  }
}

/**
 * Dismiss error message
 */
export function dismissError(dispatch: React.Dispatch<BarAction>) {
  logger.debug('Actions', 'Dismissing error');
  dispatch({ type: 'CLEAR_ERROR' });
}

/**
 * Toggle minimized state
 */
export function toggleMinimized(
  isCurrentlyMinimized: boolean,
  dispatch: React.Dispatch<BarAction>
) {
  logger.debug('Actions', 'Toggling minimized:', !isCurrentlyMinimized);
  dispatch({
    type: 'SET_MINIMIZED',
    payload: !isCurrentlyMinimized,
  });
}

/**
 * Open settings page in new tab
 */
export async function openSettings(dispatch: React.Dispatch<BarAction>) {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'openSettings',
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to open settings');
    }

    logger.debug('Actions', 'Settings tab opened');
  } catch (error) {
    logger.error('Actions', 'Failed to open settings:', error);

    dispatch({
      type: 'SET_ERROR',
      payload: error instanceof Error ? error.message : 'Failed to open settings',
    });
  }
}

/**
 * Open bug report page in new tab
 */
export async function openBugReport(dispatch: React.Dispatch<BarAction>) {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'openBugReport',
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to open bug report');
    }

    logger.debug('Actions', 'Bug report tab opened');
  } catch (error) {
    logger.error('Actions', 'Failed to open bug report:', error);

    dispatch({
      type: 'SET_ERROR',
      payload: error instanceof Error ? error.message : 'Failed to open bug report',
    });
  }
}

/**
 * Close the persistent bar by toggling state:barVisible and reloading page
 */
export async function closeBar(dispatch: React.Dispatch<BarAction>) {
  try {
    // Stop tracking and cleanup scroll listeners before closing
    window.dispatchEvent(new CustomEvent('mhh:stopTracking'));

    // Toggle bar visibility in storage
    await storage.setItem('local:state:barVisible', false);

    logger.debug('Actions', 'Closing bar and reloading page');

    // Reload page so persistent bar content script re-initializes
    // and checks the barVisible setting (which is now false)
    window.location.reload();
  } catch (error) {
    logger.error('Actions', 'Failed to close bar:', error);

    dispatch({
      type: 'SET_ERROR',
      payload: error instanceof Error ? error.message : 'Failed to close bar',
    });
  }
}
