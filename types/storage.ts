/**
 * Storage types for WXT storage
 */

import type { MatomoHeatmap, MatomoSite } from './matomo';

export interface DomainSiteMapping {
  siteId: number;
  siteName: string;
  timestamp: number;
}

export interface StorageSchema {
  // Matomo credentials
  'matomo:apiUrl': string;
  'matomo:authToken': string;

  // Domain to site mappings (cached with TTL)
  'matomo:domainSiteMap': Record<string, DomainSiteMapping>;

  // Available sites with write access (cached with TTL)
  'matomo:availableSites': {
    sites: MatomoSite[];
    timestamp: number;
  } | null;

  // UI state
  'ui:selectedHeatmapId': number | null;

  // Heatmap cache per site (with TTL)
  'cache:heatmaps': Record<number, {
    heatmaps: MatomoHeatmap[];
    timestamp: number;
  }>;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const DOMAIN_MAPPING_TTL = 24 * 60 * 60 * 1000; // 24 hours
