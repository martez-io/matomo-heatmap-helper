/**
 * Storage types for WXT storage
 */

import type { MatomoHeatmap, MatomoSite } from './matomo';

export type ProcessingStep = 'validating' | 'expanding' | 'capturing' | 'verifying' | 'complete';

export interface ScreenshotProgress {
  heatmapId: number;
  tabId: number;
  siteId: number;
  step: ProcessingStep;
  startTime: number;
}

export interface LockedElementData {
  selector: string;
  scrollHeight: number;
  clientHeight: number;
}

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

  // Extension state
  'state:isInteractiveMode': boolean;
  'state:isProcessing': boolean;
  'state:processingStep': ProcessingStep | null;
  'state:screenshotInProgress': ScreenshotProgress | null;
  'state:lockedElements': LockedElementData[];
  'state:activeTabId': number | null;
  'state:barVisible': boolean;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const DOMAIN_MAPPING_TTL = 24 * 60 * 60 * 1000; // 24 hours
