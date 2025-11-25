/**
 * Height Fixer
 *
 * Handles height-related constraints:
 * - Sets element height to scrollHeight to reveal hidden content
 * - Removes maxHeight constraints
 */

import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const heightFixer: Fixer = {
  id: 'element:height',
  priority: 10,
  scope: 'element',

  shouldApply(context: FixerContext): boolean {
    // Apply if element has hidden content (scrollHeight > clientHeight)
    return context.scrollHeight > context.clientHeight;
  },

  apply(context: FixerContext): FixerResult {
    const { element, scrollHeight } = context;

    // Store original values (closure captures them)
    const originalHeight = element.style.height;
    const originalMinHeight = element.style.minHeight;
    const originalMaxHeight = element.style.maxHeight;

    // Apply fix
    element.style.height = `${scrollHeight}px`;
    element.style.minHeight = `${scrollHeight}px`;
    element.style.maxHeight = 'none';

    return {
      fixerId: 'element:height',
      applied: true,
      restore() {
        element.style.height = originalHeight;
        element.style.minHeight = originalMinHeight;
        element.style.maxHeight = originalMaxHeight;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(heightFixer);
