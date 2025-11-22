/**
 * Content script entry point
 * Handles page manipulation for Matomo heatmap screenshots
 */

import { browser } from 'wxt/browser';
import type { ContentScriptMessage, ScrollTrackerStatus } from '@/types/messages';
import { ScrollTracker } from './state';
import { handleStartTracking, handleStopTracking } from './scroll-tracking';
import { handleExpandElements, handleRestore } from './expansion';
import {
  handleEnterInteractiveMode,
  handleExitInteractiveMode,
  getLockedElementsStatus,
} from './interactive-mode';
import { injectStyles, showScanner, hideScanner, showBorderGlow } from './animations';
import { logger } from '@/lib/logger';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  async main() {
    await logger.init();
    logger.debug('Content', 'Content script loaded');

    // Inject styles immediately so lock indicators work
    injectStyles();

    // Setup event listeners for persistent bar communication
    setupBarEventListeners();

    // Listen for messages from popup/background
    browser.runtime.onMessage.addListener(
      (request: ContentScriptMessage, _sender, sendResponse) => {
        logger.debug('Content', 'Message received:', request);

        try {
          switch (request.action) {
            case 'startTracking':
              handleStartTracking(request.heatmapId);
              sendResponse({ success: true });
              break;

            case 'stopTracking':
              handleStopTracking();
              sendResponse({ success: true });
              break;

            case 'getStatus':
              const status = getStatus();
              sendResponse(status);
              break;

            case 'expandElements':
              handleExpandElements()
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
              return true; // Async response

            case 'restore':
              handleRestore();
              sendResponse({ success: true });
              break;

            case 'showScanner':
              showScanner();
              sendResponse({ success: true });
              break;

            case 'hideScanner':
              hideScanner();
              sendResponse({ success: true });
              break;

            case 'showBorderGlow':
              showBorderGlow();
              sendResponse({ success: true });
              break;

            case 'enterInteractiveMode':
              handleEnterInteractiveMode();
              sendResponse({ success: true });
              break;

            case 'exitInteractiveMode':
              handleExitInteractiveMode();
              sendResponse({ success: true });
              break;

            case 'getLockedElements':
              const lockedStatus = getLockedElementsStatus();
              sendResponse(lockedStatus);
              break;

            default:
              sendResponse({ success: false, error: 'Unknown action' });
          }
        } catch (error) {
          logger.error('Content', 'Error handling message:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        return true;
      }
    );
  },
});

/**
 * Setup event listeners for communication with persistent bar
 */
function setupBarEventListeners(): void {
  // Listen for commands from persistent bar
  window.addEventListener('mhh:startTracking', ((event: CustomEvent) => {
    const { heatmapId } = event.detail;
    handleStartTracking(heatmapId);
  }) as EventListener);

  window.addEventListener('mhh:stopTracking', (() => {
    handleStopTracking();
  }) as EventListener);

  window.addEventListener('mhh:toggleInteractiveMode', ((event: CustomEvent) => {
    const { enable } = event.detail;
    if (enable) {
      handleEnterInteractiveMode();
    } else {
      handleExitInteractiveMode();
    }
  }) as EventListener);

  // Legacy event listeners (for backward compatibility)
  window.addEventListener('mhh:enterInteractiveMode', (() => {
    handleEnterInteractiveMode();
  }) as EventListener);

  window.addEventListener('mhh:exitInteractiveMode', (() => {
    handleExitInteractiveMode();
  }) as EventListener);

  logger.debug('Content', 'Bar event listeners setup');
}

/**
 * Get current scroll tracker status
 */
function getStatus(): ScrollTrackerStatus {
  const scrollables = Array.from(ScrollTracker.scrolledElements.values()).map((meta) => ({
    selector: meta.selector,
    hiddenContent: meta.hiddenContent,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
  }));

  return {
    scrolledCount: ScrollTracker.scrolledElements.size,
    scrollables,
    isTracking: ScrollTracker.isTracking,
    isInteractiveMode: ScrollTracker.isInteractiveMode,
    lockedCount: ScrollTracker.lockedElements.size,
  };
}
