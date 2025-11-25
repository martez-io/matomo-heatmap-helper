/**
 * Relative URL Fixer (Global Scope)
 *
 * Converts all relative URLs to absolute URLs across the entire document
 * before Matomo captures the DOM for heatmap screenshots. This ensures
 * images and resources load correctly when the captured HTML is rendered
 * from Matomo's server context.
 */

import { logger } from '@/lib/logger';
import { detectRelativeUrls } from '../utils/url-detector';
import { applyAbsoluteUrls, restoreOriginalUrls } from '../utils/url-converter';
import type { Fixer, GlobalFixerContext, FixerResult, DetectedRelativeUrl } from '../types';
import { fixerRegistry } from '../registry';

export const relativeUrlFixer: Fixer = {
  id: 'global:relative-url',
  priority: 10, // Run early to convert URLs before other operations
  scope: 'global',

  shouldApply(_context: GlobalFixerContext): boolean {
    // Always apply - actual detection happens in apply()
    return true;
  },

  apply(context: GlobalFixerContext): FixerResult {
    const { document: doc } = context;
    const resources = detectRelativeUrls(doc);

    if (resources.length === 0) {
      logger.debug('Content', 'Relative URL fixer: No relative URLs found');
      return {
        fixerId: 'global:relative-url',
        applied: false,
        count: 0,
        restore: () => {},
      };
    }

    logger.debug('Content', `Relative URL fixer: Found ${resources.length} relative URLs`);

    // Apply conversions
    const appliedResources = applyAbsoluteUrls(resources);

    logger.debug(
      'Content',
      `Relative URL fixer: Applied ${appliedResources.length}/${resources.length}`
    );

    return {
      fixerId: 'global:relative-url',
      applied: appliedResources.length > 0,
      count: appliedResources.length,
      restore() {
        restoreOriginalUrls(appliedResources);
        logger.debug('Content', `Relative URL fixer: Restored ${appliedResources.length} URLs`);
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(relativeUrlFixer);

/**
 * Module-level state for tracking document fixes
 * Used by layout-prep.ts to manage fix/restore lifecycle outside pipeline
 */
let currentGlobalFixResult: {
  appliedResources: DetectedRelativeUrl[];
  applied: boolean;
} | null = null;

/**
 * Apply document URL fixes and store result for later restoration
 * (Legacy API for backward compatibility with expansion.ts)
 */
export function applyAndStoreDocumentUrlFixes(doc: Document = document): FixerResult {
  // Restore any existing fixes first
  if (currentGlobalFixResult) {
    restoreDocumentUrlFixes();
  }

  const resources = detectRelativeUrls(doc);

  if (resources.length === 0) {
    logger.debug('Content', 'Relative URL fixer: No relative URLs found');
    currentGlobalFixResult = { appliedResources: [], applied: false };
    return {
      fixerId: 'global:relative-url',
      applied: false,
      count: 0,
      restore: () => {},
    };
  }

  const appliedResources = applyAbsoluteUrls(resources);

  logger.debug(
    'Content',
    `Relative URL fixer: Applied ${appliedResources.length}/${resources.length}`
  );

  currentGlobalFixResult = {
    appliedResources,
    applied: appliedResources.length > 0,
  };

  return {
    fixerId: 'global:relative-url',
    applied: appliedResources.length > 0,
    count: appliedResources.length,
    restore() {
      restoreDocumentUrlFixes();
    },
  };
}

/**
 * Restore previously applied document URL fixes
 */
export function restoreDocumentUrlFixes(): void {
  if (currentGlobalFixResult) {
    restoreOriginalUrls(currentGlobalFixResult.appliedResources);
    logger.debug(
      'Content',
      `Relative URL fixer: Restored ${currentGlobalFixResult.appliedResources.length} URLs`
    );
    currentGlobalFixResult = null;
  }
}

/**
 * Check if document URL fixes are currently applied
 */
export function hasDocumentUrlFixes(): boolean {
  return currentGlobalFixResult !== null && currentGlobalFixResult.applied;
}

/**
 * Clear state (for testing)
 */
export function clearDocumentUrlFixState(): void {
  currentGlobalFixResult = null;
}
