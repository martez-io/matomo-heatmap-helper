import { browser } from 'wxt/browser';
import { setStorage } from '@/lib/storage';
import type { ContentScriptMessage, ContentScriptResponse, ScrollTrackerStatus } from '@/types/messages';
import type { LockedElementData } from '@/types/storage';

// Global state
const ScrollTracker = {
  scrolledElements: new Map<HTMLElement, ElementMetadata>(),
  originalStates: new Map<HTMLElement, ElementStyles>(),
  isTracking: false,
  heatmapId: null as number | null,
  startTime: null as number | null,
  // Interactive mode state
  isInteractiveMode: false,
  lockedElements: new Map<HTMLElement, ElementMetadata>(),
  interactiveOverlay: null as HTMLElement | null,
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
    console.log('[Matomo Heatmap Helper] Content script loaded');

    // Inject styles immediately so lock indicators work
    injectStyles();

    // Listen for messages from popup
    browser.runtime.onMessage.addListener((request: ContentScriptMessage, _sender, sendResponse) => {
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

          case 'hideScanner':
            hideScanner();
            sendResponse({ success: true });
            break;

          case 'showBorderGlow':
            showBorderGlow();
            sendResponse({ success: true });
            break;

          case 'enterInteractiveMode':
            handleEnterInteractiveMode();
            sendResponse({ success: true });
            break;

          case 'exitInteractiveMode':
            handleExitInteractiveMode();
            sendResponse({ success: true });
            break;

          case 'getLockedElements':
            const lockedStatus = getLockedElementsStatus();
            sendResponse(lockedStatus);
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

  console.log('[Matomo Heatmap Helper] Tracking started');
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

  console.log('[Matomo Heatmap Helper] Tracking stopped and state cleared');
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
    // Skip if element is already locked (prioritize locked state)
    if (ScrollTracker.lockedElements.has(element)) {
      return;
    }

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

    console.log(`[Matomo Heatmap Helper] Detected: ${selector}`);
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
    isInteractiveMode: ScrollTracker.isInteractiveMode,
    lockedCount: ScrollTracker.lockedElements.size,
  };
}

// Sync state to storage
async function syncStateToStorage() {
  await setStorage('state:isInteractiveMode', ScrollTracker.isInteractiveMode);

  const lockedElements: LockedElementData[] = Array.from(ScrollTracker.lockedElements.values()).map(meta => ({
    selector: meta.selector,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
  }));
  await setStorage('state:lockedElements', lockedElements);
}

// Expand elements
async function handleExpandElements() {
  ScrollTracker.isTracking = false;

  // Merge locked and scrolled elements (avoiding duplicates)
  const elementsToExpand = new Map<HTMLElement, ElementMetadata>();

  // Add scrolled elements
  ScrollTracker.scrolledElements.forEach((meta, element) => {
    elementsToExpand.set(element, meta);
  });

  // Add locked elements (will override if already in map)
  ScrollTracker.lockedElements.forEach((meta, element) => {
    elementsToExpand.set(element, meta);
  });

  if (elementsToExpand.size === 0) {
    console.log('[Matomo Heatmap Helper] No elements to expand - skipping expansion');
    return;
  }

  console.log(`[Matomo Heatmap Helper] Expanding ${elementsToExpand.size} elements (${ScrollTracker.scrolledElements.size} scrolled, ${ScrollTracker.lockedElements.size} locked)`);

  // Store and expand html/body
  storeOriginalState(document.documentElement);
  storeOriginalState(document.body);
  expandElement(document.documentElement);
  expandElement(document.body);

  // Expand each element and its parents
  elementsToExpand.forEach((meta, element) => {
    // Remove visual indicators
    element.style.outline = '';
    element.style.outlineOffset = '';

    // Remove lock icon if present
    const lockIcon = element.querySelector('.matomo-lock-icon');
    if (lockIcon) {
      lockIcon.remove();
    }

    // Expand element (original state already stored)
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

  console.log('[Matomo Heatmap Helper] Elements expanded');
}

// Restore layout
function handleRestore() {
  console.log('[Matomo Heatmap Helper] Restoring layout');

  // Remove all lock indicators
  document.querySelectorAll('.mhh-locked-element').forEach((el) => {
    el.classList.remove('mhh-locked-element');
    el.classList.remove('mhh-locked-indicator-before');
    el.classList.remove('mhh-locked-indicator-after');
  });
  document.querySelectorAll('.matomo-lock-icon').forEach((icon) => icon.remove());

  // Restore original styles
  ScrollTracker.originalStates.forEach((styles, element) => {
    Object.entries(styles).forEach(([prop, value]) => {
      (element.style as any)[prop] = value;
    });
  });

  // Clear all state
  ScrollTracker.scrolledElements.clear();
  ScrollTracker.lockedElements.clear();
  ScrollTracker.originalStates.clear();
  ScrollTracker.isTracking = false;

  console.log('[Matomo Heatmap Helper] Layout restored');
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

// Interactive Mode Functions

function handleEnterInteractiveMode() {
  if (ScrollTracker.isInteractiveMode) {
    console.log('[Content] Interactive mode already active');
    return;
  }

  ScrollTracker.isInteractiveMode = true;
  syncStateToStorage(); // Sync to storage

  // Create instructions banner
  const banner = document.createElement('div');
  banner.id = 'matomo-interactive-banner';
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
    pointer-events: none;
    opacity: 0;
    transition: opacity 300ms;
  `;
  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">🔒</span>
      <span>Hover and click elements to lock their height and background position. <kbd style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;">ESC</kbd> to exit.</span>
    </div>
  `;

  document.body.appendChild(banner);

  // Trigger fade-in
  requestAnimationFrame(() => {
    banner.style.opacity = '1';
  });

  // Create highlight overlay container (will be positioned over hovered elements)
  const highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'matomo-highlight-overlay';
  highlightOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 2147483646;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(highlightOverlay);

  // Create element info tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'matomo-element-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 2147483647;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 11px;
    white-space: nowrap;
    display: none;
  `;
  document.body.appendChild(tooltip);

  // Attach event listeners
  document.addEventListener('mouseover', handleInteractiveHover, true);
  document.addEventListener('mouseout', handleInteractiveHoverOut, true);
  document.addEventListener('click', handleInteractiveClick, true);
  document.addEventListener('keydown', handleInteractiveKeydown);

  // Store references
  ScrollTracker.interactiveOverlay = banner;

  console.log('[Content] Interactive mode enabled');
}

function handleExitInteractiveMode() {
  if (!ScrollTracker.isInteractiveMode) return;

  ScrollTracker.isInteractiveMode = false;
  syncStateToStorage(); // Sync to storage

  // Remove banner
  if (ScrollTracker.interactiveOverlay) {
    ScrollTracker.interactiveOverlay.style.opacity = '0';
    setTimeout(() => {
      ScrollTracker.interactiveOverlay?.remove();
      ScrollTracker.interactiveOverlay = null;
    }, 300);
  }

  // Remove highlight overlay and tooltip
  const highlight = document.getElementById('matomo-highlight-overlay');
  if (highlight) highlight.remove();

  const tooltip = document.getElementById('matomo-element-tooltip');
  if (tooltip) tooltip.remove();

  // Remove event listeners
  document.removeEventListener('mouseover', handleInteractiveHover, true);
  document.removeEventListener('mouseout', handleInteractiveHoverOut, true);
  document.removeEventListener('click', handleInteractiveClick, true);
  document.removeEventListener('keydown', handleInteractiveKeydown);

  // Reset cursor to default
  document.body.style.cursor = '';

  console.log('[Content] Interactive mode disabled');
}

function handleInteractiveHover(event: MouseEvent) {
  // Skip if scanner is active
  if (document.documentElement.classList.contains('mhh-scanner-active')) {
    return;
  }

  const element = event.target as HTMLElement;

  // Skip our own elements
  if (element.id === 'matomo-interactive-banner' ||
      element.id === 'matomo-highlight-overlay' ||
      element.id === 'matomo-element-tooltip' ||
      element.closest('#matomo-interactive-banner')) {
    return;
  }

  const highlight = document.getElementById('matomo-highlight-overlay');
  const tooltip = document.getElementById('matomo-element-tooltip');
  if (!highlight || !tooltip) return;

  // Get element bounds
  const rect = element.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  // Check if element is locked
  const isLocked = ScrollTracker.lockedElements.has(element);

  // Position and style highlight overlay
  highlight.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollLeft}px;
    top: ${rect.top + scrollTop}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background: ${isLocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
    border: 2px solid ${isLocked ? '#10b981' : '#3b82f6'};
    pointer-events: none;
    z-index: 2147483646;
    display: block;
    box-sizing: border-box;
  `;

  // Create element info text
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classList = element.className && typeof element.className === 'string'
    ? `.${element.className.split(' ').filter(c => c).slice(0, 2).join('.')}`
    : '';
  const dimensions = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  const lockStatus = isLocked ? ' 🔒' : '';

  const infoText = `${tagName}${id}${classList} ${dimensions}${lockStatus}`;

  // Position tooltip above element, or below if not enough space
  const tooltipTop = rect.top > 30 ? rect.top + scrollTop - 25 : rect.bottom + scrollTop + 5;

  tooltip.textContent = infoText;
  tooltip.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollLeft}px;
    top: ${tooltipTop}px;
    pointer-events: none;
    z-index: 2147483647;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 11px;
    white-space: nowrap;
    display: block;
  `;

  // Change cursor
  document.body.style.cursor = 'pointer';
}

function handleInteractiveHoverOut(event: MouseEvent) {
  // Skip if scanner is active
  if (document.documentElement.classList.contains('mhh-scanner-active')) {
    return;
  }

  const highlight = document.getElementById('matomo-highlight-overlay');
  const tooltip = document.getElementById('matomo-element-tooltip');

  if (highlight) highlight.style.display = 'none';
  if (tooltip) tooltip.style.display = 'none';

  document.body.style.cursor = '';
}

function handleInteractiveClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const element = event.target as HTMLElement;

  // Skip our own elements
  if (element.id === 'matomo-interactive-banner' ||
      element.id === 'matomo-highlight-overlay' ||
      element.id === 'matomo-element-tooltip' ||
      element.closest('#matomo-interactive-banner')) {
    return;
  }

  // Toggle lock state
  if (ScrollTracker.lockedElements.has(element)) {
    // Unlock
    unlockElement(element);
  } else {
    // Lock
    lockElement(element);
  }

  // Sync state to storage
  syncStateToStorage();

  // Trigger hover event to update visual feedback
  handleInteractiveHover(event);
}

function handleInteractiveKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleExitInteractiveMode();
  }
}

// Detect which pseudo-element is available for lock indicator
function detectAvailablePseudoElement(element: HTMLElement): 'before' | 'after' | 'fallback' {
  const beforeStyle = window.getComputedStyle(element, '::before');
  const afterStyle = window.getComputedStyle(element, '::after');

  // Check if pseudo-element is in use
  const beforeInUse = beforeStyle.content !== 'none' && beforeStyle.content !== '';
  const afterInUse = afterStyle.content !== 'none' && afterStyle.content !== '';

  // Prefer ::after, fallback to ::before, then to DOM element
  if (!afterInUse) return 'after';
  if (!beforeInUse) return 'before';

  return 'fallback'; // Both in use, use DOM element method
}

function lockElement(element: HTMLElement) {
  // Store original state
  storeOriginalState(element);

  // Get computed height
  const computedHeight = element.scrollHeight;
  const computedClientHeight = element.clientHeight;
  const selector = getElementSelector(element);
  const parents = findConstrainingParents(element);

  // Lock the height
  element.style.height = `${computedHeight}px`;
  element.style.minHeight = `${computedHeight}px`;

  // Add base class
  element.classList.add('mhh-locked-element');

  // Detect and apply appropriate indicator
  const indicatorType = detectAvailablePseudoElement(element);

  if (indicatorType === 'before') {
    element.classList.add('mhh-locked-indicator-before');
  } else if (indicatorType === 'after') {
    element.classList.add('mhh-locked-indicator-after');
  } else {
    // Fallback: create DOM element
    const lockIcon = document.createElement('div');
    lockIcon.className = 'matomo-lock-icon';
    lockIcon.style.cssText = `
      position: absolute;
      inset: 0;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.2);
      pointer-events: none;
      z-index: 2147483645;
      box-sizing: border-box;
    `;
    element.appendChild(lockIcon);
  }

  // Ensure element has position context
  const computedPosition = window.getComputedStyle(element).position;
  if (computedPosition === 'static') {
    element.style.position = 'relative';
  }

  // Store metadata
  const metadata: ElementMetadata = {
    element,
    selector,
    tag: element.tagName.toLowerCase(),
    scrollHeight: computedHeight,
    clientHeight: computedClientHeight,
    hiddenContent: computedHeight - computedClientHeight,
    parents,
    firstDetected: Date.now(),
  };

  ScrollTracker.lockedElements.set(element, metadata);

  console.log(`[Content] Locked: ${selector} (${computedHeight}px, indicator: ${indicatorType})`);
}

function unlockElement(element: HTMLElement) {
  // Remove from locked elements
  ScrollTracker.lockedElements.delete(element);

  // Remove all lock classes
  element.classList.remove('mhh-locked-element');
  element.classList.remove('mhh-locked-indicator-before');
  element.classList.remove('mhh-locked-indicator-after');

  // Remove fallback DOM element if exists
  const lockIcon = element.querySelector('.matomo-lock-icon');
  if (lockIcon) {
    lockIcon.remove();
  }

  // Restore original styles
  const originalState = ScrollTracker.originalStates.get(element);
  if (originalState) {
    element.style.height = originalState.height;
    element.style.minHeight = originalState.minHeight;
    element.style.position = originalState.position;
  }

  console.log(`[Content] Unlocked: ${getElementSelector(element)}`);
}

function getLockedElementsStatus() {
  const lockedElements = Array.from(ScrollTracker.lockedElements.values()).map((meta) => ({
    selector: meta.selector,
    scrollHeight: meta.scrollHeight,
    clientHeight: meta.clientHeight,
    isScrollable: meta.hiddenContent > 0,
  }));

  return {
    lockedCount: ScrollTracker.lockedElements.size,
    lockedElements,
  };
}

// Inject CSS styles for lock indicators and animations
function injectStyles() {
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
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.2);
      pointer-events: none;
      z-index: 2147483645;
      box-sizing: border-box;
    }

    /* Lock indicator using ::after (green border + overlay) */
    .mhh-locked-indicator-after::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.2);
      pointer-events: none;
      z-index: 2147483645;
      box-sizing: border-box;
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
    html.matomoHsr #matomo-interactive-banner,
    html.matomoHsr #matomo-highlight-overlay,
    html.matomoHsr #matomo-element-tooltip,
    html.matomoHsr .matomo-lock-icon,
    html.matomoHsr .mhh-locked-indicator-before::before,
    html.matomoHsr .mhh-locked-indicator-after::after,
    html.piwikHsr #matomo-scanner-overlay,
    html.piwikHsr #matomo-scan-line,
    html.piwikHsr #matomo-border-glow,
    html.piwikHsr #matomo-interactive-banner,
    html.piwikHsr #matomo-highlight-overlay,
    html.piwikHsr #matomo-element-tooltip,
    html.piwikHsr .matomo-lock-icon,
    html.piwikHsr .mhh-locked-indicator-before::before,
    html.piwikHsr .mhh-locked-indicator-after::after {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
  console.log('[Content] Styles injected');
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

  console.log('[Content] Scanner overlay injected');
}

// Hide scanner animation
function hideScanner() {
  // Remove the CSS class immediately (always, regardless of whether scanner element exists)
  document.documentElement.classList.remove('mhh-scanner-active');

  const scanner = document.getElementById('matomo-scanner-overlay');
  if (scanner) {
    scanner.style.opacity = '0';
    setTimeout(() => {
      scanner.remove();
    }, 500); // Match transition duration
    console.log('[Content] Scanner overlay removed');
  } else {
    console.log('[Content] Scanner overlay not found, class removed');
  }
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
      // Remove class to show lock indicators again
      document.documentElement.classList.remove('mhh-scanner-active');
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
