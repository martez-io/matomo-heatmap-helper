/**
 * Font CORS Fixer (Global Scope)
 *
 * Embeds all fonts as data URIs to prevent CORS errors when Matomo renders
 * the captured DOM. This is necessary because Matomo renders heatmaps on its
 * own domain (e.g., matomo.example.com), making ALL fonts from the original
 * page (e.g., app.example.com) cross-origin - even fonts that were same-origin
 * from the page's perspective.
 *
 * The fixer:
 * 1. Detects all @font-face rules in stylesheets
 * 2. Fetches font files via background script (bypasses CORS)
 * 3. Converts fonts to base64 data URIs
 * 4. Injects override @font-face rules with embedded fonts
 */

import { browser } from 'wxt/browser';
import { logger } from '@/lib/logger';
import {
  detectFontFaces,
  getFontUrlsToProxy,
  generateFontFaceCss,
  FontFaceInfo,
} from '../utils/font-detector';
import type { Fixer, GlobalFixerContext, FixerResult } from '../types';
import type { CorsResourceRequest, BackgroundResponse } from '@/types/messages';
import { fixerRegistry } from '../registry';

const STYLE_MARKER = 'data-mhh-font-cors-fix';

export const fontCorsFixer: Fixer = {
  id: 'global:font-cors',
  priority: 20, // After relative-url (10), before other operations
  scope: 'global',

  shouldApply(_context: GlobalFixerContext): boolean {
    // Always apply - actual detection happens in apply()
    return true;
  },

  async apply(context: GlobalFixerContext): Promise<FixerResult> {
    const { document: doc } = context;

    // Detect all @font-face rules (all fonts need embedding for Matomo)
    const detectedFonts = await detectFontFaces(doc);

    if (detectedFonts.length === 0) {
      logger.debug('Content', 'Font CORS fixer: No fonts found');
      return {
        fixerId: 'global:font-cors',
        applied: false,
        count: 0,
        restore: () => {},
      };
    }

    // Get all font URLs that need embedding
    const fontUrls = getFontUrlsToProxy(detectedFonts);

    logger.debug(
      'Content',
      `Font CORS fixer: Found ${detectedFonts.length} @font-face rules with ${fontUrls.length} font URLs to embed`
    );

    // Fetch font files via background script
    const dataUriMap = await fetchFontFiles(fontUrls);

    if (dataUriMap.size === 0) {
      logger.warn('Content', 'Font CORS fixer: Failed to fetch any fonts');
      return {
        fixerId: 'global:font-cors',
        applied: false,
        count: 0,
        restore: () => {},
      };
    }

    logger.debug('Content', `Font CORS fixer: Fetched ${dataUriMap.size}/${fontUrls.length} fonts`);

    // Generate @font-face CSS with data URIs
    const overrideCss = generateFontFaceCss(detectedFonts, dataUriMap);

    if (!overrideCss) {
      logger.debug('Content', 'Font CORS fixer: No override CSS generated');
      return {
        fixerId: 'global:font-cors',
        applied: false,
        count: 0,
        restore: () => {},
      };
    }

    // Inject override stylesheet
    const styleElement = doc.createElement('style');
    styleElement.setAttribute(STYLE_MARKER, 'true');
    styleElement.textContent = overrideCss;
    doc.head.appendChild(styleElement);

    logger.debug(
      'Content',
      `Font CORS fixer: Injected override styles for ${dataUriMap.size} fonts`
    );

    return {
      fixerId: 'global:font-cors',
      applied: true,
      count: dataUriMap.size,
      restore() {
        styleElement.remove();
        logger.debug('Content', 'Font CORS fixer: Removed override styles');
      },
    };
  },
};

/**
 * Fetch font files via background script and convert to data URIs
 */
async function fetchFontFiles(urls: string[]): Promise<Map<string, string>> {
  const dataUriMap = new Map<string, string>();

  if (urls.length === 0) return dataUriMap;

  try {
    // Build CORS resource requests
    const requests: CorsResourceRequest[] = urls.map((url, index) => ({
      id: `font-${index}`,
      url,
      resourceType: 'font',
    }));

    const response = (await browser.runtime.sendMessage({
      action: 'fetchCorsResources',
      requests,
    })) as BackgroundResponse;

    if (response.success && response.corsResults) {
      for (const result of response.corsResults) {
        if (result.success && result.dataUri) {
          dataUriMap.set(result.url, result.dataUri);
        } else {
          logger.debug(
            'Content',
            `Font CORS fixer: Failed to fetch ${result.url}: ${result.error}`
          );
        }
      }
    }
  } catch (error) {
    logger.error('Content', 'Font CORS fixer: Failed to fetch fonts:', error);
  }

  return dataUriMap;
}

