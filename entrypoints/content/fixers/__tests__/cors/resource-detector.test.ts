/**
 * Tests for CORS resource detection utilities
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  isCrossOrigin,
  detectCorsResources,
  deduplicateByUrl,
} from '../../cors/resource-detector';
import { createElement, cleanup } from '../test-utils';

// Cross-origin test URL (different from jsdom's about:blank origin)
const CROSS_ORIGIN_URL = 'https://cdn.example.com/image.png';
const CROSS_ORIGIN_URL_2 = 'https://cdn.other.com/bg.jpg';

describe('resource-detector', () => {
  afterEach(() => {
    cleanup();
  });

  describe('isCrossOrigin', () => {
    it('should return true for fully-qualified cross-origin URLs', () => {
      expect(isCrossOrigin('https://cdn.example.com/image.png')).toBe(true);
      expect(isCrossOrigin('http://other-site.com/file.js')).toBe(true);
    });

    it('should return false for same-origin URLs', () => {
      // jsdom uses about:blank as origin
      expect(isCrossOrigin('/local/path.png')).toBe(false);
      expect(isCrossOrigin('./relative.png')).toBe(false);
    });

    it('should return false for data URIs', () => {
      expect(isCrossOrigin('data:image/png;base64,abc')).toBe(false);
      expect(isCrossOrigin('data:text/plain,hello')).toBe(false);
    });

    it('should return false for blob URLs', () => {
      expect(isCrossOrigin('blob:https://example.com/uuid')).toBe(false);
    });

    it('should return false for fragment-only URLs', () => {
      expect(isCrossOrigin('#section')).toBe(false);
      expect(isCrossOrigin('#')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isCrossOrigin('')).toBe(false);
      expect(isCrossOrigin('not a url at all')).toBe(false);
    });
  });

  describe('detectCorsResources', () => {
    describe('img elements', () => {
      it('should detect cross-origin img src', () => {
        const container = createElement('div', {
          innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(1);
        expect(resources[0].url).toBe(CROSS_ORIGIN_URL);
        expect(resources[0].attribute).toBe('src');
        expect(resources[0].resourceType).toBe('image');
      });

      it('should detect multiple cross-origin images', () => {
        const container = createElement('div', {
          innerHTML: `
            <img src="${CROSS_ORIGIN_URL}">
            <img src="${CROSS_ORIGIN_URL_2}">
          `,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(2);
        expect(resources.map((r) => r.url)).toContain(CROSS_ORIGIN_URL);
        expect(resources.map((r) => r.url)).toContain(CROSS_ORIGIN_URL_2);
      });

      it('should detect img when root is img element', () => {
        const img = document.createElement('img');
        img.src = CROSS_ORIGIN_URL;
        document.body.appendChild(img);

        const resources = detectCorsResources(img);

        expect(resources).toHaveLength(1);
        expect(resources[0].url).toBe(CROSS_ORIGIN_URL);
      });

      it('should not detect same-origin images', () => {
        const container = createElement('div', {
          innerHTML: '<img src="/local/image.png">',
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(0);
      });

      it('should detect multiple elements with same URL', () => {
        const container = createElement('div', {
          innerHTML: `
            <img src="${CROSS_ORIGIN_URL}" id="img1">
            <img src="${CROSS_ORIGIN_URL}" id="img2">
          `,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(2);
        expect(resources[0].url).toBe(CROSS_ORIGIN_URL);
        expect(resources[1].url).toBe(CROSS_ORIGIN_URL);
      });
    });

    describe('SVG use elements', () => {
      it('should detect cross-origin SVG use href', () => {
        const container = createElement('div', {
          innerHTML: `<svg><use href="${CROSS_ORIGIN_URL}#icon"></use></svg>`,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(1);
        expect(resources[0].url).toBe(`${CROSS_ORIGIN_URL}#icon`);
        expect(resources[0].attribute).toBe('href');
        expect(resources[0].resourceType).toBe('svg');
      });

      it('should not detect local SVG use references', () => {
        const container = createElement('div', {
          innerHTML: '<svg><use href="#local-icon"></use></svg>',
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(0);
      });
    });

    describe('video poster', () => {
      it('should detect cross-origin video poster', () => {
        const container = createElement('div', {
          innerHTML: `<video poster="${CROSS_ORIGIN_URL}"></video>`,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources).toHaveLength(1);
        expect(resources[0].url).toBe(CROSS_ORIGIN_URL);
        expect(resources[0].attribute).toBe('poster');
        expect(resources[0].resourceType).toBe('image');
      });
    });

    describe('srcset', () => {
      it('should detect first cross-origin URL in srcset', () => {
        const container = createElement('div', {
          innerHTML: `<img srcset="${CROSS_ORIGIN_URL} 1x, ${CROSS_ORIGIN_URL_2} 2x">`,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        // Should detect the first cross-origin URL
        expect(resources).toHaveLength(1);
        expect(resources[0].url).toBe(CROSS_ORIGIN_URL);
        expect(resources[0].attribute).toBe('srcset');
      });
    });

    describe('originalValue tracking', () => {
      it('should preserve originalValue for restoration', () => {
        const container = createElement('div', {
          innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
        });
        document.body.appendChild(container);

        const resources = detectCorsResources(container);

        expect(resources[0].originalValue).toBe(CROSS_ORIGIN_URL);
      });
    });
  });

  describe('deduplicateByUrl', () => {
    it('should group resources by URL', () => {
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL}" id="img2">
          <img src="${CROSS_ORIGIN_URL_2}" id="img3">
        `,
      });
      document.body.appendChild(container);

      const resources = detectCorsResources(container);
      const { unique, mapping } = deduplicateByUrl(resources);

      // Should have 2 unique URLs
      expect(unique).toHaveLength(2);

      // Mapping should have both images for CROSS_ORIGIN_URL
      const sameUrlResources = mapping.get(CROSS_ORIGIN_URL);
      expect(sameUrlResources).toHaveLength(2);

      // And one for CROSS_ORIGIN_URL_2
      const otherUrlResources = mapping.get(CROSS_ORIGIN_URL_2);
      expect(otherUrlResources).toHaveLength(1);
    });

    it('should preserve element references in mapping', () => {
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL}" id="img2">
        `,
      });
      document.body.appendChild(container);

      const resources = detectCorsResources(container);
      const { mapping } = deduplicateByUrl(resources);

      const sameUrlResources = mapping.get(CROSS_ORIGIN_URL)!;
      const ids = sameUrlResources.map((r) => r.element.id);

      expect(ids).toContain('img1');
      expect(ids).toContain('img2');
    });

    it('should return unique request objects', () => {
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL}" id="img2">
        `,
      });
      document.body.appendChild(container);

      const resources = detectCorsResources(container);
      const { unique } = deduplicateByUrl(resources);

      expect(unique).toHaveLength(1);
      expect(unique[0].url).toBe(CROSS_ORIGIN_URL);
      expect(unique[0].resourceType).toBe('image');
    });

    it('should handle empty resources array', () => {
      const { unique, mapping } = deduplicateByUrl([]);

      expect(unique).toHaveLength(0);
      expect(mapping.size).toBe(0);
    });
  });
});
