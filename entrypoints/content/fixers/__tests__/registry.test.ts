/**
 * Tests for the fixer registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixerRegistry } from '../registry';
import type { Fixer, ComposableFixer, FixerContext, FixerResult } from '../types';

// Create a mock fixer for testing
function createMockFixer(id: string, priority: number): Fixer {
  return {
    id,
    priority,
    shouldApply: vi.fn().mockReturnValue(true),
    apply: vi.fn().mockReturnValue({
      fixerId: id,
      applied: true,
      restore: vi.fn(),
    }),
  };
}

// Create a mock composable fixer for testing
function createMockComposableFixer(
  id: string,
  priority: number,
  composesFixers: string[]
): ComposableFixer {
  return {
    id,
    priority,
    composesFixers,
    shouldApply: vi.fn().mockReturnValue(true),
    apply: vi.fn().mockReturnValue({
      fixerId: id,
      applied: true,
      restore: vi.fn(),
    }),
  };
}

describe('FixerRegistry', () => {
  beforeEach(() => {
    // Clear the registry before each test
    fixerRegistry.clear();
  });

  describe('register', () => {
    it('should register a fixer', () => {
      const fixer = createMockFixer('test:fixer', 10);
      fixerRegistry.register(fixer);

      expect(fixerRegistry.get('test:fixer')).toBe(fixer);
    });

    it('should throw an error when registering duplicate IDs', () => {
      const fixer1 = createMockFixer('test:fixer', 10);
      const fixer2 = createMockFixer('test:fixer', 20);

      fixerRegistry.register(fixer1);

      expect(() => fixerRegistry.register(fixer2)).toThrow(
        'Fixer with id "test:fixer" already registered'
      );
    });
  });

  describe('get', () => {
    it('should return a registered fixer by ID', () => {
      const fixer = createMockFixer('test:get', 10);
      fixerRegistry.register(fixer);

      expect(fixerRegistry.get('test:get')).toBe(fixer);
    });

    it('should return undefined for non-existent ID', () => {
      expect(fixerRegistry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAllSorted', () => {
    it('should return all fixers sorted by priority (ascending)', () => {
      const fixer1 = createMockFixer('test:high', 30);
      const fixer2 = createMockFixer('test:low', 10);
      const fixer3 = createMockFixer('test:medium', 20);

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);
      fixerRegistry.register(fixer3);

      const sorted = fixerRegistry.getAllSorted();

      expect(sorted).toHaveLength(3);
      expect(sorted[0].id).toBe('test:low');
      expect(sorted[1].id).toBe('test:medium');
      expect(sorted[2].id).toBe('test:high');
    });

    it('should return empty array when no fixers registered', () => {
      expect(fixerRegistry.getAllSorted()).toHaveLength(0);
    });

    it('should cache sorted results', () => {
      const fixer1 = createMockFixer('test:a', 10);
      const fixer2 = createMockFixer('test:b', 20);

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);

      const sorted1 = fixerRegistry.getAllSorted();
      const sorted2 = fixerRegistry.getAllSorted();

      expect(sorted1).toBe(sorted2); // Same array reference
    });
  });

  describe('getBaseFixers', () => {
    it('should return only non-composable fixers', () => {
      const baseFixer = createMockFixer('base:test', 10);
      const composableFixer = createMockComposableFixer('specialized:test', 100, ['base:test']);

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(composableFixer);

      const baseFixers = fixerRegistry.getBaseFixers();

      expect(baseFixers).toHaveLength(1);
      expect(baseFixers[0].id).toBe('base:test');
    });

    it('should return fixers sorted by priority', () => {
      const fixer1 = createMockFixer('base:high', 30);
      const fixer2 = createMockFixer('base:low', 10);

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);

      const baseFixers = fixerRegistry.getBaseFixers();

      expect(baseFixers[0].id).toBe('base:low');
      expect(baseFixers[1].id).toBe('base:high');
    });
  });

  describe('getSpecializedFixers', () => {
    it('should return only composable fixers', () => {
      const baseFixer = createMockFixer('base:test', 10);
      const composableFixer = createMockComposableFixer('specialized:test', 100, ['base:test']);

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(composableFixer);

      const specializedFixers = fixerRegistry.getSpecializedFixers();

      expect(specializedFixers).toHaveLength(1);
      expect(specializedFixers[0].id).toBe('specialized:test');
      expect(specializedFixers[0].composesFixers).toContain('base:test');
    });

    it('should return fixers sorted by priority', () => {
      const fixer1 = createMockComposableFixer('specialized:high', 120, []);
      const fixer2 = createMockComposableFixer('specialized:low', 100, []);

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);

      const specializedFixers = fixerRegistry.getSpecializedFixers();

      expect(specializedFixers[0].id).toBe('specialized:low');
      expect(specializedFixers[1].id).toBe('specialized:high');
    });
  });

  describe('clear', () => {
    it('should remove all registered fixers', () => {
      fixerRegistry.register(createMockFixer('test:a', 10));
      fixerRegistry.register(createMockFixer('test:b', 20));

      expect(fixerRegistry.getAllSorted()).toHaveLength(2);

      fixerRegistry.clear();

      expect(fixerRegistry.getAllSorted()).toHaveLength(0);
      expect(fixerRegistry.get('test:a')).toBeUndefined();
      expect(fixerRegistry.get('test:b')).toBeUndefined();
    });
  });
});
