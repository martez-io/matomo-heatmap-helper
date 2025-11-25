/**
 * Fixer execution pipeline
 */

import type { FixerContext, ElementFixResult, FixerResult } from './types';
import { isComposableFixer } from './types';
import { fixerRegistry } from './registry';
import { logger } from '@/lib/logger';

/**
 * Execute the fixer pipeline on an element
 *
 * Pipeline logic:
 * 1. First, run composable (specialized) fixers - they can supersede base fixers
 * 2. Then run remaining fixers, skipping any superseded by composable fixers
 * 3. Within each phase, run in priority order (lower first)
 *
 * Fixers can be sync or async - we use `await Promise.resolve()` to handle both uniformly.
 */
export async function applyFixers(element: HTMLElement): Promise<ElementFixResult> {
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

  const allFixers = fixerRegistry.getAllSorted();

  // Phase 1: Run composable fixers first (they can supersede base fixers)
  for (const fixer of allFixers) {
    if (!isComposableFixer(fixer)) continue;

    if (fixer.shouldApply(context)) {
      try {
        const result = await Promise.resolve(fixer.apply(context));

        if (result.applied) {
          appliedFixers.push(result);
          handledFixerIds.add(fixer.id);
          // Mark composed base fixers as handled
          fixer.composesFixers.forEach((id) => handledFixerIds.add(id));
          logger.debug('Content', `Applied fixer: ${fixer.id}`);
        }
      } catch (err) {
        logger.error('Content', `Error applying fixer ${fixer.id}:`, err);
      }
    }
  }

  // Phase 2: Run remaining fixers (skip if already handled)
  for (const fixer of allFixers) {
    if (handledFixerIds.has(fixer.id)) continue;
    if (isComposableFixer(fixer)) continue; // Already processed

    if (fixer.shouldApply(context)) {
      try {
        const result = await Promise.resolve(fixer.apply(context));

        if (result.applied) {
          appliedFixers.push(result);
          handledFixerIds.add(fixer.id);
          logger.debug('Content', `Applied fixer: ${fixer.id}`);
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
