/**
 * Tests for the CORS resource fixer
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { corsFixer } from '../../specialized/cors-fixer';
import { createElement, createFixerContext, cleanup } from '../test-utils';

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));

import { browser } from 'wxt/browser';

const mockSendMessage = vi.mocked(browser.runtime.sendMessage);

// Cross-origin test URL (different from jsdom's about:blank origin)
const CROSS_ORIGIN_URL = 'https://cdn.example.com/image.png';
const CROSS_ORIGIN_URL_2 = 'https://cdn.other.com/bg.jpg';
const SAME_ORIGIN_URL = 'about:blank/image.png'; // Same origin as jsdom

describe('CorsFixer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(corsFixer.id).toBe('specialized:cors');
    });

    it('should have priority 5 (runs early)', () => {
      expect(corsFixer.priority).toBe(5);
    });
  });

  describe('shouldApply', () => {
    it('should return true for element containing images', () => {
      const container = createElement('div', {
        innerHTML: '<img src="test.jpg">',
      });
      const context = createFixerContext(container);

      expect(corsFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for img element itself', () => {
      const img = document.createElement('img');
      img.src = 'test.jpg';
      const context = createFixerContext(img);

      expect(corsFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with SVG use elements', () => {
      const container = createElement('div', {
        innerHTML: '<svg><use href="sprite.svg#icon"></use></svg>',
      });
      const context = createFixerContext(container);

      expect(corsFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with video poster', () => {
      const container = createElement('div', {
        innerHTML: '<video poster="poster.jpg"></video>',
      });
      const context = createFixerContext(container);

      expect(corsFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with background-image', () => {
      const container = createElement('div', {
        style: {
          backgroundImage: 'url("bg.jpg")',
        },
      });
      const context = createFixerContext(container);

      expect(corsFixer.shouldApply(context)).toBe(true);
    });

    it('should return false for plain element without resources when background-image is none', () => {
      const container = createElement('div', {
        innerHTML: '<p>Just text</p>',
        style: {
          backgroundImage: 'none',
        },
      });
      const context = createFixerContext(container);

      // Note: shouldApply is a cheap check that may return true even if no cross-origin
      // resources exist (e.g., if backgroundImage computed style is not exactly 'none').
      // The actual apply() method correctly returns applied: false when no resources found.
      // Here we explicitly set background-image to 'none' to test the false case.
      expect(corsFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should return applied: false when no cross-origin resources detected', async () => {
      // Use same-origin images (relative URLs)
      const container = createElement('div', {
        innerHTML: '<img src="/local/image.png">',
      });
      const context = createFixerContext(container);

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(false);
      expect(result.fixerId).toBe('specialized:cors');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should send cross-origin resources to background for fetching', async () => {
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/png;base64,iVBORw0KGgo=',
          },
        ],
        totalSizeBytes: 1000,
      });

      await corsFixer.apply(context);

      expect(mockSendMessage).toHaveBeenCalledWith({
        action: 'fetchCorsResources',
        requests: expect.arrayContaining([
          expect.objectContaining({
            url: CROSS_ORIGIN_URL,
            resourceType: 'image',
          }),
        ]),
      });
    });

    it('should apply data URIs to images on successful fetch', async () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const img = container.querySelector('img')!;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri,
          },
        ],
        totalSizeBytes: 1000,
      });

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(img.getAttribute('src')).toBe(dataUri);
    });

    it('should return applied: false when background fetch fails', async () => {
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Fetch failed',
      });

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(false);
    });

    it('should handle partial success (some resources fail)', async () => {
      const dataUri = 'data:image/png;base64,success=';
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL_2}" id="img2">
        `,
      });
      const img1 = container.querySelector('#img1') as HTMLImageElement;
      const img2 = container.querySelector('#img2') as HTMLImageElement;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri,
          },
          {
            id: 'cors-1',
            url: CROSS_ORIGIN_URL_2,
            success: false,
            error: '404 Not Found',
          },
        ],
        totalSizeBytes: 500,
      });

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(img1.getAttribute('src')).toBe(dataUri);
      // img2 should keep original URL since fetch failed
      expect(img2.getAttribute('src')).toBe(CROSS_ORIGIN_URL_2);
    });

    it('should deduplicate same URL used multiple times', async () => {
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL}" id="img2">
        `,
      });
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/png;base64,deduped=',
          },
        ],
        totalSizeBytes: 100,
      });

      await corsFixer.apply(context);

      // Should only send one request for the URL
      const call = mockSendMessage.mock.calls[0][0] as {
        action: string;
        requests: Array<{ url: string }>;
      };
      expect(call.requests.length).toBe(1);

      // But both images should get the data URI
      const img1 = container.querySelector('#img1') as HTMLImageElement;
      const img2 = container.querySelector('#img2') as HTMLImageElement;
      expect(img1.getAttribute('src')).toBe('data:image/png;base64,deduped=');
      expect(img2.getAttribute('src')).toBe('data:image/png;base64,deduped=');
    });

    it('should handle video poster attributes', async () => {
      const dataUri = 'data:image/jpeg;base64,poster=';
      const container = createElement('div', {
        innerHTML: `<video poster="${CROSS_ORIGIN_URL}"></video>`,
      });
      const video = container.querySelector('video')!;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri,
          },
        ],
        totalSizeBytes: 2000,
      });

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(video.getAttribute('poster')).toBe(dataUri);
    });

    it('should handle runtime errors gracefully', async () => {
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const context = createFixerContext(container);

      mockSendMessage.mockRejectedValue(new Error('Extension context invalidated'));

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore original image src after apply', async () => {
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const img = container.querySelector('img')!;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/png;base64,temp=',
          },
        ],
        totalSizeBytes: 100,
      });

      const result = await corsFixer.apply(context);

      // Verify data URI was applied
      expect(img.getAttribute('src')).toBe('data:image/png;base64,temp=');

      // Restore
      result.restore();

      // Verify original URL is back
      expect(img.getAttribute('src')).toBe(CROSS_ORIGIN_URL);
    });

    it('should restore multiple images', async () => {
      const container = createElement('div', {
        innerHTML: `
          <img src="${CROSS_ORIGIN_URL}" id="img1">
          <img src="${CROSS_ORIGIN_URL_2}" id="img2">
        `,
      });
      const img1 = container.querySelector('#img1') as HTMLImageElement;
      const img2 = container.querySelector('#img2') as HTMLImageElement;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/png;base64,one=',
          },
          {
            id: 'cors-1',
            url: CROSS_ORIGIN_URL_2,
            success: true,
            dataUri: 'data:image/png;base64,two=',
          },
        ],
        totalSizeBytes: 200,
      });

      const result = await corsFixer.apply(context);
      result.restore();

      expect(img1.getAttribute('src')).toBe(CROSS_ORIGIN_URL);
      expect(img2.getAttribute('src')).toBe(CROSS_ORIGIN_URL_2);
    });

    it('should restore video poster', async () => {
      const container = createElement('div', {
        innerHTML: `<video poster="${CROSS_ORIGIN_URL}"></video>`,
      });
      const video = container.querySelector('video')!;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/jpeg;base64,poster=',
          },
        ],
        totalSizeBytes: 100,
      });

      const result = await corsFixer.apply(context);
      result.restore();

      expect(video.getAttribute('poster')).toBe(CROSS_ORIGIN_URL);
    });

    it('should be safe to call restore even when apply returned false', async () => {
      const container = createElement('div', {
        innerHTML: '<img src="/local/image.png">',
      });
      const context = createFixerContext(container);

      const result = await corsFixer.apply(context);

      expect(result.applied).toBe(false);
      // Should not throw
      expect(() => result.restore()).not.toThrow();
    });

    it('should be safe to call restore multiple times', async () => {
      const container = createElement('div', {
        innerHTML: `<img src="${CROSS_ORIGIN_URL}">`,
      });
      const img = container.querySelector('img')!;
      const context = createFixerContext(container);

      mockSendMessage.mockResolvedValue({
        success: true,
        corsResults: [
          {
            id: 'cors-0',
            url: CROSS_ORIGIN_URL,
            success: true,
            dataUri: 'data:image/png;base64,x=',
          },
        ],
        totalSizeBytes: 50,
      });

      const result = await corsFixer.apply(context);
      result.restore();
      result.restore();
      result.restore();

      expect(img.getAttribute('src')).toBe(CROSS_ORIGIN_URL);
    });
  });
});
