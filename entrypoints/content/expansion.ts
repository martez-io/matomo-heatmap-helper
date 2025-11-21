/**
 * Element expansion and layout restoration
 */

import { ScrollTracker, type ElementMetadata } from './state';
import {
  storeOriginalState,
  expandElement,
  expandScrollableElement,
  applyLockIndicator,
  sleep,
} from './dom-utils';

/**
 * Remove lock indicators temporarily during restore
 */
function removeLockIndicatorsTemporarily(lockedElements: HTMLElement[]): void {
  lockedElements.forEach((element) => {
    element.classList.remove('mhh-locked-element');
    element.classList.remove('mhh-locked-indicator-before');
    element.classList.remove('mhh-locked-indicator-after');

    const lockIcon = element.querySelector('.matomo-lock-icon');
    if (lockIcon) {
      lockIcon.remove();
    }
  });
}

/**
 * Restore original styles for all elements
 */
function restoreOriginalStyles(): void {
  ScrollTracker.originalStates.forEach((styles, element) => {
    Object.entries(styles).forEach(([prop, value]) => {
      (element.style as any)[prop] = value;
    });
  });
}

/**
 * Clean up scrolled elements and memory
 */
function cleanupScrolledElementsState(): void {
  ScrollTracker.scrolledElements.clear();
  ScrollTracker.isTracking = false;

  // Clean up originalStates for non-locked elements (memory optimization)
  ScrollTracker.originalStates.forEach((_styles, element) => {
    if (!ScrollTracker.lockedElements.has(element)) {
      ScrollTracker.originalStates.delete(element);
    }
  });
}

/**
 * Re-apply lock indicators after restore
 */
function reapplyLockIndicators(lockedElements: HTMLElement[]): number {
  let preservedCount = 0;

  lockedElements.forEach((element) => {
    // Check if element still exists in DOM
    if (!document.body.contains(element)) {
      console.warn(`[Content] Locked element removed from DOM, cleaning up`);
      ScrollTracker.lockedElements.delete(element);
      ScrollTracker.originalStates.delete(element);
      return;
    }

    const meta = ScrollTracker.lockedElements.get(element);
    if (!meta) return;

    const indicatorType = element.dataset.mhhLockIndicator as 'before' | 'after' | 'fallback';
    applyLockIndicator(element, indicatorType);
    preservedCount++;
  });

  return preservedCount;
}

/**
 * Expand all tracked scrollable elements
 */
export async function handleExpandElements(): Promise<void> {
  ScrollTracker.isTracking = false;

  // Merge locked and scrolled elements (avoiding duplicates)
  const elementsToExpand = new Map<HTMLElement, ElementMetadata>();

  // Add scrolled elements
  ScrollTracker.scrolledElements.forEach((meta, element) => {
    elementsToExpand.set(element, meta);
  });

  // Add locked elements (will override if already in map)
  ScrollTracker.lockedElements.forEach((meta, element) => {
    elementsToExpand.set(element, meta);
  });

  if (elementsToExpand.size === 0) {
    console.log('[Matomo Heatmap Helper] No elements to expand - skipping expansion');
    return;
  }

  console.log(
    `[Matomo Heatmap Helper] Expanding ${elementsToExpand.size} elements (${ScrollTracker.scrolledElements.size} scrolled, ${ScrollTracker.lockedElements.size} locked)`
  );

  // Store and expand html/body
  storeOriginalState(document.documentElement);
  storeOriginalState(document.body);
  expandElement(document.documentElement);
  expandElement(document.body);

  // Expand each element and its parents
  elementsToExpand.forEach((meta, element) => {
    // Remove visual indicators
    element.style.outline = '';
    element.style.outlineOffset = '';

    // Remove lock icon if present
    const lockIcon = element.querySelector('.matomo-lock-icon');
    if (lockIcon) {
      lockIcon.remove();
    }

    // Expand element (original state already stored)
    expandScrollableElement(element, meta);

    // Expand parents
    meta.parents.forEach((parentInfo) => {
      storeOriginalState(parentInfo.element);
      expandElement(parentInfo.element);
    });
  });

  // Force reflow
  document.body.offsetHeight;

  // Wait for rendering
  await sleep(500);

  console.log('[Matomo Heatmap Helper] Elements expanded');
}

/**
 * Restore page layout to original state
 */
export function handleRestore(): void {
  console.log('[Matomo Heatmap Helper] Restoring layout');

  // Clean up scanner state
  document.documentElement.classList.remove('mhh-scanner-active');

  // Extract locked elements before removing indicators
  const lockedElements = Array.from(ScrollTracker.lockedElements.keys());

  // Remove lock indicators temporarily for clean restore
  removeLockIndicatorsTemporarily(lockedElements);

  // Restore original styles for all elements
  restoreOriginalStyles();

  // Clear scrolled elements and optimize memory
  cleanupScrolledElementsState();

  // Re-apply lock indicators to preserved elements
  const preservedCount = reapplyLockIndicators(lockedElements);

  console.log(
    `[Matomo Heatmap Helper] Layout restored, ${preservedCount} locked elements preserved`
  );
}
