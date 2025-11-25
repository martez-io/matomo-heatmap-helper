# Fixer System

A composable, extensible system for fixing CSS/DOM properties to ensure proper heatmap screenshot capture.

## Overview

The fixer system addresses common problems where pages with custom scroll containers, overflow:hidden elements, fixed-height containers, or relative URLs don't capture correctly in Matomo's heatmap screenshots.

Fixers are organized by **scope**:
- **Element fixers**: Run on individual locked/scrolled elements selected by users
- **Global fixers**: Run once on the entire document during screenshot preparation

## Architecture

```
fixers/
├── types.ts              # Core interfaces (Fixer, ComposableFixer, FixerContext, etc.)
├── registry.ts           # FixerRegistry singleton for managing fixers
├── pipeline.ts           # applyElementFixers() and applyGlobalFixers() execution
├── state.ts              # elementFixResults storage
├── lock-indicator.ts     # Visual lock indicator (separate from layout fixers)
├── index.ts              # Re-exports and auto-registration imports
├── element/              # Element-scope fixers (run per-element)
│   ├── height-fixer.ts
│   ├── overflow-fixer.ts
│   ├── position-fixer.ts
│   ├── iframe-fixer.ts
│   ├── sticky-header-fixer.ts
│   ├── video-fixer.ts
│   └── cors-fixer.ts
├── global/               # Global-scope fixers (run once on document)
│   └── relative-url-fixer.ts
├── utils/                # Shared utilities
│   ├── url-detector.ts
│   ├── url-converter.ts
│   └── cors-detector.ts
└── __tests__/            # Test files
    ├── test-utils.ts
    ├── registry.test.ts
    ├── state.test.ts
    ├── pipeline.test.ts
    ├── element/
    ├── global/
    └── utils/
```

## Core Concepts

### Fixer Interface

Every fixer implements the `Fixer` interface:

```typescript
interface Fixer {
  /** Unique identifier (convention: 'element:name' or 'global:name') */
  readonly id: string;

  /** Priority for ordering (lower numbers run first) */
  readonly priority: number;

  /** Scope determines when fixer runs: 'element' or 'global' */
  readonly scope: FixerScope;

  /** Determine if this fixer should apply */
  shouldApply(context: FixerContext | GlobalFixerContext): boolean;

  /** Apply the fix and return self-contained restoration data */
  apply(context: FixerContext | GlobalFixerContext): FixerResult;
}

type FixerScope = 'element' | 'global';
```

### FixerContext (Element Scope)

Context for element-scope fixers:

```typescript
interface FixerContext {
  element: HTMLElement;
  document: Document;
  computedStyle: CSSStyleDeclaration;
  scrollHeight: number;
  clientHeight: number;
}
```

### GlobalFixerContext (Global Scope)

Context for global-scope fixers:

```typescript
interface GlobalFixerContext {
  document: Document;
}
```

### Self-Contained Restoration

Each fixer's `apply()` method returns a `FixerResult` with a `restore()` closure that captures original values:

```typescript
interface FixerResult {
  fixerId: string;
  applied: boolean;
  restore: () => void;  // Closure that restores original state
}
```

### ComposableFixer

Element fixers can declare which other element fixers they supersede:

```typescript
interface ComposableFixer extends Fixer {
  /** IDs of element fixers this fixer supersedes */
  readonly composesFixers: string[];
}
```

When a composable fixer applies, its composed fixers are skipped to prevent duplicate/conflicting modifications.

## Priority Guidelines

### Element Fixers

| Priority Range | Type | Examples |
|---------------|------|----------|
| 1-50 | Base CSS fixers | height (10), overflow (20), position (30) |
| 100-199 | Specialized element fixers | iframe (100), sticky-header (110), video (120), cors (130) |

Lower priority numbers run first. Specialized fixers run after base fixers but can suppress them via `composesFixers`.

### Global Fixers

| Priority Range | Type | Examples |
|---------------|------|----------|
| 1-50 | Document-wide fixers | relative-url (10) |

Global fixers run once on the entire document before element fixers are applied.

## Contributing a New Fixer

### Step 1: Choose Fixer Scope

- **Element fixer** (`element/`): Runs on individual locked/scrolled elements
  - **Base**: Single CSS concern (height, overflow, position)
  - **Specialized**: Element-type specific, may compose multiple base fixes
