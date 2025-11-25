/**
 * Utilities for detecting cross-origin resources in the DOM
 */

import type { CorsResourceRequest } from '@/types/messages';

/**
 * Check if a URL is cross-origin relative to the current page
 */
export function isCrossOrigin(url: string): boolean {
  try {
    // Skip data URIs, blob URLs, and fragment-only URLs
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) {
      return false;
    }

    // Parse URL relative to current location
    const parsed = new URL(url, window.location.href);
    return parsed.origin !== window.location.origin;
  } catch {
    // Invalid URL - treat as not cross-origin
    return false;
  }
}

/**
 * Extract URL from CSS url() value
 */
function extractCssUrl(cssValue: string): string | null {
  const match = cssValue.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  return match ? match[1] : null;
}

/**
 * Detected resource with metadata for restoration
 */
export interface DetectedResource extends CorsResourceRequest {
  element: Element;
  attribute: string;
  originalValue: string;
  cssProperty?: string;
}

/**
 * Detect all cross-origin resources within an element tree.
 *
 * Note: Multiple elements can reference the same URL. This function returns
 * all element-URL pairs - use deduplicateByUrl() to group by URL for efficient
 * fetching while mapping back to all affected elements.
 */
export function detectCorsResources(root: HTMLElement): DetectedResource[] {
  const resources: DetectedResource[] = [];
  let idCounter = 0;
  const generateId = () => `cors-${idCounter++}`;

  // 1. <img src> attributes
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && isCrossOrigin(src)) {
      resources.push({
        id: generateId(),
        url: src,
        resourceType: 'image',
        element: img,
        attribute: 'src',
        originalValue: src,
      });
    }
  });

  // Also check root if it's an img
  if (root.tagName === 'IMG') {
    const src = root.getAttribute('src');
    if (src && isCrossOrigin(src)) {
      resources.push({
        id: generateId(),
        url: src,
        resourceType: 'image',
        element: root,
        attribute: 'src',
        originalValue: src,
      });
    }
  }

  // 2. CSS background-image (computed styles)
  // Track URLs per element to avoid duplicate detection on same element
  const checkBackgroundImage = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el);
    const bgImage = computed.backgroundImage;

    if (bgImage && bgImage !== 'none') {
      const url = extractCssUrl(bgImage);
      if (url && isCrossOrigin(url)) {
        resources.push({
          id: generateId(),
          url,
          resourceType: 'image',
          element: el,
          attribute: 'style',
          originalValue: el.style.backgroundImage,
          cssProperty: 'backgroundImage',
        });
      }
    }
  };

  // Check root element
  checkBackgroundImage(root);

  // Check all descendants
  root.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement) {
      checkBackgroundImage(el);
    }
  });

  // 3. SVG <use> elements with external references
  root.querySelectorAll('use[href], use[xlink\\:href]').forEach((use) => {
    const href =
      use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

    if (href && isCrossOrigin(href)) {
      resources.push({
        id: generateId(),
        url: href,
        resourceType: 'svg',
        element: use,
        attribute: use.hasAttribute('href') ? 'href' : 'xlink:href',
        originalValue: href,
      });
    }
  });

  // 4. <img srcset> and <source srcset> - extract first cross-origin URL per element
  root.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    const srcset = el.getAttribute('srcset');
    if (srcset) {
      // Parse srcset: "url1 1x, url2 2x" or "url1 100w, url2 200w"
      const urls = srcset
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean);

      // Find first cross-origin URL in this element's srcset
      for (const url of urls) {
        if (isCrossOrigin(url)) {
          resources.push({
            id: generateId(),
            url,
            resourceType: 'image',
            element: el,
            attribute: 'srcset',
            originalValue: srcset,
          });
          break; // Only handle first cross-origin URL in srcset for MVP
        }
      }
    }
  });

  // 5. <video poster> attribute
  root.querySelectorAll('video[poster]').forEach((video) => {
    const poster = video.getAttribute('poster');
    if (poster && isCrossOrigin(poster)) {
      resources.push({
        id: generateId(),
        url: poster,
        resourceType: 'image',
        element: video,
        attribute: 'poster',
        originalValue: poster,
      });
    }
  });

  return resources;
}

/**
 * Deduplicate resources by URL, mapping each URL to all elements that use it
 */
export function deduplicateByUrl(resources: DetectedResource[]): {
  unique: CorsResourceRequest[];
  mapping: Map<string, DetectedResource[]>;
} {
  const mapping = new Map<string, DetectedResource[]>();

  resources.forEach((resource) => {
    const existing = mapping.get(resource.url);
    if (existing) {
      existing.push(resource);
    } else {
      mapping.set(resource.url, [resource]);
    }
  });

  const unique: CorsResourceRequest[] = [];
  mapping.forEach((list, url) => {
    unique.push({
      id: list[0].id,
      url,
      resourceType: list[0].resourceType,
    });
  });

  return { unique, mapping };
}
