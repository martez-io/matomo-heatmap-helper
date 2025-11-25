/**
 * State management for element fix results
 */

import type { ElementFixResult } from './types';

/**
 * Map of elements to their fix results
 * Replaces the current originalStates pattern for locked elements
 */
export const elementFixResults = new Map<HTMLElement, ElementFixResult>();

/**
 * Store a fix result for an element
 */
export function storeFixResult(element: HTMLElement, result: ElementFixResult): void {
  elementFixResults.set(element, result);
}

/**
 * Get stored fix result for an element
 */
export function getFixResult(element: HTMLElement): ElementFixResult | undefined {
  return elementFixResults.get(element);
}

/**
 * Check if an element has fix results
 */
export function hasFixResult(element: HTMLElement): boolean {
  return elementFixResults.has(element);
}

/**
 * Restore and remove fix result for an element
 */
export function restoreAndRemove(element: HTMLElement): boolean {
  const result = elementFixResults.get(element);
  if (result) {
    result.restoreAll();
    elementFixResults.delete(element);
    return true;
  }
  return false;
}

/**
 * Clear all fix results (restore all elements)
 */
export function clearAllFixResults(): void {
  elementFixResults.forEach((result) => result.restoreAll());
  elementFixResults.clear();
}

/**
 * Get count of elements with fix results
 */
export function getFixResultCount(): number {
  return elementFixResults.size;
}
