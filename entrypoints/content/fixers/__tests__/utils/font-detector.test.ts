/**
 * Tests for font detection utilities
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseFontSrc,
  collectStylesheets,
  extractFontFacesFromCssText,
  getFontUrlsToProxy,
  generateFontFaceCss,
} from '../../utils/font-detector';
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

// Mock browser API for detectFontFaces (async tests)
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
}));

describe('font-detector', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('parseFontSrc', () => {
    const baseUrl = 'https://example.com/styles/main.css';

    it('should parse simple url() with single quotes', () => {
      const src = "url('/fonts/Roboto-Regular.woff2')";
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto-Regular.woff2');
      expect(result[0].format).toBeUndefined();
    });

    it('should parse url() with double quotes', () => {
      const src = 'url("/fonts/Roboto-Regular.woff2")';
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto-Regular.woff2');
    });

    it('should parse url() without quotes', () => {
      const src = 'url(/fonts/Roboto-Regular.woff2)';
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto-Regular.woff2');
    });

    it('should parse url() with format()', () => {
      const src = "url('/fonts/Roboto.woff2') format('woff2')";
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto.woff2');
      expect(result[0].format).toBe('woff2');
    });

    it('should parse multiple url() entries', () => {
      const src = `url('/fonts/Roboto.woff2') format('woff2'), url('/fonts/Roboto.woff') format('woff')`;
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto.woff2');
      expect(result[0].format).toBe('woff2');
      expect(result[1].url).toBe('https://example.com/fonts/Roboto.woff');
      expect(result[1].format).toBe('woff');
    });

    it('should mark cross-origin URLs correctly', () => {
      const src = "url('https://fonts.gstatic.com/Roboto.woff2') format('woff2')";
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].isCrossOrigin).toBe(true);
    });

    it('should mark same-origin URLs correctly', () => {
      // Use URLs that match the base URL's origin
      const src = "url('https://example.com/fonts/Roboto.woff2') format('woff2')";
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      // Both URLs are on example.com, so not cross-origin relative to the stylesheet
      // But isCrossOrigin checks against window.location.origin (localhost:3000 in tests)
      // So this will be cross-origin from the page's perspective
      expect(result[0].isCrossOrigin).toBe(true);
    });

    it('should mark localhost URLs as same-origin in test environment', () => {
      const src = "url('http://localhost:3000/fonts/Roboto.woff2') format('woff2')";
      const result = parseFontSrc(src, 'http://localhost:3000/styles/main.css');

      expect(result).toHaveLength(1);
      expect(result[0].isCrossOrigin).toBe(false);
    });

    it('should resolve relative URLs against base URL', () => {
      const src = "url('../fonts/Roboto.woff2')";
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/fonts/Roboto.woff2');
    });

    it('should preserve data URIs without modification', () => {
      const dataUri =
        'data:font/woff2;base64,d09GMgABAAAAAAKAAoAAAAABkgAAAJUAAEAAAAAAAAAAAAAAAAAAAAAA';
      const src = `url('${dataUri}') format('woff2')`;
      const result = parseFontSrc(src, baseUrl);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(dataUri);
      expect(result[0].isCrossOrigin).toBe(false);
    });

    it('should handle Google Fonts URL pattern', () => {
      const googleFontsBase = 'https://fonts.googleapis.com/css2';
      const src =
        "url(https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2) format('woff2')";
      const result = parseFontSrc(src, googleFontsBase);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2'
      );
      expect(result[0].format).toBe('woff2');
      expect(result[0].isCrossOrigin).toBe(true);
    });

    it('should return empty array for invalid src', () => {
      const result = parseFontSrc('', baseUrl);
      expect(result).toHaveLength(0);
    });
  });

  describe('collectStylesheets', () => {
    it('should collect inline style elements', () => {
      const style = document.createElement('style');
      style.textContent = 'body { color: red; }';
      document.head.appendChild(style);

      const { stylesheets } = collectStylesheets(document);

      expect(stylesheets.some((s) => s.type === 'inline')).toBe(true);
    });

    it('should categorize link stylesheets by origin', () => {
      // Create a link element (won't actually load in test)
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto';
      document.head.appendChild(link);

      const { stylesheets } = collectStylesheets(document);

      // Should be categorized as cross-origin (can't access rules)
      const linkSource = stylesheets.find((s) => s.url?.includes('fonts.googleapis.com'));
      expect(linkSource?.type).toBe('cross-origin');
    });

    it('should return empty arrays for document with no stylesheets', () => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';

      const { stylesheets, crossOriginImports } = collectStylesheets(document);

      expect(stylesheets).toEqual([]);
      expect(crossOriginImports).toEqual([]);
    });

    it('should return crossOriginImports array', () => {
      // Even with no stylesheets, should return the structure
      document.head.innerHTML = '';
      const { stylesheets, crossOriginImports } = collectStylesheets(document);

      expect(Array.isArray(stylesheets)).toBe(true);
      expect(Array.isArray(crossOriginImports)).toBe(true);
    });
  });

  describe('extractFontFacesFromCssText', () => {
    it('should extract @font-face from CSS text', () => {
      const cssText = `
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-weight: 400;
          src: url(https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://fonts.googleapis.com/css2?family=Roboto';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(1);
      expect(fonts[0].familyName).toBe('Roboto');
      expect(fonts[0].fontStyle).toBe('normal');
      expect(fonts[0].fontWeight).toBe('400');
      expect(fonts[0].sourceType).toBe('cross-origin');
      expect(fonts[0].fontUrls).toHaveLength(1);
    });

    it('should extract multiple @font-face rules', () => {
      const cssText = `
        @font-face {
          font-family: 'Roboto';
          font-weight: 400;
          src: url(roboto-regular.woff2) format('woff2');
        }
        @font-face {
          font-family: 'Roboto';
          font-weight: 700;
          src: url(roboto-bold.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(2);
      expect(fonts[0].fontWeight).toBe('400');
      expect(fonts[1].fontWeight).toBe('700');
    });

    it('should handle @font-face with font-display', () => {
      const cssText = `
        @font-face {
          font-family: 'Roboto';
          font-display: swap;
          src: url(roboto.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts[0].fontDisplay).toBe('swap');
    });

    it('should handle @font-face with unicode-range', () => {
      const cssText = `
        @font-face {
          font-family: 'Roboto';
          unicode-range: U+0000-00FF;
          src: url(roboto.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts[0].unicodeRange).toBe('U+0000-00FF');
    });

    it('should skip @font-face without font-family', () => {
      const cssText = `
        @font-face {
          src: url(roboto.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(0);
    });

    it('should skip @font-face without src', () => {
      const cssText = `
        @font-face {
          font-family: 'Roboto';
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(0);
    });

    it('should extract @font-face inside @media blocks', () => {
      const cssText = `
        @media (min-width: 768px) {
          @font-face {
            font-family: 'Roboto';
            font-weight: 400;
            src: url(roboto.woff2) format('woff2');
          }
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(1);
      expect(fonts[0].familyName).toBe('Roboto');
    });

    it('should extract @font-face inside @supports blocks', () => {
      const cssText = `
        @supports (font-variation-settings: normal) {
          @font-face {
            font-family: 'VariableFont';
            src: url(variable.woff2) format('woff2-variations');
          }
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(1);
      expect(fonts[0].familyName).toBe('VariableFont');
    });

    it('should extract both top-level and nested @font-face', () => {
      const cssText = `
        @font-face {
          font-family: 'TopLevel';
          src: url(top.woff2) format('woff2');
        }
        @media screen {
          @font-face {
            font-family: 'Nested';
            src: url(nested.woff2) format('woff2');
          }
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(2);
      expect(fonts.map((f) => f.familyName)).toContain('TopLevel');
      expect(fonts.map((f) => f.familyName)).toContain('Nested');
    });

    it('should handle CSS comments correctly', () => {
      const cssText = `
        /* This is a comment with @font-face { font-family: Fake; } */
        @font-face {
          font-family: 'Real';
          src: url(real.woff2) format('woff2');
        }
      `;
      const sourceUrl = 'https://example.com/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(1);
      expect(fonts[0].familyName).toBe('Real');
    });

    it('should handle real-world Tiempos font pattern', () => {
      // This is the actual pattern from the user's issue
      const cssText = `
        @font-face {
          font-family: Tiempos Headline;
          src: url(/assets/fonts/tiempos-headline-web-medium.woff2) format("truetype");
        }
      `;
      const sourceUrl = 'https://app.quetschn.academy/styles.css';

      const fonts = extractFontFacesFromCssText(cssText, sourceUrl);

      expect(fonts).toHaveLength(1);
      expect(fonts[0].familyName).toBe('Tiempos Headline');
      expect(fonts[0].fontUrls).toHaveLength(1);
      expect(fonts[0].fontUrls[0].url).toBe(
        'https://app.quetschn.academy/assets/fonts/tiempos-headline-web-medium.woff2'
      );
    });
  });

  describe('getFontUrlsToProxy', () => {
    it('should extract all unique font URLs', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
            { url: 'https://fonts.gstatic.com/roboto.woff', format: 'woff', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
        {
          familyName: 'Open Sans',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/opensans.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const urls = getFontUrlsToProxy(fonts);

      expect(urls).toHaveLength(3);
      expect(urls).toContain('https://fonts.gstatic.com/roboto.woff2');
      expect(urls).toContain('https://fonts.gstatic.com/roboto.woff');
      expect(urls).toContain('https://fonts.gstatic.com/opensans.woff2');
    });

    it('should deduplicate URLs used by multiple fonts', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontWeight: '400',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
        {
          familyName: 'Roboto',
          fontWeight: '700',
          fontUrls: [
            {
              url: 'https://fonts.gstatic.com/roboto.woff2',
              format: 'woff2',
              isCrossOrigin: true,
            }, // Same URL
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const urls = getFontUrlsToProxy(fonts);

      expect(urls).toHaveLength(1);
    });

    it('should include same-origin URLs (they need proxying for Matomo)', () => {
      const fonts = [
        {
          familyName: 'Custom',
          fontUrls: [
            {
              url: 'https://example.com/fonts/custom.woff2',
              format: 'woff2',
              isCrossOrigin: false,
            },
            {
              url: 'https://fonts.gstatic.com/roboto.woff2',
              format: 'woff2',
              isCrossOrigin: true,
            },
          ],
          originalCssText: '',
          sourceType: 'same-origin' as const,
        },
      ];

      const urls = getFontUrlsToProxy(fonts);

      // Now returns ALL font URLs since they'll be cross-origin when Matomo renders
      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://example.com/fonts/custom.woff2');
      expect(urls).toContain('https://fonts.gstatic.com/roboto.woff2');
    });

    it('should exclude data URIs', () => {
      const fonts = [
        {
          familyName: 'Embedded',
          fontUrls: [
            {
              url: 'data:font/woff2;base64,abc123',
              format: 'woff2',
              isCrossOrigin: false,
            },
          ],
          originalCssText: '',
          sourceType: 'inline' as const,
        },
      ];

      const urls = getFontUrlsToProxy(fonts);

      expect(urls).toHaveLength(0);
    });
  });

  describe('generateFontFaceCss', () => {
    it('should generate @font-face CSS with data URIs', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontWeight: '400',
          fontStyle: 'normal',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const dataUriMap = new Map([
        ['https://fonts.gstatic.com/roboto.woff2', 'data:font/woff2;base64,FONT_DATA'],
      ]);

      const css = generateFontFaceCss(fonts, dataUriMap);

      expect(css).toContain('@font-face');
      expect(css).toContain('font-family: "Roboto"');
      expect(css).toContain('font-weight: 400');
      expect(css).toContain('font-style: normal');
      expect(css).toContain('data:font/woff2;base64,FONT_DATA');
      expect(css).toContain('format("woff2")');
    });

    it('should include font-display when present', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontDisplay: 'swap',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const dataUriMap = new Map([
        ['https://fonts.gstatic.com/roboto.woff2', 'data:font/woff2;base64,DATA'],
      ]);

      const css = generateFontFaceCss(fonts, dataUriMap);

      expect(css).toContain('font-display: swap');
    });

    it('should include unicode-range when present', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          unicodeRange: 'U+0000-00FF',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const dataUriMap = new Map([
        ['https://fonts.gstatic.com/roboto.woff2', 'data:font/woff2;base64,DATA'],
      ]);

      const css = generateFontFaceCss(fonts, dataUriMap);

      expect(css).toContain('unicode-range: U+0000-00FF');
    });

    it('should keep same-origin URLs as-is', () => {
      const fonts = [
        {
          familyName: 'Custom',
          fontUrls: [
            {
              url: 'https://example.com/fonts/custom.woff2',
              format: 'woff2',
              isCrossOrigin: false,
            },
          ],
          originalCssText: '',
          sourceType: 'same-origin' as const,
        },
      ];

      const dataUriMap = new Map<string, string>();

      const css = generateFontFaceCss(fonts, dataUriMap);

      expect(css).toContain('https://example.com/fonts/custom.woff2');
    });

    it('should fall back to original URLs when no data URIs fetched', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      // Empty map = no data URIs fetched
      const dataUriMap = new Map<string, string>();

      const css = generateFontFaceCss(fonts, dataUriMap);

      // Should fall back to original URL
      expect(css).toContain('@font-face');
      expect(css).toContain('https://fonts.gstatic.com/roboto.woff2');
    });

    it('should generate multiple @font-face rules', () => {
      const fonts = [
        {
          familyName: 'Roboto',
          fontWeight: '400',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto-400.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
        {
          familyName: 'Roboto',
          fontWeight: '700',
          fontUrls: [
            { url: 'https://fonts.gstatic.com/roboto-700.woff2', format: 'woff2', isCrossOrigin: true },
          ],
          originalCssText: '',
          sourceType: 'cross-origin' as const,
        },
      ];

      const dataUriMap = new Map([
        ['https://fonts.gstatic.com/roboto-400.woff2', 'data:font/woff2;base64,DATA400'],
        ['https://fonts.gstatic.com/roboto-700.woff2', 'data:font/woff2;base64,DATA700'],
      ]);

      const css = generateFontFaceCss(fonts, dataUriMap);

      const fontFaceCount = (css.match(/@font-face/g) || []).length;
      expect(fontFaceCount).toBe(2);
      expect(css).toContain('font-weight: 400');
      expect(css).toContain('font-weight: 700');
    });
  });
});
