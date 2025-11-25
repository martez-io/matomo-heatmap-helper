/**
 * Sticky Header Fixer
 *
 * Handles sticky/fixed positioned headers:
 * - Converts to relative/static to prevent overlap in screenshots
 * - Creates placeholder to maintain layout when converting from fixed
 */

import type { ComposableFixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const stickyHeaderFixer: ComposableFixer = {
  id: 'specialized:sticky-header',
  priority: 110,
  composesFixers: ['base:position'],

  shouldApply(context: FixerContext): boolean {
    const { element, computedStyle } = context;
    const position = computedStyle.position;
    const tagName = element.tagName.toLowerCase();

    // Target headers and navs that are fixed/sticky
    const isHeaderElement =
      tagName === 'header' ||
      tagName === 'nav' ||
      element.getAttribute('role') === 'banner' ||
      element.getAttribute('role') === 'navigation' ||
      element.classList.contains('header') ||
      element.classList.contains('navbar') ||
      element.classList.contains('nav') ||
      element.classList.contains('sticky');

    return isHeaderElement && (position === 'fixed' || position === 'sticky');
  },

  apply(context: FixerContext): FixerResult {
    const { element, computedStyle } = context;

    const originalPosition = element.style.position;
    const originalTop = element.style.top;
    const originalBottom = element.style.bottom;
    const originalLeft = element.style.left;
    const originalRight = element.style.right;
    const originalZIndex = element.style.zIndex;
    const originalWidth = element.style.width;

    // Get current dimensions for placeholder
    const rect = element.getBoundingClientRect();
    let placeholder: HTMLElement | null = null;

    // If fixed, create a placeholder to maintain scroll position
    if (computedStyle.position === 'fixed') {
      placeholder = document.createElement('div');
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.visibility = 'hidden';
      placeholder.dataset.mhhPlaceholder = 'true';
      element.parentElement?.insertBefore(placeholder, element);
    }

    // Convert to relative positioning
    element.style.position = 'relative';
    element.style.top = 'auto';
    element.style.bottom = 'auto';
    element.style.left = 'auto';
    element.style.right = 'auto';
    element.style.zIndex = 'auto';
    element.style.width = 'auto';

    return {
      fixerId: 'specialized:sticky-header',
      applied: true,
      restore() {
        element.style.position = originalPosition;
        element.style.top = originalTop;
        element.style.bottom = originalBottom;
        element.style.left = originalLeft;
        element.style.right = originalRight;
        element.style.zIndex = originalZIndex;
        element.style.width = originalWidth;

        if (placeholder && placeholder.parentElement) {
          placeholder.remove();
        }
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(stickyHeaderFixer);
