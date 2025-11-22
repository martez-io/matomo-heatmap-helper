/**
 * Type-safe messaging utilities for extension communication
 */

import { browser } from 'wxt/browser';
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
      // Check if Matomo exists
      if (typeof window._paq === 'undefined') {
        return {
          success: false,
          error:
            'Matomo (_paq) not found on this page.\\n\\nPlease ensure:\\n• Matomo tracking code is installed\\n• The page has fully loaded\\n• Ad blockers are not blocking Matomo',
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
 * Check if Matomo exists on the page
 */
export async function checkMatomoExists(tabId: number): Promise<boolean> {
  try {
    const result = await executeInPageContext<{ hasMatomо: boolean }>(
      tabId,
      () => {
        return {
          hasMatomо: typeof window._paq !== 'undefined',
        };
      }
    );

    return result.hasMatomо;
  } catch (error) {
    logger.error('Messaging', 'Failed to check Matomo:', error);
    return false;
  }
}

/**
 * Get current active tab
 */
export async function getCurrentTab(): Promise<browser.tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error('No active tab found');
  }
  return tab;
}

// Type augmentation for window._paq
declare global {
  interface Window {
    _paq: any[];
  }
}
