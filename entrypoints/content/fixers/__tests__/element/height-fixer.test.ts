/**
 * Tests for the height fixer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { heightFixer } from '../../element/height-fixer';
import {
  createElement,
  createScrollableElement,
  createFixerContext,
  cleanup,
} from '../test-utils';

describe('HeightFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(heightFixer.id).toBe('element:height');
    });

    it('should have priority 10', () => {
      expect(heightFixer.priority).toBe(10);
    });

    it('should have element scope', () => {
      expect(heightFixer.scope).toBe('element');
    });
  });

  describe('shouldApply', () => {
    it('should return true when scrollHeight > clientHeight', () => {
      const element = createScrollableElement({
        scrollHeight: 500,
        clientHeight: 200,
      });
      const context = createFixerContext(element);

      expect(heightFixer.shouldApply(context)).toBe(true);
    });

    it('should return false when scrollHeight equals clientHeight', () => {
      const element = createScrollableElement({
        scrollHeight: 200,
        clientHeight: 200,
      });
      const context = createFixerContext(element);

      expect(heightFixer.shouldApply(context)).toBe(false);
    });

    it('should return false when scrollHeight < clientHeight', () => {
      const element = createScrollableElement({
        scrollHeight: 100,
        clientHeight: 200,
      });
      const context = createFixerContext(element);

      expect(heightFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should set height to scrollHeight', () => {
      const element = createScrollableElement({
        scrollHeight: 500,
        clientHeight: 200,
      });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      heightFixer.apply(context);

      expect(element.style.height).toBe('500px');
    });

    it('should set minHeight to scrollHeight', () => {
      const element = createScrollableElement({
        scrollHeight: 500,
        clientHeight: 200,
      });
      document.body.appendChild(element);
      const context = createFixerContext(element);

      heightFixer.apply(context);

      expect(element.style.minHeight).toBe('500px');
    });

    it('should set maxHeight to none', () => {
      const element = createScrollableElement({
        scrollHeight: 500,
        clientHeight: 200,
      });
      element.style.maxHeight = '300px';
      document.body.appendChild(element);
      const context = createFixerContext(element);

      heightFixer.apply(context);

      expect(element.style.maxHeight).toBe('none');
    });

    it('should return applied: true', () => {
      const element = createScrollableElement();
      const context = createFixerContext(element);

      const result = heightFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('element:height');
    });
  });

  describe('restore', () => {
    it('should restore original height', () => {
      const element = createScrollableElement();
      element.style.height = '200px';
      const originalHeight = element.style.height;
      const context = createFixerContext(element);

      const result = heightFixer.apply(context);
      expect(element.style.height).toBe('500px');

      result.restore();
      expect(element.style.height).toBe(originalHeight);
    });

    it('should restore original minHeight', () => {
      const element = createScrollableElement();
      element.style.minHeight = '100px';
      const originalMinHeight = element.style.minHeight;
      const context = createFixerContext(element);

      const result = heightFixer.apply(context);
      expect(element.style.minHeight).toBe('500px');

      result.restore();
      expect(element.style.minHeight).toBe(originalMinHeight);
    });

    it('should restore original maxHeight', () => {
      const element = createScrollableElement();
      element.style.maxHeight = '300px';
      const originalMaxHeight = element.style.maxHeight;
      const context = createFixerContext(element);

      const result = heightFixer.apply(context);
      expect(element.style.maxHeight).toBe('none');

      result.restore();
      expect(element.style.maxHeight).toBe(originalMaxHeight);
    });

    it('should restore empty string values correctly', () => {
      const element = createScrollableElement();
      // No explicit height set
      element.style.height = '';
      element.style.minHeight = '';
      element.style.maxHeight = '';
      const context = createFixerContext(element);

      const result = heightFixer.apply(context);
      result.restore();

      expect(element.style.height).toBe('');
      expect(element.style.minHeight).toBe('');
      expect(element.style.maxHeight).toBe('');
    });
  });
});
