/**
 * Site resolution logic for automatic domain-based site detection
 */

import { browser } from 'wxt/browser';
import { createMatomoClient, MatomoApiClient } from './matomo-api';
import {
  getDomainSiteMapping,
  saveDomainSiteMapping,
  getAvailableSites,
  saveAvailableSites,
  getCredentials,
  getEnforceTracker,
} from './storage';
import type { MatomoSite } from '@/types/matomo';
import { logger } from './logger';

export type ResolutionResult =
  | { success: true; siteId: number; siteName: string }
  | { success: false; error: 'no-site' | 'no-permission' | 'no-credentials' };

/**
 * Extract domain from URL (e.g., "https://example.com/path" -> "example.com")
 */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Filter site IDs by available sites (with write permission)
 */
function filterSitesByPermission(
  matchingSiteIds: number[],
  availableSites: MatomoSite[]
): MatomoSite[] {
  const availableSiteIds = new Set(availableSites.map((s) => s.idsite));

  return matchingSiteIds
    .filter((id) => availableSiteIds.has(id))
    .map((id) => availableSites.find((s) => s.idsite === id)!)
    .filter(Boolean);
}

/**
 * Core resolution logic - shared by all public resolution functions
 */
async function resolveForDomain(
  url: string,
  domain: string,
  client: MatomoApiClient
): Promise<ResolutionResult> {
  // Check if domain is already cached
  const cachedMapping = await getDomainSiteMapping(domain);
  if (cachedMapping) {
    // Skip enforced mappings when enforce mode is OFF
    const enforceEnabled = await getEnforceTracker();
    if (cachedMapping.isEnforced && !enforceEnabled) {
      logger.debug('SiteResolver', 'Skipping enforced mapping (enforce mode is OFF):', cachedMapping);
      // Continue to normal resolution below
    } else {
      logger.debug('SiteResolver', 'Using cached mapping:', cachedMapping);
      return {
        success: true,
        siteId: cachedMapping.siteId,
        siteName: cachedMapping.siteName,
      };
    }
  }

  try {
    // Step 1: Try multiple URL format variations to find matching site IDs
    const urlObj = new URL(url);
    const urlVariations = [
      { label: 'Full URL', value: url },
      { label: 'Base URL', value: `${urlObj.protocol}//${urlObj.hostname}` },
      { label: 'Domain only', value: domain },
      { label: 'HTTPS base', value: `https://${urlObj.hostname}` },
      { label: 'HTTP base', value: `http://${urlObj.hostname}` },
    ];

    let matchingSiteIds: number[] = [];
    let matchedVariation: string | null = null;

    for (const variation of urlVariations) {
      const result = await client.getSitesIdFromSiteUrl(variation.value);
      if (result && result.length > 0) {
        matchingSiteIds = result;
        matchedVariation = variation.label;
        break;
      }
    }

    if (!matchingSiteIds.length) {
      logger.debug('SiteResolver', 'No sites match domain:', domain);
      return { success: false, error: 'no-site' };
    }

    logger.debug('SiteResolver', `Found ${matchingSiteIds.length} site(s) via ${matchedVariation}`);

    // Step 2: Get available sites (with write permission)
    let availableSites = await getAvailableSites();
    if (!availableSites) {
      availableSites = await client.getSitesWithWriteAccess();
      await saveAvailableSites(availableSites);
    }

    // Step 3: Filter matching IDs by available sites (write permission check)
    let sitesWithPermission = filterSitesByPermission(matchingSiteIds, availableSites);

    // Retry with fresh site list if no permission found
    if (sitesWithPermission.length === 0) {
      availableSites = await client.getSitesWithWriteAccess();
      await saveAvailableSites(availableSites);
      sitesWithPermission = filterSitesByPermission(matchingSiteIds, availableSites);

      if (sitesWithPermission.length === 0) {
        logger.error('SiteResolver', 'No write permission for matching sites');
        return { success: false, error: 'no-permission' };
      }
    }

    // Step 4: Use first matching site with permission
    const selectedSite = sitesWithPermission[0];
    logger.debug('SiteResolver', 'Selected site:', selectedSite.name, `(${selectedSite.idsite})`);

    // Cache the mapping
    await saveDomainSiteMapping(domain, selectedSite.idsite, selectedSite.name);

    return {
      success: true,
      siteId: selectedSite.idsite,
      siteName: selectedSite.name,
    };
  } catch (error) {
    logger.error('SiteResolver', 'Resolution failed:', error);
    return { success: false, error: 'no-site' };
  }
}

/**
 * Resolve site ID for the current browser tab
 */
export async function resolveSiteForCurrentTab(): Promise<ResolutionResult> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.url) {
    logger.error('SiteResolver', 'No active tab found');
    return { success: false, error: 'no-site' };
  }

  const domain = extractDomain(currentTab.url);
  if (domain === null) {
    logger.error('SiteResolver', 'Could not extract domain from URL:', currentTab.url);
    return { success: false, error: 'no-site' };
  }

  const credentials = await getCredentials();
  if (!credentials) {
    logger.error('SiteResolver', 'No credentials found');
    return { success: false, error: 'no-credentials' };
  }

  logger.debug('SiteResolver', 'Resolving site for domain:', domain);
  const client = createMatomoClient(credentials.apiUrl, credentials.authToken);
  return resolveForDomain(currentTab.url, domain, client);
}

/**
 * Resolve site ID for a given URL (background worker safe)
 */
export async function resolveSiteForUrl(url: string): Promise<ResolutionResult> {
  if (!url) {
    logger.error('SiteResolver', 'No URL provided');
    return { success: false, error: 'no-site' };
  }

  const domain = extractDomain(url);
  if (domain === null) {
    logger.error('SiteResolver', 'Could not extract domain from URL:', url);
    return { success: false, error: 'no-site' };
  }

  const credentials = await getCredentials();
  if (!credentials) {
    logger.error('SiteResolver', 'No credentials found');
    return { success: false, error: 'no-credentials' };
  }

  logger.debug('SiteResolver', 'Resolving site for domain:', domain);
  const client = createMatomoClient(credentials.apiUrl, credentials.authToken);
  return resolveForDomain(url, domain, client);
}

/**
 * Resolve site ID for the current page (content script wrapper)
 */
export async function resolveSiteForCurrentPage(): Promise<ResolutionResult> {
  return resolveSiteForUrl(window.location.href);
}
