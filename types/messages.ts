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
  | { action: 'expandElements' }
  | { action: 'restore' }
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

// Background worker messages
export type BackgroundMessage =
  | { action: 'onSuccessfulScreenshot'; url: string; tabId: number }
  | { action: 'executeScreenshot'; heatmapId: number; tabId?: number; siteId: number }
  | { action: 'cancelScreenshot'; tabId?: number }
  | { action: 'fetchHeatmaps'; siteId: number; forceRefresh?: boolean }
  | { action: 'resolveSite'; url: string }
  | { action: 'openSettings' }
  | { action: 'openBugReport' };

export type BackgroundResponse = {
  success: boolean;
  tabId?: number;
  error?: string;
  // Site resolution fields
  siteId?: number;
  siteName?: string;
};

// Page context messages (for Matomo API calls)
export interface MatomoPageContextResponse {
  success: boolean;
  error?: string;
}
