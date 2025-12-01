/**
 * Main state management hook for persistent bar
 * Uses useReducer with initial data loading from storage
 */

import { useReducer, useEffect } from 'react';
import { get } from '@/lib/storage';
import { S } from '@/lib/storage-keys';
import { logger } from '@/lib/logger';
import type { BarState, BarAction } from '../types';
import type { MatomoHeatmap } from '@/types/matomo';
import { useStorageSync } from './useStorageSync';
import { useContentScriptBridge } from './useContentScriptBridge';

const initialState: BarState = {
  isMinimized: false,
  isVisible: true,
  selectedHeatmap: null,
  heatmaps: [],
  elements: [],
  isTracking: false,
  isInteractiveMode: false,
  isProcessing: false,
  processingStep: null,
  error: null,
  siteId: null,
  siteName: null,
};

function barReducer(state: BarState, action: BarAction): BarState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };

    case 'SET_MINIMIZED':
      return { ...state, isMinimized: action.payload };

    case 'SELECT_HEATMAP':
      return { ...state, selectedHeatmap: action.payload };

    case 'UPDATE_ELEMENT_LIST':
      return { ...state, elements: action.payload };

    case 'SET_TRACKING':
      return { ...state, isTracking: action.payload };

    case 'SET_INTERACTIVE_MODE':
      return { ...state, isInteractiveMode: action.payload };

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_PROCESSING_STEP':
      return { ...state, processingStep: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

export function useBarState() {
  const [state, dispatch] = useReducer(barReducer, initialState);

  // Set up storage sync
  useStorageSync(dispatch);

  // Set up content script bridge
  useContentScriptBridge(dispatch);

  // Initial data load
  useEffect(() => {
    logger.debug('useBarState', 'Loading initial state from storage...');

    const loadInitialState = async () => {
      try {
        // Load site info first (needed to lookup correct heatmaps from cache)
        const siteId = await get(S.PERSISTENT_BAR_SITE_ID);
        const siteName = await get(S.PERSISTENT_BAR_SITE_NAME);

        // Load heatmaps cache (Record keyed by siteId)
        const heatmapCache = await get(S.HEATMAPS_CACHE);

        // Extract heatmaps for this specific site
        const siteHeatmaps = siteId && heatmapCache?.[siteId]?.heatmaps ? heatmapCache[siteId].heatmaps : [];

        // Load selected heatmap ID
        const selectedHeatmapId = await get(S.SELECTED_HEATMAP);

        logger.debug('useBarState', 'Initial load:', {
          heatmapCount: siteHeatmaps.length,
          selectedHeatmapId,
          siteId,
          siteName,
        });

        // Find selected heatmap object from site-specific heatmaps
        let selectedHeatmap: MatomoHeatmap | null = null;
        if (selectedHeatmapId && siteHeatmaps.length > 0) {
          selectedHeatmap =
            siteHeatmaps.find((h: MatomoHeatmap) => h.idsitehsr === selectedHeatmapId) ?? null;
        }

        dispatch({
          type: 'SET_STATE',
          payload: {
            heatmaps: siteHeatmaps,
            selectedHeatmap,
            siteId: siteId ?? null,
            siteName: siteName ?? null,
          },
        });

        // Auto-start tracking if a heatmap was previously selected
        if (selectedHeatmap) {
          logger.debug('useBarState', 'Auto-starting tracking for heatmap:', selectedHeatmap.idsitehsr);
          window.dispatchEvent(
            new CustomEvent('mhh:startTracking', {
              detail: { heatmapId: selectedHeatmap.idsitehsr },
            })
          );
          dispatch({
            type: 'SET_TRACKING',
            payload: true,
          });
        }
      } catch (error) {
        logger.error('useBarState', 'Failed to load initial state:', error);
      }
    };

    loadInitialState();
  }, []);

  return { state, dispatch };
}