- **Global fixer** (`global/`): Runs once on entire document during screenshot preparation

### Step 2: Create the Fixer File

Create your fixer in the appropriate directory:

**Element fixer example** (`element/my-fixer.ts`):

```typescript
import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const myFixer: Fixer = {
  id: 'element:my-fixer',
  priority: 25,
  scope: 'element',

  shouldApply(context: FixerContext): boolean {
    // Return true if this fixer should apply to the element
    return context.computedStyle.someProperty === 'someValue';
  },

  apply(context: FixerContext): FixerResult {
    const { element } = context;

    // Store original values in closure
    const originalValue = element.style.someProperty;

    // Apply fix
    element.style.someProperty = 'fixedValue';

    return {
      fixerId: 'element:my-fixer',
      applied: true,
      restore() {
        element.style.someProperty = originalValue;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(myFixer);
```

**Composable element fixer example** (`element/my-element-fixer.ts`):

```typescript
import type { ComposableFixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const myElementFixer: ComposableFixer = {
  id: 'element:my-element',
  priority: 130,
  scope: 'element',
  composesFixers: ['element:height', 'element:overflow'], // Fixers this supersedes

  shouldApply(context: FixerContext): boolean {
    const { element } = context;
    return element.tagName.toLowerCase() === 'my-element';
  },

  apply(context: FixerContext): FixerResult {
    const { element } = context;

    // Store all original values
    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;
    let createdElement: HTMLElement | null = null;

    // Apply specialized fixes
    element.style.height = 'auto';
    element.style.overflow = 'visible';

    // Create additional DOM elements if needed
    createdElement = document.createElement('div');
    element.appendChild(createdElement);

    return {
      fixerId: 'element:my-element',
      applied: true,
      restore() {
        element.style.height = originalHeight;
        element.style.overflow = originalOverflow;
        if (createdElement) {
          createdElement.remove();
        }
      },
    };
  },
};

fixerRegistry.register(myElementFixer);
```

**Global fixer example** (`global/my-global-fixer.ts`):

```typescript
import type { Fixer, GlobalFixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const myGlobalFixer: Fixer = {
  id: 'global:my-fixer',
  priority: 20,
  scope: 'global',

  shouldApply(_context: GlobalFixerContext): boolean {
    return true; // Or check document conditions
  },

  apply(context: GlobalFixerContext): FixerResult {
    const { document } = context;

    // Find and modify elements
    const elements = document.querySelectorAll('.target');
    const originalValues: string[] = [];

    elements.forEach((el, i) => {
      originalValues[i] = (el as HTMLElement).style.color;
      (el as HTMLElement).style.color = 'red';
    });

    return {
      fixerId: 'global:my-fixer',
      applied: elements.length > 0,
      restore() {
        elements.forEach((el, i) => {
          (el as HTMLElement).style.color = originalValues[i];
        });
      },
    };
  },
};

fixerRegistry.register(myGlobalFixer);
```

### Step 3: Register the Fixer

Add an import in `index.ts`:

```typescript
// Element fixers
import './element/my-fixer';

// Global fixers
import './global/my-global-fixer';
```

### Step 4: Write Tests

Create a test file mirroring the fixer location:

```typescript
// __tests__/element/my-fixer.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { myFixer } from '../../element/my-fixer';
import { createElement, createFixerContext, cleanup } from '../test-utils';

describe('MyFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(myFixer.id).toBe('element:my-fixer');
    });

    it('should have correct priority', () => {
      expect(myFixer.priority).toBe(25);
    });

    it('should have element scope', () => {
      expect(myFixer.scope).toBe('element');
    });
  });

  describe('shouldApply', () => {
    it('should return true when condition is met', () => {
      const element = createElement('div', {
        style: { someProperty: 'someValue' },
      });
      const context = createFixerContext(element);

      expect(myFixer.shouldApply(context)).toBe(true);
    });

    it('should return false when condition is not met', () => {
      const element = createElement('div', {
        style: { someProperty: 'otherValue' },
      });
      const context = createFixerContext(element);

      expect(myFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should apply the fix correctly', () => {
      const element = createElement('div', {
        style: { someProperty: 'someValue' },
      });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      myFixer.apply(context);

      expect(element.style.someProperty).toBe('fixedValue');
    });

    it('should return applied: true', () => {
      const element = createElement('div');
      const context = createFixerContext(element);

      const result = myFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('element:my-fixer');
    });
  });

  describe('restore', () => {
    it('should restore original value', () => {
      const element = createElement('div', {
        style: { someProperty: 'originalValue' },
      });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      const result = myFixer.apply(context);
      expect(element.style.someProperty).toBe('fixedValue');

      result.restore();
      expect(element.style.someProperty).toBe('originalValue');
    });
  });
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm run test

# Run with coverage
npm run test:coverage
```

