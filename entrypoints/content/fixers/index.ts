/**
 * Fixer System
 *
 * A composable system for fixing CSS/DOM for heatmap screenshots.
 * Fixers are organized by scope:
 * - element/: Run on individual locked/scrolled elements
 * - global/: Run once on entire document
 *
 * Fixers are auto-registered when their modules are imported.
 */

// Re-export types
export * from './types';

// Re-export registry
export { fixerRegistry } from './registry';

// Re-export pipeline functions
export { applyFixers, applyElementFixers, applyGlobalFixers } from './pipeline';

// Re-export state management
export {
  storeFixResult,
  getFixResult,
  hasFixResult,
  restoreAndRemove,
  clearAllFixResults,
  getFixResultCount,
} from './state';

// Re-export lock indicator
export { applyLockVisualIndicator, detectAvailablePseudoElement } from './lock-indicator';
export type { LockIndicatorResult, IndicatorType } from './lock-indicator';

// Import element-scope fixers to trigger auto-registration
import './element/height-fixer';
import './element/overflow-fixer';
import './element/position-fixer';
import './element/iframe-fixer';
import './element/sticky-header-fixer';
import './element/video-fixer';
import './element/cors-fixer';

// Import global-scope fixers to trigger auto-registration
import './global/relative-url-fixer';
import './global/font-cors-fixer';

// Re-export global fixer helpers for backward compatibility
export {
  applyAndStoreDocumentUrlFixes,
  restoreDocumentUrlFixes,
  hasDocumentUrlFixes,
} from './global/relative-url-fixer';

export {
  applyAndStoreFontCorsFixes,
  restoreFontCorsFixes,
  hasFontCorsFixes,
} from './global/font-cors-fixer';

// Re-export URL utilities for external use
export { isRelativeUrl, detectRelativeUrls, toAbsoluteUrl } from './utils/url-detector';
export { applyAbsoluteUrl, restoreOriginalUrl } from './utils/url-converter';

// Re-export CORS utilities for external use
export { isCrossOrigin, detectCorsResources, deduplicateByUrl } from './utils/cors-detector';
export type { DetectedResource } from './utils/cors-detector';

// Re-export font detection utilities
export {
  detectFontFaces,
  getFontUrlsToProxy,
  generateFontFaceCss,
  collectStylesheets,
  parseFontSrc,
} from './utils/font-detector';
export type { FontFaceInfo, FontUrlInfo, StylesheetSource } from './utils/font-detector';
