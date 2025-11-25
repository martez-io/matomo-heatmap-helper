/**
 * Element Fixer System
 *
 * A composable system for fixing element CSS/DOM for heatmap screenshots.
 * Fixers are auto-registered when their modules are imported.
 */

// Re-export types
export * from './types';

// Re-export registry
export { fixerRegistry } from './registry';

// Re-export pipeline
export { applyFixers } from './pipeline';

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

// Import fixers to trigger auto-registration
// Base fixers
import './base/height-fixer';
import './base/overflow-fixer';
import './base/position-fixer';

// Specialized fixers
import './specialized/iframe-fixer';
import './specialized/sticky-header-fixer';
import './specialized/video-fixer';
import './specialized/cors-fixer';
