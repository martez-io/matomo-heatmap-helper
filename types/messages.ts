/**
 * Message types for extension communication
 */

export interface ScrollableElement {
  selector: string;
  hiddenContent: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollTrackerStatus {
  scrolledCount: number;
  scrollables: ScrollableElement[];
  isTracking: boolean;
  isInteractiveMode: boolean;
  lockedCount: number;
}

export interface LockedElement {
  selector: string;
  scrollHeight: number;
  clientHeight: number;
  isScrollable: boolean;
}

export interface LockedElementsStatus {
  lockedCount: number;
  lockedElements: LockedElement[];
}

// Content script messages
export type ContentScriptMessage =
  | { action: 'startTracking'; heatmapId: number }
  | { action: 'stopTracking' }
  | { action: 'getStatus' }
  | { action: 'prepareLayout' }
  | { action: 'restoreLayout' }
  | { action: 'expandElements' } // @deprecated - use prepareLayout
  | { action: 'restore' } // @deprecated - use restoreLayout
  | { action: 'showScanner' }
  | { action: 'hideScanner' }
  | { action: 'showBorderGlow' }
  | { action: 'enterInteractiveMode' }
  | { action: 'exitInteractiveMode' }
  | { action: 'getLockedElements' };

export type ContentScriptResponse =
  | { success: true }
  | { success: false; error: string }
  | ScrollTrackerStatus
  | LockedElementsStatus;

// CORS resource types for cross-origin resource handling
export type CorsResourceType = 'image' | 'font' | 'svg';

export interface CorsResourceRequest {
  id: string;
  url: string;
  resourceType: CorsResourceType;
}

export interface CorsResourceResult {
  id: string;
  url: string;
  success: boolean;
  dataUri?: string;
  mimeType?: string;
  sizeBytes?: number;
  error?: string;
}

// CSS text fetching for cross-origin stylesheets (font detection)
export interface CssTextResult {
  url: string;
  success: boolean;
  cssText?: string;
  error?: string;
}

// Background worker messages
export type BackgroundMessage =
  | { action: 'onSuccessfulScreenshot'; url: string; tabId: number }
  | { action: 'executeScreenshot'; heatmapId: number; tabId?: number; siteId: number }
  | { action: 'cancelScreenshot'; tabId?: number }
  | { action: 'fetchHeatmaps'; siteId: number; forceRefresh?: boolean }
  | { action: 'resolveSite'; url: string }
  | { action: 'openSettings' }
  | { action: 'openBugReport' }
  | { action: 'fetchCorsResources'; requests: CorsResourceRequest[] }
  | { action: 'fetchCssText'; urls: string[] };

export type BackgroundResponse = {
  success: boolean;
  tabId?: number;
  error?: string;
  // Site resolution fields
  siteId?: number;
  siteName?: string;
  // CORS resource fetching fields
  corsResults?: CorsResourceResult[];
  totalSizeBytes?: number;
  // CSS text fetching fields
  cssTextResults?: CssTextResult[];
};

// Page context messages (for Matomo API calls)
export interface MatomoPageContextResponse {
  success: boolean;
  error?: string;
}
