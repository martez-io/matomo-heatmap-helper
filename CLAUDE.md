# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that helps prepare pages with custom scroll containers for Matomo heatmap screenshots. The extension tracks scrollable elements as users interact with them, then expands these elements and triggers Matomo's screenshot capture API.

## Architecture

### Extension Components

The extension uses a standard popup-based Chrome extension architecture:

1. **Popup UI (`popup/`)**: User interface for managing Matomo API credentials, selecting heatmaps from a dropdown, viewing detected scrollable elements, and triggering screenshot capture. Manages state transitions through 4 states: `input`, `error`, `scrolling`, and `success`. Includes a settings modal for configuring Matomo API access and loading available heatmaps.

2. **Content Script (`content/content.js`)**: Runs on all pages (`<all_urls>`). Handles:
   - Scroll event tracking using user-driven detection (attaches listeners to all DOM elements)
   - Scrollable element registry with metadata (scroll height, constraining parents, etc.)
   - DOM manipulation to expand elements
   - Layout restoration

3. **Background Service Worker (`background/background.js`)**: Handles post-screenshot actions independently of popup lifecycle. Receives messages from popup and creates new tabs after popup closes, ensuring proper focus management.

### Message Passing Architecture

**Popup → Content Script** via `chrome.tabs.sendMessage()`:

- `startTracking`: Initializes scroll tracking with heatmap ID
- `getStatus`: Polls for current count of detected scrollables (500ms intervals)
- `expandElements`: Triggers DOM expansion (returns promise for async completion)
- `restore`: Restores original element states

**Popup → Background Worker** via `chrome.runtime.sendMessage()`:

- `onSuccessfulScreenshot`: Sent after successful screenshot capture with heatmap URL. Background worker creates new tab after popup closes to ensure proper focus management.

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

**Popup State** (`popup/popup.js:2-11`):
- `currentState`: One of `'input'`, `'error'`, `'scrolling'`, `'success'`
- `selectedHeatmap`: Full heatmap object from API (contains idsitehsr, name, status, capture_manually, match_page_rules, etc.)
- `availableHeatmaps`: Array of heatmaps loaded from Matomo API for current site
- `bypassedMatomoCheck`: Tracks if user bypassed Matomo detection
- `matomoApiUrl`: Stored Matomo instance URL for API calls
- `matomoAuthToken`: Stored authentication token for Matomo API
- `matomoSiteId`: Selected site ID with write access
- `matomoSiteName`: Selected site name for display

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

### Heatmap Validation & Configuration

Before triggering the screenshot, the extension validates and configures the selected heatmap via Matomo API calls:

**1. Load Available Heatmaps** (`popup/popup.js:430-512`):
- API: `HeatmapSessionRecording.getHeatmaps`
- Called on popup load if credentials exist
- Populates dropdown with format: `"Name (ID: 123) - Active/Ended"`

**2. Pre-Screenshot Validation** (`popup/popup.js:537-564`):
- Checks `capture_manually` setting:
  - If `=== 0`: Calls `updateHeatmap()` with `captureDomManually=true`
- Checks heatmap status:
  - If `=== "ended"`: Calls `resumeHeatmap()` and increments `sample_limit` by 1

**3. Update Heatmap API** (`popup/popup.js:566-608`):
- API: `HeatmapSessionRecording.updateHeatmap`
- Preserves all existing settings
- Encodes `match_page_rules` array with proper URL encoding

**4. Resume Heatmap API** (`popup/popup.js:610-628`):
- API: `HeatmapSessionRecording.resumeHeatmap`
- Re-activates ended heatmaps for new screenshot capture

## Development Workflow

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory
5. After code changes: click the reload icon on the extension card

### Testing

Manual testing workflow:

