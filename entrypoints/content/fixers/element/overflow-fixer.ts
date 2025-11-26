/**
 * Overflow Fixer
 *
 * Handles overflow constraints:
 * - Sets overflow to visible to show all content
 */

import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const overflowFixer: Fixer = {
  id: 'element:overflow',
  title: 'Remove scroll',
  priority: 20,
  scope: 'element',

  shouldApply(context: FixerContext): boolean {
    const { computedStyle } = context;
    const overflow = computedStyle.overflow;
    const overflowY = computedStyle.overflowY;

    // Apply if overflow is constrained in any way
    return (
      overflow === 'hidden' ||
      overflow === 'scroll' ||
      overflow === 'auto' ||
      overflowY === 'hidden' ||
      overflowY === 'scroll' ||
      overflowY === 'auto'
    );
  },

  apply(context: FixerContext): FixerResult {
    const { element } = context;

    const originalOverflow = element.style.overflow;
    const originalOverflowY = element.style.overflowY;

    element.style.overflow = 'visible';
    element.style.overflowY = 'visible';

    return {
      fixerId: 'element:overflow',
      applied: true,
      restore() {
        element.style.overflow = originalOverflow;
        element.style.overflowY = originalOverflowY;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(overflowFixer);
