/**
 * Fixer registry for managing available fixers
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
   * Get base fixers (non-composable)
   */
  getBaseFixers(): Fixer[] {
    return this.getAllSorted().filter((f) => !isComposableFixer(f));
  }

  /**
   * Get specialized/composable fixers
   */
  getSpecializedFixers(): ComposableFixer[] {
    return this.getAllSorted().filter((f): f is ComposableFixer => isComposableFixer(f));
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
