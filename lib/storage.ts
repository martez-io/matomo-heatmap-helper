/**
 * Typed storage helpers using WXT storage
 */

import { storage } from 'wxt/utils/storage';
import type { StorageSchema } from '@/types/storage';

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
 */
export async function saveDomainSiteMapping(
  domain: string,
  siteId: number,
  siteName: string
) {
  const domainMap = (await getStorage('matomo:domainSiteMap')) || {};

  domainMap[domain] = {
    siteId,
    siteName,
    timestamp: Date.now(),
  };

  await setStorage('matomo:domainSiteMap', domainMap);
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
