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
  const [apiUrl, authToken, siteId, siteName] = await Promise.all([
    getStorage('matomo:apiUrl'),
    getStorage('matomo:authToken'),
    getStorage('matomo:siteId'),
    getStorage('matomo:siteName'),
  ]);

  if (!apiUrl || !authToken || !siteId || !siteName) {
    return null;
  }

  return {
    apiUrl,
    authToken,
    siteId,
    siteName,
  };
}

/**
 * Save credentials to storage
 */
export async function saveCredentials(credentials: {
  apiUrl: string;
  authToken: string;
  siteId: number;
  siteName: string;
}) {
  await Promise.all([
    setStorage('matomo:apiUrl', credentials.apiUrl),
    setStorage('matomo:authToken', credentials.authToken),
    setStorage('matomo:siteId', credentials.siteId),
    setStorage('matomo:siteName', credentials.siteName),
  ]);
}

/**
 * Clear credentials from storage
 */
export async function clearCredentials() {
  await Promise.all([
    removeStorage('matomo:apiUrl'),
    removeStorage('matomo:authToken'),
    removeStorage('matomo:siteId'),
    removeStorage('matomo:siteName'),
  ]);
}

/**
 * Check if cache is still valid
 */
export function isCacheValid(timestamp: number, ttl: number = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp < ttl;
}
