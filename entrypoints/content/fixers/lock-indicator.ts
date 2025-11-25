/**
 * Visual lock indicator management
 * Separate from fixers - this is UI feedback, not layout correction
 */

export type IndicatorType = 'before' | 'after' | 'fallback';

export interface LockIndicatorResult {
  element: HTMLElement;
  indicatorType: IndicatorType;
  remove(): void;
}

/**
 * Detect which pseudo-element is available for lock indicator
 */
export function detectAvailablePseudoElement(element: HTMLElement): IndicatorType {
  const beforeStyle = window.getComputedStyle(element, '::before');
  const afterStyle = window.getComputedStyle(element, '::after');

  // Check if pseudo-element is in use
  const beforeInUse = beforeStyle.content !== 'none' && beforeStyle.content !== '';
  const afterInUse = afterStyle.content !== 'none' && afterStyle.content !== '';

  // Prefer ::after, fallback to ::before, then to DOM element
  if (!afterInUse) return 'after';
  if (!beforeInUse) return 'before';

  return 'fallback'; // Both in use, use DOM element method
}

/**
 * Apply visual lock indicator to an element
 */
export function applyLockVisualIndicator(element: HTMLElement): LockIndicatorResult {
  const indicatorType = detectAvailablePseudoElement(element);

  // Store original position if we need to modify it
  const originalPosition = element.style.position;
  const computedPosition = window.getComputedStyle(element).position;
  let positionChanged = false;

  // Ensure element has position context for indicators
  if (computedPosition === 'static') {
    element.style.position = 'relative';
    positionChanged = true;
  }

  // Add base class and data attribute
  element.classList.add('mhh-locked-element');
  element.dataset.mhhLocked = 'true';
  element.dataset.mhhLockIndicator = indicatorType;

  // Apply visual indicator based on type
  if (indicatorType === 'before') {
    element.classList.add('mhh-locked-indicator-before');
  } else if (indicatorType === 'after') {
    element.classList.add('mhh-locked-indicator-after');
  } else if (indicatorType === 'fallback') {
    // Create fallback DOM element
    const lockIcon = document.createElement('div');
    lockIcon.className = 'matomo-lock-icon';
    lockIcon.style.cssText = `
      position: absolute;
      inset: 0;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.2);
      pointer-events: none;
      z-index: 999990;
      box-sizing: border-box;
    `;
    element.appendChild(lockIcon);
  }

  return {
    element,
    indicatorType,
    remove() {
      // Remove classes
      element.classList.remove('mhh-locked-element');
      element.classList.remove('mhh-locked-indicator-before');
      element.classList.remove('mhh-locked-indicator-after');

      // Remove data attributes
      delete element.dataset.mhhLocked;
      delete element.dataset.mhhLockIndicator;

      // Remove fallback DOM element if exists
      const lockIcon = element.querySelector('.matomo-lock-icon');
      if (lockIcon) {
        lockIcon.remove();
      }

      // Restore position if we changed it
      if (positionChanged) {
        element.style.position = originalPosition;
      }
    },
  };
}
