# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) built with WXT, React, TypeScript, and Tailwind CSS that helps prepare pages with custom scroll containers for Matomo heatmap screenshots. The extension tracks scrollable elements as users interact with them, then expands these elements and triggers Matomo's screenshot capture API.

## Development Commands

```bash
# Development mode with hot reload (Chrome/Chromium)
npm run dev
npm run dev:chrome

# Production builds
npm run build               # Chrome
npm run build:firefox       # Firefox

# Firefox testing workflow (see limitation below)
npm run test:firefox        # Build and show load path
npm run build:firefox-watch # Auto-rebuild on changes

# Create distributable ZIPs
npm run zip                 # Chrome
npm run zip:firefox         # Firefox
```

After building, load the extension from `.output/chrome-mv3` (or `firefox-mv3`) in your browser's developer mode.

### Firefox MV3 Development Limitation

**Important**: Firefox Manifest V3 dev mode does **not** work with WXT due to Content Security Policy restrictions in Firefox. This is a known upstream issue ([#1626](https://github.com/wxt-dev/wxt/issues/1626)) waiting for Mozilla to fix.

**Recommended Multi-Browser Workflow**:
1. **Primary development**: Use Chrome with hot reload (`npm run dev`)
2. **Firefox testing**: Build production and load manually:
   ```bash
   npm run test:firefox
   # Load extension from: .output/firefox-mv3
   ```
3. **Continuous Firefox testing**: Use watch mode for auto-rebuilds:
   ```bash
   npm run build:firefox-watch
   # Manually reload extension in Firefox after each rebuild
   ```

**Why this happens**: Running `npm run dev:firefox` will open Firefox but the extension won't work properly (WebSocket errors, MIME type errors, blank popup/pages) due to CSP blocking the dev server. Use production builds instead.

## Architecture Overview

### WXT Framework

This project uses [WXT](https://wxt.dev/) - a modern framework for building browser extensions with:
- TypeScript support out of the box
- React integration via `@wxt-dev/module-react`
- Hot Module Replacement (HMR) for rapid development
- Auto-generated manifest from `wxt.config.ts`
- Built-in storage utilities via `@wxt-dev/storage`

### Tech Stack

- **Framework**: WXT 0.20.x
- **UI Library**: React 19 with React DOM
- **Styling**: Tailwind CSS 4.x with PostCSS
- **State Management**: TanStack Query (React Query) for async state
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Type Safety**: TypeScript with strict mode

### Extension Components

**Popup** (`entrypoints/popup/`): Main UI for heatmap selection and screenshot capture. Uses React with TanStack Query for data fetching. State flow: `loading` → `onboarding` (if no credentials) → `no-matomo` (if Matomo not detected) → `selection` → `tracking` → `processing` → `complete`.

**Options Page** (`entrypoints/options/`): Separate page for managing Matomo API credentials. Validates credentials by fetching sites with write access, allows site selection, and persists settings to chrome.storage.

**Content Script** (`entrypoints/content.ts`): Runs on all pages at `document_idle`. Handles scroll event tracking, element registry, DOM manipulation for expansion/restoration, and visual feedback animations (scanner overlay and border glow).

**Background Worker** (`entrypoints/background.ts`): Service worker that handles post-screenshot actions independently of popup lifecycle. Triggers border glow animation, waits for completion, then creates new tab with heatmap view.

### Key Architectural Patterns

**Dual Execution Context**: The extension uses both `ISOLATED` (content script default) and `MAIN` (page context) worlds. Matomo API calls must execute in `MAIN` world via `browser.scripting.executeScript({ world: 'MAIN' })` to access page's `window._paq` object. See `lib/messaging.ts:executeInPageContext()`.

**Type-Safe Messaging**: All extension message passing uses strongly typed interfaces defined in `types/messages.ts`. Helper functions in `lib/messaging.ts` provide type safety and use WXT's `browser` API: `sendToContentScript()`, `sendToBackground()`, `executeInPageContext()`.

**Storage Abstraction**: Uses WXT's storage utilities wrapped in type-safe helpers (`lib/storage.ts`) with a centralized schema (`types/storage.ts`). Storage keys are namespaced (e.g., `matomo:apiUrl`, `ui:selectedHeatmapId`, `cache:heatmaps`).

**Component Architecture**: React components are organized by domain:
- `components/popup/`: Popup-specific components (HeatmapSelector, ScrollTracker, StatusFeedback)
- `components/options/`: Options page components (CredentialsForm, SiteSelector, ValidationStatus)
- `components/shared/`: Reusable components (Button, ErrorMessage, LoadingSpinner)

### Message Flow

**Popup → Content Script** (via `browser.tabs.sendMessage()`):
- `startTracking`: Initialize scroll tracking with heatmap ID
- `stopTracking`: Stop tracking and clear state
- `getStatus`: Get current scroll tracking status (polled every 500ms)
- `expandElements`: Trigger DOM expansion (async)
- `restore`: Restore original element states
- `showScanner`: Inject scanner overlay animation
- `showBorderGlow`: Show border glow animation

**Popup → Background Worker** (via `browser.runtime.sendMessage()`):
- `onSuccessfulScreenshot`: Sent after successful screenshot with heatmap URL and tabId

**Background → Content Script** (via `browser.tabs.sendMessage()`):
- `showBorderGlow`: Trigger border glow animation before tab redirect

**Popup → Page Context** (via `browser.scripting.executeScript({ world: 'MAIN' })`):
- `triggerMatomoScreenshot()`: Executes `window._paq.push(['HeatmapSessionRecording::captureInitialDom'])` and `window._paq.push(['HeatmapSessionRecording::enable'])`
- `checkMatomoExists()`: Checks if `window._paq` exists on page

### State Management

**Content Script State** (`entrypoints/content.ts:4-10`):
```typescript
const ScrollTracker = {
  scrolledElements: Map<HTMLElement, ElementMetadata>,
  originalStates: Map<HTMLElement, ElementStyles>,
  isTracking: boolean,
  heatmapId: number | null,
  startTime: number | null,
}
```

**Popup State** (`entrypoints/popup/App.tsx:20-33`):
- `state`: AppState enum ('loading' | 'onboarding' | 'no-matomo' | 'selection' | 'tracking' | 'processing' | 'complete')
- `selectedHeatmap`: Full MatomoHeatmap object
- `processingStep`: ProcessingStep enum ('validating' | 'expanding' | 'capturing' | 'verifying' | 'complete')
- TanStack Query manages heatmap fetching with caching

**Storage Persisted State**:
- `matomo:apiUrl`, `matomo:authToken`, `matomo:siteId`, `matomo:siteName`: Credentials
- `ui:selectedHeatmapId`: Last selected heatmap ID
- `cache:heatmaps`: Cached heatmap list with timestamp (5 min TTL)

## Core Workflows

### Scroll Detection Algorithm

User-driven detection (not heuristic-based):
1. Attach `scroll` event listeners to all DOM elements on tracking start
2. When scroll fires, check if `element.scrollHeight > element.clientHeight`
3. Skip if already registered
4. Store original CSS state before any modification
5. Find and store constraining parents that limit expansion
6. Add element to registry with metadata
7. Apply visual feedback (green outline removed during expansion)

### Element Expansion Strategy

Function `handleExpandElements()` in `entrypoints/content.ts:184-223`:
1. Stop tracking (`isTracking = false`)
2. Store original states for `<html>` and `<body>`
3. Expand `<html>` and `<body>` to remove viewport constraints
4. For each detected scrollable:
   - Remove visual outline
   - Set `minHeight` to full `scrollHeight`
   - Set `overflow: visible`
   - Expand all constraining parents
5. Force reflow with `document.body.offsetHeight`
6. Wait 500ms for rendering to complete

### Parent Constraint Detection

Function `findConstrainingParents()` in `entrypoints/content.ts:287-313` walks up DOM tree to find parents that constrain child expansion:
- Fixed heights: `100vh`, `100%`, or pixel values
- `max-height` constraints
- `overflow: hidden` or `overflow-y: hidden`
- Heights smaller than child's scrollHeight

These parents must also be expanded during screenshot capture.

### Matomo Integration

**Screenshot Trigger Sequence** (`entrypoints/popup/App.tsx:192-271`):
1. Show scanner animation on page
2. **Validate heatmap** (`processingStep: 'validating'`):
   - If `capture_manually === 0`: Call `updateHeatmap()` to enable manual capture
   - If `status === 'ended'`: Call `resumeHeatmap()` to reactivate
3. **Expand elements** (`processingStep: 'expanding'`): Send `expandElements` message
4. **Capture** (`processingStep: 'capturing'`): Execute in MAIN world to call `window._paq.push()`
5. **Verify** (`processingStep: 'verifying'`): Poll Matomo API for `page_treemirror` field
6. **Restore**: Send `restore` message to revert DOM changes
7. **Complete**: Send to background worker, close popup
8. **Background handles**: Border glow animation (1.5s) → Create new tab

**Screenshot Verification** (`lib/matomo-api.ts:189-211`):
- Calls `HeatmapSessionRecording.getHeatmap` with `includePageTreeMirror=1`
- Polls every 300ms for up to 50 attempts (15 seconds total)
- Checks if `page_treemirror` exists and is non-empty string
- Returns true if verified, false if timeout

### Visual Feedback Animations

**Scanner Overlay** (`entrypoints/content.ts:321-388`):
- Dark overlay (rgba(0,0,0,0.8)) with animated orange scan line
- Gradient: rgba(254,154,0,0.3) to rgba(254,154,0,0.8) with glow
- Animates from top to bottom over 3 seconds (infinite loop)
- Shows during validation, expansion, capture, and verification
- Hidden from Matomo screenshots via CSS selectors `html.matomoHsr`, `html.piwikHsr`

**Border Glow** (`entrypoints/content.ts:391-435`):
- Green inset box-shadow on viewport edges
- Animation: fade in 0.5s → hold 1s → fade out 0.5s (total 1.5s)
- Shows after screenshot verification and popup close
- Background worker creates new tab after animation completes
- Also hidden from Matomo screenshots

Both animations use `z-index: 999999` and `pointer-events: none`.

## Data Types

Key type definitions in `types/`:

**`matomo.ts`**: MatomoSite, MatomoHeatmap, MatomoApiResponse, HeatmapVerificationResponse

**`messages.ts`**: ContentScriptMessage, BackgroundMessage, with discriminated unions for different action types

**`storage.ts`**: StorageSchema defining all storage keys and their types (e.g., `'matomo:apiUrl': string`, `'cache:heatmaps': { heatmaps: MatomoHeatmap[], siteId: number, timestamp: number }`)

## Library Functions

**`lib/matomo-api.ts`**: MatomoApiClient class with methods:
- `getSitesWithWriteAccess()`: Fetch sites user can modify
- `getHeatmaps(siteId)`: Fetch heatmaps for a site
- `getHeatmap(siteId, heatmapId, includePageTreeMirror)`: Fetch single heatmap with optional page tree
- `updateHeatmap(heatmap)`: Update heatmap config (enables manual capture)
- `resumeHeatmap(siteId, heatmapId)`: Reactivate ended heatmap
- `verifyScreenshotCaptured(siteId, heatmapId)`: Check if screenshot exists
- `waitForScreenshotCapture(siteId, heatmapId, maxAttempts, delayMs)`: Poll for verification

**`lib/messaging.ts`**: Type-safe Chrome extension messaging helpers

**`lib/storage.ts`**: Type-safe storage wrappers using WXT storage utilities

## React Hooks

**`hooks/useHeatmaps.ts`**: TanStack Query hook for fetching heatmaps with automatic caching and refetching. Caches results to storage with 5-minute TTL.

**`hooks/useScrollTracking.ts`**: Hook that polls content script status every 500ms when tracking is active. Returns `{ scrolledCount, scrollables }`.

## Important Implementation Details

**Matomo Detection**: On popup load, executes in MAIN world to check for `window._paq`. Shows error state if not found, with "Continue Anyway" bypass option for testing.

**Heatmap Caching**: Heatmaps are cached to storage with timestamp. Popup shows cached data immediately on mount while fetching fresh data in background. Cache TTL is 5 minutes.

**Polling**: When in tracking state, popup polls content script every 500ms via `getStatus` message. Polling stops on error, success, or when user clicks Restore/Reset.

**Error Handling**: Errors during screenshot process show inline in current state to avoid confusing state transitions. Users can retry by clicking "Take Screenshot" again.

**Focus Management**: Background worker handles post-screenshot actions to prevent focus jumping back to scanned page. Popup closes immediately after sending message to background, which then handles animations and tab creation with `active: true`.

## File Organization

```
entrypoints/          # WXT entrypoints (popup, options, content, background)
  popup/             # Popup UI with App.tsx
  options/           # Options page with App.tsx
  content.ts         # Content script
  background.ts      # Background service worker
  style.css          # Global Tailwind styles
components/          # React components organized by domain
  popup/             # Popup-specific components
  options/           # Options page components
  shared/            # Reusable components
hooks/               # Custom React hooks
lib/                 # Core library functions (API, messaging, storage)
types/               # TypeScript type definitions
public/icons/        # Extension icons (16, 48, 128)
wxt.config.ts        # WXT configuration
tailwind.config.js   # Tailwind CSS configuration
tsconfig.json        # TypeScript configuration
```

## WXT-Specific Patterns

**Entrypoint Definition**: Use `defineContentScript()`, `defineBackground()` exported as default. WXT auto-generates manifest entries.

**Storage**: Use `storage` from `wxt/utils/storage` with namespaced keys (e.g., `local:matomo:apiUrl`). The storage API is reactive and works across all extension contexts.

**Browser API**: Use WXT's unified `browser` API imported from `wxt/browser` instead of Chrome-specific `chrome.*` APIs. This provides cross-browser compatibility (Chromium, Firefox, Safari). WXT merges browser-specific globals into a unified promise-based API. Import with `import { browser } from 'wxt/browser';` or rely on auto-imports if enabled.

**Build Output**: Dev builds to `.output/chrome-mv3-dev`, production to `.output/chrome-mv3`. Each browser target has separate output directory.

## Permissions

Defined in `wxt.config.ts:5-10`:
- `activeTab`: Access current tab only
- `scripting`: Required for `browser.scripting.executeScript()` in MAIN world
- `storage`: Persist credentials and state
- `host_permissions: ['<all_urls>']`: Required for Matomo API calls to user-provided instances
