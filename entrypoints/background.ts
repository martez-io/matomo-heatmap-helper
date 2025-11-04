import type { BackgroundMessage, BackgroundResponse } from '@/types/messages';

export default defineBackground({
  main() {
    console.log('[Background] Service worker initialized');

    chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
      console.log('[Background] Received message:', message);

      if (message.action === 'onSuccessfulScreenshot') {
        handleSuccessfulScreenshot(message.tabId, message.url)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ success: false, error: error.message }));

        return true; // Async response
      }

      return false;
    });
  },
});

async function handleSuccessfulScreenshot(tabId: number, url: string): Promise<BackgroundResponse> {
  console.log('[Background] Handling successful screenshot');

  try {
    // Send message to content script to show border glow
    await chrome.tabs.sendMessage(tabId, { action: 'showBorderGlow' });

    // Wait for animation to complete (1.5s)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Open heatmap tab
    console.log('[Background] Opening heatmap tab:', url);
    const tab = await chrome.tabs.create({ url, active: true });

    console.log('[Background] Heatmap tab created:', tab.id);
    return { success: true, tabId: tab.id };
  } catch (error) {
    console.error('[Background] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
