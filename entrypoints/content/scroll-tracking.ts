/**
 * Scroll tracking functionality
 */

import { ScrollTracker, type ElementMetadata } from './state';
import { storeOriginalState, getElementSelector, findConstrainingParents } from './dom-utils';
import { dispatchStatusUpdate } from './events';

/**
 * Handle scroll events on elements
 */
export function handleScroll(event: Event): void {
  if (!ScrollTracker.isTracking) return;

  const element = event.target as HTMLElement;

  // Skip document/window
  if (element === document.documentElement || element === document.body) return;

  // Check if element has scrollable content
  if (element.scrollHeight <= element.clientHeight) return;

  // Add to registry if not already there
  if (!ScrollTracker.scrolledElements.has(element)) {
    // Skip if element is already locked (prioritize locked state)
    if (ScrollTracker.lockedElements.has(element)) {
      return;
    }

    // Store original state BEFORE any modifications
    storeOriginalState(element);

    const selector = getElementSelector(element);
    const parents = findConstrainingParents(element);

    const metadata: ElementMetadata = {
      element,
      selector,
      tag: element.tagName.toLowerCase(),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      hiddenContent: element.scrollHeight - element.clientHeight,
      parents,
      firstDetected: Date.now(),
    };

    ScrollTracker.scrolledElements.set(element, metadata);

    console.log(`[Matomo Heatmap Helper] Detected: ${selector}`);

    // Notify persistent bar
    dispatchStatusUpdate();
  }
}

/**
 * Remove scroll listeners from all tracked elements
 */
export function removeScrollListeners(): void {
  if (ScrollTracker.elementsWithListeners.length === 0) {
    return;
  }

  ScrollTracker.elementsWithListeners.forEach((el) => {
    el.removeEventListener('scroll', handleScroll);
  });

  console.log(
    `[Matomo Heatmap Helper] Removed ${ScrollTracker.elementsWithListeners.length} scroll listeners`
  );

  // Clear the list
  ScrollTracker.elementsWithListeners = [];
}

/**
 * Start tracking scrolls on the page
 */
export function handleStartTracking(heatmapId: number): void {
  // Clean up any existing listeners first
  removeScrollListeners();

  ScrollTracker.heatmapId = heatmapId;
  ScrollTracker.isTracking = true;
  ScrollTracker.startTime = Date.now();
  ScrollTracker.scrolledElements.clear();

  // Attach scroll listeners to all elements and store references
  const allElements = document.querySelectorAll('*');
  ScrollTracker.elementsWithListeners = Array.from(allElements);

  ScrollTracker.elementsWithListeners.forEach((el) => {
    el.addEventListener('scroll', handleScroll, { passive: true });
  });

  console.log(
    `[Matomo Heatmap Helper] Tracking started (${ScrollTracker.elementsWithListeners.length} listeners attached)`
  );

  // Notify persistent bar
  dispatchStatusUpdate();
}

/**
 * Stop tracking and clear state
 */
export function handleStopTracking(): void {
  ScrollTracker.isTracking = false;

  // Remove visual outlines from all tracked elements
  ScrollTracker.scrolledElements.forEach((metadata) => {
    metadata.element.style.outline = '';
    metadata.element.style.outlineOffset = '';
  });

  // Remove all scroll listeners
  removeScrollListeners();

  // Clear tracked elements
  ScrollTracker.scrolledElements.clear();

  console.log('[Matomo Heatmap Helper] Tracking stopped and state cleared');

  // Notify persistent bar
  dispatchStatusUpdate();
}