// Auto-register when module loads
fixerRegistry.register(fontCorsFixer);

/**
 * Module-level state for tracking font fixes
 * Used by expansion.ts to manage fix/restore lifecycle outside pipeline
 */
let currentFontFixResult: {
  styleElement: HTMLStyleElement | null;
  appliedCount: number;
} | null = null;

/**
 * Apply font embedding and store result for later restoration.
 * Standalone API for use in layout-prep.ts.
 *
 * All fonts are embedded as data URIs because they'll become cross-origin
 * when Matomo renders the captured DOM on its own domain.
 */
export async function applyAndStoreFontCorsFixes(doc: Document = document): Promise<FixerResult> {
  // Restore any existing fixes first
  if (currentFontFixResult) {
    restoreFontCorsFixes();
  }

  // Detect all @font-face rules (all fonts need embedding for Matomo)
  const detectedFonts = await detectFontFaces(doc);

  if (detectedFonts.length === 0) {
    logger.debug('Content', 'Font CORS fixer: No fonts found');
    currentFontFixResult = { styleElement: null, appliedCount: 0 };
    return {
      fixerId: 'global:font-cors',
      applied: false,
      count: 0,
      restore: () => {},
    };
  }

  // Get all font URLs that need embedding
  const fontUrls = getFontUrlsToProxy(detectedFonts);

  logger.debug(
    'Content',
    `Font CORS fixer: Found ${detectedFonts.length} @font-face rules with ${fontUrls.length} font URLs to embed`
  );

  // Fetch font files via background script
  const dataUriMap = await fetchFontFiles(fontUrls);

  if (dataUriMap.size === 0) {
    logger.warn('Content', 'Font CORS fixer: Failed to fetch any fonts');
    currentFontFixResult = { styleElement: null, appliedCount: 0 };
    return {
      fixerId: 'global:font-cors',
      applied: false,
      count: 0,
      restore: () => {},
    };
  }

  logger.debug('Content', `Font CORS fixer: Fetched ${dataUriMap.size}/${fontUrls.length} fonts`);

  // Generate @font-face CSS with data URIs
  const overrideCss = generateFontFaceCss(detectedFonts, dataUriMap);

  if (!overrideCss) {
    logger.debug('Content', 'Font CORS fixer: No override CSS generated');
    currentFontFixResult = { styleElement: null, appliedCount: 0 };
    return {
      fixerId: 'global:font-cors',
      applied: false,
      count: 0,
      restore: () => {},
    };
  }

  // Inject override stylesheet
  const styleElement = doc.createElement('style');
  styleElement.setAttribute(STYLE_MARKER, 'true');
  styleElement.textContent = overrideCss;
  doc.head.appendChild(styleElement);

  logger.debug('Content', `Font CORS fixer: Injected override styles for ${dataUriMap.size} fonts`);

  currentFontFixResult = {
    styleElement,
    appliedCount: dataUriMap.size,
  };

  return {
    fixerId: 'global:font-cors',
    applied: true,
    count: dataUriMap.size,
    restore() {
      restoreFontCorsFixes();
    },
  };
}

/**
 * Restore previously applied font CORS fixes
 */
export function restoreFontCorsFixes(): void {
  if (currentFontFixResult?.styleElement) {
    currentFontFixResult.styleElement.remove();
    logger.debug(
      'Content',
      `Font CORS fixer: Restored (removed ${currentFontFixResult.appliedCount} font overrides)`
    );
  }
  currentFontFixResult = null;
}

/**
 * Check if font CORS fixes are currently applied
 */
export function hasFontCorsFixes(): boolean {
  return currentFontFixResult !== null && currentFontFixResult.appliedCount > 0;
}

/**
 * Clear state (for testing)
 */
export function clearFontCorsFixState(): void {
  currentFontFixResult = null;
}
