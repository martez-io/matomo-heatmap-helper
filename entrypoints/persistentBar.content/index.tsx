/**
 * Entry point for persistent bar React content script
 * Creates Shadow DOM UI using WXT's createShadowRootUi
 */

import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { getCredentials, getDomainSiteMapping, getEnforceTracker, get, set, watch } from '@/lib/storage';
import { S } from '@/lib/storage-keys';
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

  return { siteId: siteId!, siteName: siteName! };
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
  await set(S.PERSISTENT_BAR_SITE_ID, siteId);
  await set(S.PERSISTENT_BAR_SITE_NAME, siteName);

  // Trigger heatmap fetch for this site (fire-and-forget, don't block UI mounting)
  logger.debug('PersistentBar', 'Triggering heatmap fetch...');
  browser.runtime.sendMessage({
    action: 'fetchHeatmaps',
    siteId: siteId,
    forceRefresh: false,
  }).then(() => {
    logger.debug('PersistentBar', 'Heatmaps fetch completed');
  }).catch((fetchError) => {
    logger.warn('PersistentBar', 'Failed to fetch heatmaps (will retry later):', fetchError);
  });

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
    const barVisible = await get(S.BAR_VISIBLE);
    logger.debug('PersistentBar', 'Bar visibility setting:', barVisible);

    if (barVisible) {
      logger.debug('PersistentBar', 'Bar enabled, mounting...');
      await mountBar(ctx, siteInfo.siteId, siteInfo.siteName);
    } else {
      logger.debug('PersistentBar', 'Bar disabled, waiting for toggle...');
    }

    // Step 4: Watch for bar visibility changes (enables mounting without page reload)
    // Using new watch() helper that applies defaults - no more null handling needed
    const unwatchBarVisible = watch(S.BAR_VISIBLE, async (newValue, oldValue) => {
      logger.debug('PersistentBar', 'Bar visibility changed:', { oldValue, newValue });

      if (newValue && !oldValue) {
        // Bar was enabled
        logger.debug('PersistentBar', 'Bar enabled via toggle, mounting...');
        await mountBar(ctx, siteInfo.siteId, siteInfo.siteName);
      } else if (!newValue && oldValue) {
        // Bar was disabled
        logger.debug('PersistentBar', 'Bar disabled via toggle, unmounting...');
        unmountBar();
      }
    });

    // Step 5: Watch for enforce mode changes to unmount if needed
    const unwatchEnforce = watch(S.ENFORCE_ENABLED, async (newValue, oldValue) => {
      if (oldValue && !newValue && wasEnforcedMapping) {
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

    // Step 6: Watch for credentials being cleared (e.g., after "Delete All Data")
    // This ensures the content script reinitializes with fresh state
    const unwatchCredentials = watch(S.API_URL, async (newValue, oldValue) => {
      if (!newValue && oldValue && currentUi) {
        logger.debug('PersistentBar', 'Credentials cleared while bar active, reloading page...');
        window.location.reload();
      }
    });

    // Clean up watchers when context invalidates
    ctx.onInvalidated(() => {
      unwatchBarVisible();
      unwatchEnforce();
      unwatchCredentials();
    });
  },
});