**Initial Setup:**
1. Open extension popup
2. Click settings gear icon (⚙️)
3. Enter Matomo instance URL (e.g., https://matomo.example.com)
4. Enter auth token
5. Click "Validate & Load Sites"
6. Verify sites load and dropdown populates
7. Select site and click "Save Settings"

**Heatmap Selection & Screenshot Workflow:**
1. Navigate to a page with custom scroll containers (e.g., Angular Material, Vuetify)
2. Open extension popup
3. Verify heatmaps loaded in dropdown (or configure credentials if first time)
4. Select desired heatmap from dropdown
5. Click "Start Tracking"
6. Scroll through all scrollable areas
7. Verify counter updates and elements get green outlines
8. Click "Done Scrolling - Take Screenshot"
9. Extension will:
   - Validate heatmap settings (enable manual capture if needed, resume if ended)
   - Expand all detected scrollable elements
   - Trigger Matomo screenshot capture
   - Close popup and open new tab with heatmap view
10. Verify new tab opens and stays focused on heatmap view

**Site Switching:**
1. Open settings modal again
2. Verify current site is pre-selected
3. Change site selection
4. Click "Save Settings"
5. Verify new site is saved and heatmaps reload for new site
6. Verify previously selected heatmap is cleared (since it belongs to old site)

### Debugging

- **Popup console**: Right-click extension icon → Inspect popup
- **Content script console**: Open page DevTools (F12) → Console tab
- **Background worker console**: Navigate to `chrome://extensions/` → Click "service worker" link under extension
- **Page context execution**: Check for `[Page Context]` logs in page console
- **API calls**: Check Network tab in popup console for Matomo API requests

All components log extensively with prefixes like `[Popup]`, `[Content]`, `[Background]`, `[Page Context]`.

**Common Issues:**
- **CORS errors**: Matomo server may need to allow requests from the extension
- **Authentication failures**: Check token validity and permissions
- **No sites returned**: User may not have write access to any sites
- **No heatmaps found**: Site may not have any heatmaps configured in Matomo
- **Focus jumping back**: Ensure background worker is registered correctly in manifest.json
- **Tab not opening**: Check background worker console for errors in `onSuccessfulScreenshot` handler

## Key Implementation Details

### Storage

Uses `chrome.storage.local` to persist:
- `selectedHeatmap`: Full heatmap object for convenience (contains idsitehsr, name, status, etc.)
- `matomoApiUrl`: Matomo instance URL (e.g., https://matomo.example.com)
- `matomoAuthToken`: User's Matomo authentication token (stored securely by Chrome)
- `matomoSiteId`: Selected site ID with write access
- `matomoSiteName`: Selected site name for display

Credentials and selected heatmap are loaded on popup initialization (`popup/popup.js:52-77`).

### Settings Modal & Matomo API Integration

The extension includes a settings modal (gear icon ⚙️ in all state headers) for managing Matomo API credentials and loading heatmaps:

**Authentication Flow:**
1. User enters Matomo instance URL and auth token
2. Clicks "Validate & Load Sites"
3. Extension calls Matomo API: `POST {url}/index.php` with:
   - `method=SitesManager.getSitesWithMinimumAccess`
   - `permission=write`
   - `token_auth={token}`
4. On success, populates site dropdown with sites user has write access to
5. User selects site and saves credentials to `chrome.storage.local`

**Auto-load Behavior:**
- When opening settings modal with saved credentials, the extension automatically loads available sites and pre-selects the current site
- When popup opens with saved credentials, the extension automatically loads available heatmaps for the current site
- Site switching triggers automatic heatmap reload and clears previously selected heatmap

**API Helper Function:**
`callMatomoAPI(baseUrl, params)` is a reusable function for making authenticated Matomo API calls using POST requests with form-encoded data. Used for:
- Loading sites with write access
- Loading available heatmaps
- Updating heatmap configuration
- Resuming ended heatmaps

**UI Features:**
- Settings gear icon (⚙️) visible in all state headers for easy access
- Modal overlay with slide-in animation
- Password-type input for secure token entry
- Real-time validation feedback (loading, success, error states)
- Site switching without re-authentication
- Credential clearing with confirmation

### Matomo Detection

On popup load, checks for `window._paq` in `MAIN` world (`popup/popup.js:67-107`). Shows error state if not found, with option to "Continue Anyway" for testing.

### Error Handling

The popup tracks whether user bypassed Matomo check. If they did and capture fails, errors show inline in the scrolling state rather than sending them back to the error state. This prevents confusing state transitions.

**Error Scenarios:**
- **No credentials**: Shows helpful message: "Please configure Matomo credentials in settings first"
- **No heatmaps found**: Displays error with suggestion to create heatmaps in Matomo
- **API validation fails**: Aborts screenshot process and shows detailed error message
- **Screenshot capture fails**: Shows error inline if user bypassed Matomo check, otherwise shows error state

### Polling Updates

When in scrolling state, popup polls content script every 500ms for status updates to update the detected count and list in real-time. Polling is stopped when:
- Screenshot capture succeeds
- Error occurs during capture
- User clicks "Restore" or "Reset"

### Background Worker & Post-Screenshot Flow

After successful screenshot capture, the popup sends a message to the background service worker to handle tab creation. This architecture solves the focus-jumping issue:

**Problem:** When popup closes, Chrome restores focus to the tab that opened it (the scanned page)

**Solution:** Background worker creates tab AFTER popup closes

**Flow:**
1. Screenshot succeeds
2. Popup sends `onSuccessfulScreenshot` message to background worker with heatmap URL
3. Popup closes immediately (`window.close()`)
4. Background worker (still running) creates new tab with `active: true`
5. Focus switches to new heatmap tab and stays there

**Security:** The heatmap URL has `token_auth` parameter stripped before being sent to background worker to prevent exposing sensitive tokens in URLs.

### Element Selectors

Function `getElementSelector()` (`content/content.js:230-237`) generates CSS selectors for UI display:
- Prefers `#id` if available
- Falls back to first 2 class names (`.class1.class2`)
- Falls back to tag name

## Permissions

- `activeTab`: Access current tab only (minimal permission)
- `scripting`: Required for `chrome.scripting.executeScript()` in MAIN world
- `storage`: Persist selected heatmap and Matomo API credentials
- `host_permissions: ["<all_urls>"]`: Required for making API calls to user-provided Matomo instances

## File Structure

- `manifest.json`: Extension manifest (Manifest V3) with permissions, host_permissions, and background service worker
- `background/background.js`: Background service worker for post-screenshot actions (tab creation)
- `popup/popup.html`: Popup UI with 4 state sections, heatmap dropdown, and settings modal overlay
- `popup/popup.css`: Popup styling including dropdown, loading indicators, modal, and form styles
- `popup/popup.js`: Popup state management, heatmap selection/validation, message passing, and Matomo API integration
- `content/content.js`: Core scroll tracking and expansion logic
- `icons/`: Extension icons (16x16, 48x48, 128x128)
- `CLAUDE.md`: This file - architecture and implementation documentation
