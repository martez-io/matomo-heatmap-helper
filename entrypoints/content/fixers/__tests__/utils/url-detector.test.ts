/**
 * Tests for URL detection utilities
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  isRelativeUrl,
  toAbsoluteUrl,
  extractCssUrls,
  detectRelativeUrls,
} from '../../utils/url-detector';
import { createElement, cleanup } from '../test-utils';

describe('url-detector', () => {
  afterEach(() => {
    cleanup();
  });

  describe('isRelativeUrl', () => {
    it('should return true for path-relative URLs', () => {
      expect(isRelativeUrl('/assets/image.png')).toBe(true);
      expect(isRelativeUrl('images/photo.jpg')).toBe(true);
      expect(isRelativeUrl('./local.png')).toBe(true);
      expect(isRelativeUrl('../parent/file.jpg')).toBe(true);
    });

    it('should return false for absolute URLs', () => {
      expect(isRelativeUrl('https://example.com/image.png')).toBe(false);
      expect(isRelativeUrl('http://cdn.example.com/file.jpg')).toBe(false);
    });

    it('should return false for protocol-relative URLs', () => {
      expect(isRelativeUrl('//cdn.example.com/image.png')).toBe(false);
    });

    it('should return false for data URIs', () => {
      expect(isRelativeUrl('data:image/png;base64,abc')).toBe(false);
      expect(isRelativeUrl('data:text/plain,hello')).toBe(false);
    });

    it('should return false for blob URLs', () => {
      expect(isRelativeUrl('blob:https://example.com/uuid')).toBe(false);
    });

    it('should return false for fragment-only URLs', () => {
      expect(isRelativeUrl('#section')).toBe(false);
      expect(isRelativeUrl('#')).toBe(false);
    });

    it('should return false for empty or whitespace URLs', () => {
      expect(isRelativeUrl('')).toBe(false);
      expect(isRelativeUrl('   ')).toBe(false);
    });
  });

  describe('toAbsoluteUrl', () => {
    it('should convert path-relative URLs to absolute', () => {
      const base = 'https://example.com/page/index.html';
      expect(toAbsoluteUrl('/assets/image.png', base)).toBe(
        'https://example.com/assets/image.png'
      );
    });

    it('should convert relative URLs to absolute', () => {
      const base = 'https://example.com/page/index.html';
      expect(toAbsoluteUrl('images/photo.jpg', base)).toBe(
        'https://example.com/page/images/photo.jpg'
      );
    });

    it('should handle parent path navigation', () => {
      const base = 'https://example.com/page/sub/index.html';
      expect(toAbsoluteUrl('../image.png', base)).toBe(
        'https://example.com/page/image.png'
      );
    });

    it('should return original URL if parsing fails', () => {
      // Invalid URLs should return as-is
      expect(toAbsoluteUrl(':::invalid', 'also:::invalid')).toBe(':::invalid');
    });
  });

  describe('extractCssUrls', () => {
    it('should extract URL from url() without quotes', () => {
      expect(extractCssUrls('url(/path/image.png)')).toEqual(['/path/image.png']);
    });

    it('should extract URL from url() with double quotes', () => {
      expect(extractCssUrls('url("/path/image.png")')).toEqual(['/path/image.png']);
    });

    it('should extract URL from url() with single quotes', () => {
      expect(extractCssUrls("url('/path/image.png')")).toEqual(['/path/image.png']);
    });

    it('should extract multiple URLs', () => {
      const css = 'url(/path/a.png), url("/path/b.png")';
      expect(extractCssUrls(css)).toEqual(['/path/a.png', '/path/b.png']);
    });

    it('should handle whitespace in url()', () => {
      expect(extractCssUrls('url(  /path/image.png  )')).toEqual(['/path/image.png']);
    });

    it('should return empty array for no URLs', () => {
      expect(extractCssUrls('none')).toEqual([]);
      expect(extractCssUrls('')).toEqual([]);
    });
  });

  describe('detectRelativeUrls', () => {
    describe('img src', () => {
      it('should detect relative img src', () => {
        const container = createElement('div', {
          innerHTML: '<img src="/images/photo.jpg">',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].originalValue).toBe('/images/photo.jpg');
        expect(results[0].attribute).toBe('src');
        expect(results[0].absoluteUrl).toContain('/images/photo.jpg');
      });

      it('should not detect absolute img src', () => {
        const container = createElement('div', {
          innerHTML: '<img src="https://cdn.example.com/image.png">',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(0);
      });

      it('should detect multiple relative images', () => {
        const container = createElement('div', {
          innerHTML: `
            <img src="/images/a.jpg">
            <img src="/images/b.jpg">
          `,
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(2);
      });
    });

    describe('srcset', () => {
      it('should detect relative URLs in srcset', () => {
        const container = createElement('div', {
          innerHTML: '<img srcset="/small.jpg 1x, /large.jpg 2x">',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(2);
        expect(results[0].urlInValue).toBe('/small.jpg');
        expect(results[1].urlInValue).toBe('/large.jpg');
        expect(results[0].attribute).toBe('srcset');
      });

      it('should detect srcset with width descriptors', () => {
        const container = createElement('div', {
          innerHTML: '<img srcset="/small.jpg 480w, /large.jpg 1200w">',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(2);
        expect(results[0].urlInValue).toBe('/small.jpg');
        expect(results[1].urlInValue).toBe('/large.jpg');
      });

      it('should detect source[srcset] elements', () => {
        const container = createElement('div', {
          innerHTML: '<picture><source srcset="/mobile.jpg 1x"></picture>',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].urlInValue).toBe('/mobile.jpg');
      });
    });

    describe('video poster', () => {
      it('should detect relative video poster', () => {
        const container = createElement('div', {
          innerHTML: '<video poster="/poster.jpg"></video>',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].originalValue).toBe('/poster.jpg');
        expect(results[0].attribute).toBe('poster');
      });
    });

    describe('source src', () => {
      it('should detect relative source src', () => {
        const container = createElement('div', {
          innerHTML: '<video><source src="/video.mp4"></video>',
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].originalValue).toBe('/video.mp4');
        expect(results[0].attribute).toBe('src');
      });
    });

    describe('CSS background-image', () => {
      it('should detect relative URL in inline background-image', () => {
        const container = createElement('div', {
          style: {
            backgroundImage: 'url(/bg/pattern.png)',
          },
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].urlInValue).toBe('/bg/pattern.png');
        expect(results[0].cssProperty).toBe('backgroundImage');
        expect(results[0].attribute).toBe('style');
      });

      it('should detect relative URL with quotes', () => {
        const container = createElement('div', {
          style: {
            backgroundImage: 'url("/bg/pattern.png")',
          },
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(1);
        expect(results[0].urlInValue).toBe('/bg/pattern.png');
      });

      it('should not detect absolute URLs in background-image', () => {
        const container = createElement('div', {
          style: {
            backgroundImage: 'url(https://cdn.example.com/bg.png)',
          },
        });
        document.body.appendChild(container);

        const results = detectRelativeUrls(container);

        expect(results).toHaveLength(0);
      });
    });

    describe('document-level detection', () => {
      it('should detect relative URLs in entire document', () => {
        document.body.innerHTML = `
          <img src="/img1.jpg">
          <div><img src="/img2.jpg"></div>
          <video poster="/poster.jpg"></video>
        `;

        const results = detectRelativeUrls(document);

        expect(results).toHaveLength(3);
      });
    });
  });
});
