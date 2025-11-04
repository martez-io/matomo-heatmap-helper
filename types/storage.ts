/**
 * Storage types for WXT storage
 */

import type { MatomoHeatmap } from './matomo';

export interface StorageSchema {
  // Matomo credentials
  'matomo:apiUrl': string;
  'matomo:authToken': string;
  'matomo:siteId': number;
  'matomo:siteName': string;

  // UI state
  'ui:selectedHeatmapId': number | null;
  'ui:lastUsedSiteId': number | null;

  // Cache (with TTL)
  'cache:heatmaps': {
    siteId: number;
    heatmaps: MatomoHeatmap[];
    timestamp: number;
  } | null;
  'cache:sites': {
    sites: Array<{ idsite: number; name: string }>;
    timestamp: number;
  } | null;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
