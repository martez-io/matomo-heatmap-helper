/**
 * Type-safe messaging utilities for extension communication
 */

import { browser, type Browser } from 'wxt/browser';
import type {
  ContentScriptMessage,
  ContentScriptResponse,
  BackgroundMessage,
  BackgroundResponse,
  MatomoPageContextResponse,
} from '@/types/messages';
import { logger } from './logger';

/**
 * Send a message to a content script with type safety
 */
export async function sendToContentScript(
  tabId: number,
  message: ContentScriptMessage
): Promise<ContentScriptResponse> {
  return new Promise((resolve, reject) => {
    browser.tabs.sendMessage(tabId, message, (response: ContentScriptResponse) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to the background worker
 */
export async function sendToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(message, (response: BackgroundResponse) => {
      if (browser.runtime.lastError) {
        reject(new Error(browser.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Execute script in page context (MAIN world) for Matomo API calls
 */
export async function executeInPageContext<T = any>(
  tabId: number,
  func: (...args: any[]) => T,
  args: any[] = []
): Promise<T> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN', // Run in page context to access window._paq
    func,
    args,
  });

  if (!results || results.length === 0) {
    throw new Error('Script execution failed - no results returned');
  }

  return results[0].result as T;
}

/**
 * Trigger Matomo screenshot capture
 */
export async function triggerMatomoScreenshot(
  tabId: number,
  heatmapId: number
): Promise<MatomoPageContextResponse> {
  return executeInPageContext<MatomoPageContextResponse>(
    tabId,
    (heatmapIdParam: number) => {
      // Check if Matomo _paq exists
      if (typeof window._paq === 'undefined') {
        return {
          success: false,
          error:
            'Matomo (_paq) not found on this page.\n\nPlease ensure:\n• Matomo tracking code is installed\n• The page has fully loaded\n• Ad blockers are not blocking Matomo',
        };
      }

      // Check if Matomo core is loaded
      if (typeof window.Matomo === 'undefined') {
        return {
          success: false,
          error: 'Matomo core not loaded. The tracking script may still be loading.',
        };
      }

      // Check if HeatmapSessionRecording plugin is available
      if (typeof window.Matomo.HeatmapSessionRecording === 'undefined') {
        return {
          success: false,
          error: 'HeatmapSessionRecording plugin not loaded.\n\nEnsure the Heatmap & Session Recording plugin is installed and enabled on your Matomo instance.',
        };
      }

      // Trigger screenshot
      window._paq.push(['HeatmapSessionRecording::captureInitialDom', parseInt(String(heatmapIdParam))]);
      window._paq.push(['HeatmapSessionRecording::enable']);

      return { success: true };
    },
    [heatmapId]
  );
}

/**
 * Clean existing Matomo scripts and inject enforced tracker.
 * Waits for both matomo.js and HeatmapSessionRecording to load before returning.
 */
export async function cleanAndInjectTracker(
  tabId: number,
  trackerUrl: string,
  siteId: number
): Promise<{ success: boolean; error?: string }> {
  // Normalize URL - remove trailing slashes to prevent double-slash issues
  const normalizedUrl = trackerUrl.replace(/\/+$/, '');
  const SCRIPT_LOAD_TIMEOUT_MS = 10000;

  try {
    return await executeInPageContext<Promise<{ success: boolean; error?: string }>>(
      tabId,
      (url: string, id: number, timeoutMs: number) => {
        return new Promise((resolve) => {
          // STEP 1: Remove existing Matomo scripts (clean slate)
          const existingScripts = document.querySelectorAll(
            'script[src*="matomo.js"], script[src*="/matomo/"], script[src*="piwik.js"], script[src*="HeatmapSessionRecording"]'
          );
          existingScripts.forEach((el) => el.remove());

          // Also clear existing Matomo global
          if (typeof window.Matomo !== 'undefined') {
            try {
              // @ts-ignore - clearing global
              delete window.Matomo;
            } catch (e) {
              // Some browsers may not allow deletion
            }
          }

          // STEP 2: Reset _paq to fresh array
          window._paq = [];

          // STEP 3: Configure tracker
          window._paq.push(['setTrackerUrl', url + '/matomo.php']);
          window._paq.push(['setSiteId', id]);
          window._paq.push(['enableLinkTracking']);

          // STEP 4: Track script loading state
          let loadedCount = 0;
          let errorOccurred = false;
          const SCRIPTS_TO_LOAD = 2;

          const checkComplete = () => {
            if (loadedCount === SCRIPTS_TO_LOAD && !errorOccurred) {
              resolve({ success: true });
            }
          };

          const handleError = (scriptName: string, scriptUrl: string) => {
            if (!errorOccurred) {
              errorOccurred = true;
              resolve({
                success: false,
                error: `Failed to load ${scriptName} from ${scriptUrl}. Check if the URL is correct and the server allows cross-origin requests.`,
              });
            }
          };

          // STEP 5: Inject matomo.js core library
          const matomoScript = document.createElement('script');
          matomoScript.async = true;
          matomoScript.src = url + '/matomo.js';
          matomoScript.setAttribute('data-mhh-enforced', 'true');
          matomoScript.onload = () => {
            loadedCount++;
            checkComplete();
          };
          matomoScript.onerror = () => handleError('matomo.js', matomoScript.src);
          document.head.appendChild(matomoScript);

          // STEP 6: Inject HeatmapSessionRecording plugin
          const heatmapScript = document.createElement('script');
          heatmapScript.async = true;
          heatmapScript.src = url + '/plugins/HeatmapSessionRecording/tracker.min.js';
          heatmapScript.setAttribute('data-mhh-enforced', 'true');
          heatmapScript.onload = () => {
            loadedCount++;
            checkComplete();
          };
          heatmapScript.onerror = () => handleError('HeatmapSessionRecording', heatmapScript.src);
          document.head.appendChild(heatmapScript);

          // STEP 7: Timeout fallback
          setTimeout(() => {
            if (loadedCount < SCRIPTS_TO_LOAD && !errorOccurred) {
              resolve({
                success: false,
                error: `Timeout loading Matomo scripts (${loadedCount}/${SCRIPTS_TO_LOAD} loaded). The server may be unreachable or blocked by the page's Content Security Policy.`,
              });
            }
          }, timeoutMs);
        });
      },
      [normalizedUrl, siteId, SCRIPT_LOAD_TIMEOUT_MS]
    );
  } catch (error) {
    logger.error('Messaging', 'Failed to inject enforced tracker:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wait for Matomo and HeatmapSessionRecording plugin to load
 */
export async function waitForMatomoReady(
  tabId: number,
  timeoutMs: number = 10000
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 200; // Check every 200ms

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await executeInPageContext<{
        ready: boolean;
        hasHeatmap: boolean;
        matomoExists: boolean;
        debugInfo?: string;
      }>(tabId, () => {
        // Check if Matomo core loaded
        const matomoExists = typeof window.Matomo !== 'undefined';

        if (!matomoExists) {
          return { ready: false, hasHeatmap: false, matomoExists: false, debugInfo: 'Matomo global not found' };
        }

        // Check if we can get a tracker instance
        let hasTracker = false;
        try {
          const tracker = window.Matomo.getAsyncTracker();
          hasTracker = tracker !== null;
        } catch (e) {
          return { ready: false, hasHeatmap: false, matomoExists: true, debugInfo: 'Tracker not ready yet' };
        }

        if (!hasTracker) {
          return { ready: false, hasHeatmap: false, matomoExists: true, debugInfo: 'No tracker instance' };
        }

        // Check if HeatmapSessionRecording plugin is loaded and has required methods
        // The plugin can be registered either globally on Matomo or via _paq commands
        const hsrExists = typeof window.Matomo.HeatmapSessionRecording !== 'undefined';

        // The most reliable check: verify the plugin registered its static methods
        // HeatmapSessionRecording::captureInitialDom should be callable via _paq
        // We can also check if the global namespace has the plugin
        const hasHeatmap = hsrExists;

        return {
          ready: true,
          hasHeatmap,
          matomoExists: true,
          debugInfo: hasHeatmap ? 'HeatmapSessionRecording ready' : 'HeatmapSessionRecording not found',
        };
      });

      if (result.ready && result.hasHeatmap) {
        logger.debug('Messaging', 'Matomo ready with Heatmap plugin');
        return { success: true };
      }

      if (result.matomoExists && !result.hasHeatmap) {
        logger.debug('Messaging', 'Matomo loaded, waiting for Heatmap plugin...', result.debugInfo);
        // Continue polling - plugin might still be loading
      }

      // Not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      logger.error('Messaging', 'Error checking Matomo readiness:', error);
      // Continue polling - might be temporary error
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout reached - provide more specific error
  const finalCheck = await executeInPageContext<{ matomoExists: boolean; hsrExists: boolean }>(tabId, () => {
    return {
      matomoExists: typeof window.Matomo !== 'undefined',
      hsrExists: typeof window.Matomo?.HeatmapSessionRecording !== 'undefined',
    };
  }).catch(() => ({ matomoExists: false, hsrExists: false }));

  let errorMsg = 'Timeout waiting for Matomo to load.';
  if (!finalCheck.matomoExists) {
    errorMsg = 'Failed to load Matomo core (matomo.js). Check if the URL is correct and accessible.';
  } else if (!finalCheck.hsrExists) {
    errorMsg = 'Matomo loaded but HeatmapSessionRecording plugin not found. Ensure the plugin is installed and enabled on your instance.';
  }

  logger.error('Messaging', `Timeout (${timeoutMs}ms):`, errorMsg);
  return {
    success: false,
    error: errorMsg,
  };
}

/**
 * Check if Matomo exists on the page
 */
export async function checkMatomoExists(tabId: number): Promise<boolean> {
  try {
    const result = await executeInPageContext<{ hasMatomo: boolean }>(
      tabId,
      () => {
        return {
          hasMatomo: typeof window._paq !== 'undefined',
        };
      }
    );

    return result.hasMatomo;
  } catch (error) {
    logger.error('Messaging', 'Failed to check Matomo:', error);
    return false;
  }
}

/**
 * Get current active tab
 */
export async function getCurrentTab(): Promise<Browser.tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error('No active tab found');
  }
  return tab;
}

// Type augmentation for window._paq and Matomo
declare global {
  interface Window {
    _paq: any[];
    Matomo: {
      getAsyncTracker: () => any;
      HeatmapSessionRecording?: any;
      [key: string]: any;
    };
  }
}
