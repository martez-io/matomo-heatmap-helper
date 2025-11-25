/**
 * Font Detector Utility
 *
 * Detects @font-face rules across all stylesheets (inline, same-origin, cross-origin)
 * and prepares them for embedding as data URIs.
 *
 * IMPORTANT: All fonts must be embedded because they'll become cross-origin when
 * Matomo renders the captured DOM on its own domain (e.g., matomo.example.com
 * rendering content from app.example.com).
 */

import { browser } from 'wxt/browser';
import { logger } from '@/lib/logger';
import { isCrossOrigin } from './cors-detector';
import type { CssTextResult, BackgroundResponse } from '@/types/messages';

/**
 * Information about a font URL within @font-face src
 */
export interface FontUrlInfo {
  url: string;
  format?: string; // woff2, woff, ttf, etc.
  /**
   * Whether this URL is cross-origin from the PAGE's perspective.
   * NOTE: This is informational only. All fonts are embedded regardless of this value
   * because they'll all become cross-origin when Matomo renders on its domain.
   */
  isCrossOrigin: boolean;
}

/**
 * Information about a detected @font-face rule
 */
export interface FontFaceInfo {
  familyName: string;
  fontWeight?: string;
  fontStyle?: string;
  fontDisplay?: string;
  unicodeRange?: string;
  fontUrls: FontUrlInfo[];
  originalCssText: string; // Full @font-face rule text for reconstruction
  sourceType: 'inline' | 'same-origin' | 'cross-origin';
  sourceUrl?: string; // URL of stylesheet (for cross-origin)
}

/**
 * Stylesheet source with categorization
 */
export interface StylesheetSource {
  type: 'inline' | 'same-origin' | 'cross-origin';
  url?: string; // Only for linked stylesheets
  sheet?: CSSStyleSheet; // For inline/same-origin that we can read
  element: HTMLStyleElement | HTMLLinkElement;
}

/**
 * Cross-origin @import URL info
 */
interface CrossOriginImport {
  url: string;
  parentUrl?: string;
}

/**
 * Collect all stylesheets in the document, categorized by accessibility.
 * Also scans for @import rules and collects cross-origin import URLs.
 */
export function collectStylesheets(doc: Document): {
  stylesheets: StylesheetSource[];
  crossOriginImports: CrossOriginImport[];
} {
  const stylesheets: StylesheetSource[] = [];
  const crossOriginImports: CrossOriginImport[] = [];
  const visitedUrls = new Set<string>();

  // Collect <style> elements (inline)
  doc.querySelectorAll('style').forEach((style) => {
    if (style.sheet) {
      stylesheets.push({
        type: 'inline',
        sheet: style.sheet,
        element: style,
      });
    }
  });

  // Collect <link rel="stylesheet"> elements
  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    const href = link.href;
    if (!href) return;

    // Check if we can access cssRules (same-origin check)
    const sheet = link.sheet;
    let canAccessRules = false;

    if (sheet) {
      try {
        // Try to access cssRules - will throw for cross-origin
        const _rules = sheet.cssRules;
        canAccessRules = true;
      } catch {
        canAccessRules = false;
      }
    }

    if (canAccessRules && sheet) {
      stylesheets.push({
        type: 'same-origin',
        url: href,
        sheet,
        element: link,
      });
    } else {
      stylesheets.push({
        type: 'cross-origin',
        url: href,
        element: link,
      });
    }
  });

  // Scan accessible stylesheets for @import rules
  for (const source of stylesheets) {
    if (source.sheet && (source.type === 'inline' || source.type === 'same-origin')) {
      scanForImports(source.sheet, source.url, visitedUrls, crossOriginImports);
    }
  }

  return { stylesheets, crossOriginImports };
}

/**
 * Recursively scan a stylesheet for @import rules
 */
function scanForImports(
  sheet: CSSStyleSheet,
  parentUrl: string | undefined,
  visited: Set<string>,
  imports: CrossOriginImport[]
): void {
  try {
    for (const rule of Array.from(sheet.cssRules)) {
      if (rule instanceof CSSImportRule && rule.href) {
        // Resolve the import URL against the parent stylesheet
        let importUrl: string;
        try {
          importUrl = new URL(rule.href, parentUrl || window.location.href).href;
        } catch {
          continue;
        }

        if (visited.has(importUrl)) continue;
        visited.add(importUrl);

        if (isCrossOrigin(importUrl)) {
          // Cross-origin import - queue for fetching
          imports.push({ url: importUrl, parentUrl });
        } else if (rule.styleSheet) {
          // Same-origin import - recurse into it
          scanForImports(rule.styleSheet, importUrl, visited, imports);
        }
      }
    }
  } catch {
    // CORS blocked - can't access cssRules
  }
}

