/**
 * Fixer registry for managing available fixers
 *
 * Supports both element-level and global fixers via scope filtering.
 */

import type { Fixer, ComposableFixer } from './types';
import { isComposableFixer } from './types';

/**
 * Registry holding all available fixers
 * Fixers are registered at module load time via auto-registration
 */
class FixerRegistry {
  private fixers: Map<string, Fixer> = new Map();
  private sortedFixers: Fixer[] | null = null;

  /**
   * Register a fixer. Throws if ID already exists.
   */
  register(fixer: Fixer): void {
    if (this.fixers.has(fixer.id)) {
      throw new Error(`Fixer with id "${fixer.id}" already registered`);
    }
    this.fixers.set(fixer.id, fixer);
    this.sortedFixers = null; // Invalidate cache
  }

  /**
   * Get a fixer by ID
   */
  get(id: string): Fixer | undefined {
    return this.fixers.get(id);
  }

  /**
   * Get all fixers sorted by priority (ascending)
   */
  getAllSorted(): Fixer[] {
    if (!this.sortedFixers) {
      this.sortedFixers = Array.from(this.fixers.values()).sort(
        (a, b) => a.priority - b.priority
      );
    }
    return this.sortedFixers;
  }

  /**
   * Get element-scope fixers (run on individual locked/scrolled elements)
   */
  getElementFixers(): Fixer[] {
    return this.getAllSorted().filter((f) => f.scope === 'element');
  }

  /**
   * Get global-scope fixers (run once on entire document)
   */
  getGlobalFixers(): Fixer[] {
    return this.getAllSorted().filter((f) => f.scope === 'global');
  }

  /**
   * Get base element fixers (non-composable)
   * @deprecated Use getElementFixers() and filter by !isComposableFixer
   */
  getBaseFixers(): Fixer[] {
    return this.getElementFixers().filter((f) => !isComposableFixer(f));
  }

  /**
   * Get composable element fixers
   * @deprecated Use getElementFixers() and filter by isComposableFixer
   */
  getSpecializedFixers(): ComposableFixer[] {
    return this.getElementFixers().filter((f): f is ComposableFixer => isComposableFixer(f));
  }

  /**
   * Clear all registered fixers (useful for testing)
   */
  clear(): void {
    this.fixers.clear();
    this.sortedFixers = null;
  }
}

// Singleton instance
export const fixerRegistry = new FixerRegistry();
