/**
 * Event dispatching for communication with persistent bar
 */

import { ScrollTracker } from './state';
import { fixerRegistry } from './fixers/registry';
import type { SerializedElementInfo } from '@/types/elements';

// Cache for memoization - track source data changes to skip ALL work when unchanged
let lastScrolledSize = 0;
let lastLockedSize = 0;
let lastIsTracking: boolean | null = null;
let lastIsInteractiveMode: boolean | null = null;

/**
 * Serialize element metadata for cross-context communication
 */
function serializeElements(): SerializedElementInfo[] {
  const elements: SerializedElementInfo[] = [];
  const lockedIds = new Set<string>();

  // Add locked elements first (they have priority)
  ScrollTracker.lockedElements.forEach((meta) => {
    lockedIds.add(meta.id);
    // Get applicable fixes for this element
    const fixes = fixerRegistry.getApplicableFixerTitles(meta.element);
    elements.push({
      id: meta.id,
      selector: meta.selector,
      tag: meta.tag,
      hiddenContent: meta.hiddenContent,
      isLocked: true,
      timestamp: meta.firstDetected,
      fixes,
    });
  });

  // Add scrolled elements (excluding those already locked)
  ScrollTracker.scrolledElements.forEach((meta) => {
    if (!lockedIds.has(meta.id)) {
      // Get applicable fixes for this element
      const fixes = fixerRegistry.getApplicableFixerTitles(meta.element);
      elements.push({
        id: meta.id,
        selector: meta.selector,
        tag: meta.tag,
        hiddenContent: meta.hiddenContent,
        isLocked: false,
        timestamp: meta.firstDetected,
        fixes,
      });
    }
  });

  // Sort by timestamp descending (newest first)
  elements.sort((a, b) => b.timestamp - a.timestamp);

  return elements;
}

/**
 * Dispatch status update to persistent bar
 * Uses memoization to skip ALL work when nothing has changed
 */
export function dispatchStatusUpdate(): void {
  // Check source data sizes directly (O(1) operation)
  const currentScrolledSize = ScrollTracker.scrolledElements.size;
  const currentLockedSize = ScrollTracker.lockedElements.size;
  const currentIsTracking = ScrollTracker.isTracking;
  const currentIsInteractiveMode = ScrollTracker.isInteractiveMode;

  // Quick check: determine what has changed
  const elementsChanged = currentScrolledSize !== lastScrolledSize ||
                          currentLockedSize !== lastLockedSize;
  const trackingChanged = currentIsTracking !== lastIsTracking;
  const interactiveChanged = currentIsInteractiveMode !== lastIsInteractiveMode;

  // Early exit if nothing changed - skip ALL work including serialization
  if (!elementsChanged && !trackingChanged && !interactiveChanged) {
    return;
  }

  // Only serialize and dispatch if element counts changed
  if (elementsChanged) {
    lastScrolledSize = currentScrolledSize;
    lastLockedSize = currentLockedSize;
    const elements = serializeElements();
    window.dispatchEvent(
      new CustomEvent('mhh:elementListUpdate', {
        detail: { elements },
      })
    );
  }

  // Dispatch tracking change if needed
  if (trackingChanged) {
    lastIsTracking = currentIsTracking;
    window.dispatchEvent(
      new CustomEvent('mhh:trackingChange', {
        detail: { isTracking: currentIsTracking },
      })
    );
  }

  // Dispatch interactive mode change if needed
  if (interactiveChanged) {
    lastIsInteractiveMode = currentIsInteractiveMode;
    window.dispatchEvent(
      new CustomEvent('mhh:interactiveModeChange', {
        detail: { isInteractive: currentIsInteractiveMode },
      })
    );
  }
}

/**
 * Dispatch error to persistent bar
 */
export function dispatchError(message: string): void {
  const event = new CustomEvent('mhh:error', {
    detail: { message },
  });
  window.dispatchEvent(event);
}

/**
 * Dispatch success to persistent bar
 */
export function dispatchSuccess(): void {
  const event = new CustomEvent('mhh:success', {});
  window.dispatchEvent(event);
}
