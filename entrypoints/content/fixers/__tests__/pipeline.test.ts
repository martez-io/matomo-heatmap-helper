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
        priority: 10,
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
        priority: 30,
        shouldApply: () => true,
        apply: () => {
          callOrder.push('high');
          return { fixerId: 'test:high', applied: true, restore: vi.fn() };
        },
      };

      const fixer2: Fixer = {
        id: 'test:low',
        priority: 10,
        shouldApply: () => true,
        apply: () => {
          callOrder.push('low');
          return { fixerId: 'test:low', applied: true, restore: vi.fn() };
        },
      };

      const fixer3: Fixer = {
        id: 'test:medium',
        priority: 20,
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

    it('should skip base fixers that are composed by specialized fixers', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer: Fixer = {
        id: 'base:test',
        priority: 10,
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'base:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const specializedFixer: ComposableFixer = {
        id: 'specialized:test',
        priority: 100,
        composesFixers: ['base:test'],
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'specialized:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(specializedFixer);

      const result = await applyFixers(element);

      expect(specializedFixer.apply).toHaveBeenCalled();
      expect(baseFixer.apply).not.toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(1);
      expect(result.appliedFixers[0].fixerId).toBe('specialized:test');
    });

    it('should apply base fixers not composed by any specialized fixer', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer1: Fixer = {
        id: 'base:composed',
        priority: 10,
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'base:composed',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const baseFixer2: Fixer = {
        id: 'base:standalone',
        priority: 20,
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'base:standalone',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const specializedFixer: ComposableFixer = {
        id: 'specialized:test',
        priority: 100,
        composesFixers: ['base:composed'],
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'specialized:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      fixerRegistry.register(baseFixer1);
      fixerRegistry.register(baseFixer2);
      fixerRegistry.register(specializedFixer);

      const result = await applyFixers(element);

      expect(specializedFixer.apply).toHaveBeenCalled();
      expect(baseFixer1.apply).not.toHaveBeenCalled();
      expect(baseFixer2.apply).toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(2);
    });

    it('should not apply specialized fixer if shouldApply returns false', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const baseFixer: Fixer = {
        id: 'base:test',
        priority: 10,
        shouldApply: () => true,
        apply: vi.fn().mockReturnValue({
          fixerId: 'base:test',
          applied: true,
          restore: vi.fn(),
        }),
      };

      const specializedFixer: ComposableFixer = {
        id: 'specialized:test',
        priority: 100,
        composesFixers: ['base:test'],
        shouldApply: () => false, // Does not apply
        apply: vi.fn(),
      };

      fixerRegistry.register(baseFixer);
      fixerRegistry.register(specializedFixer);

      const result = await applyFixers(element);

      // Specialized doesn't apply, so base should run
      expect(specializedFixer.apply).not.toHaveBeenCalled();
      expect(baseFixer.apply).toHaveBeenCalled();
      expect(result.appliedFixers).toHaveLength(1);
      expect(result.appliedFixers[0].fixerId).toBe('base:test');
    });

    it('should handle errors in fixer apply gracefully', async () => {
      const element = createElement('div');
      document.body.appendChild(element);

      const errorFixer: Fixer = {
        id: 'test:error',
        priority: 10,
        shouldApply: () => true,
        apply: () => {
          throw new Error('Test error');
        },
      };

      const goodFixer: Fixer = {
        id: 'test:good',
        priority: 20,
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
        priority: 10,
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:first',
          applied: true,
          restore: () => restoreOrder.push('first'),
        }),
      };

      const fixer2: Fixer = {
        id: 'test:second',
        priority: 20,
        shouldApply: () => true,
        apply: () => ({
          fixerId: 'test:second',
          applied: true,
          restore: () => restoreOrder.push('second'),
        }),
      };

      const fixer3: Fixer = {
        id: 'test:third',
        priority: 30,
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
        priority: 10,
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
        priority: 20,
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
      await import('../base/height-fixer');
      await import('../base/overflow-fixer');

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
      expect(fixerIds).toContain('base:height');
      expect(fixerIds).toContain('base:overflow');
    });
  });
});
