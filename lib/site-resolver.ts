/**
 * Site resolution logic for automatic domain-based site detection
 */

import { browser } from 'wxt/browser';
import { createMatomoClient } from './matomo-api';
import {
  getDomainSiteMapping,
  saveDomainSiteMapping,
  getAvailableSites,
  saveAvailableSites,
  getCredentials,
} from './storage';
import type { MatomoSite } from '@/types/matomo';

export type ResolutionResult =
  | { success: true; siteId: number; siteName: string }
  | { success: false; error: 'no-site' | 'no-permission' | 'no-credentials' };

/**
 * Extract domain from URL (e.g., "https://example.com/path" -> "example.com")
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Resolve site ID for the current browser tab
 */
export async function resolveSiteForCurrentTab(): Promise<ResolutionResult> {
  // Get current tab URL
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.url) {
    console.error('[SiteResolver] No active tab found');
    return { success: false, error: 'no-site' };
  }

  const domain = extractDomain(currentTab.url);
  if (!domain) {
    console.error('[SiteResolver] Could not extract domain from URL:', currentTab.url);
    return { success: false, error: 'no-site' };
  }

  console.log('[SiteResolver] Resolving site for domain:', domain);

  // Get credentials
  const credentials = await getCredentials();
  if (!credentials) {
    console.error('[SiteResolver] No credentials found');
    return { success: false, error: 'no-credentials' };
  }

  // Check if domain is already cached
  const cachedMapping = await getDomainSiteMapping(domain);
  if (cachedMapping) {
    console.log('[SiteResolver] Using cached mapping:', cachedMapping);
    return {
      success: true,
      siteId: cachedMapping.siteId,
      siteName: cachedMapping.siteName,
    };
  }

  // Not cached, need to resolve via API
  const client = createMatomoClient(credentials.apiUrl, credentials.authToken);

  try {
    // Step 1: Get site IDs that match this domain
    // Try multiple URL format variations to find a match
    const urlObj = new URL(currentTab.url);
    const urlVariations = [
      { label: 'Full URL', value: currentTab.url },
      { label: 'Base URL (protocol + domain)', value: `${urlObj.protocol}//${urlObj.hostname}` },
      { label: 'Domain only', value: domain },
      { label: 'HTTPS base URL', value: `https://${urlObj.hostname}` },
      { label: 'HTTP base URL', value: `http://${urlObj.hostname}` },
    ];

    console.log('[SiteResolver] Trying multiple URL format variations...');
    let matchingSiteIds: number[] = [];

    for (const variation of urlVariations) {
      console.log(`[SiteResolver] Trying ${variation.label}: ${variation.value}`);
      const result = await client.getSitesIdFromSiteUrl(variation.value);

      if (result && result.length > 0) {
        console.log(`[SiteResolver] ✓ SUCCESS! Found matching site IDs with ${variation.label}:`, result);
        matchingSiteIds = result;
        break;
      } else {
        console.log(`[SiteResolver] ✗ No match with ${variation.label}`);
      }
    }

    if (!matchingSiteIds || matchingSiteIds.length === 0) {
      console.log('[SiteResolver] ✗ No sites match this domain with any URL format variation');
      return { success: false, error: 'no-site' };
    }

    console.log('[SiteResolver] Found matching site IDs:', matchingSiteIds);

    // Step 2: Get available sites (with write permission)
    let availableSites = await getAvailableSites();

    if (!availableSites) {
      console.log('[SiteResolver] No cached available sites, fetching...');
      availableSites = await client.getSitesWithWriteAccess();
      await saveAvailableSites(availableSites);
    }

    // Step 3: Filter matching IDs by available sites (write permission check)
    const sitesWithPermission = filterSitesByPermission(matchingSiteIds, availableSites);

    if (sitesWithPermission.length === 0) {
      // No matches found, try refetching available sites
      console.log('[SiteResolver] No matching sites with write permission, refetching sites...');
      availableSites = await client.getSitesWithWriteAccess();
      await saveAvailableSites(availableSites);

      const sitesWithPermissionRetry = filterSitesByPermission(matchingSiteIds, availableSites);

      if (sitesWithPermissionRetry.length === 0) {
        console.error('[SiteResolver] No write permission for any matching sites');
        return { success: false, error: 'no-permission' };
      }

      // Use first match after retry
      const selectedSite = sitesWithPermissionRetry[0];
      await saveDomainSiteMapping(domain, selectedSite.idsite, selectedSite.name);

      return {
        success: true,
        siteId: selectedSite.idsite,
        siteName: selectedSite.name,
      };
    }

    // Step 4: Use first matching site with permission
    const selectedSite = sitesWithPermission[0];
    console.log('[SiteResolver] Selected site:', selectedSite);

    // Cache the mapping
    await saveDomainSiteMapping(domain, selectedSite.idsite, selectedSite.name);

    return {
      success: true,
      siteId: selectedSite.idsite,
      siteName: selectedSite.name,
    };
  } catch (error) {
    console.error('[SiteResolver] Resolution failed:', error);
    return { success: false, error: 'no-site' };
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
