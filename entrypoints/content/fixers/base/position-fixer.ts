/**
 * Position Fixer
 *
 * Handles position-related concerns:
 * - Ensures element has position context for lock indicators
 * - Only applies when element is statically positioned
 */

import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const positionFixer: Fixer = {
  id: 'base:position',
  priority: 30,

  shouldApply(context: FixerContext): boolean {
    // Apply if element is statically positioned (needs context for indicators)
    return context.computedStyle.position === 'static';
  },

  apply(context: FixerContext): FixerResult {
    const { element } = context;

    const originalPosition = element.style.position;

    // relative maintains layout but provides positioning context
    element.style.position = 'relative';

    return {
      fixerId: 'base:position',
      applied: true,
      restore() {
        element.style.position = originalPosition;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(positionFixer);
