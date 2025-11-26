import { browser } from 'wxt/browser';
import { getCurrentTab } from './messaging';
import { logger } from './logger';
import { getBrowserName, getBrowserEngine, isFirefox, isEdge, isSafari, isOpera } from './platform';

export interface BugReportContext {
  errorMessage?: string;
  stackTrace?: string;
  appState?: string;
  processingStep?: string;
  matomoDetected?: boolean;
  selectedHeatmapId?: number;
}

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
}

/**
 * Extract browser version from user agent (requires UA parsing at runtime)
 */
function getBrowserVersion(): string {
  const ua = navigator.userAgent;

  if (isFirefox()) {
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    return match?.[1] ?? 'Unknown';
  }
  if (isEdge()) {
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    return match?.[1] ?? 'Unknown';
  }
  if (isSafari()) {
    const match = ua.match(/Version\/(\d+\.\d+)/);
    return match?.[1] ?? 'Unknown';
  }
  if (isOpera()) {
    const match = ua.match(/OPR\/(\d+\.\d+)/);
    return match?.[1] ?? 'Unknown';
  }
  // Chrome or other Chromium-based
  const match = ua.match(/Chrome\/(\d+\.\d+)/);
  return match?.[1] ?? 'Unknown';
}

/**
 * Detect browser information using WXT environment variables
 * Browser name/engine from build-time, version from UA
 */
export function getBrowserInfo(): BrowserInfo {
  return {
    name: getBrowserName(),
    version: getBrowserVersion(),
    engine: getBrowserEngine(),
  };
}

/**
 * Generate a GitHub issue URL with prefilled bug report information
 */
export async function generateBugReportUrl(
  context?: BugReportContext
): Promise<string> {
  const browserInfo = getBrowserInfo();
  const manifest = browser.runtime.getManifest();
  const extensionVersion = manifest.version;

  let currentUrl = 'N/A';
  try {
    const tab = await getCurrentTab();
    currentUrl = tab.url || 'N/A';
  } catch (error) {
    logger.warn('GithubIssue', 'Could not get current tab URL:', error);
  }

  // Build the issue body
  const sections = [
    '## Browser Information',
    `**Browser**: ${browserInfo.name} (${browserInfo.engine})`,
    `**Version**: ${browserInfo.version}`,
    `**Extension Version**: ${extensionVersion}`,
    '',
    '## Environment',
    `**Current URL**: ${currentUrl}`,
    `**Matomo Detected**: ${context?.matomoDetected !== undefined ? (context.matomoDetected ? 'Yes' : 'No') : 'Unknown'}`,
    '',
  ];

  // Add error details if available
  if (context?.errorMessage || context?.stackTrace || context?.appState) {
    sections.push('## Error Details');

    if (context.errorMessage) {
      sections.push('**Error Message**:');
      sections.push('```');
      sections.push(context.errorMessage);
      sections.push('```');
      sections.push('');
    }

    if (context.stackTrace) {
      sections.push('**Stack Trace**:');
      sections.push('```');
      sections.push(context.stackTrace);
      sections.push('```');
      sections.push('');
    }

    if (context.appState) {
      sections.push(`**App State**: ${context.appState}`);
      if (context.processingStep) {
        sections.push(`**Processing Step**: ${context.processingStep}`);
      }
      if (context.selectedHeatmapId !== undefined) {
        sections.push(`**Selected Heatmap ID**: ${context.selectedHeatmapId}`);
      }
      sections.push('');
    }
  }

  sections.push('## Steps to Reproduce');
  sections.push('1. ');
  sections.push('2. ');
  sections.push('3. ');
  sections.push('');
  sections.push('## Expected Behavior');
  sections.push('');
  sections.push('');
  sections.push('## Actual Behavior');
  sections.push('');
  sections.push('');
  sections.push('## Additional Context');
  sections.push('<!-- Add screenshots, console errors, or other context here -->');

  const body = sections.join('\n');

  // Create the GitHub issue URL with query parameters
  const baseUrl = 'https://github.com/martez-io/matomo-heatmap-helper/issues/new';
  const url = new URL(baseUrl);
  url.searchParams.set('template', 'bug_report.md');
  url.searchParams.set('title', '[Bug] ');
  url.searchParams.set('body', body);

  return url.toString();
}
