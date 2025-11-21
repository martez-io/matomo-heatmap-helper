/**
 * Entry point for persistent bar React content script
 * Creates Shadow DOM UI using WXT's createShadowRootUi
 */

import ReactDOM from 'react-dom/client';
import { storage } from 'wxt/utils/storage';
import { browser } from 'wxt/browser';
import { getCredentials } from '@/lib/storage';
import { App } from './components/App';
import './styles.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    console.log('[PersistentBar React] Initializing...');

    // Step 1: Check credentials
    const credentials = await getCredentials();
    if (!credentials) {
      console.log('[PersistentBar React] ❌ No credentials configured - bar will not show');
      return;
    }
    console.log('[PersistentBar React] ✅ Credentials found');

    // Step 1.5: Check if bar is enabled via toggle
    const barVisible = await storage.getItem('local:state:barVisible');
    console.log('[PersistentBar React] 📍 Bar visibility setting:', barVisible);

    if (barVisible === false) {
      console.log('[PersistentBar React] ❌ Bar manually disabled by user');
      return;
    }
    console.log('[PersistentBar React] ✅ Bar toggle check passed');

    // Step 2: Resolve site for current page
    try {
      console.log('[PersistentBar React] 🔍 Resolving site for current page...');
      const response = await browser.runtime.sendMessage({
        action: 'resolveSite',
        url: window.location.href,
      });

      if (!response.success) {
        console.log('[PersistentBar React] ❌ Could not resolve site:', response.error);
        return;
      }

      // Step 3: Store site info for bar components
      await storage.setItem('local:persistentBar:siteId', response.siteId);
      await storage.setItem('local:persistentBar:siteName', response.siteName);

      console.log('[PersistentBar React] ✅ Site resolved:', {
        siteId: response.siteId,
        siteName: response.siteName,
      });

      // Step 3.5: Trigger heatmap fetch for this site
      console.log('[PersistentBar React] 📋 Fetching heatmaps for site...');
      try {
        await browser.runtime.sendMessage({
          action: 'fetchHeatmaps',
          siteId: response.siteId,
          forceRefresh: false, // Use cache if available
        });
        console.log('[PersistentBar React] ✅ Heatmaps fetch triggered');
      } catch (fetchError) {
        console.warn('[PersistentBar React] ⚠️ Failed to fetch heatmaps (will retry later):', fetchError);
        // Don't return - bar can still function without heatmaps loaded yet
      }
    } catch (error) {
      console.error('[PersistentBar React] ❌ Failed to resolve site:', error);
      return;
    }

    // Step 4: Mount the React UI
    console.log('[PersistentBar React] 🚀 Mounting UI...');
    const ui = await createShadowRootUi(ctx, {
      name: 'matomo-heatmap-helper-bar',
      position: 'inline',
      append: 'last',
      onMount: (container) => {
        console.log('[PersistentBar React] Mounting UI...');

        // Create root element for React
        const app = document.createElement('div');
        app.id = 'mhh-persistent-bar-root';
        container.append(app);

        // Render React app
        const root = ReactDOM.createRoot(app);
        root.render(<App />);

        console.log('[PersistentBar React] UI mounted successfully');

        return root;
      },
      onRemove: (root: ReactDOM.Root | undefined) => {
        console.log('[PersistentBar React] Unmounting UI...');
        root?.unmount();
      },
    });

    ui.mount();

    // Mark the shadow host with data attribute for detection
    const shadowHost = document.querySelector('matomo-heatmap-helper-bar');
    if (shadowHost) {
      (shadowHost as HTMLElement).dataset.mhhPersistentBar = 'true';
      console.log('[PersistentBar React] Shadow host marked with data attribute');
    }
  },
});
