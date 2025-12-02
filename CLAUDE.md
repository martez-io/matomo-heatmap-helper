# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Matomo Heatmap Helper is a Chrome extension (also supports Firefox) that fixes common issues with Matomo heatmap screenshots. Pages with custom scroll containers, overflow:hidden elements, fixed-height containers, or cross-origin resources don't capture correctly - this extension detects and fixes those issues.

Built with [WXT](https://wxt.dev/) (WebExtension framework) and React 19, using Tailwind CSS 4 for styling.

## Common Commands

```bash
# Development (Chrome with hot reload)
npm run dev

# Development (Firefox)
npm run dev:firefox

# Build for production
npm run build
npm run build:firefox

# Testing
npm run test           # Watch mode
npm run test:run       # Single run
npm run test:coverage  # With coverage report

# Package for distribution
npm run zip
npm run zip:firefox
```

## Architecture

### Extension Entry Points (`entrypoints/`)

The extension has four main contexts that communicate via Chrome messaging:

1. **Background Service Worker** (`background.ts`)
   - Central coordinator using `ScreenshotStateMachine` for screenshot flow
   - Handles Matomo API calls, CORS resource fetching, site resolution
   - Communicates with popup and content scripts via `browser.runtime.onMessage`

2. **Content Script** (`content/index.ts`)
   - Runs on all pages, manipulates DOM for heatmap screenshots
   - Uses the **Fixer System** (see below) to fix CSS/DOM issues
   - Communicates with persistent bar via custom DOM events (`mhh:*`)

3. **Persistent Bar** (`persistentBar.content/`)
   - React app mounted in Shadow DOM via `createShadowRootUi`
   - Shows on pages that match a configured Matomo site
   - Controls interactive mode, element locking, and triggers screenshots

4. **Popup** (`popup/`)
   - Extension popup for initial configuration and quick access
   - Handles credentials setup, site selection, bar visibility toggle

### Fixer System (`entrypoints/content/fixers/`)

Composable system for fixing CSS/DOM properties during screenshot capture. See `fixers/README.md` for full documentation.

**Key concepts:**
- **Element fixers** (`element/`): Run on individual locked/scrolled elements (e.g., height, overflow, position)
- **Global fixers** (`global/`): Run once on entire document (e.g., relative URL conversion)
- **ComposableFixer**: Specialized fixers can declare which base fixers they supersede via `composesFixers`
- **Self-contained restoration**: Each fixer's `apply()` returns a `restore()` closure

**Adding a new fixer:**
1. Create file in `element/` or `global/`
2. Implement `Fixer` interface with `id`, `priority`, `scope`, `shouldApply()`, `apply()`
3. Import in `index.ts` to auto-register
4. Write tests in `__tests__/`

### Storage System (`lib/storage.ts`, `lib/storage-keys.ts`)

Two APIs available:

```typescript
// New API (preferred) - uses storage entries with defaults
import { S } from '@/lib/storage-keys';
import { get, set, watch } from '@/lib/storage';

const barVisible = await get(S.BAR_VISIBLE);  // Returns boolean, never null
await set(S.BAR_VISIBLE, true);
watch(S.BAR_VISIBLE, (newVal, oldVal) => { /* ... */ });

// Legacy API - may return null
const value = await getStorage('matomo:apiUrl');
```

Adding new storage keys in `storage-keys.ts` automatically includes them in `clearAllData()`.

### Messaging (`types/messages.ts`)

- **ContentScriptMessage**: Content script actions (startTracking, prepareLayout, etc.)
- **BackgroundMessage**: Background worker actions (executeScreenshot, fetchHeatmaps, etc.)
- **Custom DOM events**: Bar-to-content communication uses `mhh:*` events (e.g., `mhh:startTracking`)

### Shared Libraries (`lib/`)

- `matomo-api.ts`: Matomo API client for fetching heatmaps and sites
- `site-resolver.ts`: Matches current page URL to Matomo sites
- `logger.ts`: Debug logging (enabled via settings:debugMode)
- `messaging.ts`: Typed message sending helpers

### UI Components

- `components/ui/`: Radix-based shadcn/ui components
- `components/icons/`: Custom SVG icons
- Each entrypoint has its own component tree (e.g., `persistentBar.content/components/`)

## Key Patterns

### Shadow DOM Isolation
The persistent bar uses Shadow DOM (`createShadowRootUi`) to isolate styles from the host page. CSS is injected via `cssInjectionMode: 'ui'`.

### State Machine for Screenshots
`ScreenshotStateMachine` in background coordinates the multi-step screenshot process (prepare layout, capture, upload, restore).

### Interactive Mode
Users can click elements to "lock" them for expansion. Locked elements get visual indicators and are processed by the fixer pipeline during screenshots.

## Testing

Tests use Vitest with happy-dom. Coverage focuses on `entrypoints/content/fixers/`.

Test utilities in `fixers/__tests__/test-utils.ts`:
- `createElement()`, `createScrollableElement()`, `createFixerContext()`
- Always call `cleanup()` in `afterEach()`

## Path Aliases

`@/` maps to the project root (configured in `vitest.config.ts`).

```typescript
import { S } from '@/lib/storage-keys';
import type { BackgroundMessage } from '@/types/messages';
```
