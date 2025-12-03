/**
 * Hook for syncing bar state with chrome.storage
 * Watches storage keys and updates local state when they change
 */

import { useEffect } from 'react';
import { get, watch } from '@/lib/storage';
import { S } from '@/lib/storage-keys';
import { logger } from '@/lib/logger';
import type { BarAction } from '../types';

export function useStorageSync(dispatch: React.Dispatch<BarAction>) {
  useEffect(() => {
    logger.debug('useStorageSync', 'Setting up storage watchers...');

    // Watch for heatmap cache updates
    const unwatchHeatmaps = watch(S.HEATMAPS_CACHE, async (newValue) => {
      // Get current siteId to extract correct heatmaps
      const siteId = await get(S.PERSISTENT_BAR_SITE_ID);

      if (siteId && newValue[siteId]?.heatmaps) {
        logger.debug('useStorageSync', 'Heatmaps updated for site', siteId, ':', newValue[siteId].heatmaps.length);
        dispatch({
          type: 'SET_STATE',
          payload: { heatmaps: newValue[siteId].heatmaps },
        });
      } else if (siteId && !newValue[siteId]) {
        logger.debug('useStorageSync', 'No heatmaps found for site', siteId);
        dispatch({
          type: 'SET_STATE',
          payload: { heatmaps: [] },
        });
      }
    });

    // Watch for selected heatmap updates
    const unwatchSelected = watch(S.SELECTED_HEATMAP, (newValue) => {
      if (newValue !== null) {
        logger.debug('useStorageSync', 'Selected heatmap ID updated:', newValue);
        // Will be resolved in useBarState's initial load
      }
    });

    // Watch for processing state updates
    const unwatchProcessing = watch(S.IS_PROCESSING, (newValue) => {
      logger.debug('useStorageSync', 'Processing state updated:', newValue);
      dispatch({
        type: 'SET_PROCESSING',
        payload: newValue,
      });
    });

    // Watch for processing step updates
    const unwatchStep = watch(S.PROCESSING_STEP, (newValue) => {
      logger.debug('useStorageSync', 'Processing step updated:', newValue);
      dispatch({
        type: 'SET_PROCESSING_STEP',
        payload: newValue,
      });
    });

    // Watch for processing error updates
    const unwatchError = watch(S.PROCESSING_ERROR, (newValue) => {
      logger.debug('useStorageSync', 'Processing error updated:', newValue);
      dispatch({
        type: 'SET_ERROR',
        payload: newValue,
      });
    });

    return () => {
      logger.debug('useStorageSync', 'Cleaning up storage watchers...');
      unwatchHeatmaps();
      unwatchSelected();
      unwatchProcessing();
      unwatchStep();
      unwatchError();
    };
  }, [dispatch]);
}