/**
 * Parse the src property of @font-face to extract font URLs
 * Handles: url('path.woff2') format('woff2'), url(path.woff) format('woff'), ...
 */
export function parseFontSrc(srcValue: string, baseUrl: string): FontUrlInfo[] {
  const fontUrls: FontUrlInfo[] = [];

  // Match url(...) with optional format(...)
  // Pattern: url(['"]?path['"]?) [format(['"]?type['"]?)]
  const urlPattern = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")\s]+)['"]?\s*\))?/gi;

  let match;
  while ((match = urlPattern.exec(srcValue)) !== null) {
    const rawUrl = match[1];
    const format = match[2];

    // Skip data URIs
    if (rawUrl.startsWith('data:')) {
      fontUrls.push({
        url: rawUrl,
        format,
        isCrossOrigin: false,
      });
      continue;
    }

    // Resolve relative URL against stylesheet base
    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(rawUrl, baseUrl).href;
    } catch {
      logger.warn('Content', `Font detector: Invalid URL "${rawUrl}" in stylesheet ${baseUrl}`);
      continue;
    }

    fontUrls.push({
      url: resolvedUrl,
      format,
      isCrossOrigin: isCrossOrigin(resolvedUrl),
    });
  }

  return fontUrls;
}

/**
 * Extract a single @font-face rule into FontFaceInfo
 */
function extractFontFaceRule(
  rule: CSSFontFaceRule,
  baseUrl: string,
  sourceType: 'inline' | 'same-origin' | 'cross-origin',
  sourceUrl?: string
): FontFaceInfo | null {
  const style = rule.style;
  const familyName = style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
  const srcValue = style.getPropertyValue('src');

  if (!familyName || !srcValue) return null;

  const fontUrls = parseFontSrc(srcValue, baseUrl);

  return {
    familyName,
    fontWeight: style.getPropertyValue('font-weight') || undefined,
    fontStyle: style.getPropertyValue('font-style') || undefined,
    fontDisplay: style.getPropertyValue('font-display') || undefined,
    unicodeRange: style.getPropertyValue('unicode-range') || undefined,
    fontUrls,
    originalCssText: rule.cssText,
    sourceType,
    sourceUrl,
  };
}

/**
 * Extract @font-face rules from a CSSStyleSheet.
 * Handles @font-face, @import (recursively), and @media rules.
 */
function extractFontFacesFromSheet(
  sheet: CSSStyleSheet,
  sourceType: 'inline' | 'same-origin',
  sourceUrl?: string,
  visitedUrls?: Set<string>
): FontFaceInfo[] {
  const fontFaces: FontFaceInfo[] = [];
  const baseUrl = sourceUrl || window.location.href;
  const visited = visitedUrls || new Set<string>();

  try {
    for (const rule of Array.from(sheet.cssRules)) {
      // Handle @font-face rules
      if (rule instanceof CSSFontFaceRule) {
        const fontInfo = extractFontFaceRule(rule, baseUrl, sourceType, sourceUrl);
        if (fontInfo) fontFaces.push(fontInfo);
      }
      // Handle @import rules - recurse into imported stylesheets
      else if (rule instanceof CSSImportRule) {
        const importUrl = rule.href;
        if (importUrl && !visited.has(importUrl) && rule.styleSheet) {
          visited.add(importUrl);

          // Determine if the import is cross-origin
          const importSourceType = isCrossOrigin(importUrl) ? 'cross-origin' : sourceType;

          // Recurse into the imported stylesheet
          const importedFonts = extractFontFacesFromSheet(
            rule.styleSheet,
            importSourceType as 'inline' | 'same-origin',
            importUrl,
            visited
          );
          fontFaces.push(...importedFonts);
        }
      }
      // Handle @media rules - extract @font-face from inside
      else if (rule instanceof CSSMediaRule) {
        for (const nestedRule of Array.from(rule.cssRules)) {
          if (nestedRule instanceof CSSFontFaceRule) {
            const fontInfo = extractFontFaceRule(nestedRule, baseUrl, sourceType, sourceUrl);
            if (fontInfo) fontFaces.push(fontInfo);
          }
        }
      }
      // Handle @supports rules - extract @font-face from inside
      else if (rule instanceof CSSSupportsRule) {
        for (const nestedRule of Array.from(rule.cssRules)) {
          if (nestedRule instanceof CSSFontFaceRule) {
            const fontInfo = extractFontFaceRule(nestedRule, baseUrl, sourceType, sourceUrl);
            if (fontInfo) fontFaces.push(fontInfo);
          }
        }
      }
    }
  } catch (error) {
    logger.warn('Content', `Font detector: Failed to read rules from ${sourceUrl || 'inline'}:`, error);
  }

  return fontFaces;
}

