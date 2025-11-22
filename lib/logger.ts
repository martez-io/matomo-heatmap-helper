/**
 * Centralized logger with debug mode support.
 *
 * - debug() and info() only log when debug mode is enabled
 * - warn() and error() always log (important for troubleshooting)
 * - Caches debug mode in memory for sync access
 * - Watches storage changes to update cache live
 */

import { storage } from 'wxt/utils/storage';

interface Logger {
  _debugEnabled: boolean;
  _initialized: boolean;
  _unwatch: (() => void) | null;

  init(): Promise<void>;
  debug(tag: string, ...args: unknown[]): void;
  info(tag: string, ...args: unknown[]): void;
  warn(tag: string, ...args: unknown[]): void;
  error(tag: string, ...args: unknown[]): void;
}

const formatTag = (tag: string) => `[${tag}]`;

export const logger: Logger = {
  _debugEnabled: false,
  _initialized: false,
  _unwatch: null,

  /**
   * Initialize the logger by loading debug mode from storage
   * and setting up a watcher for live updates.
   * Safe to call multiple times - will only initialize once.
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    // Load current debug mode setting
    const debugMode = await storage.getItem<boolean>('local:settings:debugMode');
    this._debugEnabled = debugMode ?? false;

    // Watch for changes to debug mode
    this._unwatch = storage.watch<boolean>('local:settings:debugMode', (newValue) => {
      this._debugEnabled = newValue ?? false;
    });

    this._initialized = true;
  },

  /**
   * Log debug messages (only when debug mode enabled)
   */
  debug(tag: string, ...args: unknown[]): void {
    if (this._debugEnabled) {
      console.log(formatTag(tag), ...args);
    }
  },

  /**
   * Log info messages (only when debug mode enabled)
   */
  info(tag: string, ...args: unknown[]): void {
    if (this._debugEnabled) {
      console.info(formatTag(tag), ...args);
    }
  },

  /**
   * Log warnings (always logs - important for troubleshooting)
   */
  warn(tag: string, ...args: unknown[]): void {
    console.warn(formatTag(tag), ...args);
  },

  /**
   * Log errors (always logs - important for troubleshooting)
   */
  error(tag: string, ...args: unknown[]): void {
    console.error(formatTag(tag), ...args);
  },
};
