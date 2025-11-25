/**
 * URL Detection for Relative URLs
 *
 * Detects all relative URLs in a document/element that need to be
 * converted to absolute URLs for Matomo heatmap screenshots.
 */

import type { DetectedRelativeUrl } from '../types';

/**
 * Check if a URL is relative (needs conversion to absolute)
 */
export function isRelativeUrl(url: string): boolean {
  // Skip empty, whitespace-only
  if (!url || !url.trim()) {
    return false;
  }

  const trimmed = url.trim();

  // Skip data URIs and blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return false;
  }

  // Skip fragment-only URLs
  if (trimmed.startsWith('#')) {
    return false;
  }

  // Skip absolute URLs (http://, https://)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false;
  }

  // Skip protocol-relative URLs (//example.com)
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Everything else is relative (/, ./, ../, or path)
  return true;
}

/**
 * Convert a relative URL to absolute using the current page's base URL
 */
export function toAbsoluteUrl(relativeUrl: string, baseUrl: string = window.location.href): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    // If URL parsing fails, return original
    return relativeUrl;
  }
}

/**
 * Extract all URLs from a CSS url() value
 * Handles: url(path), url("path"), url('path'), and multiple urls
 */
export function extractCssUrls(cssValue: string): string[] {
  const urls: string[] = [];
  // Match url(...) with optional quotes
  const regex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
  let match;
  while ((match = regex.exec(cssValue)) !== null) {
    const url = match[2];
    if (url) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Detect all elements with relative URLs in a document or element tree
 */
export function detectRelativeUrls(root: Document | HTMLElement): DetectedRelativeUrl[] {
  const results: DetectedRelativeUrl[] = [];
  const baseUrl = window.location.href;

  // Get the root element for querying
  const rootElement = root instanceof Document ? root.documentElement : root;

  // 1. img[src] - Simple image sources
  rootElement.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && isRelativeUrl(src)) {
      results.push({
        element: img,
        attribute: 'src',
        originalValue: src,
        absoluteUrl: toAbsoluteUrl(src, baseUrl),
      });
    }
  });

  // 2. img[srcset], source[srcset] - Responsive images
  rootElement.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    const srcset = el.getAttribute('srcset');
    if (!srcset) return;

    // Parse srcset: "url1 1x, url2 2x" or "url1 100w, url2 200w"
    const parts = srcset.split(',');

    parts.forEach((part) => {
      const trimmed = part.trim();
      const [url] = trimmed.split(/\s+/);
      if (url && isRelativeUrl(url)) {
        results.push({
          element: el,
          attribute: 'srcset',
          originalValue: srcset,
          absoluteUrl: toAbsoluteUrl(url, baseUrl),
          urlInValue: url,
        });
      }
    });
  });

  // 3. video[poster] - Video poster images
  rootElement.querySelectorAll('video[poster]').forEach((video) => {
    const poster = video.getAttribute('poster');
    if (poster && isRelativeUrl(poster)) {
      results.push({
        element: video,
        attribute: 'poster',
        originalValue: poster,
        absoluteUrl: toAbsoluteUrl(poster, baseUrl),
      });
    }
  });

  // 4. source[src] - Media sources
  rootElement.querySelectorAll('source[src]').forEach((source) => {
    const src = source.getAttribute('src');
    if (src && isRelativeUrl(src)) {
      results.push({
        element: source,
        attribute: 'src',
        originalValue: src,
        absoluteUrl: toAbsoluteUrl(src, baseUrl),
      });
    }
  });

  // 5. CSS background-image - Inline styles
  // Check all elements for inline background-image styles
  const checkBackgroundImage = (el: HTMLElement) => {
    const inlineStyle = el.style.backgroundImage;
    if (inlineStyle && inlineStyle !== 'none') {
      const urls = extractCssUrls(inlineStyle);
      urls.forEach((url) => {
        if (isRelativeUrl(url)) {
          results.push({
            element: el,
            attribute: 'style',
            originalValue: inlineStyle,
            absoluteUrl: toAbsoluteUrl(url, baseUrl),
            cssProperty: 'backgroundImage',
            urlInValue: url,
          });
        }
      });
    }
  };

  // Check root element
  if (rootElement instanceof HTMLElement) {
    checkBackgroundImage(rootElement);
  }

  // Check all descendants
  rootElement.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement) {
      checkBackgroundImage(el);
    }
  });

  return results;
}

/**
 * Group detected URLs by element and attribute for efficient batch processing
 * This is useful for srcset where multiple URLs share the same attribute
 */
export function groupByElementAttribute(
  resources: DetectedRelativeUrl[]
): Map<string, DetectedRelativeUrl[]> {
  const groups = new Map<string, DetectedRelativeUrl[]>();

  resources.forEach((resource) => {
    // Create a unique key for element + attribute combination
    const key = `${(resource.element as HTMLElement).dataset?.mhhUrlId || Math.random()}-${resource.attribute}`;
    const existing = groups.get(key) || [];
    existing.push(resource);
    groups.set(key, existing);
  });

  return groups;
}
