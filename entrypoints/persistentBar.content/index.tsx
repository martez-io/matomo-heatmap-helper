/**
 * Entry point for persistent bar React content script
 * Creates Shadow DOM UI using WXT's createShadowRootUi
 */

import ReactDOM from 'react-dom/client';
import { storage } from 'wxt/utils/storage';
import { browser } from 'wxt/browser';
import { getCredentials } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { App } from './components/App';
import './styles.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    await logger.init();
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

    // Step 2: Resolve site for current page
    try {
      logger.debug('PersistentBar', 'Resolving site for current page...');
      const response = await browser.runtime.sendMessage({
        action: 'resolveSite',
        url: window.location.href,
      });

      if (!response.success) {
        logger.debug('PersistentBar', 'Could not resolve site:', response.error);
        return;
      }

      // Step 3: Store site info for bar components
      await storage.setItem('local:persistentBar:siteId', response.siteId);
      await storage.setItem('local:persistentBar:siteName', response.siteName);

      logger.debug('PersistentBar', 'Site resolved:', {
        siteId: response.siteId,
        siteName: response.siteName,
      });

      // Step 3.5: Trigger heatmap fetch for this site
      logger.debug('PersistentBar', 'Fetching heatmaps for site...');
      try {
        await browser.runtime.sendMessage({
          action: 'fetchHeatmaps',
          siteId: response.siteId,
          forceRefresh: false, // Use cache if available
        });
        logger.debug('PersistentBar', 'Heatmaps fetch triggered');
      } catch (fetchError) {
        logger.warn('PersistentBar', 'Failed to fetch heatmaps (will retry later):', fetchError);
        // Don't return - bar can still function without heatmaps loaded yet
      }
    } catch (error) {
      logger.error('PersistentBar', 'Failed to resolve site:', error);
      return;
    }

    // Step 4: Mount the React UI
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

    // Mark the shadow host with data attribute for detection
    const shadowHost = document.querySelector('matomo-heatmap-helper-bar');
    if (shadowHost) {
      (shadowHost as HTMLElement).dataset.mhhPersistentBar = 'true';
      logger.debug('PersistentBar', 'Shadow host marked with data attribute');
    }
  },
});