### Test Utilities

The test utilities in `__tests__/test-utils.ts` provide helpers for creating test elements:

| Function | Description |
|----------|-------------|
| `createElement(tag, options)` | Create element with style, id, className, attributes |
| `createScrollableElement(options)` | Create element with mocked scrollHeight/clientHeight |
| `createIframe(options)` | Create iframe with mocked properties |
| `createVideoElement(options)` | Create video with mocked media properties |
| `createStickyHeader(tag, position)` | Create sticky/fixed header element |
| `createFixerContext(element)` | Create FixerContext for testing (appends to body) |
| `cleanup()` | Clear document.body after each test |

### Test Coverage Requirements

All fixers should have tests covering:

1. **Metadata tests**: Verify `id` and `priority`
2. **shouldApply tests**: Test positive and negative cases
3. **apply tests**: Verify CSS/DOM changes are applied correctly
4. **restore tests**: Verify original state is fully restored

### Environment

Tests run with [Vitest](https://vitest.dev/) using [happy-dom](https://github.com/capricorn86/happy-dom) for DOM simulation. Note that happy-dom may behave differently from real browsers in some cases (e.g., default computed styles).

## Existing Fixers

### Element Fixers (Base)

| Fixer | Priority | Purpose |
|-------|----------|---------|
| `element:height` | 10 | Expands elements to scrollHeight, removes maxHeight |
| `element:overflow` | 20 | Sets overflow to visible |
| `element:position` | 30 | Converts static positioning to relative |

### Element Fixers (Specialized)

| Fixer | Priority | Composes | Purpose |
|-------|----------|----------|---------|
| `element:iframe` | 100 | height, overflow | Handles cross-origin iframes with fallback height |
| `element:sticky-header` | 110 | position | Converts fixed/sticky headers to relative, creates placeholder |
| `element:video` | 120 | height | Pauses video and ensures proper dimensions |
| `element:cors` | 130 | - | Fetches cross-origin images via background script |

### Global Fixers

| Fixer | Priority | Purpose |
|-------|----------|---------|
| `global:relative-url` | 10 | Converts relative URLs to absolute for screenshot capture |

## Pipeline Execution Flow

### Global Fixers (`applyGlobalFixers`)

1. Get all registered global-scope fixers
2. Sort by priority (lower numbers first)
3. For each global fixer:
   - Call `shouldApply({ document })`
   - If true, call `apply({ document })`
   - Store result for restoration
4. Return `GlobalFixResult` with `restoreAll()` method

### Element Fixers (`applyElementFixers`)

1. Create `FixerContext` with element data
2. Get all registered element-scope fixers
3. Run specialized fixers first (higher priority numbers)
4. Track which base fixers are "composed" by applied specialized fixers
5. Run remaining base fixers (lower priority numbers) in order
6. Skip any base fixer that was composed by a specialized fixer
7. Return `ElementFixResult` with all applied fixers and `restoreAll()` method

### Full Layout Preparation

The `prepareLayout()` function in `layout-prep.ts` orchestrates both:

1. Apply global fixers to document (e.g., convert relative URLs)
2. For each locked/scrolled element, apply element fixers
3. Return combined restoration function

## Best Practices

1. **Single Responsibility**: Each fixer should handle one concern
2. **Self-Contained Restoration**: Capture all original values in the restore closure
3. **No Side Effects**: Don't modify global state; only modify the target element
4. **Clean Up Created Elements**: If you create DOM elements, remove them in restore()
5. **Use composesFixers**: If your specialized fixer handles what a base fixer does, declare it
6. **Test Edge Cases**: Test empty values, missing properties, and restoration
