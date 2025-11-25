/**
 * Fixer execution pipeline
 */

import type { FixerContext, ElementFixResult, FixerResult } from './types';
import { fixerRegistry } from './registry';
import { logger } from '@/lib/logger';

/**
 * Execute the fixer pipeline on an element
 *
 * Pipeline logic:
 * 1. First, check specialized fixers - they may supersede base fixers
 * 2. For each specialized fixer that applies, mark its composed fixers as handled
 * 3. Run remaining base fixers not already handled by specialized fixers
 * 4. Collect all results for restoration
 */
export function applyFixers(element: HTMLElement): ElementFixResult {
  const computedStyle = window.getComputedStyle(element);

  const context: FixerContext = {
    element,
    document: element.ownerDocument,
    computedStyle,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };

  const appliedFixers: FixerResult[] = [];
  const handledFixerIds = new Set<string>();

  // Phase 1: Run specialized fixers that match
  const specializedFixers = fixerRegistry.getSpecializedFixers();

  for (const fixer of specializedFixers) {
    if (fixer.shouldApply(context)) {
      try {
        const result = fixer.apply(context);
        if (result.applied) {
          appliedFixers.push(result);
          handledFixerIds.add(fixer.id);
          // Mark composed base fixers as handled (prevents double-application)
          fixer.composesFixers.forEach((id) => handledFixerIds.add(id));
          logger.debug('Content', `Applied specialized fixer: ${fixer.id}`);
        }
      } catch (err) {
        logger.error('Content', `Error applying fixer ${fixer.id}:`, err);
      }
    }
  }

  // Phase 2: Run base fixers not already handled by specialized fixers
  const baseFixers = fixerRegistry.getBaseFixers();

  for (const fixer of baseFixers) {
    if (handledFixerIds.has(fixer.id)) {
      continue; // Already handled by a specialized fixer
    }

    if (fixer.shouldApply(context)) {
      try {
        const result = fixer.apply(context);
        if (result.applied) {
          appliedFixers.push(result);
          handledFixerIds.add(fixer.id);
          logger.debug('Content', `Applied base fixer: ${fixer.id}`);
        }
      } catch (err) {
        logger.error('Content', `Error applying fixer ${fixer.id}:`, err);
      }
    }
  }

  return {
    element,
    appliedFixers,
    timestamp: Date.now(),
    restoreAll() {
      // Restore in reverse order of application
      for (let i = appliedFixers.length - 1; i >= 0; i--) {
        const result = appliedFixers[i];
        try {
          result.restore();
          logger.debug('Content', `Restored fixer: ${result.fixerId}`);
        } catch (err) {
          logger.error('Content', `Failed to restore fixer ${result.fixerId}:`, err);
        }
      }
    },
  };
}
