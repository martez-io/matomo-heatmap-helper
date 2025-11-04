/**
 * Matomo API client for making authenticated API calls
 */

import type {
  MatomoHeatmap,
  MatomoSite,
  MatomoApiResponse,
  isMatomoApiError,
  HeatmapVerificationResponse,
} from '@/types/matomo';

export class MatomoApiClient {
  constructor(
    private baseUrl: string,
    private authToken: string
  ) {}

  /**
   * Make a generic Matomo API call
   */
  private async call<T>(params: Record<string, any>): Promise<T> {
    const url = `${this.baseUrl}/index.php`;

    const formData = new URLSearchParams();
    formData.append('module', 'API');
    formData.append('format', 'json');

    // Add all params
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, String(value));
    }

    console.log('[MatomoAPI] Calling:', params.method);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Check for Matomo API error response
      if (data.result === 'error') {
        throw new Error(data.message || 'Matomo API returned an error');
      }

      return data as T;
    } catch (error) {
      console.error('[MatomoAPI] Call failed:', error);

      // Provide user-friendly error messages
      if (
        error instanceof Error &&
        (error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))
      ) {
        throw new Error('Cannot connect to Matomo. Check the URL and your internet connection.');
      } else if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error(
          'CORS error. The Matomo server may need to allow requests from this extension.'
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Get sites with write access
   */
  async getSitesWithWriteAccess(): Promise<MatomoSite[]> {
    return this.call<MatomoSite[]>({
      method: 'SitesManager.getSitesWithMinimumAccess',
      permission: 'write',
      token_auth: this.authToken,
    });
  }

  /**
   * Get heatmaps for a site
   */
  async getHeatmaps(siteId: number): Promise<MatomoHeatmap[]> {
    return this.call<MatomoHeatmap[]>({
      method: 'HeatmapSessionRecording.getHeatmaps',
      idSite: siteId,
      token_auth: this.authToken,
    });
  }

  /**
   * Get a single heatmap with page tree mirror
   */
  async getHeatmap(
    siteId: number,
    heatmapId: number,
    includePageTreeMirror = false
  ): Promise<HeatmapVerificationResponse> {
    return this.call<HeatmapVerificationResponse>({
      method: 'HeatmapSessionRecording.getHeatmap',
      idSite: siteId,
      idSiteHsr: heatmapId,
      token_auth: this.authToken,
      ...(includePageTreeMirror && { includePageTreeMirror: 1 }),
    });
  }

  /**
   * Update heatmap configuration
   */
  async updateHeatmap(heatmap: MatomoHeatmap): Promise<any> {
    const params: Record<string, any> = {
      method: 'HeatmapSessionRecording.updateHeatmap',
      idSite: heatmap.idsite,
      idSiteHsr: heatmap.idsitehsr,
      name: heatmap.name,
      sampleRate: heatmap.sample_rate,
      sampleLimit: heatmap.sample_limit,
      breakpointMobile: heatmap.breakpoint_mobile,
      breakpointTablet: heatmap.breakpoint_tablet,
      screenshotUrl: heatmap.screenshot_url || '',
      excludedElements: heatmap.excluded_elements || '',
      captureDomManually: true,
      token_auth: this.authToken,
    };

    // Encode match_page_rules array
    if (heatmap.match_page_rules && Array.isArray(heatmap.match_page_rules)) {
      heatmap.match_page_rules.forEach((rule, index) => {
        params[`matchPageRules[${index}][attribute]`] = rule.attribute;
        params[`matchPageRules[${index}][type]`] = rule.type;
        params[`matchPageRules[${index}][value]`] = rule.value;
        params[`matchPageRules[${index}][inverted]`] = rule.inverted || '0';
      });
    }

    return this.call(params);
  }

  /**
   * Resume an ended heatmap
   */
  async resumeHeatmap(siteId: number, heatmapId: number): Promise<any> {
    return this.call({
      method: 'HeatmapSessionRecording.resumeHeatmap',
      idSite: siteId,
      idSiteHsr: heatmapId,
      token_auth: this.authToken,
    });
  }

  /**
   * Verify screenshot was captured
   */
  async verifyScreenshotCaptured(siteId: number, heatmapId: number): Promise<boolean> {
    try {
      const result = await this.getHeatmap(siteId, heatmapId, true);

      // Check if page_treemirror exists and is non-empty
      if (
        result &&
        result.page_treemirror &&
        typeof result.page_treemirror === 'string' &&
        result.page_treemirror.trim() !== ''
      ) {
        console.log('[MatomoAPI] Screenshot verified - page_treemirror present');
        return true;
      } else {
        console.warn('[MatomoAPI] Screenshot not verified - page_treemirror missing or empty');
        return false;
      }
    } catch (error) {
      console.error('[MatomoAPI] Failed to verify screenshot:', error);
      return false;
    }
  }

  /**
   * Poll for screenshot capture with timeout
   */
  async waitForScreenshotCapture(
    siteId: number,
    heatmapId: number,
    maxAttempts = 50,
    delayMs = 300
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[MatomoAPI] Verifying screenshot (${attempt}/${maxAttempts})...`);

      // Wait before checking
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Verify
      const success = await this.verifyScreenshotCaptured(siteId, heatmapId);
      if (success) {
        console.log('[MatomoAPI] Screenshot verified successfully!');
        return true;
      }
    }

    console.error('[MatomoAPI] Screenshot verification timed out');
    return false;
  }
}

/**
 * Create a Matomo API client instance
 */
export function createMatomoClient(baseUrl: string, authToken: string): MatomoApiClient {
  return new MatomoApiClient(baseUrl, authToken);
}
