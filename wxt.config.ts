import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: "dist",
  manifest: {
    name: 'Matomo Heatmap Helper',
    version: '0.6.1', // x-release-please-version
    description: 'The missing chrome extension for Matomo heatmap screenshots',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
    web_accessible_resources: [
      {
        matches: ['<all_urls>'],
        resources: ['/logo.png'],
      },
    ],
  },
  vite: () => ({
    optimizeDeps: {
      // Wait for HTML crawling to complete before scanning dependencies
      // This prevents race condition where Vite tries to scan dist files before WXT generates them
      holdUntilCrawlEnd: true,
    },
  }),
});
