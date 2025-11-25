/**
 * Core type definitions for the element fixer system
 */

/**
 * Context provided to each fixer when applying or restoring
 */
export interface FixerContext {
  element: HTMLElement;
  document: Document;
  computedStyle: CSSStyleDeclaration;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Result from applying a fixer, contains self-contained restoration
 */
export interface FixerResult {
  fixerId: string;
  applied: boolean;
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

  /**
   * Determine if this fixer should apply to the element
   */
  shouldApply(context: FixerContext): boolean;

  /**
   * Apply the fix and return self-contained restoration data.
   * Can be sync or async - return Promise for async operations.
   */
  apply(context: FixerContext): FixerResult | Promise<FixerResult>;
}

/**
 * Extended interface for specialized fixers that compose base fixers
 */
export interface ComposableFixer extends Fixer {
  /** IDs of base fixers this fixer supersedes */
  readonly composesFixers: string[];
}

/**
 * Type guard to check if a fixer is composable
 */
export function isComposableFixer(fixer: Fixer): fixer is ComposableFixer {
  return 'composesFixers' in fixer;
}

/**
 * Aggregate result from running all applicable fixers on an element
 */
export interface ElementFixResult {
  element: HTMLElement;
  appliedFixers: FixerResult[];
  timestamp: number;

  /** Restore all applied fixes in reverse order */
  restoreAll(): void;
}
