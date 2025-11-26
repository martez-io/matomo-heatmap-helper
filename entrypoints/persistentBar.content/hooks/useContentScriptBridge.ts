/**
 * Hook for listening to content script events
 * Bridges communication between main content script and persistent bar
 */

import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import type { BarAction } from '../types';
import type { SerializedElementInfo } from '@/types/elements';

export function useContentScriptBridge(dispatch: React.Dispatch<BarAction>) {
  useEffect(() => {
    logger.debug('useContentScriptBridge', 'Setting up event listeners...');

    // Listen for element list updates
    const handleElementListUpdate = (event: CustomEvent<{ elements: SerializedElementInfo[] }>) => {
      const { elements } = event.detail;
      logger.debug('useContentScriptBridge', 'Element list updated:', elements.length);
      dispatch({
        type: 'UPDATE_ELEMENT_LIST',
        payload: elements,
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
    window.addEventListener('mhh:elementListUpdate', handleElementListUpdate as EventListener);
    window.addEventListener('mhh:trackingChange', handleTrackingChange as EventListener);
    window.addEventListener('mhh:interactiveModeChange', handleInteractiveModeChange as EventListener);

    return () => {
      logger.debug('useContentScriptBridge', 'Cleaning up event listeners...');
      window.removeEventListener('mhh:elementListUpdate', handleElementListUpdate as EventListener);
      window.removeEventListener('mhh:trackingChange', handleTrackingChange as EventListener);
      window.removeEventListener('mhh:interactiveModeChange', handleInteractiveModeChange as EventListener);
    };
  }, [dispatch]);
}
