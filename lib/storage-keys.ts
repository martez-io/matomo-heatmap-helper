/**
 * Storage key definitions with defaults
 * Similar to PHP class constants: StorageKeys::BAR_VISIBLE
 *
 * Usage:
 *   import { S } from '@/lib/storage-keys';
 *   await get(S.BAR_VISIBLE);  // Returns boolean, never null
 *   await set(S.BAR_VISIBLE, true);
 */

import type { MatomoHeatmap, MatomoSite } from '@/types/matomo';
import type { DomainSiteMapping, LockedElementData, ProcessingStep, ScreenshotProgress } from '@/types/storage';

// Storage entry type - combines key string with its default value
type StorageEntry<T> = { readonly key: string; readonly default: T };

/**
 * All storage keys with their defaults
 * Adding a new key here automatically includes it in clearAllData()
 */
export const S = {
  // ─── State ─────────────────────────────────────────────
  BAR_VISIBLE: { key: 'state:barVisible', default: false } as StorageEntry<boolean>,
  BAR_MINIMIZED: { key: 'state:barMinimized', default: false } as StorageEntry<boolean>,
  INTERACTIVE_MODE: { key: 'state:isInteractiveMode', default: false } as StorageEntry<boolean>,
  IS_PROCESSING: { key: 'state:isProcessing', default: false } as StorageEntry<boolean>,
  PROCESSING_STEP: { key: 'state:processingStep', default: null } as StorageEntry<ProcessingStep | null>,
  SCREENSHOT_PROGRESS: { key: 'state:screenshotInProgress', default: null } as StorageEntry<ScreenshotProgress | null>,
  LOCKED_ELEMENTS: { key: 'state:lockedElements', default: [] as LockedElementData[] } as StorageEntry<LockedElementData[]>,
  ACTIVE_TAB_ID: { key: 'state:activeTabId', default: null } as StorageEntry<number | null>,
  HAS_SEEN_ANIMATION: { key: 'state:hasSeenEntranceAnimation', default: false } as StorageEntry<boolean>,
  ANIMATION_PENDING: { key: 'state:animationPending', default: false } as StorageEntry<boolean>,
  PROCESSING_ERROR: { key: 'state:processingError', default: null } as StorageEntry<string | null>,

  // ─── Settings ──────────────────────────────────────────
  DEBUG_MODE: { key: 'settings:debugMode', default: false } as StorageEntry<boolean>,
  ALWAYS_ANIMATE: { key: 'settings:alwaysShowEntranceAnimation', default: false } as StorageEntry<boolean>,

  // ─── Enforcement ───────────────────────────────────────
  ENFORCE_ENABLED: { key: 'enforce:enabled', default: false } as StorageEntry<boolean>,

  // ─── UI ────────────────────────────────────────────────
  SELECTED_HEATMAP: { key: 'ui:selectedHeatmapId', default: null } as StorageEntry<number | null>,

  // ─── Persistent Bar (runtime state for current page) ───
  PERSISTENT_BAR_SITE_ID: { key: 'persistentBar:siteId', default: null } as StorageEntry<number | null>,
  PERSISTENT_BAR_SITE_NAME: { key: 'persistentBar:siteName', default: null } as StorageEntry<string | null>,

  // ─── Credentials ───────────────────────────────────────
  API_URL: { key: 'matomo:apiUrl', default: null } as StorageEntry<string | null>,
  AUTH_TOKEN: { key: 'matomo:authToken', default: null } as StorageEntry<string | null>,
  SITE_ID: { key: 'matomo:siteId', default: null } as StorageEntry<number | null>,
  SITE_NAME: { key: 'matomo:siteName', default: null } as StorageEntry<string | null>,

  // ─── Caches ────────────────────────────────────────────
  DOMAIN_SITE_MAP: { key: 'matomo:domainSiteMap', default: {} as Record<string, DomainSiteMapping> } as StorageEntry<Record<string, DomainSiteMapping>>,
  AVAILABLE_SITES: { key: 'matomo:availableSites', default: null } as StorageEntry<{ sites: MatomoSite[]; timestamp: number } | null>,
  HEATMAPS_CACHE: { key: 'cache:heatmaps', default: {} as Record<number, { heatmaps: MatomoHeatmap[]; timestamp: number }> } as StorageEntry<Record<number, { heatmaps: MatomoHeatmap[]; timestamp: number }>>,

  // ─── Debug ─────────────────────────────────────────────
  ERROR_LOG: { key: 'debug:errorLog', default: [] as Array<{ type: string; message: string; step: ProcessingStep; recoverable: boolean; context: unknown; timestamp: number }> } as StorageEntry<Array<{ type: string; message: string; step: ProcessingStep; recoverable: boolean; context: unknown; timestamp: number }>>,

  // ─── Feedback ──────────────────────────────────────────
  FEEDBACK_COUNT: { key: 'feedback:promptCount', default: 0 } as StorageEntry<number>,
  REVIEW_CLICKED: { key: 'feedback:reviewClicked', default: false } as StorageEntry<boolean>,
  LAST_PROCESSED_TS: { key: 'feedback:lastProcessedTs', default: 0 } as StorageEntry<number>,
} as const;

// Type for any storage entry key
export type StorageEntryKey = keyof typeof S;

// Get all storage keys for clearAllData() - automatically stays in sync
export const ALL_STORAGE_KEYS = Object.values(S).map(entry => entry.key);
