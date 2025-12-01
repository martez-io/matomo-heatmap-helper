/**
 * Tests for the fixer pipeline execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyFixers } from '../pipeline';
import { fixerRegistry } from '../registry';
import type { Fixer, ComposableFixer } from '../types';
import { createElement, createScrollableElement, cleanup } from './test-utils';

// Mock the logger to avoid import issues
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    init: vi.fn(),
  },
}));

describe('Pipeline', () => {
  beforeEach(() => {
    // Clear the registry before each test
    fixerRegistry.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('applyFixers', () => {
    it('should return ElementFixResult with element reference', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const result = await applyFixers(element);

      expect(result.element).toBe(element);
    });

    it('should return timestamp', async () => {
      const element = createElement('div');
      document.body.appendChild(element);
      const before = Date.now();

      const result = await applyFixers(element);

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should return empty appliedFixers when no fixers match', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      // Register a fixer that doesn't apply
      const fixer: Fixer = {
        id: 'test:no-match',
        title: 'Test no match',
        priority: 10,
        scope: 'element',
        shouldApply: () => false,
        apply: vi.fn(),
      };
      fixerRegistry.register(fixer);

      const result = await applyFixers(element);

      expect(result.appliedFixers).toHaveLength(0);
      expect(fixer.apply).not.toHaveBeenCalled();
    });

    it('should apply fixers in priority order (lower first)', async () => {
      const element = createElement('div');
      document.body.appendChild(element);
      const callOrder: string[] = [];

      const fixer1: Fixer = {
        id: 'test:high',
        title: 'Test high',
        priority: 30,
        scope: 'element',
        shouldApply: () => true,
        apply: () => {
          callOrder.push('high');
          return { fixerId: 'test:high', applied: true, restore: vi.fn() };
        },
      };

      const fixer2: Fixer = {
        id: 'test:low',
        title: 'Test low',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: () => {
          callOrder.push('low');
          return { fixerId: 'test:low', applied: true, restore: vi.fn() };
        },
      };

      const fixer3: Fixer = {
        id: 'test:medium',
        title: 'Test medium',
        priority: 20,
        scope: 'element',
        shouldApply: () => true,
        apply: () => {
          callOrder.push('medium');
          return { fixerId: 'test:medium', applied: true, restore: vi.fn() };
        },
      };

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);
      fixerRegistry.register(fixer3);

      await applyFixers(element);

      expect(callOrder).toEqual(['low', 'medium', 'high']);
    });

    it('should skip element fixers that are composed by composable fixers', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer: Fixer = {
        id: 'element:test',
        title: 'Test base',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const composableFixer: ComposableFixer = {
        id: 'element:composable',
        title: 'Test composable',
        priority: 100,
        scope: 'element',
        composesFixers: ['element:test'],
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:composable',
          applied: true,
          restore: vi.fn(),
        }),
      };

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(composableFixer);

      const result = await applyFixers(element);

      expect(composableFixer.apply).toHaveBeenCalled();
      expect(baseFixer.apply).not.toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(1);
      expect(result.appliedFixers[0].fixerId).toBe('element:composable');
    });

    it('should apply element fixers not composed by any composable fixer', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer1: Fixer = {
        id: 'element:composed',
        title: 'Test composed',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:composed',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const baseFixer2: Fixer = {
        id: 'element:standalone',
        title: 'Test standalone',
        priority: 20,
        scope: 'element',
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:standalone',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const composableFixer: ComposableFixer = {
        id: 'element:composable',
        title: 'Test composable',
        priority: 100,
        scope: 'element',
        composesFixers: ['element:composed'],
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:composable',
          applied: true,
          restore: vi.fn(),
        }),
      };

      fixerRegistry.register(baseFixer1);
      fixerRegistry.register(baseFixer2);
      fixerRegistry.register(composableFixer);

      const result = await applyFixers(element);

      expect(composableFixer.apply).toHaveBeenCalled();
      expect(baseFixer1.apply).not.toHaveBeenCalled();
      expect(baseFixer2.apply).toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(2);
    });

    it('should not apply composable fixer if shouldApply returns false', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer: Fixer = {
        id: 'element:test',
        title: 'Test base',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'element:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const composableFixer: ComposableFixer = {
        id: 'element:composable',
        title: 'Test composable',
        priority: 100,
        scope: 'element',
        composesFixers: ['element:test'],
        shouldApply: () => false, // Does not apply
        apply: vi.fn(),
      };

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(composableFixer);

      const result = await applyFixers(element);

      // Composable doesn't apply, so base should run
      expect(composableFixer.apply).not.toHaveBeenCalled();
      expect(baseFixer.apply).toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(1);
      expect(result.appliedFixers[0].fixerId).toBe('element:test');
    });

    it('should handle errors in fixer apply gracefully', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const errorFixer: Fixer = {
        id: 'test:error',
        title: 'Test error',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: () => {
          throw new Error('Test error');
        },
      };

      const goodFixer: Fixer = {
        id: 'test:good',
        title: 'Test good',
        priority: 20,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:good',
          applied: true,
          restore: vi.fn(),
        }),
      };

      fixerRegistry.register(errorFixer);
      fixerRegistry.register(goodFixer);

      // Should not throw
      const result = await applyFixers(element);

      // Good fixer should still be applied
      expect(result.appliedFixers).toHaveLength(1);
      expect(result.appliedFixers[0].fixerId).toBe('test:good');
    });
  });

  describe('restoreAll', () => {
    it('should restore fixers in reverse order', async () => {
      const element = createElement('div');
      document.body.appendChild(element);
      const restoreOrder: string[] = [];

      const fixer1: Fixer = {
        id: 'test:first',
        title: 'Test first',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:first',
          applied: true,
          restore: () => restoreOrder.push('first'),
        }),
      };

      const fixer2: Fixer = {
        id: 'test:second',
        title: 'Test second',
        priority: 20,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:second',
          applied: true,
          restore: () => restoreOrder.push('second'),
        }),
      };

      const fixer3: Fixer = {
        id: 'test:third',
        title: 'Test third',
        priority: 30,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:third',
          applied: true,
          restore: () => restoreOrder.push('third'),
        }),
      };

      fixerRegistry.register(fixer1);
      fixerRegistry.register(fixer2);
      fixerRegistry.register(fixer3);

      const result = await applyFixers(element);
      result.restoreAll();

      // Should restore in reverse order (last applied first)
      expect(restoreOrder).toEqual(['third', 'second', 'first']);
    });

    it('should handle errors in restore gracefully', async () => {
      const element = createElement('div');
      document.body.appendChild(element);
      const restoreOrder: string[] = [];

      const errorFixer: Fixer = {
        id: 'test:error',
        title: 'Test error',
        priority: 10,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:error',
          applied: true,
          restore: () => {
            throw new Error('Restore error');
          },
        }),
      };

      const goodFixer: Fixer = {
        id: 'test:good',
        title: 'Test good',
        priority: 20,
        scope: 'element',
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:good',
          applied: true,
          restore: () => restoreOrder.push('good'),
        }),
      };

      fixerRegistry.register(errorFixer);
      fixerRegistry.register(goodFixer);

      const result = await applyFixers(element);

      // Should not throw
      expect(() => result.restoreAll()).not.toThrow();

      // Good fixer should still be restored
      expect(restoreOrder).toContain('good');
    });
  });

  describe('integration with real fixers', () => {
    beforeEach(() => {
      // Import real fixers to register them
      // We need to re-register after clearing
    });

    it('should work with scrollable element (height + overflow fixers)', async () => {
      // Import to trigger registration
      await import('../element/height-fixer');
      await import('../element/overflow-fixer');

      const element = createScrollableElement({
        scrollHeight: 500,
        clientHeight: 200,
        overflow: 'hidden',
      });
      document.body.appendChild(element);

      const result = await applyFixers(element);

      // Both height and overflow should apply
      expect(result.appliedFixers.length).toBeGreaterThanOrEqual(2);

      const fixerIds = result.appliedFixers.map((f: { fixerId: string }) => f.fixerId);
      expect(fixerIds).toContain('element:height');
      expect(fixerIds).toContain('element:overflow');
    });
  });
});
