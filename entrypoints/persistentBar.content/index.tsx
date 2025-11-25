/**
 * Entry point for persistent bar React content script
 * Creates Shadow DOM UI using WXT's createShadowRootUi
 */

import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import ReactDOM from 'react-dom/client';
import { storage } from 'wxt/utils/storage';
import { browser } from 'wxt/browser';
import { getCredentials, getDomainSiteMapping, getEnforceTracker } from '@/lib/storage';
import { extractDomain } from '@/lib/site-resolver';
import { logger } from '@/lib/logger';
import { App } from './components/App';
import './styles.css';

// Module-level state for the watcher to access
let currentUi: { remove: () => void } | null = null;
let currentDomain: string | null = null;
let wasEnforcedMapping = false;

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    await logger.init(true); // Skip watcher to avoid CSP violations
    logger.debug('PersistentBar', 'Initializing...');

    // Step 1: Check credentials
    const credentials = await getCredentials();
    if (!credentials) {
      logger.debug('PersistentBar', 'No credentials configured - bar will not show');
      return;
    }
    logger.debug('PersistentBar', 'Credentials found');

    // Step 1.5: Check if bar is enabled via toggle
    const barVisible = await storage.getItem('local:state:barVisible');
    logger.debug('PersistentBar', 'Bar visibility setting:', barVisible);

    if (barVisible === false) {
      logger.debug('PersistentBar', 'Bar manually disabled by user');
      return;
    }
    logger.debug('PersistentBar', 'Bar toggle check passed');

    // Step 2: Get current domain and check enforce mode
    currentDomain = extractDomain(window.location.href);
    if (!currentDomain) {
      logger.debug('PersistentBar', 'Could not extract domain from URL');
      return;
    }

    const enforceEnabled = await getEnforceTracker();
    logger.debug('PersistentBar', 'Enforce mode:', enforceEnabled, 'Domain:', currentDomain);

    // Step 3: Check domain mapping
    const domainMapping = await getDomainSiteMapping(currentDomain);
    let siteId: number | null = null;
    let siteName: string | null = null;

    if (domainMapping) {
      // Domain has a mapping - check if we should use it based on enforce mode
      if (enforceEnabled) {
        // Enforce mode ON: use any mapping (enforced or auto-matched)
        siteId = domainMapping.siteId;
        siteName = domainMapping.siteName;
        wasEnforcedMapping = domainMapping.isEnforced === true;
        logger.debug('PersistentBar', 'Using domain mapping (enforce ON):', { siteId, siteName, isEnforced: domainMapping.isEnforced });
      } else if (!domainMapping.isEnforced) {
        // Enforce mode OFF: only use non-enforced (auto-matched) mappings
        siteId = domainMapping.siteId;
        siteName = domainMapping.siteName;
        wasEnforcedMapping = false;
        logger.debug('PersistentBar', 'Using auto-matched domain mapping:', { siteId, siteName });
      } else {
        // Enforce mode OFF but mapping is enforced: ignore it
        logger.debug('PersistentBar', 'Ignoring enforced mapping (enforce mode is OFF)');
      }
    }

    // Step 4: If no valid mapping, try auto-resolution
    if (!siteId || !siteName) {
      try {
        logger.debug('PersistentBar', 'No valid mapping, attempting auto-resolution...');
        const response = await browser.runtime.sendMessage({
          action: 'resolveSite',
          url: window.location.href,
        });

        if (!response.success) {
          logger.debug('PersistentBar', 'Could not auto-resolve site:', response.error);
          return;
        }

        siteId = response.siteId;
        siteName = response.siteName;
        logger.debug('PersistentBar', 'Site auto-resolved:', { siteId, siteName });
      } catch (error) {
        logger.error('PersistentBar', 'Failed to resolve site:', error);
        return;
      }
    }

    // Step 5: Store site info for the App component
    await storage.setItem('local:persistentBar:siteId', siteId);
    await storage.setItem('local:persistentBar:siteName', siteName);

    // Step 6: Trigger heatmap fetch for this site
    logger.debug('PersistentBar', 'Fetching heatmaps for site...');
    try {
      await browser.runtime.sendMessage({
        action: 'fetchHeatmaps',
        siteId: siteId,
        forceRefresh: false, // Use cache if available
      });
      logger.debug('PersistentBar', 'Heatmaps fetch triggered');
    } catch (fetchError) {
      logger.warn('PersistentBar', 'Failed to fetch heatmaps (will retry later):', fetchError);
      // Don't return - bar can still function without heatmaps loaded yet
    }

    // Step 7: Mount the React UI
    logger.debug('PersistentBar', 'Mounting UI...');
    const ui = await createShadowRootUi(ctx, {
      name: 'matomo-heatmap-helper-bar',
      position: 'inline',
      append: 'last',
      onMount: (container) => {
        logger.debug('PersistentBar', 'onMount callback triggered');

        // Create root element for React
        const app = document.createElement('div');
        app.id = 'mhh-persistent-bar-root';
        container.append(app);

        // Render React app
        const root = ReactDOM.createRoot(app);
        root.render(<App />);

        logger.debug('PersistentBar', 'UI mounted successfully');

        return root;
      },
      onRemove: (root: ReactDOM.Root | undefined) => {
        logger.debug('PersistentBar', 'Unmounting UI...');
        root?.unmount();
      },
    });

    ui.mount();
    currentUi = ui;

    // Mark the shadow host with data attribute for detection
    const shadowHost = document.querySelector('matomo-heatmap-helper-bar');
    if (shadowHost) {
      (shadowHost as HTMLElement).dataset.mhhPersistentBar = 'true';
      logger.debug('PersistentBar', 'Shadow host marked with data attribute');
    }

    // Step 8: Watch for enforce mode changes to unmount if needed
    const unwatch = storage.watch<boolean>('local:enforce:enabled', async (newValue, oldValue) => {
      // Only react when enforce mode is turned OFF and we were using an enforced mapping
      if (oldValue === true && newValue === false && wasEnforcedMapping) {
        logger.debug('PersistentBar', 'Enforce mode disabled, checking if bar should remain...');

        // Try to auto-resolve the site without the enforced mapping
        try {
          const response = await browser.runtime.sendMessage({
            action: 'resolveSite',
            url: window.location.href,
          });

          if (!response.success) {
            // Can't resolve site without enforce mode - remove the bar
            logger.debug('PersistentBar', 'Cannot resolve site without enforce mode, removing bar');
            currentUi?.remove();
            currentUi = null;
          } else {
            // Site resolved to a different (natural) site - reload to get correct state
            logger.debug('PersistentBar', 'Site resolved to natural site, reloading page');
            window.location.reload();
          }
        } catch (error) {
          logger.error('PersistentBar', 'Error checking site resolution:', error);
          currentUi?.remove();
          currentUi = null;
        }
      }
    });

    // Clean up watcher when context invalidates
    ctx.onInvalidated(() => {
      unwatch();
    });
  },
});
