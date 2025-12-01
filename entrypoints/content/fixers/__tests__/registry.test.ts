/**
 * Tests for the fixer registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixerRegistry } from '../registry';
import type { Fixer, ComposableFixer, FixerScope } from '../types';

// Create a mock element-scope fixer for testing
function createMockFixer(id: string, priority: number, scope: FixerScope = 'element'): Fixer {
  return {
    id,
    title: `Mock ${id}`,
    priority,
    scope,
    shouldApply: vi.fn().mockReturnValue(true),
    apply: vi.fn().mockReturnValue({
      fixerId: id,
      applied: true,
      restore: vi.fn(),
    }),
  };
}

// Create a mock composable fixer for testing (always element scope)
function createMockComposableFixer(
  id: string,
  priority: number,
  composesFixers: string[]
): ComposableFixer {
  return {
    id,
    title: `Mock ${id}`,
    priority,
    scope: 'element',
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

  describe('getElementFixers', () => {
    it('should return only element-scope fixers', () => {
      const elementFixer = createMockFixer('element:test', 10, 'element');
      const globalFixer = createMockFixer('global:test', 100, 'global');

      fixerRegistry.register(elementFixer);
      fixerRegistry.register(globalFixer);

      const elementFixers = fixerRegistry.getElementFixers();

      expect(elementFixers).toHaveLength(1);
      expect(elementFixers[0].id).toBe('element:test');
    });

    it('should return fixers sorted by priority', () => {
      const fixer1 = createMockFixer('element:high', 30, 'element');
      const fixer2 = createMockFixer('element:low', 10, 'element');

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);

      const elementFixers = fixerRegistry.getElementFixers();

      expect(elementFixers[0].id).toBe('element:low');
      expect(elementFixers[1].id).toBe('element:high');
    });

    it('should include composable fixers (element scope)', () => {
      const baseFixer = createMockFixer('element:base', 10, 'element');
      const composableFixer = createMockComposableFixer('element:composable', 100, ['element:base']);

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(composableFixer);

      const elementFixers = fixerRegistry.getElementFixers();

      expect(elementFixers).toHaveLength(2);
    });
  });

  describe('getGlobalFixers', () => {
    it('should return only global-scope fixers', () => {
      const elementFixer = createMockFixer('element:test', 10, 'element');
      const globalFixer = createMockFixer('global:test', 100, 'global');

      fixerRegistry.register(elementFixer);
      fixerRegistry.register(globalFixer);

      const globalFixers = fixerRegistry.getGlobalFixers();

      expect(globalFixers).toHaveLength(1);
      expect(globalFixers[0].id).toBe('global:test');
    });

    it('should return fixers sorted by priority', () => {
      const fixer1 = createMockFixer('global:high', 30, 'global');
      const fixer2 = createMockFixer('global:low', 10, 'global');

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);

      const globalFixers = fixerRegistry.getGlobalFixers();

      expect(globalFixers[0].id).toBe('global:low');
      expect(globalFixers[1].id).toBe('global:high');
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
