/**
 * Tests for the overflow fixer
 */

import { describe, it, expect, afterEach } from 'vitest';
import { overflowFixer } from '../../element/overflow-fixer';
import { createElement, createFixerContext, cleanup } from '../test-utils';

describe('OverflowFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(overflowFixer.id).toBe('element:overflow');
    });

    it('should have priority 20', () => {
      expect(overflowFixer.priority).toBe(20);
    });

    it('should have element scope', () => {
      expect(overflowFixer.scope).toBe('element');
    });
  });

  describe('shouldApply', () => {
    it('should return true when overflow is hidden', () => {
      const element = createElement('div', { style: { overflow: 'hidden' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when overflow is scroll', () => {
      const element = createElement('div', { style: { overflow: 'scroll' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when overflow is auto', () => {
      const element = createElement('div', { style: { overflow: 'auto' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when overflowY is hidden', () => {
      const element = createElement('div', { style: { overflowY: 'hidden' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when overflowY is scroll', () => {
      const element = createElement('div', { style: { overflowY: 'scroll' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return true when overflowY is auto', () => {
      const element = createElement('div', { style: { overflowY: 'auto' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(true);
    });

    it('should return false when overflow is visible', () => {
      const element = createElement('div', { style: { overflow: 'visible' } });
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(false);
    });

    it('should return false when no overflow is set (default)', () => {
      const element = createElement('div');
      const context = createFixerContext(element);

      expect(overflowFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should set overflow to visible', () => {
      const element = createElement('div', { style: { overflow: 'hidden' } });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      overflowFixer.apply(context);

      expect(element.style.overflow).toBe('visible');
    });

    it('should set overflowY to visible', () => {
      const element = createElement('div', { style: { overflowY: 'hidden' } });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      overflowFixer.apply(context);

      expect(element.style.overflowY).toBe('visible');
    });

    it('should return applied: true', async () => {
      const element = createElement('div', { style: { overflow: 'hidden' } });
      const context = createFixerContext(element);

      const result = await overflowFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('element:overflow');
    });
  });

  describe('restore', () => {
    it('should restore original overflow', async () => {
      const element = createElement('div', { style: { overflow: 'hidden' } });
      const originalOverflow = element.style.overflow;
      const context = createFixerContext(element);

      const result = await overflowFixer.apply(context);
      expect(element.style.overflow).toBe('visible');

      result.restore();
      expect(element.style.overflow).toBe(originalOverflow);
    });

    it('should restore original overflowY', async () => {
      const element = createElement('div', { style: { overflowY: 'scroll' } });
      const originalOverflowY = element.style.overflowY;
      const context = createFixerContext(element);

      const result = await overflowFixer.apply(context);
      expect(element.style.overflowY).toBe('visible');

      result.restore();
      expect(element.style.overflowY).toBe(originalOverflowY);
    });

    it('should restore empty string values correctly', async () => {
      const element = createElement('div', { style: { overflow: 'auto' } });
      element.style.overflow = '';
      element.style.overflowY = '';
      const context = createFixerContext(element);

      const result = await overflowFixer.apply(context);
      result.restore();

      expect(element.style.overflow).toBe('');
      expect(element.style.overflowY).toBe('');
    });

    it('should restore scroll value', async () => {
      const element = createElement('div', { style: { overflow: 'scroll' } });
      const context = createFixerContext(element);

      const result = await overflowFixer.apply(context);
      result.restore();

      expect(element.style.overflow).toBe('scroll');
    });
  });
});
