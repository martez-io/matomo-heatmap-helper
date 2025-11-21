/**
 * Interactive mode for manually locking/unlocking elements
 */

import { setStorage } from '@/lib/storage';
import type { LockedElementData } from '@/types/storage';
import { ScrollTracker, type ElementMetadata } from './state';
import {
  storeOriginalState,
  applyLockIndicator,
  getElementSelector,
  findConstrainingParents,
  isPartOfPersistentBar,
  detectAvailablePseudoElement,
} from './dom-utils';
import { dispatchStatusUpdate } from './events';

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
 * Lock an element at its current scroll height
 */
function lockElement(element: HTMLElement): void {
  // Store original state
  storeOriginalState(element);

  // Get computed height
  const computedHeight = element.scrollHeight;
  const computedClientHeight = element.clientHeight;
  const selector = getElementSelector(element);
  const parents = findConstrainingParents(element);

  // Lock the height
  element.style.height = `${computedHeight}px`;
  element.style.minHeight = `${computedHeight}px`;

  // Detect and apply lock indicator
  const indicatorType = detectAvailablePseudoElement(element);
  applyLockIndicator(element, indicatorType);

  // Store metadata
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

  console.log(`[Content] Locked: ${selector} (${computedHeight}px, indicator: ${indicatorType})`);

  // Notify persistent bar
  dispatchStatusUpdate();
}

/**
 * Unlock an element and restore its original styles
 */
function unlockElement(element: HTMLElement): void {
  // Remove from locked elements
  ScrollTracker.lockedElements.delete(element);

  // Remove all lock classes and data attributes
  element.classList.remove('mhh-locked-element');
  element.classList.remove('mhh-locked-indicator-before');
  element.classList.remove('mhh-locked-indicator-after');
  delete element.dataset.mhhLocked;
  delete element.dataset.mhhLockIndicator;

  // Remove fallback DOM element if exists
  const lockIcon = element.querySelector('.matomo-lock-icon');
  if (lockIcon) {
    lockIcon.remove();
  }

  // Restore original styles
  const originalState = ScrollTracker.originalStates.get(element);
  if (originalState) {
    element.style.height = originalState.height;
    element.style.minHeight = originalState.minHeight;
    element.style.position = originalState.position;
  }

  console.log(`[Content] Unlocked: ${getElementSelector(element)}`);
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
  event.preventDefault();
  event.stopPropagation();

  // Toggle lock state
  if (ScrollTracker.lockedElements.has(element)) {
    // Unlock
    unlockElement(element);
  } else {
    // Lock
    lockElement(element);
  }

  // Sync state to storage
  syncStateToStorage();

  // Notify persistent bar
  dispatchStatusUpdate();

  // Trigger hover event to update visual feedback
  handleInteractiveHover(event);
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
    console.log('[Content] Interactive mode already active');
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

  console.log('[Content] Interactive mode enabled');
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

  console.log('[Content] Interactive mode disabled');
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
