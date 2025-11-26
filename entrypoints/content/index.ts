/**
 * Content script entry point
 * Handles page manipulation for Matomo heatmap screenshots
 */

import { browser } from 'wxt/browser';
import type { ContentScriptMessage, ScrollTrackerStatus } from '@/types/messages';
import { ScrollTracker } from './state';
import { handleStartTracking, handleStopTracking } from './scroll-tracking';
import { prepareLayout, restoreLayout } from './layout-prep';
import {
  handleEnterInteractiveMode,
  handleExitInteractiveMode,
  getLockedElementsStatus,
} from './interactive-mode';
import { injectStyles, showScanner, hideScanner, showBorderGlow } from './animations';
import { dispatchStatusUpdate } from './events';
import { logger } from '@/lib/logger';

// Initialize fixers (registers all fixers to the registry)
import './fixers';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  async main() {
    await logger.init(true); // Skip watcher to avoid CSP violations
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
            case 'prepareLayout':
              prepareLayout()
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
              return true; // Async response

            case 'restore':
            case 'restoreLayout':
              restoreLayout();
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

  // Listen for ignore element requests from persistent bar
  window.addEventListener('mhh:ignoreElement', ((event: CustomEvent<{ id: string }>) => {
    const { id } = event.detail;
    handleIgnoreElement(id);
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
 * Handle ignoring an element - removes it from tracking and adds to ignored set
 */
function handleIgnoreElement(elementId: string): void {
  logger.debug('Content', 'Ignoring element:', elementId);

  // Add to ignored set
  ScrollTracker.ignoredElements.add(elementId);

  // Find and remove from scrolledElements
  for (const [element, meta] of ScrollTracker.scrolledElements) {
    if (meta.id === elementId) {
      // Remove visual outline if any
      element.style.outline = '';
      element.style.outlineOffset = '';
      ScrollTracker.scrolledElements.delete(element);
      break;
    }
  }

  // Find and remove from lockedElements (if locked)
  for (const [element, meta] of ScrollTracker.lockedElements) {
    if (meta.id === elementId) {
      // Import and call unlock functionality would be circular, so do it inline
      ScrollTracker.lockedElements.delete(element);
      // Remove any visual indicator classes
      element.classList.remove('mhh-locked-element');
      element.classList.remove('mhh-locked-indicator-before');
      element.classList.remove('mhh-locked-indicator-after');
      // Remove fallback DOM element if exists
      const lockIcon = element.querySelector('.matomo-lock-icon');
      if (lockIcon) lockIcon.remove();
      break;
    }
  }

  // Dispatch update to bar
  dispatchStatusUpdate();
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
