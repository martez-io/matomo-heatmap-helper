/**
 * Tests for global font CORS fixer
 *
 * This fixer embeds ALL fonts as data URIs because they'll become cross-origin
 * when Matomo renders the captured DOM on its own domain.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  fontCorsFixer,
  applyAndStoreFontCorsFixes,
  restoreFontCorsFixes,
  hasFontCorsFixes,
  clearFontCorsFixState,
} from '../../global/font-cors-fixer';
import { cleanup } from '../test-utils';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    init: vi.fn(),
  },
}));

// Mock browser API
const mockSendMessage = vi.fn();
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  },
}));

describe('font-cors-fixer', () => {
  beforeEach(() => {
    clearFontCorsFixState();
    mockSendMessage.mockReset();
  });

  afterEach(() => {
    cleanup();
    // Also clear head elements that cleanup() doesn't handle
    document.head.querySelectorAll('style[data-mhh-font-cors-fix]').forEach((el) => el.remove());
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
    clearFontCorsFixState();
  });

  describe('fixer metadata', () => {
    it('should have correct ID', () => {
      expect(fontCorsFixer.id).toBe('global:font-cors');
    });

    it('should have global scope', () => {
      expect(fontCorsFixer.scope).toBe('global');
    });

    it('should have priority 20', () => {
      expect(fontCorsFixer.priority).toBe(20);
    });

    it('should always return true for shouldApply', () => {
      expect(fontCorsFixer.shouldApply({ document })).toBe(true);
    });
  });

  describe('fixer.apply with no fonts', () => {
    it('should return applied=false when no fonts found', async () => {
      document.head.innerHTML = '';
      document.body.innerHTML = '<p>No fonts here</p>';

      const result = await fontCorsFixer.apply({ document });

      expect(result.applied).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should not inject any style element when no fonts found', async () => {
      document.head.innerHTML = '';

      await fontCorsFixer.apply({ document });

      const injectedStyle = document.querySelector('style[data-mhh-font-cors-fix]');
      expect(injectedStyle).toBeNull();
    });
  });

  describe('fixer.apply with fonts', () => {
    beforeEach(() => {
      // Mock successful CSS and font fetch
      mockSendMessage
        .mockResolvedValueOnce({
          // First call: fetchCssText
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  font-style: normal;
                  font-weight: 400;
                  src: url(https://fonts.gstatic.com/s/roboto/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          // Second call: fetchCorsResources (fonts)
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/s/roboto/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,MOCK_FONT_DATA',
            },
          ],
        });
    });

    it('should inject style element with embedded font data URIs', async () => {
      // Add a stylesheet link (fonts will be embedded as data URIs)
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      const result = await fontCorsFixer.apply({ document });

      expect(result.applied).toBe(true);
      expect(result.count).toBe(1);

      const injectedStyle = document.querySelector('style[data-mhh-font-cors-fix]');
      expect(injectedStyle).not.toBeNull();
      expect(injectedStyle?.textContent).toContain('@font-face');
      expect(injectedStyle?.textContent).toContain('data:font/woff2;base64,MOCK_FONT_DATA');
    });

    it('should call background script to fetch CSS and fonts', async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      await fontCorsFixer.apply({ document });

      // Should have called sendMessage twice: once for CSS, once for fonts
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'fetchCssText' })
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'fetchCorsResources' })
      );
    });
  });

  describe('restore functionality', () => {
    it('should remove injected style element on restore', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,DATA',
            },
          ],
        });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      const result = await fontCorsFixer.apply({ document });

      // Verify style was injected
      const stylesBeforeRestore = document.querySelectorAll('style[data-mhh-font-cors-fix]');
      expect(stylesBeforeRestore.length).toBe(1);

      // Restore using the result's restore function
      result.restore();

      // Verify style element count is 0 after restore
      const stylesAfterRestore = document.querySelectorAll('style[data-mhh-font-cors-fix]');
      expect(stylesAfterRestore.length).toBe(0);
    });
  });

  describe('state management (standalone API)', () => {
    it('should track state with applyAndStoreFontCorsFixes', async () => {
      document.head.innerHTML = '';

      expect(hasFontCorsFixes()).toBe(false);

      await applyAndStoreFontCorsFixes(document);

      // Even with no fonts, state is tracked
      expect(hasFontCorsFixes()).toBe(false); // false because no fonts applied
    });

    it('should clear state with restoreFontCorsFixes', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,DATA',
            },
          ],
        });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      await applyAndStoreFontCorsFixes(document);
      expect(hasFontCorsFixes()).toBe(true);

      restoreFontCorsFixes();
      expect(hasFontCorsFixes()).toBe(false);
    });

    it('should restore and clear state via restoreFontCorsFixes', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,DATA',
            },
          ],
        });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      await applyAndStoreFontCorsFixes(document);

      // Verify style was injected
      expect(document.querySelector('style[data-mhh-font-cors-fix]')).not.toBeNull();

      restoreFontCorsFixes();

      // Verify style was removed
      expect(document.querySelector('style[data-mhh-font-cors-fix]')).toBeNull();
    });

    it('should handle restoreFontCorsFixes when no fixes applied', () => {
      expect(hasFontCorsFixes()).toBe(false);
      expect(() => restoreFontCorsFixes()).not.toThrow();
    });

    it('should restore previous fixes when applying new ones', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,DATA1',
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: true,
              dataUri: 'data:font/woff2;base64,DATA2',
            },
          ],
        });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      // First application
      await applyAndStoreFontCorsFixes(document);

      // Should have one style element
      const firstStyles = document.querySelectorAll('style[data-mhh-font-cors-fix]');
      expect(firstStyles).toHaveLength(1);

      // Second application (should restore first)
      await applyAndStoreFontCorsFixes(document);

      // Should still have only one style element (old one removed)
      const secondStyles = document.querySelectorAll('style[data-mhh-font-cors-fix]');
      expect(secondStyles).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle CSS fetch failure gracefully', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      const result = await fontCorsFixer.apply({ document });

      expect(result.applied).toBe(false);
    });

    it('should handle font fetch failure gracefully', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          cssTextResults: [
            {
              url: 'https://fonts.googleapis.com/css2?family=Roboto',
              success: true,
              cssText: `
                @font-face {
                  font-family: 'Roboto';
                  src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2');
                }
              `,
            },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          corsResults: [
            {
              id: 'font-0',
              url: 'https://fonts.gstatic.com/roboto.woff2',
              success: false,
              error: 'HTTP 404',
            },
          ],
        });

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      const result = await fontCorsFixer.apply({ document });

      // Should return applied=false since no fonts were successfully fetched
      expect(result.applied).toBe(false);
    });
  });
});
