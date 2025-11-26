/**
 * Visual animations and style injection for content script
 */

import { logger } from '@/lib/logger';

// Semantic colors for injected styles (must be hex values for host page injection)
const COLORS = {
  success: '#10b981',        // success-500 equivalent
  successBg: 'rgba(16, 185, 129, 0.2)',
  successGlow: 'rgba(46, 204, 113, 0.3)',
  successGlowStrong: 'rgba(46, 204, 113, 0.5)',
  primary: '#f59e0b',        // primary-500 equivalent
  primaryLight: 'rgba(254, 154, 0, 0.3)',
  primaryMedium: 'rgba(254, 154, 0, 0.5)',
  primaryStrong: 'rgba(254, 154, 0, 0.8)',
};

/**
 * Inject CSS styles for lock indicators and animations
 */
export function injectStyles(): void {
  if (document.getElementById('matomo-scanner-styles')) {
    return; // Already injected
  }

  const style = document.createElement('style');
  style.id = 'matomo-scanner-styles';
  style.textContent = `
    @keyframes matomo-scan {
      0%, 100% { top: 0; }
      50% { top: 100%; }
    }

    /* Base class for locked elements */
    .mhh-locked-element, .mhh-locked-element::before, .mhh-locked-element::after {
      background-attachment: local !important;
    }

    /* Lock indicator using ::before (green border + overlay) */
    .mhh-locked-indicator-before::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid ${COLORS.success};
      background: ${COLORS.successBg};
      pointer-events: none;
      z-index: 999990;
      box-sizing: border-box;
    }

    /* Lock indicator using ::after (green border + overlay) */
    .mhh-locked-indicator-after::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid ${COLORS.success};
      background: ${COLORS.successBg};
      pointer-events: none;
      z-index: 999990;
      box-sizing: border-box;
    }

    /* Lock indicator fallback DOM element */
    .matomo-lock-icon {
      pointer-events: none !important;
    }

    /* Hide lock indicators during scanner animation */
    html.mhh-scanner-active .mhh-locked-indicator-before::before,
    html.mhh-scanner-active .mhh-locked-indicator-after::after,
    html.mhh-scanner-active .matomo-lock-icon {
      display: none !important;
    }

    /* Hide all extension UI from Matomo screenshots */
    html.matomoHsr #matomo-scanner-overlay,
    html.matomoHsr #matomo-scan-line,
    html.matomoHsr #matomo-border-glow,
    html.matomoHsr #matomo-highlight-overlay,
    html.matomoHsr #matomo-element-tooltip,
    html.matomoHsr .matomo-lock-icon,
    html.matomoHsr .mhh-locked-indicator-before::before,
    html.matomoHsr .mhh-locked-indicator-after::after,
    html.piwikHsr #matomo-scanner-overlay,
    html.piwikHsr #matomo-scan-line,
    html.piwikHsr #matomo-border-glow,
    html.piwikHsr #matomo-highlight-overlay,
    html.piwikHsr #matomo-element-tooltip,
    html.piwikHsr .matomo-lock-icon,
    html.piwikHsr .mhh-locked-indicator-before::before,
    html.piwikHsr .mhh-locked-indicator-after::after {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  logger.debug('Content', 'Styles injected');
}

/**
 * Show scanner animation overlay
 */
export function showScanner(): void {
  // Remove existing
  const existing = document.getElementById('matomo-scanner-overlay');
  if (existing) existing.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'matomo-scanner-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999980;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.8);
    opacity: 0;
    transition: opacity 500ms;
  `;

  // Create scan line
  const scanLine = document.createElement('div');
  scanLine.id = 'matomo-scan-line';
  scanLine.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      ${COLORS.primaryLight} 20%,
      ${COLORS.primaryStrong} 50%,
      ${COLORS.primaryLight} 80%,
      transparent 100%);
    box-shadow: 0 0 20px ${COLORS.primaryMedium};
    animation: matomo-scan 3s ease-in-out infinite;
    z-index: 999980;
  `;

  // Ensure styles are injected (should already be done in main, but just in case)
  injectStyles();

  overlay.appendChild(scanLine);
  document.body.appendChild(overlay);

  // Add class to hide lock indicators during scanner
  document.documentElement.classList.add('mhh-scanner-active');

  // Trigger fade-in animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  logger.debug('Content', 'Scanner overlay injected');
}

/**
 * Hide scanner animation overlay
 */
export function hideScanner(): void {
  // Remove the CSS class immediately (always, regardless of whether scanner element exists)
  document.documentElement.classList.remove('mhh-scanner-active');

  const scanner = document.getElementById('matomo-scanner-overlay');
  if (scanner) {
    scanner.style.opacity = '0';
    setTimeout(() => {
      scanner.remove();
    }, 500); // Match transition duration
    logger.debug('Content', 'Scanner overlay removed');
  } else {
    logger.debug('Content', 'Scanner overlay not found, class removed');
  }
}

/**
 * Show success border glow animation
 */
export function showBorderGlow(): void {
  // ALWAYS remove the scanner class immediately, regardless of scanner element existence
  document.documentElement.classList.remove('mhh-scanner-active');

  // Fade out and remove scanner
  const scanner = document.getElementById('matomo-scanner-overlay');
  if (scanner) {
    scanner.style.opacity = '0';
    // Remove after fade-out completes
    setTimeout(() => {
      scanner.remove();
    }, 200); // Match transition duration
  }

  // Create border glow
  const overlay = document.createElement('div');
  overlay.id = 'matomo-border-glow';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 999980;
    opacity: 0;
    transition: all 0.5s ease-in-out;
    box-shadow:
      inset 0 0 80px 20px ${COLORS.successGlow},
      inset 0 0 40px 10px ${COLORS.successGlowStrong};
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  logger.debug('Content', 'Border glow overlay injected');

  // Fade out after 1s
  setTimeout(() => {
    overlay.style.opacity = '0';
  }, 1000);

  // Remove after 1.5s
  setTimeout(() => {
    overlay.remove();
  }, 1500);
}
