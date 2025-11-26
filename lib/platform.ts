/**
 * Unified platform/browser detection utilities
 * Uses WXT build-time environment variables for accurate detection
 */

/**
 * Get platform name in lowercase (for URLs, UTM params, etc.)
 * Returns: 'chrome', 'firefox', 'edge', 'safari', 'opera', or 'browser'
 */
export function getPlatformName(): string {
    if (import.meta.env.FIREFOX) return 'firefox';
    if (import.meta.env.EDGE) return 'edge';
    if (import.meta.env.SAFARI) return 'safari';
    if (import.meta.env.OPERA) return 'opera';
    if (import.meta.env.CHROME) return 'chrome';
    return import.meta.env.BROWSER || 'browser';
}

/**
 * Get browser name capitalized (for display purposes)
 * Returns: 'Chrome', 'Firefox', 'Edge', 'Safari', 'Opera', or 'Unknown'
 */
export function getBrowserName(): string {
    if (import.meta.env.FIREFOX) return 'Firefox';
    if (import.meta.env.EDGE) return 'Edge';
    if (import.meta.env.SAFARI) return 'Safari';
    if (import.meta.env.OPERA) return 'Opera';
    if (import.meta.env.CHROME) return 'Chrome';
    return import.meta.env.BROWSER || 'Unknown';
}

/**
 * Get browser engine name
 * Returns: 'Gecko' (Firefox), 'WebKit' (Safari), or 'Chromium' (Chrome/Edge/Opera)
 */
export function getBrowserEngine(): string {
    if (import.meta.env.FIREFOX) return 'Gecko';
    if (import.meta.env.SAFARI) return 'WebKit';
    return 'Chromium';
}

/**
 * Check if running in a specific browser
 */
export const isFirefox = (): boolean => !!import.meta.env.FIREFOX;
export const isChrome = (): boolean => !!import.meta.env.CHROME;
export const isEdge = (): boolean => !!import.meta.env.EDGE;
export const isSafari = (): boolean => !!import.meta.env.SAFARI;
export const isOpera = (): boolean => !!import.meta.env.OPERA;
