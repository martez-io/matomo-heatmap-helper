/**
 * Tests for URL converter utilities
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  applyAbsoluteUrl,
  restoreOriginalUrl,
  applyAbsoluteUrls,
  restoreOriginalUrls,
} from '../../utils/url-converter';
import type { DetectedRelativeUrl } from '../../types';
import { createElement, cleanup } from '../test-utils';

describe('url-converter', () => {
  afterEach(() => {
    cleanup();
  });

  describe('applyAbsoluteUrl', () => {
    it('should apply absolute URL to img src', () => {
      const img = createElement('img', {
        attributes: { src: '/images/photo.jpg' },
      });
      document.body.appendChild(img);

      const resource: DetectedRelativeUrl = {
        element: img,
        attribute: 'src',
        originalValue: '/images/photo.jpg',
        absoluteUrl: 'https://example.com/images/photo.jpg',
      };

      applyAbsoluteUrl(resource);

      expect(img.getAttribute('src')).toBe('https://example.com/images/photo.jpg');
    });

    it('should apply absolute URL to video poster', () => {
      const video = document.createElement('video');
      video.setAttribute('poster', '/poster.jpg');
      document.body.appendChild(video);

      const resource: DetectedRelativeUrl = {
        element: video,
        attribute: 'poster',
        originalValue: '/poster.jpg',
        absoluteUrl: 'https://example.com/poster.jpg',
      };

      applyAbsoluteUrl(resource);

      expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg');
    });

    it('should apply absolute URL in srcset', () => {
      const img = createElement('img', {
        attributes: { srcset: '/small.jpg 1x, /large.jpg 2x' },
      });
      document.body.appendChild(img);

      const resource: DetectedRelativeUrl = {
        element: img,
        attribute: 'srcset',
        originalValue: '/small.jpg 1x, /large.jpg 2x',
        absoluteUrl: 'https://example.com/small.jpg',
        urlInValue: '/small.jpg',
      };

      applyAbsoluteUrl(resource);

      expect(img.getAttribute('srcset')).toContain('https://example.com/small.jpg');
      expect(img.getAttribute('srcset')).toContain('/large.jpg 2x');
    });

    it('should apply absolute URL to CSS background-image', () => {
      const div = createElement('div', {
        style: { backgroundImage: 'url(/bg/pattern.png)' },
      });
      document.body.appendChild(div);

      const resource: DetectedRelativeUrl = {
        element: div,
        attribute: 'style',
        originalValue: 'url(/bg/pattern.png)',
        absoluteUrl: 'https://example.com/bg/pattern.png',
        cssProperty: 'backgroundImage',
        urlInValue: '/bg/pattern.png',
      };

      applyAbsoluteUrl(resource);

      expect(div.style.backgroundImage).toContain('https://example.com/bg/pattern.png');
    });

    it('should handle CSS background-image with double quotes', () => {
      const div = createElement('div', {
        style: { backgroundImage: 'url("/bg/pattern.png")' },
      });
      document.body.appendChild(div);

      const resource: DetectedRelativeUrl = {
        element: div,
        attribute: 'style',
        originalValue: 'url("/bg/pattern.png")',
        absoluteUrl: 'https://example.com/bg/pattern.png',
        cssProperty: 'backgroundImage',
        urlInValue: '/bg/pattern.png',
      };

      applyAbsoluteUrl(resource);

      expect(div.style.backgroundImage).toContain('https://example.com/bg/pattern.png');
    });
  });

  describe('restoreOriginalUrl', () => {
    it('should restore original img src', () => {
      const img = createElement('img', {
        attributes: { src: 'https://example.com/images/photo.jpg' },
      });
      document.body.appendChild(img);

      const resource: DetectedRelativeUrl = {
        element: img,
        attribute: 'src',
        originalValue: '/images/photo.jpg',
        absoluteUrl: 'https://example.com/images/photo.jpg',
      };

      restoreOriginalUrl(resource);

      expect(img.getAttribute('src')).toBe('/images/photo.jpg');
    });

    it('should restore original srcset', () => {
      const img = createElement('img', {
        attributes: {
          srcset: 'https://example.com/small.jpg 1x, https://example.com/large.jpg 2x',
        },
      });
      document.body.appendChild(img);

      const resource: DetectedRelativeUrl = {
        element: img,
        attribute: 'srcset',
        originalValue: '/small.jpg 1x, /large.jpg 2x',
        absoluteUrl: 'https://example.com/small.jpg',
        urlInValue: '/small.jpg',
      };

      restoreOriginalUrl(resource);

      expect(img.getAttribute('srcset')).toBe('/small.jpg 1x, /large.jpg 2x');
    });

    it('should restore original CSS background-image', () => {
      const div = createElement('div', {
        style: { backgroundImage: 'url("https://example.com/bg/pattern.png")' },
      });
      document.body.appendChild(div);

      const resource: DetectedRelativeUrl = {
        element: div,
        attribute: 'style',
        originalValue: 'url(/bg/pattern.png)',
        absoluteUrl: 'https://example.com/bg/pattern.png',
        cssProperty: 'backgroundImage',
        urlInValue: '/bg/pattern.png',
      };

      restoreOriginalUrl(resource);

      // Browser may normalize quotes, so check the path is restored
      expect(div.style.backgroundImage).toContain('/bg/pattern.png');
      expect(div.style.backgroundImage).not.toContain('https://');
    });
  });

  describe('applyAbsoluteUrls (batch)', () => {
    it('should apply multiple URLs efficiently', () => {
      const img1 = createElement('img', {
        attributes: { src: '/img1.jpg' },
      });
      const img2 = createElement('img', {
        attributes: { src: '/img2.jpg' },
      });
      document.body.appendChild(img1);
      document.body.appendChild(img2);

      const resources: DetectedRelativeUrl[] = [
        {
          element: img1,
          attribute: 'src',
          originalValue: '/img1.jpg',
          absoluteUrl: 'https://example.com/img1.jpg',
        },
        {
          element: img2,
          attribute: 'src',
          originalValue: '/img2.jpg',
          absoluteUrl: 'https://example.com/img2.jpg',
        },
      ];

      const applied = applyAbsoluteUrls(resources);

      expect(applied).toHaveLength(2);
      expect(img1.getAttribute('src')).toBe('https://example.com/img1.jpg');
      expect(img2.getAttribute('src')).toBe('https://example.com/img2.jpg');
    });

    it('should batch srcset replacements for same element', () => {
      const img = createElement('img', {
        attributes: { srcset: '/small.jpg 1x, /large.jpg 2x' },
      });
      document.body.appendChild(img);

      const resources: DetectedRelativeUrl[] = [
        {
          element: img,
          attribute: 'srcset',
          originalValue: '/small.jpg 1x, /large.jpg 2x',
          absoluteUrl: 'https://example.com/small.jpg',
          urlInValue: '/small.jpg',
        },
        {
          element: img,
          attribute: 'srcset',
          originalValue: '/small.jpg 1x, /large.jpg 2x',
          absoluteUrl: 'https://example.com/large.jpg',
          urlInValue: '/large.jpg',
        },
      ];

      const applied = applyAbsoluteUrls(resources);

      expect(applied).toHaveLength(2);
      const srcset = img.getAttribute('srcset');
      expect(srcset).toContain('https://example.com/small.jpg');
      expect(srcset).toContain('https://example.com/large.jpg');
    });
  });

  describe('restoreOriginalUrls (batch)', () => {
    it('should restore multiple URLs', () => {
      const img1 = createElement('img', {
        attributes: { src: 'https://example.com/img1.jpg' },
      });
      const img2 = createElement('img', {
        attributes: { src: 'https://example.com/img2.jpg' },
      });
      document.body.appendChild(img1);
      document.body.appendChild(img2);

      const resources: DetectedRelativeUrl[] = [
        {
          element: img1,
          attribute: 'src',
          originalValue: '/img1.jpg',
          absoluteUrl: 'https://example.com/img1.jpg',
        },
        {
          element: img2,
          attribute: 'src',
          originalValue: '/img2.jpg',
          absoluteUrl: 'https://example.com/img2.jpg',
        },
      ];

      restoreOriginalUrls(resources);

      expect(img1.getAttribute('src')).toBe('/img1.jpg');
      expect(img2.getAttribute('src')).toBe('/img2.jpg');
    });

    it('should restore srcset only once per element', () => {
      const img = createElement('img', {
        attributes: {
          srcset: 'https://example.com/small.jpg 1x, https://example.com/large.jpg 2x',
        },
      });
      document.body.appendChild(img);

      const resources: DetectedRelativeUrl[] = [
        {
          element: img,
          attribute: 'srcset',
          originalValue: '/small.jpg 1x, /large.jpg 2x',
          absoluteUrl: 'https://example.com/small.jpg',
          urlInValue: '/small.jpg',
        },
        {
          element: img,
          attribute: 'srcset',
          originalValue: '/small.jpg 1x, /large.jpg 2x',
          absoluteUrl: 'https://example.com/large.jpg',
          urlInValue: '/large.jpg',
        },
      ];

      restoreOriginalUrls(resources);

      expect(img.getAttribute('srcset')).toBe('/small.jpg 1x, /large.jpg 2x');
    });
  });
});
