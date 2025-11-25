/**
 * Shared constants for the extension
 */

// Timeouts (in milliseconds)
export const MATOMO_LOAD_TIMEOUT_MS = 10000;
export const MATOMO_POLL_INTERVAL_MS = 200;
export const STALE_PROCESS_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Retry limits
export const MAX_SCREENSHOT_RETRIES = 3;

// Cache TTLs (in milliseconds)
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const DOMAIN_MAPPING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
