/**
 * Tests for the sticky header fixer
 */

import { describe, it, expect, afterEach } from 'vitest';
import { stickyHeaderFixer } from '../../specialized/sticky-header-fixer';
import { createElement, createStickyHeader, createFixerContext, cleanup } from '../test-utils';

describe('StickyHeaderFixer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('metadata', () => {
    it('should have correct ID', () => {
      expect(stickyHeaderFixer.id).toBe('specialized:sticky-header');
    });

    it('should have priority 110', () => {
      expect(stickyHeaderFixer.priority).toBe(110);
    });

    it('should compose base:position', () => {
      expect(stickyHeaderFixer.composesFixers).toContain('base:position');
    });
  });

  describe('shouldApply', () => {
    it('should return true for sticky header element', () => {
      const header = createStickyHeader('header', 'sticky');
      const context = createFixerContext(header);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for fixed header element', () => {
      const header = createStickyHeader('header', 'fixed');
      const context = createFixerContext(header);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for sticky nav element', () => {
      const nav = createStickyHeader('nav', 'sticky');
      const context = createFixerContext(nav);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for fixed nav element', () => {
      const nav = createStickyHeader('nav', 'fixed');
      const context = createFixerContext(nav);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with role="banner" and sticky position', () => {
      const element = createElement('div', {
        attributes: { role: 'banner' },
        style: { position: 'sticky' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with role="navigation" and fixed position', () => {
      const element = createElement('div', {
        attributes: { role: 'navigation' },
        style: { position: 'fixed' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with .header class and sticky position', () => {
      const element = createElement('div', {
        className: 'header',
        style: { position: 'sticky' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with .navbar class and fixed position', () => {
      const element = createElement('div', {
        className: 'navbar',
        style: { position: 'fixed' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with .nav class and sticky position', () => {
      const element = createElement('div', {
        className: 'nav',
        style: { position: 'sticky' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return true for element with .sticky class and sticky position', () => {
      const element = createElement('div', {
        className: 'sticky',
        style: { position: 'sticky' },
      });
      const context = createFixerContext(element);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(true);
    });

    it('should return false for header with relative position', () => {
      const header = createElement('header', {
        style: { position: 'relative' },
      });
      const context = createFixerContext(header);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(false);
    });

    it('should return false for header with static position', () => {
      const header = createElement('header', {
        style: { position: 'static' },
      });
      const context = createFixerContext(header);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(false);
    });

    it('should return false for div with fixed position but no header class/role', () => {
      const div = createElement('div', {
        style: { position: 'fixed' },
      });
      const context = createFixerContext(div);

      expect(stickyHeaderFixer.shouldApply(context)).toBe(false);
    });
  });

  describe('apply', () => {
    it('should set position to relative', () => {
      const header = createStickyHeader('header', 'sticky');
      document.body.appendChild(header);
      const context = createFixerContext(header);

      stickyHeaderFixer.apply(context);

      expect(header.style.position).toBe('relative');
    });

    it('should set top to auto', () => {
      const header = createStickyHeader('header', 'sticky');
      document.body.appendChild(header);
      const context = createFixerContext(header);

      stickyHeaderFixer.apply(context);

      expect(header.style.top).toBe('auto');
    });

    it('should set zIndex to auto', () => {
      const header = createStickyHeader('header', 'sticky');
      document.body.appendChild(header);
      const context = createFixerContext(header);

      stickyHeaderFixer.apply(context);

      expect(header.style.zIndex).toBe('auto');
    });

    it('should create placeholder for fixed elements', () => {
      const container = createElement('div');
      const header = createStickyHeader('header', 'fixed');
      container.appendChild(header);
      document.body.appendChild(container);

      const context = createFixerContext(header);
      stickyHeaderFixer.apply(context);

      const placeholder = container.querySelector('[data-mhh-placeholder="true"]');
      expect(placeholder).toBeTruthy();
    });

    it('should not create placeholder for sticky elements', () => {
      const container = createElement('div');
      const header = createStickyHeader('header', 'sticky');
      container.appendChild(header);
      document.body.appendChild(container);

      const context = createFixerContext(header);
      stickyHeaderFixer.apply(context);

      const placeholder = container.querySelector('[data-mhh-placeholder="true"]');
      expect(placeholder).toBeFalsy();
    });

    it('should return applied: true', () => {
      const header = createStickyHeader('header', 'sticky');
      const context = createFixerContext(header);

      const result = stickyHeaderFixer.apply(context);

      expect(result.applied).toBe(true);
      expect(result.fixerId).toBe('specialized:sticky-header');
    });
  });

  describe('restore', () => {
    it('should restore original position', () => {
      const header = createStickyHeader('header', 'sticky');
      const originalPosition = header.style.position;
      const context = createFixerContext(header);

      const result = stickyHeaderFixer.apply(context);
      result.restore();

      expect(header.style.position).toBe(originalPosition);
    });

    it('should restore original top', () => {
      const header = createStickyHeader('header', 'sticky');
      const originalTop = header.style.top;
      const context = createFixerContext(header);

      const result = stickyHeaderFixer.apply(context);
      result.restore();

      expect(header.style.top).toBe(originalTop);
    });

    it('should restore original zIndex', () => {
      const header = createStickyHeader('header', 'sticky');
      const originalZIndex = header.style.zIndex;
      const context = createFixerContext(header);

      const result = stickyHeaderFixer.apply(context);
      result.restore();

      expect(header.style.zIndex).toBe(originalZIndex);
    });

    it('should remove placeholder for fixed elements', () => {
      const container = createElement('div');
      const header = createStickyHeader('header', 'fixed');
      container.appendChild(header);
      document.body.appendChild(container);

      const context = createFixerContext(header);
      const result = stickyHeaderFixer.apply(context);

      // Placeholder should exist
      let placeholder = container.querySelector('[data-mhh-placeholder="true"]');
      expect(placeholder).toBeTruthy();

      result.restore();

      // Placeholder should be removed
      placeholder = container.querySelector('[data-mhh-placeholder="true"]');
      expect(placeholder).toBeFalsy();
    });
  });
});
