/**
 * Fixer execution pipeline
 *
 * Two pipelines:
 * - applyElementFixers: Runs element-scope fixers on individual elements
 * - applyGlobalFixers: Runs global-scope fixers on entire document
 */

import type {
  FixerContext,
  GlobalFixerContext,
  ElementFixResult,
  GlobalFixResult,
  FixerResult,
} from './types';
import { isComposableFixer } from './types';
import { fixerRegistry } from './registry';
import { logger } from '@/lib/logger';

/**
 * Execute element-level fixers on a single element
 *
 * Pipeline logic:
 * 1. First, run composable fixers - they can supersede base fixers
 * 2. Then run remaining element fixers, skipping any superseded
 * 3. Within each phase, run in priority order (lower first)
 *
 * Fixers can be sync or async - we use `await Promise.resolve()` to handle both uniformly.
 */
export async function applyElementFixers(element: HTMLElement): Promise<ElementFixResult> {
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

  const elementFixers = fixerRegistry.getElementFixers();

  // Phase 1: Run composable fixers first (they can supersede base fixers)
  for (const fixer of elementFixers) {
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

  // Phase 2: Run remaining element fixers (skip if already handled)
  for (const fixer of elementFixers) {
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

/**
 * Execute global fixers on entire document
 *
 * Runs all global-scope fixers in priority order.
 * Used during screenshot preparation to fix document-wide issues.
 */
export async function applyGlobalFixers(doc: Document = document): Promise<GlobalFixResult> {
  const context: GlobalFixerContext = {
    document: doc,
  };

  const appliedFixers: FixerResult[] = [];
  const globalFixers = fixerRegistry.getGlobalFixers();

  for (const fixer of globalFixers) {
    if (fixer.shouldApply(context)) {
      try {
        const result = await Promise.resolve(fixer.apply(context));

        if (result.applied) {
          appliedFixers.push(result);
          logger.debug('Content', `Applied global fixer: ${fixer.id}`, result.count ? `(${result.count} items)` : '');
        }
      } catch (err) {
        logger.error('Content', `Error applying global fixer ${fixer.id}:`, err);
      }
    }
  }

  return {
    appliedFixers,
    timestamp: Date.now(),
    restoreAll() {
      // Restore in reverse order of application
      for (let i = appliedFixers.length - 1; i >= 0; i--) {
        const result = appliedFixers[i];
        try {
          result.restore();
          logger.debug('Content', `Restored global fixer: ${result.fixerId}`);
        } catch (err) {
          logger.error('Content', `Failed to restore global fixer ${result.fixerId}:`, err);
        }
      }
    },
  };
}

/**
 * Legacy alias for applyElementFixers
 * @deprecated Use applyElementFixers instead
 */
export const applyFixers = applyElementFixers;
