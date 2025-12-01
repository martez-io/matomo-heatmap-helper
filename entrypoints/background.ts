import { browser } from 'wxt/browser';
import { ScreenshotStateMachine } from './background/ScreenshotStateMachine';
import { fetchCorsResources, fetchCssText } from './background/cors-fetcher';
import { get, set, getCredentials } from '@/lib/storage';
import { S } from '@/lib/storage-keys';
import { createMatomoClient } from '@/lib/matomo-api';
import { resolveSiteForUrl } from '@/lib/site-resolver';
import { generateBugReportUrl } from '@/lib/github-issue';
import { logger } from '@/lib/logger';
import type { BackgroundMessage, BackgroundResponse } from '@/types/messages';

let screenshotMachine: ScreenshotStateMachine;

export default defineBackground({
  async main() {
    await logger.init();
    logger.debug('Background', 'Service worker initialized');

    // Initialize state machine
    screenshotMachine = new ScreenshotStateMachine();

    // Handle messages from popup/bar
    browser.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
      logger.debug('Background', 'Received message:', message);

      handleMessage(message, sender)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));

      return true; // Async response
    });

    // Handle tab updates (detect navigation during screenshot)
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
      if (changeInfo.status === 'loading') {
        const progress = await get(S.SCREENSHOT_PROGRESS);
        if (progress && progress.tabId === tabId) {
          logger.warn('Background', 'Page navigation during screenshot, cancelling');
          await screenshotMachine.cancel();
        }
      }
    });

    // Handle tab removal
    browser.tabs.onRemoved.addListener(async (tabId) => {
      const progress = await get(S.SCREENSHOT_PROGRESS);
      if (progress && progress.tabId === tabId) {
        logger.warn('Background', 'Tab closed during screenshot, cancelling');
        await screenshotMachine.cancel();
      }
    });
  },
});

async function handleMessage(
  message: BackgroundMessage,
  sender?: browser.Runtime.MessageSender
): Promise<BackgroundResponse> {
  switch (message.action) {
    case 'executeScreenshot':
      // Extract tabId from sender (for content script calls) or use provided tabId
      const tabId = sender?.tab?.id ?? message.tabId;

      if (!tabId) {
        return { success: false, error: 'No tab ID available' };
      }

      await screenshotMachine.start({
        heatmapId: message.heatmapId,
        tabId: tabId,
        siteId: message.siteId,
      });
      return { success: true };

    case 'cancelScreenshot':
      await screenshotMachine.cancel();
      return { success: true };

    case 'fetchHeatmaps':
      return await fetchHeatmaps(message.siteId, message.forceRefresh);

    case 'resolveSite':
      return await resolveSite(message.url);

    case 'onSuccessfulScreenshot':
      // Legacy handler - may still be called by old popup during migration
      return await handleSuccessfulScreenshot(message.tabId, message.url);

    case 'openSettings':
      return await handleOpenSettings();

    case 'openBugReport':
      return await handleOpenBugReport();

    case 'fetchCorsResources':
      return await handleFetchCorsResources(message.requests);

    case 'fetchCssText':
      return await handleFetchCssText(message.urls);

    default:
      return { success: false, error: 'Unknown action' };
  }
}

async function fetchHeatmaps(siteId: number, forceRefresh?: boolean): Promise<BackgroundResponse> {
  try {
    const creds = await getCredentials();
    if (!creds) {
      throw new Error('No credentials configured');
    }

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cache = await get(S.HEATMAPS_CACHE);
      if (cache[siteId]) {
        const isFresh = Date.now() - cache[siteId].timestamp < 5 * 60 * 1000;
        if (isFresh) {
          logger.debug('Background', 'Using cached heatmaps for site', siteId);
          return { success: true };
        }
      }
    }

    // Fetch from API
    logger.debug('Background', 'Fetching heatmaps from API for site', siteId);
    const client = createMatomoClient(creds.apiUrl, creds.authToken);
    const heatmaps = await client.getHeatmaps(siteId);

    // Strip large fields before caching to avoid storage quota errors
    // page_treemirror can be several MB per heatmap (DOM snapshots)
    const strippedHeatmaps = heatmaps.map(({ page_treemirror, ...rest }) => rest);

    // Update cache
    const existingCache = await get(S.HEATMAPS_CACHE);
    await set(S.HEATMAPS_CACHE, {
      ...existingCache,
      [siteId]: {
        heatmaps: strippedHeatmaps,
        timestamp: Date.now(),
      },
    });

    logger.debug('Background', 'Heatmaps cached:', heatmaps.length);
    return { success: true };
  } catch (error) {
    logger.error('Background', 'Failed to fetch heatmaps:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function resolveSite(url: string): Promise<BackgroundResponse> {
  try {
    logger.debug('Background', 'Resolving site for URL:', url);
    const result = await resolveSiteForUrl(url);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      siteId: result.siteId,
      siteName: result.siteName,
    };
  } catch (error) {
    logger.error('Background', 'Failed to resolve site:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Legacy handler for backward compatibility
async function handleSuccessfulScreenshot(tabId: number, url: string): Promise<BackgroundResponse> {
  logger.debug('Background', 'Handling successful screenshot (legacy)');

  try {
    // Send message to content script to show border glow
    await browser.tabs.sendMessage(tabId, { action: 'showBorderGlow' });

    // Wait for animation to complete (1.5s)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Open heatmap tab
    logger.debug('Background', 'Opening heatmap tab:', url);
    const tab = await browser.tabs.create({ url, active: true });

    logger.debug('Background', 'Heatmap tab created:', tab.id);
    return { success: true, tabId: tab.id };
  } catch (error) {
    logger.error('Background', 'Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleOpenSettings(): Promise<BackgroundResponse> {
  try {
    logger.debug('Background', 'Opening settings page');

    // Get the options page URL - WXT generates it as chrome-extension://[ID]/options.html
    const optionsUrl = browser.runtime.getURL('options.html');

    const tab = await browser.tabs.create({ url: optionsUrl, active: true });

    logger.debug('Background', 'Settings tab created:', tab.id);
    return { success: true, tabId: tab.id };
  } catch (error) {
    logger.error('Background', 'Failed to open settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleOpenBugReport(): Promise<BackgroundResponse> {
  try {
    logger.debug('Background', 'Opening bug report');

    // Generate bug report URL with browser/environment details
    // Assume Matomo is detected since persistent bar only shows on Matomo pages
    const bugReportUrl = await generateBugReportUrl({ matomoDetected: true });

    const tab = await browser.tabs.create({ url: bugReportUrl, active: true });

    logger.debug('Background', 'Bug report tab created:', tab.id);
    return { success: true, tabId: tab.id };
  } catch (error) {
    logger.error('Background', 'Failed to open bug report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleFetchCorsResources(
  requests: import('@/types/messages').CorsResourceRequest[]
): Promise<BackgroundResponse> {
  try {
    logger.debug('Background', 'Fetching CORS resources:', requests.length);

    const { results, totalSizeBytes } = await fetchCorsResources(requests);

    return {
      success: true,
      corsResults: results,
      totalSizeBytes,
    };
  } catch (error) {
    logger.error('Background', 'Failed to fetch CORS resources:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleFetchCssText(urls: string[]): Promise<BackgroundResponse> {
  try {
    logger.debug('Background', 'Fetching CSS text:', urls.length);

    const results = await fetchCssText(urls);

    return {
      success: true,
      cssTextResults: results,
    };
  } catch (error) {
    logger.error('Background', 'Failed to fetch CSS text:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
