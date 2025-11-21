/**
 * Event dispatching for communication with persistent bar
 */

import { ScrollTracker } from './state';

/**
 * Dispatch status update to persistent bar
 */
export function dispatchStatusUpdate(): void {
  // Dispatch individual events for React bar components
  window.dispatchEvent(
    new CustomEvent('mhh:scrollCountUpdate', {
      detail: { count: ScrollTracker.scrolledElements.size },
    })
  );

  window.dispatchEvent(
    new CustomEvent('mhh:lockedCountUpdate', {
      detail: { count: ScrollTracker.lockedElements.size },
    })
  );

  window.dispatchEvent(
    new CustomEvent('mhh:trackingChange', {
      detail: { isTracking: ScrollTracker.isTracking },
    })
  );

  window.dispatchEvent(
    new CustomEvent('mhh:interactiveModeChange', {
      detail: { isInteractive: ScrollTracker.isInteractiveMode },
    })
  );

  // Also dispatch combined event for backward compatibility
  window.dispatchEvent(
    new CustomEvent('mhh:statusUpdate', {
      detail: {
        scrolledCount: ScrollTracker.scrolledElements.size,
        lockedCount: ScrollTracker.lockedElements.size,
        isInteractiveMode: ScrollTracker.isInteractiveMode,
        isTracking: ScrollTracker.isTracking,
      },
    })
  );
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
