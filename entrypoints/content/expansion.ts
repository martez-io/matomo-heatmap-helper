/**
 * Element expansion and layout restoration
 */

import { ScrollTracker, type ElementMetadata } from './state';
import {
  storeOriginalState,
  expandElement,
  expandScrollableElement,
  sleep,
} from './dom-utils';
import { logger } from '@/lib/logger';
import { getLockedElements } from './interactive-mode';


/**
 * Restore original styles for non-locked elements only
 * Locked elements maintain their fixer-applied state
 */
function restoreOriginalStyles(): void {
  const lockedElementSet = new Set(getLockedElements());

  ScrollTracker.originalStates.forEach((styles, element) => {
    // Skip locked elements - they have their own restoration via fixers
    if (lockedElementSet.has(element)) {
      return;
    }

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
    logger.debug('Content', 'No elements to expand - skipping expansion');
    return;
  }

  logger.debug('Content', `Expanding ${elementsToExpand.size} elements (${ScrollTracker.scrolledElements.size} scrolled, ${ScrollTracker.lockedElements.size} locked)`);

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

  logger.debug('Content', 'Elements expanded');
}

/**
 * Restore page layout to original state
 */
export function handleRestore(): void {
  logger.debug('Content', 'Restoring layout');

  // Clean up scanner state
  document.documentElement.classList.remove('mhh-scanner-active');

  // Get locked elements count
  const lockedCount = getLockedElements().length;

  // Restore original styles for non-locked elements
  // Locked elements keep their fixer-applied state
  restoreOriginalStyles();

  // Clear scrolled elements and optimize memory
  cleanupScrolledElementsState();

  logger.debug('Content', `Layout restored, ${lockedCount} locked elements preserved`);
}
