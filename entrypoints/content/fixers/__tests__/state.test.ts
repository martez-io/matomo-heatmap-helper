/**
 * Tests for the fixer state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  elementFixResults,
  storeFixResult,
  getFixResult,
  hasFixResult,
  restoreAndRemove,
  clearAllFixResults,
  getFixResultCount,
} from '../state';
import type { ElementFixResult } from '../types';
import { createElement, cleanup } from './test-utils';

// Helper to create a mock ElementFixResult
function createMockFixResult(element: HTMLElement): ElementFixResult {
  const restoreMock = vi.fn();
  return {
    element,
    appliedFixers: [
      {
        fixerId: 'test:mock',
        applied: true,
        restore: restoreMock,
      },
    ],
    timestamp: Date.now(),
    restoreAll: restoreMock,
  };
}

describe('Fixer State Management', () => {
  beforeEach(() => {
    // Clear state before each test
    elementFixResults.clear();
  });

  afterEach(() => {
    cleanup();
    elementFixResults.clear();
  });

  describe('storeFixResult', () => {
    it('should store a fix result for an element', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);

      storeFixResult(element, fixResult);

      expect(elementFixResults.has(element)).toBe(true);
      expect(elementFixResults.get(element)).toBe(fixResult);
    });

    it('should overwrite existing fix result for same element', () => {
      const element = createElement('div');
      const fixResult1 = createMockFixResult(element);
      const fixResult2 = createMockFixResult(element);

      storeFixResult(element, fixResult1);
      storeFixResult(element, fixResult2);

      expect(elementFixResults.get(element)).toBe(fixResult2);
    });

    it('should store multiple fix results for different elements', () => {
      const element1 = createElement('div', { id: 'el1' });
      const element2 = createElement('div', { id: 'el2' });
      const fixResult1 = createMockFixResult(element1);
      const fixResult2 = createMockFixResult(element2);

      storeFixResult(element1, fixResult1);
      storeFixResult(element2, fixResult2);

      expect(elementFixResults.size).toBe(2);
      expect(elementFixResults.get(element1)).toBe(fixResult1);
      expect(elementFixResults.get(element2)).toBe(fixResult2);
    });
  });

  describe('getFixResult', () => {
    it('should return stored fix result for element', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);
      storeFixResult(element, fixResult);

      expect(getFixResult(element)).toBe(fixResult);
    });

    it('should return undefined for element without fix result', () => {
      const element = createElement('div');

      expect(getFixResult(element)).toBeUndefined();
    });
  });

  describe('hasFixResult', () => {
    it('should return true for element with fix result', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);
      storeFixResult(element, fixResult);

      expect(hasFixResult(element)).toBe(true);
    });

    it('should return false for element without fix result', () => {
      const element = createElement('div');

      expect(hasFixResult(element)).toBe(false);
    });
  });

  describe('restoreAndRemove', () => {
    it('should call restoreAll on the fix result', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);
      storeFixResult(element, fixResult);

      restoreAndRemove(element);

      expect(fixResult.restoreAll).toHaveBeenCalled();
    });

    it('should remove the fix result from storage', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);
      storeFixResult(element, fixResult);

      restoreAndRemove(element);

      expect(hasFixResult(element)).toBe(false);
    });

    it('should return true when fix result existed', () => {
      const element = createElement('div');
      const fixResult = createMockFixResult(element);
      storeFixResult(element, fixResult);

      const result = restoreAndRemove(element);

      expect(result).toBe(true);
    });

    it('should return false when fix result did not exist', () => {
      const element = createElement('div');

      const result = restoreAndRemove(element);

      expect(result).toBe(false);
    });

    it('should not affect other elements', () => {
      const element1 = createElement('div', { id: 'el1' });
      const element2 = createElement('div', { id: 'el2' });
      const fixResult1 = createMockFixResult(element1);
      const fixResult2 = createMockFixResult(element2);
      storeFixResult(element1, fixResult1);
      storeFixResult(element2, fixResult2);

      restoreAndRemove(element1);

      expect(hasFixResult(element1)).toBe(false);
      expect(hasFixResult(element2)).toBe(true);
      expect(fixResult2.restoreAll).not.toHaveBeenCalled();
    });
  });

  describe('clearAllFixResults', () => {
    it('should call restoreAll on all fix results', () => {
      const element1 = createElement('div', { id: 'el1' });
      const element2 = createElement('div', { id: 'el2' });
      const element3 = createElement('div', { id: 'el3' });
      const fixResult1 = createMockFixResult(element1);
      const fixResult2 = createMockFixResult(element2);
      const fixResult3 = createMockFixResult(element3);
      storeFixResult(element1, fixResult1);
      storeFixResult(element2, fixResult2);
      storeFixResult(element3, fixResult3);

      clearAllFixResults();

      expect(fixResult1.restoreAll).toHaveBeenCalled();
      expect(fixResult2.restoreAll).toHaveBeenCalled();
      expect(fixResult3.restoreAll).toHaveBeenCalled();
    });

    it('should clear all fix results from storage', () => {
      const element1 = createElement('div', { id: 'el1' });
      const element2 = createElement('div', { id: 'el2' });
      storeFixResult(element1, createMockFixResult(element1));
      storeFixResult(element2, createMockFixResult(element2));

      clearAllFixResults();

      expect(elementFixResults.size).toBe(0);
    });

    it('should work when no fix results exist', () => {
      // Should not throw
      expect(() => clearAllFixResults()).not.toThrow();
    });
  });

  describe('getFixResultCount', () => {
    it('should return 0 when no fix results', () => {
      expect(getFixResultCount()).toBe(0);
    });

    it('should return correct count', () => {
      const element1 = createElement('div', { id: 'el1' });
      const element2 = createElement('div', { id: 'el2' });
      storeFixResult(element1, createMockFixResult(element1));
      storeFixResult(element2, createMockFixResult(element2));

      expect(getFixResultCount()).toBe(2);
    });

    it('should update after adding/removing', () => {
      const element = createElement('div');
      storeFixResult(element, createMockFixResult(element));
      expect(getFixResultCount()).toBe(1);

      restoreAndRemove(element);
      expect(getFixResultCount()).toBe(0);
    });
  });
});
