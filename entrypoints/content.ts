import type { ContentScriptMessage, ContentScriptResponse, ScrollTrackerStatus } from '@/types/messages';

// Global state
const ScrollTracker = {
  scrolledElements: new Map<HTMLElement, ElementMetadata>(),
  originalStates: new Map<HTMLElement, ElementStyles>(),
  isTracking: false,
  heatmapId: null as number | null,
  startTime: null as number | null,
};

interface ElementMetadata {
  element: HTMLElement;
  selector: string;
  tag: string;
  scrollHeight: number;
  clientHeight: number;
  hiddenContent: number;
  parents: Array<{ element: HTMLElement; selector: string }>;
  firstDetected: number;
}

interface ElementStyles {
  height: string;
  minHeight: string;
  maxHeight: string;
  overflow: string;
  overflowY: string;
  position: string;
  outline: string;
  outlineOffset: string;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    console.log('[Matomo Screenshot Helper] Content script loaded');

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request: ContentScriptMessage, _sender, sendResponse) => {
      console.log('[Content] Message received:', request);

      try {
        switch (request.action) {
          case 'startTracking':
            handleStartTracking(request.heatmapId);
            sendResponse({ success: true });
            break;

          case 'stopTracking':
            handleStopTracking();
            sendResponse({ success: true });
            break;

          case 'getStatus':
            const status = getStatus();
            sendResponse(status);
            break;

          case 'expandElements':
            handleExpandElements()
              .then(() => sendResponse({ success: true }))
              .catch((error) => sendResponse({ success: false, error: error.message }));
            return true; // Async response

          case 'restore':
            handleRestore();
            sendResponse({ success: true });
            break;

          case 'showScanner':
            showScanner();
            sendResponse({ success: true });
            break;

          case 'showBorderGlow':
            showBorderGlow();
            sendResponse({ success: true });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[Content] Error handling message:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return true;
    });
  },
});

// Start tracking scrolls
function handleStartTracking(heatmapId: number) {
  ScrollTracker.heatmapId = heatmapId;
  ScrollTracker.isTracking = true;
  ScrollTracker.startTime = Date.now();
  ScrollTracker.scrolledElements.clear();

  // Attach scroll listeners to all elements
  document.querySelectorAll('*').forEach((el) => {
    el.addEventListener('scroll', handleScroll, { passive: true });
  });

  console.log('[Matomo Screenshot Helper] Tracking started');
}

// Stop tracking and clear state
function handleStopTracking() {
  ScrollTracker.isTracking = false;

  // Remove visual outlines from all tracked elements
  ScrollTracker.scrolledElements.forEach((metadata) => {
    metadata.element.style.outline = '';
    metadata.element.style.outlineOffset = '';
  });

  // Clear tracked elements
  ScrollTracker.scrolledElements.clear();

  console.log('[Matomo Screenshot Helper] Tracking stopped and state cleared');
}

// Handle scroll events
function handleScroll(event: Event) {
  if (!ScrollTracker.isTracking) return;

  const element = event.target as HTMLElement;

  // Skip document/window
  if (element === document.documentElement || element === document.body) return;

  // Check if element has scrollable content
  if (element.scrollHeight <= element.clientHeight) return;

  // Add to registry if not already there
  if (!ScrollTracker.scrolledElements.has(element)) {
    // Store original state BEFORE any modifications
    storeOriginalState(element);

    const selector = getElementSelector(element);
    const parents = findConstrainingParents(element);

    const metadata: ElementMetadata = {
      element,
      selector,
      tag: element.tagName.toLowerCase(),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      hiddenContent: element.scrollHeight - element.clientHeight,
      parents,
      firstDetected: Date.now(),
    };

    ScrollTracker.scrolledElements.set(element, metadata);

    console.log(`[Matomo Screenshot Helper] Detected: ${selector}`);
  }
}

// Get current status
function getStatus(): ScrollTrackerStatus {
  const scrollables = Array.from(ScrollTracker.scrolledElements.values()).map((meta) => ({
    selector: meta.selector,
    hiddenContent: meta.hiddenContent,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
  }));

  return {
    scrolledCount: ScrollTracker.scrolledElements.size,
    scrollables,
    isTracking: ScrollTracker.isTracking,
  };
}

