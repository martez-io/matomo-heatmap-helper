/**
 * Tests for global relative URL fixer
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  relativeUrlFixer,
  applyAndStoreDocumentUrlFixes,
  restoreDocumentUrlFixes,
  hasDocumentUrlFixes,
  clearDocumentUrlFixState,
} from '../../global/relative-url-fixer';
import { createElement, cleanup } from '../test-utils';

// Mock the logger to avoid import issues
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    init: vi.fn(),
  },
}));

describe('relative-url-fixer', () => {
  beforeEach(() => {
    clearDocumentUrlFixState();
  });

  afterEach(() => {
    cleanup();
    clearDocumentUrlFixState();
  });

  describe('fixer metadata', () => {
    it('should have correct ID', () => {
      expect(relativeUrlFixer.id).toBe('global:relative-url');
    });

    it('should have global scope', () => {
      expect(relativeUrlFixer.scope).toBe('global');
    });

    it('should have priority 10', () => {
      expect(relativeUrlFixer.priority).toBe(10);
    });
  });

  describe('fixer.apply', () => {
    it('should return applied=false when no relative URLs found', async () => {
      document.body.innerHTML = '<img src="https://cdn.example.com/image.png">';

      const result = await relativeUrlFixer.apply({ document });

      expect(result.applied).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should detect and convert relative URLs', async () => {
      document.body.innerHTML = `
        <img src="/images/photo.jpg">
        <img src="/images/other.jpg">
      `;

      const result = await relativeUrlFixer.apply({ document });

      expect(result.applied).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should convert img src to absolute URL', () => {
      document.body.innerHTML = '<img src="/images/photo.jpg">';

      relativeUrlFixer.apply({ document });

      const img = document.querySelector('img');
      expect(img?.getAttribute('src')).toContain('/images/photo.jpg');
      expect(img?.getAttribute('src')).toMatch(/^https?:\/\//);
    });

    it('should convert srcset URLs to absolute', () => {
      document.body.innerHTML = '<img srcset="/small.jpg 1x, /large.jpg 2x">';

      relativeUrlFixer.apply({ document });

      const img = document.querySelector('img');
      const srcset = img?.getAttribute('srcset') || '';
      expect(srcset).toMatch(/https?:\/\/.*\/small\.jpg/);
      expect(srcset).toMatch(/https?:\/\/.*\/large\.jpg/);
    });

    it('should convert video poster to absolute URL', () => {
      document.body.innerHTML = '<video poster="/poster.jpg"></video>';

      relativeUrlFixer.apply({ document });

      const video = document.querySelector('video');
      expect(video?.getAttribute('poster')).toMatch(/^https?:\/\//);
    });

    it('should handle CSS background-image', () => {
      const div = createElement('div', {
        style: { backgroundImage: 'url(/bg/pattern.png)' },
      });
      document.body.appendChild(div);

      relativeUrlFixer.apply({ document });

      expect(div.style.backgroundImage).toMatch(/https?:\/\//);
    });
  });

  describe('restore functionality', () => {
    it('should restore all converted URLs via result.restore()', async () => {
      document.body.innerHTML = `
        <img src="/images/photo.jpg" id="img1">
        <img src="/images/other.jpg" id="img2">
      `;

      const result = await relativeUrlFixer.apply({ document });

      // Verify conversion happened
      const img1 = document.getElementById('img1');
      expect(img1?.getAttribute('src')).toMatch(/^https?:\/\//);

      // Restore
      result.restore();

      // Verify restoration
      expect(img1?.getAttribute('src')).toBe('/images/photo.jpg');
      expect(document.getElementById('img2')?.getAttribute('src')).toBe('/images/other.jpg');
    });

    it('should restore srcset to original value', async () => {
      document.body.innerHTML = '<img srcset="/small.jpg 1x, /large.jpg 2x">';

      const result = await relativeUrlFixer.apply({ document });
      result.restore();

      const img = document.querySelector('img');
      expect(img?.getAttribute('srcset')).toBe('/small.jpg 1x, /large.jpg 2x');
    });
  });

  describe('state management (legacy API)', () => {
    it('should store result with applyAndStoreDocumentUrlFixes', () => {
      document.body.innerHTML = '<img src="/images/photo.jpg">';

      expect(hasDocumentUrlFixes()).toBe(false);

      applyAndStoreDocumentUrlFixes(document);

      expect(hasDocumentUrlFixes()).toBe(true);
    });

    it('should clear state with restoreDocumentUrlFixes', () => {
      document.body.innerHTML = '<img src="/images/photo.jpg">';

      applyAndStoreDocumentUrlFixes(document);
      expect(hasDocumentUrlFixes()).toBe(true);

      restoreDocumentUrlFixes();
      expect(hasDocumentUrlFixes()).toBe(false);
    });

    it('should restore URLs and clear state', () => {
      document.body.innerHTML = '<img src="/images/photo.jpg" id="test-img">';

      applyAndStoreDocumentUrlFixes(document);

      // Verify conversion
      const img = document.getElementById('test-img');
      expect(img?.getAttribute('src')).toMatch(/^https?:\/\//);

      restoreDocumentUrlFixes();

      // Verify restoration
      expect(img?.getAttribute('src')).toBe('/images/photo.jpg');
    });

    it('should restore previous fixes when applying new ones', () => {
      document.body.innerHTML = '<img src="/images/photo.jpg" id="test-img">';

      // First application
      applyAndStoreDocumentUrlFixes(document);

      // Modify DOM and apply again
      const img = document.getElementById('test-img');
      expect(img?.getAttribute('src')).toMatch(/^https?:\/\//);

      // Second application should restore first
      applyAndStoreDocumentUrlFixes(document);

      // Should still be converted (re-applied)
      expect(img?.getAttribute('src')).toMatch(/^https?:\/\//);
    });

    it('should handle restoreDocumentUrlFixes when no fixes applied', () => {
      expect(hasDocumentUrlFixes()).toBe(false);
      expect(() => restoreDocumentUrlFixes()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should not modify absolute URLs', () => {
      const absoluteUrl = 'https://cdn.example.com/image.png';
      document.body.innerHTML = `<img src="${absoluteUrl}">`;

      relativeUrlFixer.apply({ document });

      const img = document.querySelector('img');
      expect(img?.getAttribute('src')).toBe(absoluteUrl);
    });

    it('should not modify data URIs', () => {
      const dataUri = 'data:image/png;base64,abc123';
      document.body.innerHTML = `<img src="${dataUri}">`;

      relativeUrlFixer.apply({ document });

      const img = document.querySelector('img');
      expect(img?.getAttribute('src')).toBe(dataUri);
    });

    it('should handle empty document', async () => {
      document.body.innerHTML = '';

      const result = await relativeUrlFixer.apply({ document });

      expect(result.applied).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle mixed absolute and relative URLs', async () => {
      document.body.innerHTML = `
        <img src="/relative.jpg" id="relative">
        <img src="https://cdn.example.com/absolute.jpg" id="absolute">
      `;

      const result = await relativeUrlFixer.apply({ document });

      expect(result.count).toBe(1);

      const relativeImg = document.getElementById('relative');
      const absoluteImg = document.getElementById('absolute');

      expect(relativeImg?.getAttribute('src')).toMatch(/^https?:\/\//);
      expect(absoluteImg?.getAttribute('src')).toBe('https://cdn.example.com/absolute.jpg');
    });
  });
});
