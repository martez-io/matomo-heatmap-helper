/**
 * Hook for listening to content script events
 * Bridges communication between main content script and persistent bar
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import type { BarAction } from '../types';

export function useContentScriptBridge(dispatch: React.Dispatch<BarAction>) {
  useEffect(() => {
    logger.debug('useContentScriptBridge', 'Setting up event listeners...');

    // Listen for scroll count updates
    const handleScrollUpdate = (event: CustomEvent) => {
      const { count } = event.detail;
      logger.debug('useContentScriptBridge', 'Scroll count updated:', count);
      dispatch({
        type: 'UPDATE_SCROLL_COUNT',
        payload: count,
      });
    };

    // Listen for locked element count updates
    const handleLockedUpdate = (event: CustomEvent) => {
      const { count } = event.detail;
      logger.debug('useContentScriptBridge', 'Locked count updated:', count);
      dispatch({
        type: 'UPDATE_LOCKED_COUNT',
        payload: count,
      });
    };

    // Listen for tracking state changes
    const handleTrackingChange = (event: CustomEvent) => {
      const { isTracking } = event.detail;
      logger.debug('useContentScriptBridge', 'Tracking state changed:', isTracking);
      dispatch({
        type: 'SET_TRACKING',
        payload: isTracking,
      });
    };

    // Listen for interactive mode changes
    const handleInteractiveModeChange = (event: CustomEvent) => {
      const { isInteractive } = event.detail;
      logger.debug('useContentScriptBridge', 'Interactive mode changed:', isInteractive);
      dispatch({
        type: 'SET_INTERACTIVE_MODE',
        payload: isInteractive,
      });
    };

    // Add event listeners
    window.addEventListener('mhh:scrollCountUpdate', handleScrollUpdate as EventListener);
    window.addEventListener('mhh:lockedCountUpdate', handleLockedUpdate as EventListener);
    window.addEventListener('mhh:trackingChange', handleTrackingChange as EventListener);
    window.addEventListener('mhh:interactiveModeChange', handleInteractiveModeChange as EventListener);

    return () => {
      logger.debug('useContentScriptBridge', 'Cleaning up event listeners...');
      window.removeEventListener('mhh:scrollCountUpdate', handleScrollUpdate as EventListener);
      window.removeEventListener('mhh:lockedCountUpdate', handleLockedUpdate as EventListener);
      window.removeEventListener('mhh:trackingChange', handleTrackingChange as EventListener);
      window.removeEventListener('mhh:interactiveModeChange', handleInteractiveModeChange as EventListener);
    };
  }, [dispatch]);
}
