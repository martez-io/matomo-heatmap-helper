// Background Service Worker for Matomo Heatmap Helper Extension
// This runs independently of the popup and handles tasks that need to continue after popup closes

console.log('[Background] Service worker initialized');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] Received message:', message);

  if (message.action === 'onSuccessfulScreenshot') {
    console.log('[Background] Handling successful screenshot, showing border glow animation');

    // Send message to content script to show border glow animation
    chrome.tabs.sendMessage(message.tabId, { action: 'showBorderGlow' }, (_response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Background] Failed to send border glow message:', chrome.runtime.lastError.message);
      }
    });

    // Wait 1.5 seconds for animation to complete, then open heatmap tab
    setTimeout(() => {
      console.log('[Background] Opening heatmap tab:', message.url);

      chrome.tabs.create({ url: message.url, active: true }).then(tab => {
        console.log('[Background] Heatmap tab created successfully:', tab.id);
        sendResponse({ success: true, tabId: tab.id });
      }).catch(error => {
        console.error('[Background] Failed to create tab:', error);
        sendResponse({ success: false, error: error.message });
      });
    }, 1500);

    // Return true to indicate we'll send response asynchronously
    return true;
  }
});
