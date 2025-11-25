/**
 * Core type definitions for the fixer system
 *
 * Fixers are organized by scope:
 * - 'element': Run on individual locked/scrolled elements
 * - 'global': Run once on entire document during screenshot preparation
 */

/**
 * Fixer scope determines when and how fixers run
 */
export type FixerScope = 'element' | 'global';

/**
 * Context provided to element-level fixers
 */
export interface FixerContext {
  element: HTMLElement;
  document: Document;
  computedStyle: CSSStyleDeclaration;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Context provided to global (document-level) fixers
 */
export interface GlobalFixerContext {
  document: Document;
}

/**
 * Result from applying a fixer, contains self-contained restoration
 */
export interface FixerResult {
  fixerId: string;
  applied: boolean;
  count?: number; // Optional: for fixers that process multiple items
  restore: () => void;
}

/**
 * Base interface all fixers must implement
 *
 * Fixers can be sync or async - apply() can return either
 * FixerResult directly or a Promise<FixerResult>.
 */
export interface Fixer {
  /** Unique identifier for this fixer */
  readonly id: string;

  /** Priority for ordering (lower runs first) */
  readonly priority: number;

  /** Scope determines when fixer runs: 'element' or 'global' */
  readonly scope: FixerScope;

  /**
   * Determine if this fixer should apply
   * Element fixers receive FixerContext, global fixers receive GlobalFixerContext
   */
  shouldApply(context: FixerContext | GlobalFixerContext): boolean;

  /**
   * Apply the fix and return self-contained restoration data.
   * Can be sync or async - return Promise for async operations.
   */
  apply(context: FixerContext | GlobalFixerContext): FixerResult | Promise<FixerResult>;
}

/**
 * Extended interface for element fixers that compose other element fixers
 */
export interface ComposableFixer extends Fixer {
  /** Element fixers can compose other element fixers */
  readonly scope: 'element';
  /** IDs of element fixers this fixer supersedes */
  readonly composesFixers: string[];
}

/**
 * Type guard to check if a fixer is composable
 */
export function isComposableFixer(fixer: Fixer): fixer is ComposableFixer {
  return 'composesFixers' in fixer;
}

/**
 * Aggregate result from running element-level fixers on an element
 */
export interface ElementFixResult {
  element: HTMLElement;
  appliedFixers: FixerResult[];
  timestamp: number;

  /** Restore all applied fixes in reverse order */
  restoreAll(): void;
}

/**
 * Aggregate result from running global fixers on a document
 */
export interface GlobalFixResult {
  appliedFixers: FixerResult[];
  timestamp: number;

  /** Restore all applied fixes in reverse order */
  restoreAll(): void;
}

/**
 * Detected relative URL with metadata for restoration
 */
export interface DetectedRelativeUrl {
  element: Element;
  attribute: string; // 'src', 'srcset', 'poster', 'style'
  originalValue: string; // Full original attribute value
  absoluteUrl: string; // Converted URL
  cssProperty?: string; // 'backgroundImage' if CSS
  urlInValue?: string; // Specific URL in srcset/CSS (for partial replacement)
}