/**
 * Extract @font-face blocks from CSS using brace-counting
 * This handles @font-face inside @media and @supports blocks correctly
 */
function extractFontFaceBlocks(css: string): { content: string; fullRule: string }[] {
  const blocks: { content: string; fullRule: string }[] = [];

  // Remove CSS comments first
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Find all @font-face positions
  const fontFacePattern = /@font-face\s*\{/gi;
  let match;

  while ((match = fontFacePattern.exec(cleanCss)) !== null) {
    const startIndex = match.index;
    const openBraceIndex = match.index + match[0].length - 1;
    let braceCount = 1;
    let endIndex = openBraceIndex + 1;

    // Count braces to find the matching closing brace
    while (braceCount > 0 && endIndex < cleanCss.length) {
      if (cleanCss[endIndex] === '{') braceCount++;
      else if (cleanCss[endIndex] === '}') braceCount--;
      endIndex++;
    }

    if (braceCount === 0) {
      const fullRule = cleanCss.substring(startIndex, endIndex);
      const content = cleanCss.substring(openBraceIndex + 1, endIndex - 1);
      blocks.push({ content, fullRule });
    }
  }

  return blocks;
}

/**
 * Parse @font-face rules from raw CSS text
 * Uses brace-counting to handle @font-face inside @media/@supports blocks
 */
export function extractFontFacesFromCssText(
  cssText: string,
  sourceUrl: string
): FontFaceInfo[] {
  const fontFaces: FontFaceInfo[] = [];
  const blocks = extractFontFaceBlocks(cssText);

  for (const { content: ruleContent, fullRule } of blocks) {
    // Extract properties
    const getProperty = (name: string): string | undefined => {
      const propPattern = new RegExp(`${name}\\s*:\\s*([^;]+)`, 'i');
      const propMatch = ruleContent.match(propPattern);
      return propMatch ? propMatch[1].trim() : undefined;
    };

    const familyName = getProperty('font-family')?.replace(/['"]/g, '').trim();
    const srcValue = getProperty('src');

    if (!familyName || !srcValue) continue;

    const fontUrls = parseFontSrc(srcValue, sourceUrl);

    fontFaces.push({
      familyName,
      fontWeight: getProperty('font-weight'),
      fontStyle: getProperty('font-style'),
      fontDisplay: getProperty('font-display'),
      unicodeRange: getProperty('unicode-range'),
      fontUrls,
      originalCssText: fullRule,
      sourceType: 'cross-origin',
      sourceUrl,
    });
  }

  return fontFaces;
}

/**
 * Fetch CSS text from cross-origin stylesheets via background script
 */
async function fetchCrossOriginCss(urls: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (urls.length === 0) return results;

  try {
    const response = (await browser.runtime.sendMessage({
      action: 'fetchCssText',
      urls,
    })) as BackgroundResponse;

    if (response.success && response.cssTextResults) {
      for (const result of response.cssTextResults) {
        if (result.success && result.cssText) {
          results.set(result.url, result.cssText);
        } else {
          logger.debug('Content', `Font detector: Failed to fetch ${result.url}: ${result.error}`);
        }
      }
    }
  } catch (error) {
    logger.error('Content', 'Font detector: Failed to fetch cross-origin CSS:', error);
  }

  return results;
}

/**
 * Extract @import URLs from CSS text
 */
function extractImportsFromCssText(cssText: string, baseUrl: string): string[] {
  const imports: string[] = [];

  // Match @import url(...) or @import "..."
  const importPattern = /@import\s+(?:url\(\s*['"]?([^'")\s]+)['"]?\s*\)|['"]([^'"]+)['"])/gi;

  let match;
  while ((match = importPattern.exec(cssText)) !== null) {
    const importUrl = match[1] || match[2];
    if (importUrl) {
      try {
        const resolvedUrl = new URL(importUrl, baseUrl).href;
        imports.push(resolvedUrl);
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return imports;
}

/**
 * Recursively fetch cross-origin CSS including nested @imports
 */
async function fetchCrossOriginCssRecursive(
  urls: string[],
  visited: Set<string> = new Set()
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const toFetch = urls.filter((url) => !visited.has(url));

  if (toFetch.length === 0) return results;

  // Mark as visited before fetching
  toFetch.forEach((url) => visited.add(url));

  const cssMap = await fetchCrossOriginCss(toFetch);

  // Check each CSS for more @import rules
  const nestedImports: string[] = [];

  for (const [url, cssText] of cssMap) {
    results.set(url, cssText);

    // Extract @import URLs from the CSS text
    const imports = extractImportsFromCssText(cssText, url);
    for (const importUrl of imports) {
      if (!visited.has(importUrl)) {
        nestedImports.push(importUrl);
      }
    }
  }

  // Recursively fetch nested imports
  if (nestedImports.length > 0) {
    logger.debug('Content', `Font detector: Found ${nestedImports.length} nested @import rules`);
    const nestedResults = await fetchCrossOriginCssRecursive(nestedImports, visited);
    for (const [url, cssText] of nestedResults) {
      results.set(url, cssText);
    }
  }

  return results;
}

/**
 * Main detection function - finds all @font-face rules in the document
 * Returns only fonts with at least one cross-origin URL that needs proxying
 */
export async function detectFontFaces(doc: Document): Promise<FontFaceInfo[]> {
  const allFontFaces: FontFaceInfo[] = [];
  const { stylesheets, crossOriginImports } = collectStylesheets(doc);

  logger.debug(
    'Content',
    `Font detector: Found ${stylesheets.length} stylesheets, ${crossOriginImports.length} cross-origin @imports`
  );

  // Process inline and same-origin stylesheets directly
  for (const source of stylesheets) {
    if ((source.type === 'inline' || source.type === 'same-origin') && source.sheet) {
      const fonts = extractFontFacesFromSheet(source.sheet, source.type, source.url);
      allFontFaces.push(...fonts);
    }
  }

  // Collect ALL cross-origin URLs: direct links + @imports found in accessible stylesheets
  const crossOriginUrls = [
    ...stylesheets.filter((s) => s.type === 'cross-origin' && s.url).map((s) => s.url!),
    ...crossOriginImports.map((i) => i.url),
  ];

  if (crossOriginUrls.length > 0) {
    logger.debug(
      'Content',
      `Font detector: Fetching ${crossOriginUrls.length} cross-origin stylesheets (including @imports)`
    );

    // Use recursive fetch to handle nested @imports in cross-origin CSS
    const cssTextMap = await fetchCrossOriginCssRecursive(crossOriginUrls);

    // Parse @font-face from fetched CSS
    for (const [url, cssText] of cssTextMap) {
      const fonts = extractFontFacesFromCssText(cssText, url);
      allFontFaces.push(...fonts);
    }
  }

  // Return ALL fonts - they'll all be cross-origin when Matomo renders at a different domain
  logger.debug(
    'Content',
    `Font detector: Found ${allFontFaces.length} @font-face rules to proxy`
  );

  return allFontFaces;
}

/**
 * Get all unique font URLs that need proxying (all non-data-URI fonts)
 * All fonts need proxying because they'll be cross-origin when Matomo renders
 */
export function getFontUrlsToProxy(fonts: FontFaceInfo[]): string[] {
  const urls = new Set<string>();

  for (const font of fonts) {
    for (const fontUrl of font.fontUrls) {
      if (!fontUrl.url.startsWith('data:')) {
        urls.add(fontUrl.url);
      }
    }
  }

  return Array.from(urls);
}

/**
 * Generate @font-face CSS with data URIs for fonts
 * Uses data URIs when available, falls back to original URLs
 */
export function generateFontFaceCss(
  fonts: FontFaceInfo[],
  dataUriMap: Map<string, string>
): string {
  const rules: string[] = [];

  for (const font of fonts) {
    // Build src with data URIs when available
    const srcParts: string[] = [];

    for (const fontUrl of font.fontUrls) {
      if (dataUriMap.has(fontUrl.url)) {
        // Use data URI if we fetched one (regardless of original cross-origin status)
        const dataUri = dataUriMap.get(fontUrl.url)!;
        srcParts.push(
          fontUrl.format ? `url("${dataUri}") format("${fontUrl.format}")` : `url("${dataUri}")`
        );
      } else {
        // Keep original URL as fallback (for unfetched fonts or data URIs)
        srcParts.push(
          fontUrl.format
            ? `url("${fontUrl.url}") format("${fontUrl.format}")`
            : `url("${fontUrl.url}")`
        );
      }
    }

    if (srcParts.length === 0) continue;

    // Build @font-face rule
    const props: string[] = [`font-family: "${font.familyName}"`, `src: ${srcParts.join(', ')}`];

    if (font.fontWeight) props.push(`font-weight: ${font.fontWeight}`);
    if (font.fontStyle) props.push(`font-style: ${font.fontStyle}`);
    if (font.fontDisplay) props.push(`font-display: ${font.fontDisplay}`);
    if (font.unicodeRange) props.push(`unicode-range: ${font.unicodeRange}`);

    rules.push(`@font-face {\n  ${props.join(';\n  ')};\n}`);
  }

  return rules.join('\n\n');
}
