/**
 * Constants for feedback bar
 * Store URLs, troubleshooting items
 *
 * PLACEHOLDER URLs - Update these before publishing:
 * - CHROME_EXTENSION_ID: Get from Chrome Web Store after publishing
 * - FIREFOX_ADDON_SLUG: Get from Firefox Add-ons after publishing
 */

// Re-export generateBugReportUrl for use as the issue URL generator
export { generateBugReportUrl as getIssueUrl } from '@/lib/github-issue';
import { isFirefox, isEdge } from '@/lib/platform';

// =============================================================================
// PLACEHOLDER CONFIGURATION - UPDATE BEFORE PUBLISHING
// =============================================================================
const CHROME_EXTENSION_ID = 'your-chrome-extension-id';
const FIREFOX_ADDON_SLUG = 'matomo-heatmap-helper';
// =============================================================================

/**
 * Get the review URL for the current browser's extension store
 * Uses unified platform detection from @/lib/platform
 */
export function getReviewUrl(): string {
  if (isFirefox()) {
    return `https://addons.mozilla.org/firefox/addon/${FIREFOX_ADDON_SLUG}/reviews/`;
  }
  if (isEdge()) {
    return `https://microsoftedge.microsoft.com/addons/detail/${CHROME_EXTENSION_ID}`;
  }
  // Chrome / Chromium default
  return `https://chrome.google.com/webstore/detail/${CHROME_EXTENSION_ID}`;
}

interface TroubleshootingItem {
  issue: string;
  listItems: string[];
}

export const TROUBLESHOOTING_ITEMS: TroubleshootingItem[] = [
  {
    issue: 'Wrong height of elements',
    listItems: [
        'Verify that you successfully selected that element in the interactive mode',
        'If that did not help try selecting elements within that section and those surrounding it',
        'Make sure your browser width, is similar to the width of the heatmap. If elements are correctly rendered on desktop, but not on mobile then you have hit a known limitation. The matomo team is actively working on a solution.',
        'If the issue persists, please report the issue',
    ],
  },
  {
    issue: 'Only the first portion of the heatmap is shown',
    listItems: [
        'Make sure you have scrolled to the bottom of the page before clicking the capture button',
        'If the issue persists, please report the issue',
    ],
  },
  {
    issue: 'Parallax (sticky) background images are not shown',
    listItems: [
        'Click "select elements" button and click on the parallax (sticky) background image',
        'If that did not help try selecting elements within that section and those surrounding it',
        'If the issue persists, please report the issue',
    ],
  },
  {
    issue: 'Animated elements are not shown',
    listItems: [
        'Please ensure you have scrolled to the bottom of the page and have waited for the animation to complete',
        'If the issue persists, please report the issue',
    ],
  },
];
