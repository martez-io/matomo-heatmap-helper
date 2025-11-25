/**
 * Interactive mode for manually locking/unlocking elements
 */

import { setStorage } from '@/lib/storage';
import type { LockedElementData } from '@/types/storage';
import { ScrollTracker, type ElementMetadata } from './state';
import {
  getElementSelector,
  findConstrainingParents,
  isPartOfPersistentBar,
} from './dom-utils';
import { dispatchStatusUpdate } from './events';
import { logger } from '@/lib/logger';
import {
  applyFixers,
  storeFixResult,
  restoreAndRemove,
  applyLockVisualIndicator,
  type LockIndicatorResult,
} from './fixers';

/**
 * Map to track lock indicators for each element
 */
const lockIndicators = new Map<HTMLElement, LockIndicatorResult>();

/**
 * Sync state to storage
 */
async function syncStateToStorage(): Promise<void> {
  await setStorage('state:isInteractiveMode', ScrollTracker.isInteractiveMode);

  const lockedElements: LockedElementData[] = Array.from(
    ScrollTracker.lockedElements.values()
  ).map((meta) => ({
    selector: meta.selector,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
  }));
  await setStorage('state:lockedElements', lockedElements);
}

/**
 * Lock an element using the fixer pipeline
 */
async function lockElement(element: HTMLElement): Promise<void> {
  // Apply all relevant fixers via pipeline (async for CORS and other async fixers)
  const fixResult = await applyFixers(element);
  storeFixResult(element, fixResult);

  // Apply visual lock indicator (separate from fixers)
  const indicatorResult = applyLockVisualIndicator(element);
  lockIndicators.set(element, indicatorResult);

  // Get element info for metadata
  const computedHeight = element.scrollHeight;
  const computedClientHeight = element.clientHeight;
  const selector = getElementSelector(element);
  const parents = findConstrainingParents(element);

  // Store metadata in ScrollTracker for UI/sync
  const metadata: ElementMetadata = {
    element,
    selector,
    tag: element.tagName.toLowerCase(),
    scrollHeight: computedHeight,
    clientHeight: computedClientHeight,
    hiddenContent: computedHeight - computedClientHeight,
    parents,
    firstDetected: Date.now(),
  };

  ScrollTracker.lockedElements.set(element, metadata);

  const appliedFixerIds = fixResult.appliedFixers.map((f) => f.fixerId).join(', ');
  logger.debug(
    'Content',
    `Locked: ${selector} (fixers: ${appliedFixerIds || 'none'}, indicator: ${indicatorResult.indicatorType})`
  );

  // Notify persistent bar
  dispatchStatusUpdate();
}

/**
 * Unlock an element using self-contained restore functions
 */
function unlockElement(element: HTMLElement): void {
  // Remove from locked elements
  ScrollTracker.lockedElements.delete(element);

  // Remove visual indicator
  const indicatorResult = lockIndicators.get(element);
  if (indicatorResult) {
    indicatorResult.remove();
    lockIndicators.delete(element);
  }

  // Restore all fixers (self-contained restoration)
  restoreAndRemove(element);

  logger.debug('Content', `Unlocked: ${getElementSelector(element)}`);
}

/**
 * Handle hover events in interactive mode
 */
function handleInteractiveHover(event: MouseEvent): void {
  // Skip if scanner is active
  if (document.documentElement.classList.contains('mhh-scanner-active')) {
    return;
  }

  const element = event.target as HTMLElement;

  // Skip our own elements
  if (element.id === 'matomo-highlight-overlay' || element.id === 'matomo-element-tooltip') {
    return;
  }

  // Skip persistent bar elements
  if (isPartOfPersistentBar(element)) {
    return;
  }

  const highlight = document.getElementById('matomo-highlight-overlay');
  const tooltip = document.getElementById('matomo-element-tooltip');
  if (!highlight || !tooltip) return;

  // Get element bounds
  const rect = element.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  // Check if element is locked
  const isLocked = ScrollTracker.lockedElements.has(element);

  // Position and style highlight overlay
  highlight.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollLeft}px;
    top: ${rect.top + scrollTop}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background: ${isLocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
    border: 2px solid ${isLocked ? '#10b981' : '#3b82f6'};
    pointer-events: none;
    z-index: 999991;
    display: block;
    box-sizing: border-box;
  `;

  // Create element info text
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classList =
    element.className && typeof element.className === 'string'
      ? `.${element.className
          .split(' ')
          .filter((c) => c)
          .slice(0, 2)
          .join('.')}`
      : '';
  const dimensions = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  const lockStatus = isLocked ? ' 🔒' : '';

  const infoText = `${tagName}${id}${classList} ${dimensions}${lockStatus}`;

  // Position tooltip above element, or below if not enough space
  const tooltipTop = rect.top > 30 ? rect.top + scrollTop - 25 : rect.bottom + scrollTop + 5;

  tooltip.textContent = infoText;
  tooltip.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollLeft}px;
    top: ${tooltipTop}px;
    pointer-events: none;
    z-index: 999992;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 11px;
    white-space: nowrap;
    display: block;
  `;

  // Change cursor
  document.body.style.cursor = 'pointer';
}

/**
 * Handle hover out events in interactive mode
 */
function handleInteractiveHoverOut(_event: MouseEvent): void {
  // Skip if scanner is active
  if (document.documentElement.classList.contains('mhh-scanner-active')) {
    return;
  }

  const highlight = document.getElementById('matomo-highlight-overlay');
  const tooltip = document.getElementById('matomo-element-tooltip');

  if (highlight) highlight.style.display = 'none';
  if (tooltip) tooltip.style.display = 'none';

  document.body.style.cursor = '';
}

/**
 * Handle click events in interactive mode
 */
