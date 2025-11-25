# Element Fixer System

A composable, extensible system for fixing element CSS/DOM properties to ensure proper heatmap screenshot capture.

## Overview

The fixer system addresses the common problem where pages with custom scroll containers, overflow:hidden elements, or fixed-height containers don't capture fully in Matomo's heatmap screenshots. When users select elements in interactive mode, the fixer pipeline applies appropriate corrections and stores self-contained restoration functions.

## Architecture

```
fixers/
├── types.ts              # Core interfaces (Fixer, ComposableFixer, FixerContext, FixerResult)
├── registry.ts           # FixerRegistry singleton for managing fixers
├── pipeline.ts           # applyFixers() execution logic
├── state.ts              # elementFixResults storage
├── lock-indicator.ts     # Visual lock indicator (separate from layout fixers)
├── index.ts              # Re-exports and auto-registration imports
├── base/                 # Base CSS fixers (single concern)
│   ├── height-fixer.ts
│   ├── overflow-fixer.ts
│   └── position-fixer.ts
├── specialized/          # Element-type specific fixers (may compose base fixers)
│   ├── iframe-fixer.ts
│   ├── sticky-header-fixer.ts
│   └── video-fixer.ts
└── __tests__/            # Test files
    ├── test-utils.ts
    ├── registry.test.ts
    ├── state.test.ts
    ├── pipeline.test.ts
    ├── base/
    └── specialized/
```

## Core Concepts

### Fixer Interface

Every fixer implements the `Fixer` interface:

```typescript
interface Fixer {
  /** Unique identifier (convention: 'base:name' or 'specialized:name') */
  readonly id: string;

  /** Priority for ordering (lower numbers run first) */
  readonly priority: number;

  /** Determine if this fixer should apply to the element */
  shouldApply(context: FixerContext): boolean;

  /** Apply the fix and return self-contained restoration data */
  apply(context: FixerContext): FixerResult;
}
```

### FixerContext

The context provides all information a fixer needs:

```typescript
interface FixerContext {
  element: HTMLElement;
  document: Document;
  computedStyle: CSSStyleDeclaration;
  scrollHeight: number;
  clientHeight: number;
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

Specialized fixers can declare which base fixers they supersede:

```typescript
interface ComposableFixer extends Fixer {
  /** IDs of base fixers this fixer supersedes */
  readonly composesFixers: string[];
}
```

When a specialized fixer applies, its composed base fixers are skipped to prevent duplicate/conflicting modifications.

## Priority Guidelines

| Priority Range | Type | Examples |
|---------------|------|----------|
| 1-50 | Base CSS fixers | height (10), overflow (20), position (30) |
| 100-199 | Specialized element fixers | iframe (100), sticky-header (110), video (120) |

Lower priority numbers run first. Specialized fixers run after base fixers but can suppress them via `composesFixers`.

## Contributing a New Fixer

### Step 1: Choose Fixer Type

- **Base fixer**: Single CSS concern (height, overflow, position, etc.)
- **Specialized fixer**: Element-type specific that may need custom logic or compose multiple base fixes

### Step 2: Create the Fixer File

Create your fixer in the appropriate directory:

**Base fixer example** (`base/my-fixer.ts`):

```typescript
import type { Fixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const myFixer: Fixer = {
  id: 'base:my-fixer',
  priority: 25, // Choose appropriate priority

  shouldApply(context: FixerContext): boolean {
    // Return true if this fixer should apply to the element
    // Use context.computedStyle, context.element, etc.
    return context.computedStyle.someProperty === 'someValue';
  },

  apply(context: FixerContext): FixerResult {
    const { element } = context;

    // Store original values in closure
    const originalValue = element.style.someProperty;

    // Apply fix
    element.style.someProperty = 'fixedValue';

    return {
      fixerId: 'base:my-fixer',
      applied: true,
      restore() {
        // Restore original state
        element.style.someProperty = originalValue;
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(myFixer);
```

**Specialized fixer example** (`specialized/my-element-fixer.ts`):

```typescript
import type { ComposableFixer, FixerContext, FixerResult } from '../types';
import { fixerRegistry } from '../registry';

export const myElementFixer: ComposableFixer = {
  id: 'specialized:my-element',
  priority: 130,
  composesFixers: ['base:height', 'base:overflow'], // Base fixers this supersedes

  shouldApply(context: FixerContext): boolean {
    const { element } = context;
    // Check if this is the target element type
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
      fixerId: 'specialized:my-element',
      applied: true,
      restore() {
        // Restore all original state
        element.style.height = originalHeight;
        element.style.overflow = originalOverflow;

        // Clean up created elements
        if (createdElement) {
          createdElement.remove();
        }
      },
    };
  },
};

// Auto-register when module loads
fixerRegistry.register(myElementFixer);
```

### Step 3: Register the Fixer

Add an import in `index.ts`:

```typescript
// In the appropriate section:
// Base fixers
import './base/my-fixer';

// OR Specialized fixers
import './specialized/my-element-fixer';
```

### Step 4: Write Tests

Create a test file mirroring the fixer location:

```typescript
// __tests__/base/my-fixer.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { myFixer } from '../../base/my-fixer';
import { createElement, createFixerContext, cleanup } from '../test-utils';

describe('MyFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(myFixer.id).toBe('base:my-fixer');
    });

    it('should have correct priority', () => {
      expect(myFixer.priority).toBe(25);
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
      expect(result.fixerId).toBe('base:my-fixer');
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

### Base Fixers

| Fixer | Priority | Purpose |
|-------|----------|---------|
| `base:height` | 10 | Expands elements to scrollHeight, removes maxHeight |
| `base:overflow` | 20 | Sets overflow to visible |
| `base:position` | 30 | Converts static positioning to relative |

### Specialized Fixers

| Fixer | Priority | Composes | Purpose |
|-------|----------|----------|---------|
| `specialized:iframe` | 100 | height, overflow | Handles cross-origin iframes with fallback height |
| `specialized:sticky-header` | 110 | position | Converts fixed/sticky headers to relative, creates placeholder |
| `specialized:video` | 120 | height | Pauses video and ensures proper dimensions |

## Pipeline Execution Flow

1. Create `FixerContext` with element data
2. Run specialized fixers first (higher priority numbers)
3. Track which base fixers are "composed" by applied specialized fixers
4. Run remaining base fixers (lower priority numbers) in order
5. Skip any base fixer that was composed by a specialized fixer
6. Return `ElementFixResult` with all applied fixers and `restoreAll()` method

## Best Practices

1. **Single Responsibility**: Each fixer should handle one concern
2. **Self-Contained Restoration**: Capture all original values in the restore closure
3. **No Side Effects**: Don't modify global state; only modify the target element
4. **Clean Up Created Elements**: If you create DOM elements, remove them in restore()
5. **Use composesFixers**: If your specialized fixer handles what a base fixer does, declare it
6. **Test Edge Cases**: Test empty values, missing properties, and restoration
