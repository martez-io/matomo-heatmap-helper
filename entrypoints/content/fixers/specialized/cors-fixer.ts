/**
 * CORS Resource Fixer
 *
 * Handles cross-origin resources by proxying them through the background script
 * and converting to data URIs before screenshot capture.
 */

import { browser } from 'wxt/browser';
import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';
import { logger } from '@/lib/logger';
import {
  detectCorsResources,
  deduplicateByUrl,
  type DetectedResource,
} from '../cors/resource-detector';
import type { BackgroundResponse } from '@/types/messages';

/**
 * Apply a data URI to an element, replacing the original cross-origin URL
 */
function applyDataUri(resource: DetectedResource, dataUri: string): void {
  const { element, attribute, cssProperty } = resource;

  if (cssProperty) {
    // CSS property - set as inline style
    const cssPropertyName = cssProperty.replace(/([A-Z])/g, '-$1').toLowerCase();
    (element as HTMLElement).style.setProperty(cssPropertyName, `url("${dataUri}")`);
  } else if (attribute === 'srcset') {
    // srcset - replace the specific URL within the srcset value
    const srcset = element.getAttribute('srcset') || '';
    element.setAttribute('srcset', srcset.replace(resource.url, dataUri));
  } else if (attribute === 'xlink:href') {
    // SVG xlink:href namespace attribute
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUri);
  } else {
    // Regular attribute (src, href, poster, etc.)
    element.setAttribute(attribute, dataUri);
  }
}

/**
 * Restore an element to its original cross-origin URL
 */
function restoreOriginal(resource: DetectedResource): void {
  const { element, attribute, originalValue, cssProperty } = resource;

  if (cssProperty) {
    // CSS property - restore inline style (or remove if was empty)
    const cssPropertyName = cssProperty.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (originalValue) {
      (element as HTMLElement).style.setProperty(cssPropertyName, originalValue);
    } else {
      (element as HTMLElement).style.removeProperty(cssPropertyName);
    }
  } else if (attribute === 'xlink:href') {
    // SVG xlink:href namespace attribute
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', originalValue);
  } else {
    // Regular attribute
    element.setAttribute(attribute, originalValue);
  }
}

/**
 * Check if an element likely contains cross-origin resources worth checking
 */
function mightHaveCorsResources(context: FixerContext): boolean {
  const { element, computedStyle } = context;

  // Check for images
  const hasImages = element.querySelectorAll('img').length > 0 || element.tagName === 'IMG';

  // Check for SVG use elements
  const hasSvgUse = element.querySelectorAll('use').length > 0;

  // Check for video posters
  const hasVideoPoster = element.querySelectorAll('video[poster]').length > 0;

  // Check if element or any descendant might have background-image
  const rootHasBackground = computedStyle.backgroundImage !== 'none';

  return hasImages || hasSvgUse || hasVideoPoster || rootHasBackground;
}

export const corsFixer: Fixer = {
  id: 'specialized:cors',
  priority: 5, // Run early before other fixers modify the DOM

  shouldApply(context: FixerContext): boolean {
    return mightHaveCorsResources(context);
  },

  async apply(context: FixerContext): Promise<FixerResult> {
    const { element } = context;

    // Detect all cross-origin resources
    const detectedResources = detectCorsResources(element);

    if (detectedResources.length === 0) {
      logger.debug('Content', 'CORS fixer: No cross-origin resources found');
      return { fixerId: 'specialized:cors', applied: false, restore: () => {} };
    }

    logger.debug('Content', `CORS fixer: Found ${detectedResources.length} cross-origin resources`);

    // Deduplicate by URL (same resource might be used multiple times)
    const { unique, mapping } = deduplicateByUrl(detectedResources);

    try {
      // Send to background script for fetching
      const response: BackgroundResponse = await browser.runtime.sendMessage({
        action: 'fetchCorsResources',
        requests: unique,
      });

      if (!response.success || !response.corsResults) {
        logger.warn('Content', 'CORS fixer: Background fetch failed:', response.error);
        return { fixerId: 'specialized:cors', applied: false, restore: () => {} };
      }

      // Track which resources were successfully applied for restoration
      const appliedResources: DetectedResource[] = [];

      // Apply data URIs to DOM
      for (const result of response.corsResults) {
        if (!result.success || !result.dataUri) {
          logger.debug('Content', `CORS fixer: Failed to fetch ${result.url}: ${result.error}`);
          continue;
        }

        // Apply to all elements using this URL
        const elementsForUrl = mapping.get(result.url) || [];
        for (const resource of elementsForUrl) {
          try {
            applyDataUri(resource, result.dataUri);
            appliedResources.push(resource);
            logger.debug('Content', `CORS fixer: Applied data URI for ${result.url}`);
          } catch (err) {
            logger.warn('Content', `CORS fixer: Failed to apply data URI to element:`, err);
          }
        }
      }

      const successCount = appliedResources.length;
      const totalCount = detectedResources.length;

      logger.debug(
        'Content',
        `CORS fixer: Applied ${successCount}/${totalCount} resources, ${response.totalSizeBytes} bytes`
      );

      return {
        fixerId: 'specialized:cors',
        applied: successCount > 0,
        restore() {
          // Restore all modified resources to their original URLs
          for (const resource of appliedResources) {
            try {
              restoreOriginal(resource);
            } catch (err) {
              // Silent failure on restore - best effort
              logger.debug('Content', 'CORS fixer: Failed to restore resource:', err);
            }
          }
          logger.debug('Content', `CORS fixer: Restored ${appliedResources.length} resources`);
        },
      };
    } catch (err) {
      logger.error('Content', 'CORS fixer: Unexpected error:', err);
      return { fixerId: 'specialized:cors', applied: false, restore: () => {} };
    }
  },
};

// Auto-register
fixerRegistry.register(corsFixer);
