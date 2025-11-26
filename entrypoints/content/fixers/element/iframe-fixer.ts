/**
 * Iframe Fixer
 *
 * Handles iframe elements:
 * - Adjusts iframe to fit its content (when same-origin)
 * - Falls back to a sensible height when cross-origin
 */

import type { ComposableFixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const iframeFixer: ComposableFixer = {
  id: 'element:iframe',
  title: 'Expand iframe',
  priority: 100,
  scope: 'element',
  composesFixers: ['element:height', 'element:overflow'],

  shouldApply(context: FixerContext): boolean {
    return context.element.tagName === 'IFRAME';
  },

  apply(context: FixerContext): FixerResult {
    const iframe = context.element as HTMLIFrameElement;

    const originalHeight = iframe.style.height;
    const originalMinHeight = iframe.style.minHeight;
    const originalMaxHeight = iframe.style.maxHeight;
    const originalOverflow = iframe.style.overflow;

    let targetHeight = context.scrollHeight;

    // Try to get content height from same-origin iframe
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc && iframeDoc.body) {
        targetHeight = Math.max(
          iframeDoc.body.scrollHeight,
          iframeDoc.documentElement.scrollHeight
        );
      }
    } catch {
      // Cross-origin - use a reasonable fallback
      targetHeight = Math.max(context.scrollHeight, 800);
    }

    iframe.style.height = `${targetHeight}px`;
    iframe.style.minHeight = `${targetHeight}px`;
    iframe.style.maxHeight = 'none';
    iframe.style.overflow = 'visible';

    return {
      fixerId: 'element:iframe',
      applied: true,
      restore() {
        iframe.style.height = originalHeight;
        iframe.style.minHeight = originalMinHeight;
        iframe.style.maxHeight = originalMaxHeight;
        iframe.style.overflow = originalOverflow;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(iframeFixer);
