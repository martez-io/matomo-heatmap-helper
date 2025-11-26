/**
 * Typed storage helpers using WXT storage
 */

import { storage } from 'wxt/utils/storage';
import type { StorageSchema, DomainSiteMapping } from '@/types/storage';

/**
 * Get a value from storage with type safety
 */
export async function getStorage<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | null> {
  return await storage.getItem(`local:${key}`);
}

/**
 * Set a value in storage with type safety
 */
export async function setStorage<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await storage.setItem(`local:${key}`, value);
}

/**
 * Remove a value from storage
 */
export async function removeStorage<K extends keyof StorageSchema>(
  key: K
): Promise<void> {
  await storage.removeItem(`local:${key}`);
}

/**
 * Watch for changes to a storage key
 */
export function watchStorage<K extends keyof StorageSchema>(
  key: K,
  callback: (newValue: StorageSchema[K] | null, oldValue: StorageSchema[K] | null) => void
) {
  return storage.watch<StorageSchema[K]>(`local:${key}`, callback);
}

/**
 * Get credentials from storage
 */
export async function getCredentials() {
  const [apiUrl, authToken] = await Promise.all([
    getStorage('matomo:apiUrl'),
    getStorage('matomo:authToken'),
  ]);

  if (!apiUrl || !authToken) {
    return null;
  }

  return {
    apiUrl,
    authToken,
  };
}

/**
 * Save credentials to storage
 */
export async function saveCredentials(credentials: {
  apiUrl: string;
  authToken: string;
}) {
  await Promise.all([
    setStorage('matomo:apiUrl', credentials.apiUrl),
    setStorage('matomo:authToken', credentials.authToken),
  ]);
}

/**
 * Clear credentials from storage
 */
export async function clearCredentials() {
  await Promise.all([
    removeStorage('matomo:apiUrl'),
    removeStorage('matomo:authToken'),
    removeStorage('matomo:domainSiteMap'),
    removeStorage('matomo:availableSites'),
    removeStorage('cache:heatmaps'),
    removeStorage('ui:selectedHeatmapId'),
  ]);
}

/**
 * Get domain-to-site mapping from cache
 */
export async function getDomainSiteMapping(domain: string) {
  const domainMap = await getStorage('matomo:domainSiteMap');

  if (!domainMap || !domainMap[domain]) {
    return null;
  }

  const mapping = domainMap[domain];

  // Check if cache is still valid (24 hours)
  if (!isCacheValid(mapping.timestamp, 24 * 60 * 60 * 1000)) {
    return null;
  }

  return mapping;
}

/**
 * Save domain-to-site mapping to cache
 * Note: Non-enforced mappings will NOT overwrite existing enforced mappings
 */
export async function saveDomainSiteMapping(
  domain: string,
  siteId: number,
  siteName: string,
  isEnforced: boolean = false
) {
  const domainMap = (await getStorage('matomo:domainSiteMap')) || {};

  // Don't overwrite enforced mappings with non-enforced ones
  const existingMapping = domainMap[domain];
  if (existingMapping?.isEnforced && !isEnforced) {
    return; // Preserve the enforced mapping
  }

  domainMap[domain] = {
    siteId,
    siteName,
    timestamp: Date.now(),
    isEnforced,
  };

  await setStorage('matomo:domainSiteMap', domainMap);
}

/**
 * Get all domains that have enforced mappings
 */
export async function getEnforcedDomains(): Promise<string[]> {
  const domainMap = await getStorage('matomo:domainSiteMap');
  if (!domainMap) return [];

  return Object.entries(domainMap)
    .filter(([_, mapping]) => mapping.isEnforced === true)
    .map(([domain]) => domain);
}

/**
 * Get available sites with write access from cache
 */
export async function getAvailableSites() {
  const cached = await getStorage('matomo:availableSites');

  if (!cached) {
    return null;
  }

  // Check if cache is still valid (5 minutes)
  if (!isCacheValid(cached.timestamp, 5 * 60 * 1000)) {
    return null;
  }

  return cached.sites;
}

