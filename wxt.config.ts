import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Matomo Heatmap Screenshot Helper',
    version: '1.0.0',
    description: 'The missing chrome extension for Matomo heatmap screenshots',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['<all_urls>'],
  },
});
