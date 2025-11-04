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
}

// Content script messages
export type ContentScriptMessage =
  | { action: 'startTracking'; heatmapId: number }
  | { action: 'stopTracking' }
  | { action: 'getStatus' }
  | { action: 'expandElements' }
  | { action: 'restore' }
  | { action: 'showScanner' }
  | { action: 'showBorderGlow' };

export type ContentScriptResponse =
  | { success: true }
  | { success: false; error: string }
  | ScrollTrackerStatus;

// Background worker messages
export type BackgroundMessage = {
  action: 'onSuccessfulScreenshot';
  url: string;
  tabId: number;
};

export type BackgroundResponse = {
  success: boolean;
  tabId?: number;
  error?: string;
};

// Page context messages (for Matomo API calls)
export interface MatomoPageContextResponse {
  success: boolean;
  error?: string;
}