// Expand elements
async function handleExpandElements() {
  ScrollTracker.isTracking = false;

  if (ScrollTracker.scrolledElements.size === 0) {
    console.log('[Matomo Screenshot Helper] No scrollable elements - skipping expansion');
    return;
  }

  console.log(`[Matomo Screenshot Helper] Expanding ${ScrollTracker.scrolledElements.size} elements`);

  // Store and expand html/body
  storeOriginalState(document.documentElement);
  storeOriginalState(document.body);
  expandElement(document.documentElement);
  expandElement(document.body);

  // Expand each scrollable and its parents
  ScrollTracker.scrolledElements.forEach((meta, element) => {
    // Remove outline
    element.style.outline = '';
    element.style.outlineOffset = '';

    // Expand element (original state already stored in handleScroll)
    expandScrollableElement(element, meta);

    // Expand parents
    meta.parents.forEach((parentInfo) => {
      storeOriginalState(parentInfo.element);
      expandElement(parentInfo.element);
    });
  });

  // Force reflow
  document.body.offsetHeight;

  // Wait for rendering
  await sleep(500);

  console.log('[Matomo Screenshot Helper] Elements expanded');
}

// Restore layout
function handleRestore() {
  console.log('[Matomo Screenshot Helper] Restoring layout');

  ScrollTracker.originalStates.forEach((styles, element) => {
    Object.entries(styles).forEach(([prop, value]) => {
      (element.style as any)[prop] = value;
    });
  });

  ScrollTracker.scrolledElements.clear();
  ScrollTracker.originalStates.clear();
  ScrollTracker.isTracking = false;

  console.log('[Matomo Screenshot Helper] Layout restored');
}

// Helper: Store original state
function storeOriginalState(element: HTMLElement) {
  if (!ScrollTracker.originalStates.has(element)) {
    ScrollTracker.originalStates.set(element, {
      height: element.style.height,
      minHeight: element.style.minHeight,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      overflowY: element.style.overflowY,
      position: element.style.position,
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
    });
  }
}

// Helper: Expand generic element
function expandElement(element: HTMLElement) {
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

// Helper: Expand scrollable element
function expandScrollableElement(element: HTMLElement, meta: ElementMetadata) {
  element.style.height = 'auto';
  element.style.minHeight = `${meta.scrollHeight}px`;
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

// Helper: Get element selector
function getElementSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter((c) => c).slice(0, 2).join('.');
    if (classes) return `.${classes}`;
  }
  return el.tagName.toLowerCase();
}

// Helper: Find constraining parents
function findConstrainingParents(element: HTMLElement): Array<{ element: HTMLElement; selector: string }> {
  const parents: Array<{ element: HTMLElement; selector: string }> = [];
  let current = element.parentElement;

  while (current && current !== document.documentElement) {
    const styles = window.getComputedStyle(current);

    const isConstraining =
      styles.height === '100vh' ||
      styles.height === '100%' ||
      styles.maxHeight !== 'none' ||
      styles.overflow === 'hidden' ||
      styles.overflowY === 'hidden' ||
      (parseFloat(styles.height) > 0 && parseFloat(styles.height) < element.scrollHeight);

    if (isConstraining) {
      parents.push({
        element: current,
        selector: getElementSelector(current),
      });
    }

    current = current.parentElement;
  }

  return parents;
}

// Helper: Sleep
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Show scanner animation
function showScanner() {
  // Remove existing
  const existing = document.getElementById('matomo-scanner-overlay');
  if (existing) existing.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'matomo-scanner-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999999;
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
      rgba(254, 154, 0, 0.3) 20%,
      rgba(254, 154, 0, 0.8) 50%,
      rgba(254, 154, 0, 0.3) 80%,
      transparent 100%);
    box-shadow: 0 0 20px rgba(254, 154, 0, 0.5);
    animation: matomo-scan 3s ease-in-out infinite;
    z-index: 1000000;
  `;

  // Add CSS animation
  if (!document.getElementById('matomo-scanner-styles')) {
    const style = document.createElement('style');
    style.id = 'matomo-scanner-styles';
    style.textContent = `
      @keyframes matomo-scan {
        0%, 100% { top: 0; }
        50% { top: 100%; }
      }
      html.matomoHsr #matomo-scanner-overlay,
      html.matomoHsr #matomo-scan-line,
      html.matomoHsr #matomo-border-glow,
      html.piwikHsr #matomo-scanner-overlay,
      html.piwikHsr #matomo-scan-line,
      html.piwikHsr #matomo-border-glow {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(scanLine);
  document.body.appendChild(overlay);

  // Trigger fade-in animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  console.log('[Content] Scanner overlay injected');
}

// Show border glow animation
function showBorderGlow() {
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
    z-index: 999999;
    opacity: 0;
    transition: all 0.5s ease-in-out;
    box-shadow:
      inset 0 0 80px 20px rgba(46, 204, 113, 0.3),
      inset 0 0 40px 10px rgba(46, 204, 113, 0.5);
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  console.log('[Content] Border glow overlay injected');

  // Fade out after 1s
  setTimeout(() => {
    overlay.style.opacity = '0';
  }, 1000);

  // Remove after 1.5s
  setTimeout(() => {
    overlay.remove();
  }, 1500);
}
