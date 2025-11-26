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

/**
 * Resolves site info for the current page
 * Returns null if site cannot be resolved
 */
async function resolveSiteInfo(): Promise<{ siteId: number; siteName: string } | null> {
  // Get current domain
  currentDomain = extractDomain(window.location.href);
  if (!currentDomain) {
    logger.debug('PersistentBar', 'Could not extract domain from URL');
    return null;
  }

  const enforceEnabled = await getEnforceTracker();
  logger.debug('PersistentBar', 'Enforce mode:', enforceEnabled, 'Domain:', currentDomain);

  // Check domain mapping
  const domainMapping = await getDomainSiteMapping(currentDomain);
  let siteId: number | null = null;
  let siteName: string | null = null;

  if (domainMapping) {
    if (enforceEnabled) {
      siteId = domainMapping.siteId;
      siteName = domainMapping.siteName;
      wasEnforcedMapping = domainMapping.isEnforced === true;
      logger.debug('PersistentBar', 'Using domain mapping (enforce ON):', { siteId, siteName, isEnforced: domainMapping.isEnforced });
    } else if (!domainMapping.isEnforced) {
      siteId = domainMapping.siteId;
      siteName = domainMapping.siteName;
      wasEnforcedMapping = false;
      logger.debug('PersistentBar', 'Using auto-matched domain mapping:', { siteId, siteName });
    } else {
      logger.debug('PersistentBar', 'Ignoring enforced mapping (enforce mode is OFF)');
    }
  }

  // If no valid mapping, try auto-resolution
  if (!siteId || !siteName) {
    try {
      logger.debug('PersistentBar', 'No valid mapping, attempting auto-resolution...');
      const response = await browser.runtime.sendMessage({
        action: 'resolveSite',
        url: window.location.href,
      });

      if (!response.success) {
        logger.debug('PersistentBar', 'Could not auto-resolve site:', response.error);
        return null;
      }

      siteId = response.siteId;
      siteName = response.siteName;
      logger.debug('PersistentBar', 'Site auto-resolved:', { siteId, siteName });
    } catch (error) {
      logger.error('PersistentBar', 'Failed to resolve site:', error);
      return null;
    }
  }

  return { siteId, siteName };
}

/**
 * Mounts the persistent bar UI
 */
async function mountBar(ctx: ContentScriptContext, siteId: number, siteName: string): Promise<void> {
  if (currentUi) {
    logger.debug('PersistentBar', 'Bar already mounted, skipping');
    return;
  }

  // Store site info for the App component
  await storage.setItem('local:persistentBar:siteId', siteId);
  await storage.setItem('local:persistentBar:siteName', siteName);

  // Trigger heatmap fetch for this site
  logger.debug('PersistentBar', 'Fetching heatmaps for site...');
  try {
    await browser.runtime.sendMessage({
      action: 'fetchHeatmaps',
      siteId: siteId,
      forceRefresh: false,
    });
    logger.debug('PersistentBar', 'Heatmaps fetch triggered');
  } catch (fetchError) {
    logger.warn('PersistentBar', 'Failed to fetch heatmaps (will retry later):', fetchError);
  }

  // Mount the React UI
  logger.debug('PersistentBar', 'Mounting UI...');
  const ui = await createShadowRootUi(ctx, {
    name: 'matomo-heatmap-helper-bar',
    position: 'inline',
    append: 'last',
    onMount: (container) => {
      logger.debug('PersistentBar', 'onMount callback triggered');

      const app = document.createElement('div');
      app.id = 'mhh-persistent-bar-root';
      container.append(app);

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
}

/**
 * Unmounts the persistent bar UI
 */
function unmountBar(): void {
  if (currentUi) {
    logger.debug('PersistentBar', 'Unmounting bar');
    currentUi.remove();
    currentUi = null;
  }
}

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

    // Step 2: Resolve site info (needed for mounting)
    const siteInfo = await resolveSiteInfo();
    if (!siteInfo) {
      logger.debug('PersistentBar', 'Could not resolve site - bar will not show');
      return;
    }

    // Step 3: Check initial bar visibility and mount if enabled
    const barVisible = await storage.getItem('local:state:barVisible');
    logger.debug('PersistentBar', 'Bar visibility setting:', barVisible);

    if (barVisible !== false) {
      logger.debug('PersistentBar', 'Bar enabled, mounting...');
      await mountBar(ctx, siteInfo.siteId, siteInfo.siteName);
    } else {
      logger.debug('PersistentBar', 'Bar disabled, waiting for toggle...');
    }

    // Step 4: Watch for bar visibility changes (enables mounting without page reload)
    const unwatchBarVisible = storage.watch<boolean>('local:state:barVisible', async (newValue, oldValue) => {
      logger.debug('PersistentBar', 'Bar visibility changed:', { oldValue, newValue });

      if (newValue === true && oldValue === false) {
        // Bar was enabled - mount it
        logger.debug('PersistentBar', 'Bar enabled via toggle, mounting...');
        await mountBar(ctx, siteInfo.siteId, siteInfo.siteName);
      } else if (newValue === false && oldValue !== false) {
        // Bar was disabled - unmount it
        logger.debug('PersistentBar', 'Bar disabled via toggle, unmounting...');
        unmountBar();
      }
    });

    // Step 5: Watch for enforce mode changes to unmount if needed
    const unwatchEnforce = storage.watch<boolean>('local:enforce:enabled', async (newValue, oldValue) => {
      if (oldValue === true && newValue === false && wasEnforcedMapping) {
        logger.debug('PersistentBar', 'Enforce mode disabled, checking if bar should remain...');

        try {
          const response = await browser.runtime.sendMessage({
            action: 'resolveSite',
            url: window.location.href,
          });

          if (!response.success) {
            logger.debug('PersistentBar', 'Cannot resolve site without enforce mode, removing bar');
            unmountBar();
          } else {
            logger.debug('PersistentBar', 'Site resolved to natural site, reloading page');
            window.location.reload();
          }
        } catch (error) {
          logger.error('PersistentBar', 'Error checking site resolution:', error);
          unmountBar();
        }
      }
    });

    // Clean up watchers when context invalidates
    ctx.onInvalidated(() => {
      unwatchBarVisible();
      unwatchEnforce();
    });
  },
});
