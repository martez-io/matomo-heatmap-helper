/**
 * Tests for the position fixer
 */

import { describe, it, expect, afterEach } from 'vitest';
import { positionFixer } from '../../element/position-fixer';
import { createElement, createFixerContext, cleanup } from '../test-utils';

describe('PositionFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(positionFixer.id).toBe('element:position');
    });

    it('should have priority 30', () => {
      expect(positionFixer.priority).toBe(30);
    });

    it('should have element scope', () => {
      expect(positionFixer.scope).toBe('element');
    });
  });

  describe('shouldApply', () => {
    it('should return true when position is static', () => {
      const element = createElement('div', { style: { position: 'static' } });
      const context = createFixerContext(element);

      expect(positionFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when position is not set (default)', () => {
      const element = createElement('div');
      const context = createFixerContext(element);

      // In happy-dom, the default computed position may vary
      // The fixer should apply when position is static
      const computedPosition = context.computedStyle.position;
      const expectedResult = computedPosition === 'static';
      expect(positionFixer.shouldApply(context)).toBe(expectedResult);
    });

    it('should return false when position is relative', () => {
      const element = createElement('div', { style: { position: 'relative' } });
      const context = createFixerContext(element);

      expect(positionFixer.shouldApply(context)).toBe(false);
    });

    it('should return false when position is absolute', () => {
      const element = createElement('div', { style: { position: 'absolute' } });
      const context = createFixerContext(element);

      expect(positionFixer.shouldApply(context)).toBe(false);
    });

    it('should return false when position is fixed', () => {
      const element = createElement('div', { style: { position: 'fixed' } });
      const context = createFixerContext(element);

      expect(positionFixer.shouldApply(context)).toBe(false);
    });

    it('should return false when position is sticky', () => {
      const element = createElement('div', { style: { position: 'sticky' } });
      const context = createFixerContext(element);

      expect(positionFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should set position to relative', () => {
      const element = createElement('div', { style: { position: 'static' } });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      positionFixer.apply(context);

      expect(element.style.position).toBe('relative');
    });

    it('should return applied: true', () => {
      const element = createElement('div');
      const context = createFixerContext(element);

      const result = positionFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('element:position');
    });
  });

  describe('restore', () => {
    it('should restore original static position', () => {
      const element = createElement('div', { style: { position: 'static' } });
      const originalPosition = element.style.position;
      const context = createFixerContext(element);

      const result = positionFixer.apply(context);
      expect(element.style.position).toBe('relative');

      result.restore();
      expect(element.style.position).toBe(originalPosition);
    });

    it('should restore empty string value correctly', () => {
      const element = createElement('div');
      // No explicit position set
      element.style.position = '';
      const context = createFixerContext(element);

      const result = positionFixer.apply(context);
      result.restore();

      expect(element.style.position).toBe('');
    });
  });
});
