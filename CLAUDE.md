# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Matomo Heatmap Helper is a Chrome/Firefox extension that prepares pages with custom scroll containers for Matomo heatmap screenshots. It solves the problem where pages with overflow:hidden elements or fixed-height containers don't capture fully in Matomo's heatmap screenshots.

## Commands

```bash
# Development
npm run dev              # Start dev server (Chrome)
npm run dev:firefox      # Start dev server (Firefox)

# Build
npm run build            # Production build (Chrome)
npm run build:firefox    # Production build (Firefox)

# Package
npm run zip              # Create distributable zip (Chrome)
npm run zip:firefox      # Create distributable zip (Firefox)
```

## Architecture

### Framework
Built with [WXT](https://wxt.dev/) (Next-gen Web Extension Framework) + React + TypeScript + Tailwind CSS.

### Extension Components

**Background Service Worker** (`entrypoints/background.ts`)
- Central message router handling all cross-component communication
- Uses `ScreenshotStateMachine` for orchestrating the screenshot workflow
- Handles tab lifecycle events (navigation, closure during screenshots)

**Content Script** (`entrypoints/content.ts`)
- Core page manipulation: scroll tracking, element expansion, layout restoration
- `ScrollTracker` state machine tracks scrolled/locked elements
- Communicates via both Chrome messaging API and CustomEvents (for Shadow DOM bar)

**Persistent Bar** (`entrypoints/persistentBar.content/`)
- React app rendered in Shadow DOM via WXT's `createShadowRootUi`
- Only mounts on pages where site is resolved to a Matomo-tracked domain
- Uses CustomEvents (`mhh:*`) to communicate with content script

**Popup** (`entrypoints/popup/`)
- React app for extension icon click
- Shows different states: Unconfigured, NoPermission, SiteNotFound, ControlCenter

**Options Page** (`entrypoints/options/`)
- Credentials configuration (Matomo API URL + auth token)

### State Management

**Storage** (`lib/storage.ts`)
- Type-safe wrapper around WXT storage using `StorageSchema` types
- Keys prefixed by category: `matomo:*`, `cache:*`, `state:*`, `ui:*`

**Screenshot State Machine** (`entrypoints/background/ScreenshotStateMachine.ts`)
- States: idle → validating → expanding → capturing → verifying → restoring → complete
- Persists state to storage for resilience across browser restarts
- Handles retry logic and error recovery

### Messaging Patterns

**Background ↔ Content Script**: Chrome messaging API (`browser.runtime.sendMessage`)
**Content Script ↔ Persistent Bar**: CustomEvents on `window` object
- Events: `mhh:startTracking`, `mhh:stopTracking`, `mhh:statusUpdate`, etc.

### Type System

- `types/messages.ts`: All message types for extension communication
- `types/storage.ts`: Storage schema with full type definitions
- `types/matomo.ts`: Matomo API response types
- Path alias `@/*` maps to project root

### UI Components

- Uses shadcn/ui components (`components/ui/`)
- Custom icons in `components/icons/`
- Tailwind v4 with `@tailwindcss/postcss` + `postcss-rem-to-px` for consistent sizing

## Key Workflows

**Screenshot Capture Flow**:
1. User selects heatmap in persistent bar
2. Background validates/enables heatmap via Matomo API
3. Content script expands scrollable elements
4. Matomo's `_paq.push(['HeatmapSessionRecording::captureInitialDom', id])` triggered
5. Background polls API to verify capture
6. Content script restores layout
7. Opens heatmap view tab

**Interactive Mode**:
- User clicks elements to "lock" their expanded height
- Locked elements survive layout restore
- Visual indicators via CSS pseudo-elements (::before/::after) or fallback DOM element
