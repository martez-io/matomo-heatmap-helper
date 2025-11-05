/**
 * Matomo API types and interfaces
 */

export interface MatomoHeatmap {
  idsitehsr: number;
  idsite: number;
  name: string;
  status: 'active' | 'ended';
  capture_manually: number;
  match_page_rules: Array<{
    attribute: string;
    type: string;
    value: string;
    inverted: string;
  }>;
  sample_rate: number;
  sample_limit: number;
  breakpoint_mobile: number;
  breakpoint_tablet: number;
  screenshot_url: string;
  excluded_elements: string;
  page_treemirror?: string;
  heatmapViewUrl?: string;
}

export interface MatomoSite {
  idsite: number;
  name: string;
  main_url: string;
  type?: string;
}

export interface MatomoCredentials {
  apiUrl: string;
  authToken: string;
}

export interface HeatmapVerificationResponse {
  page_treemirror?: string;
  [key: string]: any;
}

export type MatomoApiError = {
  result: 'error';
  message: string;
};

export type MatomoApiResponse<T> = T | MatomoApiError;

export function isMatomoApiError(response: any): response is MatomoApiError {
  return response && response.result === 'error';
}
