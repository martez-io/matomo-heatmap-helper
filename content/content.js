// Global state
const ScrollTracker = {
  scrolledElements: new Map(),
  originalStates: new Map(),
  isTracking: false,
  heatmapId: null,
  startTime: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request);

  try {
    switch(request.action) {
      case 'startTracking':
        console.log('[Content] Starting tracking with ID:', request.heatmapId);
        handleStartTracking(request.heatmapId);
        sendResponse({ success: true });
        return true;

      case 'getStatus':
        const status = getStatus();
        console.log('[Content] Sending status:', status);
        sendResponse(status);
        return true;

      case 'expandElements':
        console.log('[Content] Expanding elements');
        handleExpandElements()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates async response

      case 'restore':
        console.log('[Content] Restoring layout');
        handleRestore();
        sendResponse({ success: true });
        return true;

      default:
        console.log('[Content] Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
        return true;
    }
  } catch (error) {
    console.error('[Content] Error handling message:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Start tracking scrolls
function handleStartTracking(heatmapId) {
  ScrollTracker.heatmapId = heatmapId;
  ScrollTracker.isTracking = true;
  ScrollTracker.startTime = Date.now();
  ScrollTracker.scrolledElements.clear();

  // Attach scroll listeners to all elements
  document.querySelectorAll('*').forEach(el => {
    el.addEventListener('scroll', handleScroll, { passive: true });
  });

  console.log('[Matomo Screenshot Helper] Tracking started');
}

// Handle scroll events
function handleScroll(event) {
  if (!ScrollTracker.isTracking) return;

  const element = event.target;

  // Skip document/window
  if (element === document || element === window) return;

  // Check if element has scrollable content
  if (element.scrollHeight <= element.clientHeight) return;

  // Add to registry if not already there
  if (!ScrollTracker.scrolledElements.has(element)) {
    const selector = getElementSelector(element);
    const parents = findConstrainingParents(element);

    const metadata = {
      element: element,
      selector: selector,
      tag: element.tagName.toLowerCase(),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      hiddenContent: element.scrollHeight - element.clientHeight,
      parents: parents,
      firstDetected: Date.now()
    };

    ScrollTracker.scrolledElements.set(element, metadata);

    // Visual feedback
    element.style.outline = '2px solid #27ae60';
    element.style.outlineOffset = '-2px';

    console.log(`[Matomo Screenshot Helper] Detected: ${selector}`);
  }
}

// Get current status
function getStatus() {
  const scrollables = [];

  ScrollTracker.scrolledElements.forEach(meta => {
    scrollables.push({
      selector: meta.selector,
      hiddenContent: meta.hiddenContent,
      scrollHeight: meta.scrollHeight,
      clientHeight: meta.clientHeight
    });
  });

  return {
    scrolledCount: ScrollTracker.scrolledElements.size,
    scrollables: scrollables,
    isTracking: ScrollTracker.isTracking
  };
}

// Expand elements (DOM manipulation only)
async function handleExpandElements() {
  // Stop tracking
  ScrollTracker.isTracking = false;

  // If no scrollable elements detected, just return success
  // This is normal for pages with standard scroll (no custom containers)
  if (ScrollTracker.scrolledElements.size === 0) {
    console.log('[Matomo Screenshot Helper] No scrollable elements detected - skipping expansion (this is normal for pages without custom scroll containers)');
    return true;
  }

  console.log(`[Matomo Screenshot Helper] Expanding ${ScrollTracker.scrolledElements.size} elements`);

  // Store original states
  storeOriginalState(document.documentElement, 'html');
  storeOriginalState(document.body, 'body');

  // Expand html and body
  expandElement(document.documentElement);
  expandElement(document.body);

  // Expand each scrollable and its parents
  ScrollTracker.scrolledElements.forEach((meta, element) => {
    // Remove outline
    element.style.outline = '';
    element.style.outlineOffset = '';

    // Store original state
    storeOriginalState(element);

    // Expand element
    expandScrollableElement(element, meta);

    // Expand parents
    meta.parents.forEach(parentInfo => {
      const parent = parentInfo.element;
      storeOriginalState(parent);
      expandElement(parent);
    });
  });

  // Force reflow
  document.body.offsetHeight;

  // Wait a moment for rendering
  await sleep(500);

  console.log('[Matomo Screenshot Helper] Elements expanded successfully');
  return true;
}

// Restore original layout
function handleRestore() {
  console.log('[Matomo Screenshot Helper] Restoring original layout');

  ScrollTracker.originalStates.forEach((styles, element) => {
    Object.keys(styles).forEach(prop => {
      element.style[prop] = styles[prop];
    });
  });

  ScrollTracker.scrolledElements.clear();
  ScrollTracker.originalStates.clear();
  ScrollTracker.isTracking = false;

  console.log('[Matomo Screenshot Helper] Layout restored');
}

// Helper: Store original state
function storeOriginalState(element, key) {
  if (!ScrollTracker.originalStates.has(element)) {
    ScrollTracker.originalStates.set(element, {
      height: element.style.height,
      minHeight: element.style.minHeight,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
      overflowY: element.style.overflowY,
      position: element.style.position,
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset
    });
  }
}

// Helper: Expand generic element
function expandElement(element) {
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

// Helper: Expand scrollable element
function expandScrollableElement(element, meta) {
  element.style.height = 'auto';
  element.style.minHeight = `${meta.scrollHeight}px`;
  element.style.maxHeight = 'none';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
}

// Helper: Get element selector
function getElementSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
    if (classes) return `.${classes}`;
  }
  return el.tagName.toLowerCase();
}

// Helper: Find constraining parents
function findConstrainingParents(element) {
  const parents = [];
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
        selector: getElementSelector(current)
      });
    }

    current = current.parentElement;
  }

  return parents;
}

// Helper: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('[Matomo Screenshot Helper] Content script loaded');
