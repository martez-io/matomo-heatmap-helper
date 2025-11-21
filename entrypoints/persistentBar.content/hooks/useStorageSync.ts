/**
 * Hook for syncing bar state with chrome.storage
 * Watches storage keys and updates local state when they change
 */

import { useEffect } from 'react';
import { storage } from 'wxt/utils/storage';
import type { BarAction } from '../types';
import type { MatomoHeatmap } from '@/types/matomo';
import type { ProcessingStep } from '@/types/storage';

export function useStorageSync(dispatch: React.Dispatch<BarAction>) {
  useEffect(() => {
    console.log('[useStorageSync] Setting up storage watchers...');

    // Watch for heatmap cache updates
    const unwatchHeatmaps = storage.watch<
      Record<
        number,
        {
          heatmaps: MatomoHeatmap[];
          timestamp: number;
        }
      >
    >('local:cache:heatmaps', async (newValue) => {
      // Get current siteId to extract correct heatmaps
      const siteId = await storage.getItem<number>('local:persistentBar:siteId');

      if (newValue && siteId && newValue[siteId]?.heatmaps) {
        console.log('[useStorageSync] Heatmaps updated for site', siteId, ':', newValue[siteId].heatmaps.length);
        dispatch({
          type: 'SET_STATE',
          payload: { heatmaps: newValue[siteId].heatmaps },
        });
      } else if (newValue && siteId && !newValue[siteId]) {
        console.log('[useStorageSync] No heatmaps found for site', siteId);
        dispatch({
          type: 'SET_STATE',
          payload: { heatmaps: [] },
        });
      }
    });

    // Watch for selected heatmap updates
    const unwatchSelected = storage.watch<number>(
      'local:ui:selectedHeatmapId',
      (newValue) => {
        if (newValue !== undefined) {
          console.log('[useStorageSync] Selected heatmap ID updated:', newValue);
          // Will be resolved in useBarState's initial load
        }
      }
    );

    // Watch for processing state updates
    const unwatchProcessing = storage.watch<boolean>(
      'local:state:isProcessing',
      (newValue) => {
        if (newValue !== undefined && newValue !== null) {
          console.log('[useStorageSync] Processing state updated:', newValue);
          dispatch({
            type: 'SET_PROCESSING',
            payload: newValue,
          });
        }
      }
    );

    // Watch for processing step updates
    const unwatchStep = storage.watch<ProcessingStep | null>(
      'local:state:processingStep',
      (newValue) => {
        console.log('[useStorageSync] Processing step updated:', newValue);
        dispatch({
          type: 'SET_PROCESSING_STEP',
          payload: newValue ?? null,
        });
      }
    );

    // Watch for error updates
    const unwatchError = storage.watch<string | null>(
      'local:ui:error',
      (newValue) => {
        console.log('[useStorageSync] Error updated:', newValue);
        dispatch({
          type: 'SET_ERROR',
          payload: newValue ?? null,
        });
      }
    );

    return () => {
      console.log('[useStorageSync] Cleaning up storage watchers...');
      unwatchHeatmaps();
      unwatchSelected();
      unwatchProcessing();
      unwatchStep();
      unwatchError();
    };
  }, [dispatch]);
}
