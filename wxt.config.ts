import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Matomo Heatmap Helper',
    version: '1.0.0',
    description: 'The missing chrome extension for Matomo heatmap screenshots',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
});
