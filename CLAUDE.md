# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that helps prepare pages with custom scroll containers for Matomo heatmap screenshots. The extension tracks scrollable elements as users interact with them, then expands these elements and triggers Matomo's screenshot capture API.

## Architecture

### Extension Components

The extension uses a standard popup-based Chrome extension architecture:

1. **Popup UI (`popup/`)**: User interface for entering heatmap IDs, viewing detected scrollable elements, and triggering screenshot capture. Manages state transitions through 4 states: `input`, `error`, `scrolling`, and `success`.

2. **Content Script (`content/content.js`)**: Runs on all pages (`<all_urls>`). Handles:
   - Scroll event tracking using user-driven detection (attaches listeners to all DOM elements)
   - Scrollable element registry with metadata (scroll height, constraining parents, etc.)
   - DOM manipulation to expand elements
   - Layout restoration

3. **No Background Service Worker**: The extension is simple enough to not require a background script. All logic is in popup and content scripts.

### Message Passing Architecture

Communication flows from popup → content script via `chrome.tabs.sendMessage()`:

- `startTracking`: Initializes scroll tracking with heatmap ID
- `getStatus`: Polls for current count of detected scrollables (500ms intervals)
- `expandElements`: Triggers DOM expansion (returns promise for async completion)
- `restore`: Restores original element states

### Execution Contexts

**CRITICAL**: The extension uses both `ISOLATED` and `MAIN` execution contexts:

- **Content script** runs in `ISOLATED` world (default for content scripts) - cannot access page's `window._paq`
- **Matomo API calls** must run in `MAIN` world via `chrome.scripting.executeScript({ world: 'MAIN' })` to access page context and `window._paq`

This dual-context architecture is essential for security while maintaining Matomo API access.

### State Management

**Content Script State** (`content/content.js:2-8`):
- `ScrollTracker` object maintains global state:
  - `scrolledElements`: Map of detected scrollable elements with metadata
  - `originalStates`: Map of original CSS styles for restoration
  - `isTracking`: Boolean tracking mode
  - `heatmapId`: Current heatmap ID
  - `startTime`: Tracking start timestamp

**Popup State** (`popup/popup.js:2-4`):
- `currentState`: One of `'input'`, `'error'`, `'scrolling'`, `'success'`
- `heatmapId`: Current heatmap ID
- `bypassedMatomoCheck`: Tracks if user bypassed Matomo detection

### Scrollable Detection Algorithm

The extension uses **user-driven detection** rather than heuristics (`content/content.js:68-104`):

1. Attach `scroll` event listeners to all DOM elements on tracking start
2. When a scroll event fires:
   - Check if element has scrollable content (`scrollHeight > clientHeight`)
   - Skip if already registered
   - Find constraining parents that limit expansion
   - Store metadata in `ScrollTracker.scrolledElements` Map
   - Apply visual feedback (green outline)

### Parent Constraint Detection

Function `findConstrainingParents()` (`content/content.js:240-266`) walks up the DOM tree to find parents that constrain child expansion:

- Fixed heights: `100vh`, `100%`, or pixel values
- Max-height constraints
- Overflow hidden: `overflow: hidden` or `overflow-y: hidden`
- Heights smaller than child's scrollHeight

These parents must also be expanded during screenshot capture.

### Expansion Strategy

Function `handleExpandElements()` (`content/content.js:127-176`):

1. Stop tracking (`isTracking = false`)
2. Store original CSS states for all modified elements
3. Expand `<html>` and `<body>` to remove viewport constraints
4. For each detected scrollable:
   - Remove visual outline
   - Set `minHeight` to full `scrollHeight`
   - Set `overflow: visible`
   - Expand all constraining parents
5. Force reflow and wait 500ms for rendering

### Matomo Integration

The extension triggers two Matomo API calls in sequence (`popup/popup.js:227-228`):

```javascript
window._paq.push(['HeatmapSessionRecording::captureInitialDom', heatmapId]);
window._paq.push(['HeatmapSessionRecording::enable']);
```

These **must** execute in `MAIN` world to access the page's `window._paq` object.

## Development Workflow

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory
5. After code changes: click the reload icon on the extension card

### Testing

Manual testing workflow (see README.md:114-151 for full checklist):

1. Navigate to a page with custom scroll containers (e.g., Angular Material, Vuetify)
2. Open extension popup
3. Enter test heatmap ID
4. Scroll through all scrollable areas
5. Verify counter updates and elements get green outlines
6. Click "Done Scrolling - Take Screenshot"
7. Check console for Matomo API calls and verify page expanded

### Debugging

- **Popup console**: Right-click extension icon → Inspect popup
- **Content script console**: Open page DevTools (F12) → Console tab
- **Page context execution**: Check for `[Page Context]` logs in page console

All components log extensively with prefixes like `[Popup]`, `[Content]`, `[Page Context]`.

## Key Implementation Details

### Storage

Uses `chrome.storage.local` to persist last-used heatmap ID only (`popup/popup.js:30-34`, `148`).

### Matomo Detection

On popup load, checks for `window._paq` in `MAIN` world (`popup/popup.js:67-107`). Shows error state if not found, with option to "Continue Anyway" for testing.

### Error Handling

The popup tracks whether user bypassed Matomo check (`popup/popup.js:4`, `124`). If they did and capture fails, errors show inline in the scrolling state (`popup/popup.js:260-270`) rather than sending them back to the error state.

### Polling Updates

When in scrolling state, popup polls content script every 500ms for status updates (`popup/popup.js:313-334`) to update the detected count and list in real-time.

### Element Selectors

Function `getElementSelector()` (`content/content.js:230-237`) generates CSS selectors for UI display:
- Prefers `#id` if available
- Falls back to first 2 class names (`.class1.class2`)
- Falls back to tag name

## Permissions

- `activeTab`: Access current tab only (minimal permission)
- `scripting`: Required for `chrome.scripting.executeScript()` in MAIN world
- `storage`: Persist last heatmap ID

## File Structure

- `manifest.json`: Extension manifest (Manifest V3)
- `popup/popup.html`: Popup UI with 4 state sections
- `popup/popup.css`: Popup styling
- `popup/popup.js`: Popup state management and message passing
- `content/content.js`: Core scroll tracking and expansion logic
- `icons/`: Extension icons (16x16, 48x48, 128x128)
