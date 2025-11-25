/**
 * DOM manipulation utilities for content script
 */

import { ScrollTracker, type ElementMetadata } from './state';

/**
 * Store original state of an element before modification
 */
export function storeOriginalState(element: HTMLElement): void {
  if (!ScrollTracker.originalStates.has(element)) {
    ScrollTracker.originalStates.set(element, {
      height: element.style.height,
      minHeight: element.style.minHeight,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      overflowY: element.style.overflowY,
      position: element.style.position,
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
    });
  }
}

/**
 * Expand a generic element (remove height constraints)
 */
export function expandElement(element: HTMLElement): void {
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

/**
 * Expand a scrollable element to its full scroll height
 */
export function expandScrollableElement(element: HTMLElement, meta: ElementMetadata): void {
  element.style.height = 'auto';
  element.style.minHeight = `${meta.scrollHeight}px`;
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

/**
 * Get a CSS selector for an element
 */
export function getElementSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className
      .split(' ')
      .filter((c) => c)
      .slice(0, 2)
      .join('.');
    if (classes) return `.${classes}`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Find parent elements that constrain the height of an element
 */
export function findConstrainingParents(
  element: HTMLElement
): Array<{ element: HTMLElement; selector: string }> {
  const parents: Array<{ element: HTMLElement; selector: string }> = [];
  let current = element.parentElement;

  while (current && current !== document.documentElement) {
    const styles = window.getComputedStyle(current);

    const isConstraining =
      styles.height === '100vh' ||
      styles.height === '100%' ||
      styles.maxHeight !== 'none' ||
      styles.overflow === 'hidden' ||
      styles.overflowY === 'hidden' ||
      (parseFloat(styles.height) > 0 && parseFloat(styles.height) < element.scrollHeight);

    if (isConstraining) {
      parents.push({
        element: current,
        selector: getElementSelector(current),
      });
    }

    current = current.parentElement;
  }

  return parents;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an element is part of the persistent bar's Shadow DOM
 */
export function isPartOfPersistentBar(element: HTMLElement): boolean {
  // Check if element IS the shadow host
  if (element.tagName === 'MATOMO-HEATMAP-HELPER-BAR') {
    return true;
  }

  // Check if element is INSIDE the shadow DOM
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    const host = root.host as HTMLElement;
    if (host.tagName === 'MATOMO-HEATMAP-HELPER-BAR') {
      return true;
    }
  }

  // Additional check using data attribute (defense in depth)
  if (element.dataset.mhhPersistentBar) {
    return true;
  }

  return false;
}