/**
 * Save available sites to cache
 */
export async function saveAvailableSites(sites: Array<{ idsite: number; name: string; main_url: string }>) {
  await setStorage('matomo:availableSites', {
    sites,
    timestamp: Date.now(),
  });
}

/**
 * Check if cache is still valid
 */
export function isCacheValid(timestamp: number, ttl: number = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp < ttl;
}

/**
 * Get debug mode setting (defaults to false)
 */
export async function getDebugMode(): Promise<boolean> {
  const value = await getStorage('settings:debugMode');
  return value ?? false;
}

/**
 * Set debug mode setting
 */
export async function setDebugMode(enabled: boolean): Promise<void> {
  await setStorage('settings:debugMode', enabled);
}

/**
 * Get enforce tracker setting (defaults to false)
 */
export async function getEnforceTracker(): Promise<boolean> {
  const value = await getStorage('enforce:enabled');
  return value ?? false;
}

/**
 * Set enforce tracker setting
 */
export async function setEnforceTracker(enabled: boolean): Promise<void> {
  await setStorage('enforce:enabled', enabled);
}

/**
 * Get all enforced domain mappings with full details
 */
export async function getEnforcedDomainMappings(): Promise<Array<{
  domain: string;
  siteId: number;
  siteName: string;
}>> {
  const domainMap = await getStorage('matomo:domainSiteMap');
  if (!domainMap) return [];

  return Object.entries(domainMap)
    .filter(([_, mapping]) => mapping.isEnforced === true)
    .map(([domain, mapping]) => ({
      domain,
      siteId: mapping.siteId,
      siteName: mapping.siteName,
    }));
}

/**
 * Remove a single enforced domain mapping
 */
export async function removeEnforcedDomainMapping(domain: string): Promise<void> {
  const domainMap = (await getStorage('matomo:domainSiteMap')) || {};
  if (domainMap[domain]) {
    delete domainMap[domain];
    await setStorage('matomo:domainSiteMap', domainMap);
  }
}

/**
 * Clear all enforced domain mappings (keeps non-enforced/auto-matched ones)
 */
export async function clearAllEnforcedMappings(): Promise<void> {
  const domainMap = (await getStorage('matomo:domainSiteMap')) || {};
  const nonEnforcedMap: Record<string, DomainSiteMapping> = {};

  for (const [domain, mapping] of Object.entries(domainMap)) {
    if (!mapping.isEnforced) {
      nonEnforcedMap[domain] = mapping;
    }
  }

  await setStorage('matomo:domainSiteMap', nonEnforcedMap);
}

/**
 * Get always show entrance animation setting (defaults to false = only on first open)
 */
export async function getAlwaysShowEntranceAnimation(): Promise<boolean> {
  const value = await getStorage('settings:alwaysShowEntranceAnimation');
  return value ?? false;
}

/**
 * Set always show entrance animation setting
 */
export async function setAlwaysShowEntranceAnimation(enabled: boolean): Promise<void> {
  await setStorage('settings:alwaysShowEntranceAnimation', enabled);
}

/**
 * Get whether user has seen the entrance animation
 */
export async function getHasSeenEntranceAnimation(): Promise<boolean> {
  const value = await getStorage('state:hasSeenEntranceAnimation');
  return value ?? false;
}

/**
 * Mark that user has seen the entrance animation
 */
export async function setHasSeenEntranceAnimation(seen: boolean): Promise<void> {
  await setStorage('state:hasSeenEntranceAnimation', seen);
}

/**
 * Get whether animation is pending (triggered from popup)
 */
export async function getAnimationPending(): Promise<boolean> {
  const value = await getStorage('state:animationPending');
  return value ?? false;
}

/**
 * Set animation pending flag (called when bar enabled from popup)
 */
export async function setAnimationPending(pending: boolean): Promise<void> {
  await setStorage('state:animationPending', pending);
}