function handleInteractiveClick(event: MouseEvent): void {
  let element = event.target as HTMLElement;

  // Skip our own elements
  if (element.id === 'matomo-highlight-overlay' || element.id === 'matomo-element-tooltip') {
    return;
  }

  // If clicked element is a lock indicator, find the locked parent
  if (element.classList.contains('matomo-lock-icon')) {
    const parent = element.parentElement;
    if (parent && ScrollTracker.lockedElements.has(parent)) {
      element = parent; // Use the parent instead
    } else {
      return; // Invalid state, ignore click
    }
  }

  // Skip persistent bar elements - allow normal click behavior
  if (isPartOfPersistentBar(element)) {
    return;
  }

  // Prevent default behavior ONLY for page elements (not persistent bar)
  // These must be called synchronously before any async operations
  event.preventDefault();
  event.stopPropagation();

  // Toggle lock state (async operation)
  const toggleLock = async () => {
    if (ScrollTracker.lockedElements.has(element)) {
      // Unlock (synchronous)
      unlockElement(element);
    } else {
      // Lock (async - may fetch CORS resources)
      await lockElement(element);
    }

    // Sync state to storage
    await syncStateToStorage();

    // Notify persistent bar
    dispatchStatusUpdate();

    // Trigger hover event to update visual feedback
    handleInteractiveHover(event);
  };

  // Execute async operation (errors logged internally by fixers)
  toggleLock().catch((err) => {
    logger.error('Content', 'Error toggling element lock:', err);
  });
}

/**
 * Handle keydown events in interactive mode
 */
function handleInteractiveKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    handleExitInteractiveMode();
  }
}

/**
 * Enter interactive mode for locking elements
 */
export function handleEnterInteractiveMode(): void {
  if (ScrollTracker.isInteractiveMode) {
    logger.debug('Content', 'Interactive mode already active');
    return;
  }

  ScrollTracker.isInteractiveMode = true;
  syncStateToStorage(); // Sync to storage
  dispatchStatusUpdate(); // Notify persistent bar

  // Create highlight overlay container (will be positioned over hovered elements)
  const highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'matomo-highlight-overlay';
  highlightOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999991;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(highlightOverlay);

  // Create element info tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'matomo-element-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999992;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 11px;
    white-space: nowrap;
    display: none;
  `;
  document.body.appendChild(tooltip);

  // Attach event listeners
  document.addEventListener('mouseover', handleInteractiveHover, true);
  document.addEventListener('mouseout', handleInteractiveHoverOut, true);
  document.addEventListener('click', handleInteractiveClick, true);
  document.addEventListener('keydown', handleInteractiveKeydown);

  logger.debug('Content', 'Interactive mode enabled');
}

/**
 * Exit interactive mode
 */
export function handleExitInteractiveMode(): void {
  if (!ScrollTracker.isInteractiveMode) return;

  ScrollTracker.isInteractiveMode = false;
  syncStateToStorage(); // Sync to storage
  dispatchStatusUpdate(); // Notify persistent bar

  // Remove highlight overlay and tooltip
  const highlight = document.getElementById('matomo-highlight-overlay');
  if (highlight) highlight.remove();

  const tooltip = document.getElementById('matomo-element-tooltip');
  if (tooltip) tooltip.remove();

  // Remove event listeners
  document.removeEventListener('mouseover', handleInteractiveHover, true);
  document.removeEventListener('mouseout', handleInteractiveHoverOut, true);
  document.removeEventListener('click', handleInteractiveClick, true);
  document.removeEventListener('keydown', handleInteractiveKeydown);

  // Reset cursor to default
  document.body.style.cursor = '';

  logger.debug('Content', 'Interactive mode disabled');
}

/**
 * Get status of locked elements
 */
export function getLockedElementsStatus(): {
  lockedCount: number;
  lockedElements: Array<{
    selector: string;
    scrollHeight: number;
    clientHeight: number;
    isScrollable: boolean;
  }>;
} {
  const lockedElements = Array.from(ScrollTracker.lockedElements.values()).map((meta) => ({
    selector: meta.selector,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
    isScrollable: meta.hiddenContent > 0,
  }));

  return {
    lockedCount: ScrollTracker.lockedElements.size,
    lockedElements,
  };
}

/**
 * Temporarily hide lock indicators (for screenshots)
 * Returns a function to restore them
 */
export function hideLockIndicatorsTemporarily(): () => void {
  const hiddenIndicators: Array<{ element: HTMLElement; result: LockIndicatorResult }> = [];

  lockIndicators.forEach((result, element) => {
    // Store the indicator info
    hiddenIndicators.push({ element, result });

    // Remove visual classes but keep the element tracked
    element.classList.remove('mhh-locked-element');
    element.classList.remove('mhh-locked-indicator-before');
    element.classList.remove('mhh-locked-indicator-after');

    // Hide fallback DOM element if exists
    const lockIcon = element.querySelector('.matomo-lock-icon') as HTMLElement | null;
    if (lockIcon) {
      lockIcon.style.display = 'none';
    }
  });

  // Return restore function
  return () => {
    hiddenIndicators.forEach(({ element, result }) => {
      // Restore classes
      element.classList.add('mhh-locked-element');
      if (result.indicatorType === 'before') {
        element.classList.add('mhh-locked-indicator-before');
      } else if (result.indicatorType === 'after') {
        element.classList.add('mhh-locked-indicator-after');
      }

      // Show fallback DOM element if exists
      const lockIcon = element.querySelector('.matomo-lock-icon') as HTMLElement | null;
      if (lockIcon) {
        lockIcon.style.display = '';
      }
    });
  };
}

/**
 * Get all locked elements for expansion
 */
export function getLockedElements(): HTMLElement[] {
  return Array.from(ScrollTracker.lockedElements.keys());
}
