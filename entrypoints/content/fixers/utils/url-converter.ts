/**
 * URL Converter
 *
 * Applies and restores URL conversions (relative to absolute)
 * for Matomo heatmap screenshots.
 */

import type { DetectedRelativeUrl } from '../types';

/**
 * Apply absolute URL to an element
 * Handles different attribute types: src, srcset, poster, style (CSS)
 */
export function applyAbsoluteUrl(resource: DetectedRelativeUrl): void {
  const { element, attribute, absoluteUrl, cssProperty, urlInValue, originalValue } = resource;

  if (cssProperty === 'backgroundImage') {
    // CSS background-image - replace url() value in inline style
    const htmlEl = element as HTMLElement;
    let newValue = originalValue;

    // Handle different quote styles: url(path), url("path"), url('path')
    if (urlInValue) {
      // Replace all variations of the URL
      newValue = newValue
        .replace(`url(${urlInValue})`, `url("${absoluteUrl}")`)
        .replace(`url("${urlInValue}")`, `url("${absoluteUrl}")`)
        .replace(`url('${urlInValue}')`, `url("${absoluteUrl}")`);
    }

    htmlEl.style.backgroundImage = newValue;
  } else if (attribute === 'srcset') {
    // srcset - replace specific URL within the srcset value
    if (urlInValue) {
      const currentSrcset = element.getAttribute('srcset') || '';
      // Use a regex to ensure we only replace the URL part, not descriptors
      const newSrcset = currentSrcset.replace(
        new RegExp(`(^|,\\s*)${escapeRegExp(urlInValue)}(\\s|,|$)`, 'g'),
        `$1${absoluteUrl}$2`
      );
      element.setAttribute('srcset', newSrcset);
    }
  } else {
    // Simple attribute replacement (src, poster)
    element.setAttribute(attribute, absoluteUrl);
  }
}

/**
 * Restore original URL to an element
 */
export function restoreOriginalUrl(resource: DetectedRelativeUrl): void {
  const { element, attribute, originalValue, cssProperty } = resource;

  if (cssProperty === 'backgroundImage') {
    // Restore original inline style
    (element as HTMLElement).style.backgroundImage = originalValue;
  } else {
    // Restore original attribute value
    element.setAttribute(attribute, originalValue);
  }
}

/**
 * Apply absolute URLs to multiple resources efficiently
 * Groups by element/attribute for batch processing (especially srcset)
 */
export function applyAbsoluteUrls(resources: DetectedRelativeUrl[]): DetectedRelativeUrl[] {
  const applied: DetectedRelativeUrl[] = [];

  // Group srcset resources by element to apply all at once
  const srcsetByElement = new Map<Element, DetectedRelativeUrl[]>();
  const otherResources: DetectedRelativeUrl[] = [];

  resources.forEach((resource) => {
    if (resource.attribute === 'srcset') {
      const existing = srcsetByElement.get(resource.element) || [];
      existing.push(resource);
      srcsetByElement.set(resource.element, existing);
    } else {
      otherResources.push(resource);
    }
  });

  // Apply srcset resources in batch per element
  srcsetByElement.forEach((srcsetResources, element) => {
    const originalSrcset = element.getAttribute('srcset') || '';
    let newSrcset = originalSrcset;

    srcsetResources.forEach((resource) => {
      if (resource.urlInValue) {
        newSrcset = newSrcset.replace(
          new RegExp(`(^|,\\s*)${escapeRegExp(resource.urlInValue)}(\\s|,|$)`, 'g'),
          `$1${resource.absoluteUrl}$2`
        );
      }
    });

    element.setAttribute('srcset', newSrcset);

    // Mark all as applied (they share the same originalValue for restoration)
    srcsetResources.forEach((resource) => applied.push(resource));
  });

  // Apply other resources individually
  otherResources.forEach((resource) => {
    try {
      applyAbsoluteUrl(resource);
      applied.push(resource);
    } catch {
      // Skip failed applications silently
    }
  });

  return applied;
}

/**
 * Restore original URLs to multiple resources
 * Handles srcset specially to restore all at once
 */
export function restoreOriginalUrls(resources: DetectedRelativeUrl[]): void {
  // For srcset, we need to restore the original value only once per element
  const srcsetRestored = new Set<Element>();

  resources.forEach((resource) => {
    try {
      if (resource.attribute === 'srcset') {
        // Only restore srcset once per element (all resources share same originalValue)
        if (!srcsetRestored.has(resource.element)) {
          resource.element.setAttribute('srcset', resource.originalValue);
          srcsetRestored.add(resource.element);
        }
      } else {
        restoreOriginalUrl(resource);
      }
    } catch {
      // Silent failure on restore
    }
  });
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
