/**
 * Tests for the iframe fixer
 */

import { describe, it, expect, afterEach } from 'vitest';
import { iframeFixer } from '../../specialized/iframe-fixer';
import { createElement, createIframe, createFixerContext, cleanup } from '../test-utils';

describe('IframeFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(iframeFixer.id).toBe('specialized:iframe');
    });

    it('should have priority 100', () => {
      expect(iframeFixer.priority).toBe(100);
    });

    it('should compose base:height and base:overflow', () => {
      expect(iframeFixer.composesFixers).toContain('base:height');
      expect(iframeFixer.composesFixers).toContain('base:overflow');
    });
  });

  describe('shouldApply', () => {
    it('should return true for iframe elements', () => {
      const iframe = createIframe();
      const context = createFixerContext(iframe);

      expect(iframeFixer.shouldApply(context)).toBe(true);
    });

    it('should return false for non-iframe elements', () => {
      const div = createElement('div');
      const context = createFixerContext(div);

      expect(iframeFixer.shouldApply(context)).toBe(false);
    });

    it('should return false for other elements like video', () => {
      const video = document.createElement('video');
      const context = createFixerContext(video);

      expect(iframeFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should set iframe height based on scrollHeight (cross-origin)', () => {
      const iframe = createIframe({ height: '200px' });
      document.body.appendChild(iframe);
      // Mock as cross-origin iframe (contentDocument throws)
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => {
          throw new Error('Blocked by CORS');
        },
        configurable: true,
      });
      const context = createFixerContext(iframe);
      // Set context scrollHeight to 400
      (context as any).scrollHeight = 400;

      iframeFixer.apply(context);

      // Cross-origin uses max(scrollHeight, 800)
      expect(iframe.style.height).toBe('800px');
    });

    it('should set minHeight to match height (cross-origin)', () => {
      const iframe = createIframe();
      document.body.appendChild(iframe);
      // Mock as cross-origin iframe
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => {
          throw new Error('Blocked by CORS');
        },
        configurable: true,
      });
      const context = createFixerContext(iframe);
      // Set context scrollHeight to 900 (larger than 800)
      (context as any).scrollHeight = 900;

      iframeFixer.apply(context);

      expect(iframe.style.minHeight).toBe('900px');
    });

    it('should set maxHeight to none', () => {
      const iframe = createIframe();
      iframe.style.maxHeight = '300px';
      Object.defineProperty(iframe, 'scrollHeight', { value: 500 });
      document.body.appendChild(iframe);
      const context = createFixerContext(iframe);

      iframeFixer.apply(context);

      expect(iframe.style.maxHeight).toBe('none');
    });

    it('should set overflow to visible', () => {
      const iframe = createIframe();
      iframe.style.overflow = 'hidden';
      document.body.appendChild(iframe);
      const context = createFixerContext(iframe);

      iframeFixer.apply(context);

      expect(iframe.style.overflow).toBe('visible');
    });

    it('should use fallback height of at least 800px for cross-origin iframes', () => {
      const iframe = createIframe();
      Object.defineProperty(iframe, 'scrollHeight', { value: 100 });
      // contentDocument will be null for cross-origin
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => {
          throw new Error('Blocked by CORS');
        },
      });
      document.body.appendChild(iframe);
      const context = createFixerContext(iframe);

      iframeFixer.apply(context);

      // Should use max(scrollHeight, 800)
      expect(iframe.style.height).toBe('800px');
    });

    it('should return applied: true', () => {
      const iframe = createIframe();
      const context = createFixerContext(iframe);

      const result = iframeFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('specialized:iframe');
    });
  });

  describe('restore', () => {
    it('should restore original height', () => {
      const iframe = createIframe({ height: '200px' });
      const originalHeight = iframe.style.height;
      const context = createFixerContext(iframe);

      const result = iframeFixer.apply(context);
      result.restore();

      expect(iframe.style.height).toBe(originalHeight);
    });

    it('should restore original minHeight', () => {
      const iframe = createIframe();
      iframe.style.minHeight = '100px';
      const originalMinHeight = iframe.style.minHeight;
      const context = createFixerContext(iframe);

      const result = iframeFixer.apply(context);
      result.restore();

      expect(iframe.style.minHeight).toBe(originalMinHeight);
    });

    it('should restore original maxHeight', () => {
      const iframe = createIframe();
      iframe.style.maxHeight = '400px';
      const originalMaxHeight = iframe.style.maxHeight;
      const context = createFixerContext(iframe);

      const result = iframeFixer.apply(context);
      result.restore();

      expect(iframe.style.maxHeight).toBe(originalMaxHeight);
    });

    it('should restore original overflow', () => {
      const iframe = createIframe();
      iframe.style.overflow = 'hidden';
      const originalOverflow = iframe.style.overflow;
      const context = createFixerContext(iframe);

      const result = iframeFixer.apply(context);
      result.restore();

      expect(iframe.style.overflow).toBe(originalOverflow);
    });
  });
});
