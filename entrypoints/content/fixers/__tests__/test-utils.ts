/**
 * Test utilities for fixer tests
 */

import { vi } from 'vitest';
import type { FixerContext } from '../types';

/**
 * Create a test element with specified properties
 */
export function createElement(
  tag: string,
  options: {
    id?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration>;
    innerHTML?: string;
    attributes?: Record<string, string>;
  } = {}
): HTMLElement {
  const element = document.createElement(tag);

  if (options.id) element.id = options.id;
  if (options.className) element.className = options.className;
  if (options.innerHTML) element.innerHTML = options.innerHTML;

  if (options.style) {
    Object.entries(options.style).forEach(([key, value]) => {
      if (value !== undefined) {
        (element.style as any)[key] = value;
      }
    });
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  return element;
}

/**
 * Create a scrollable element with hidden content
 */
export function createScrollableElement(options: {
  clientHeight?: number;
  scrollHeight?: number;
  overflow?: string;
} = {}): HTMLElement {
  const { clientHeight = 200, scrollHeight = 500, overflow = 'hidden' } = options;

  const element = createElement('div', {
    style: {
      height: `${clientHeight}px`,
      overflow,
      position: 'relative',
    },
  });

  // Create content that makes the element scrollable
  const content = createElement('div', {
    style: {
      height: `${scrollHeight}px`,
    },
  });
  element.appendChild(content);

  // Mock scrollHeight and clientHeight
  Object.defineProperty(element, 'scrollHeight', {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(element, 'clientHeight', {
    value: clientHeight,
    writable: true,
    configurable: true,
  });

  return element;
}

/**
 * Create a fixer context for testing
 */
export function createFixerContext(element: HTMLElement): FixerContext {
  // Append to document body so getComputedStyle works
  if (!document.body.contains(element)) {
    document.body.appendChild(element);
  }

  return {
    element,
    document: element.ownerDocument,
    computedStyle: window.getComputedStyle(element),
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };
}

/**
 * Create an iframe element
 */
export function createIframe(options: {
  src?: string;
  height?: string;
} = {}): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  if (options.src) iframe.src = options.src;
  if (options.height) iframe.style.height = options.height;

  // Mock scrollHeight
  Object.defineProperty(iframe, 'scrollHeight', {
    value: 300,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(iframe, 'clientHeight', {
    value: 300,
    writable: true,
    configurable: true,
  });

  return iframe;
}

/**
 * Create a video element
 */
export function createVideoElement(options: {
  autoplay?: boolean;
  poster?: string;
} = {}): HTMLVideoElement {
  const video = document.createElement('video');
  if (options.poster) video.poster = options.poster;

  // Mock media properties
  Object.defineProperty(video, 'paused', {
    value: !options.autoplay,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(video, 'currentTime', {
    value: 30,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(video, 'readyState', {
    value: 4, // HAVE_ENOUGH_DATA
    writable: true,
    configurable: true,
  });

  // Mock play method
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();

  return video;
}

/**
 * Create a sticky header element
 */
export function createStickyHeader(
  tag: 'header' | 'nav' = 'header',
  position: 'fixed' | 'sticky' = 'sticky'
): HTMLElement {
  const element = createElement(tag, {
    style: {
      position,
      top: '0',
      left: '0',
      right: '0',
      height: '60px',
      zIndex: '1000',
    },
  });

  Object.defineProperty(element, 'scrollHeight', {
    value: 60,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(element, 'clientHeight', {
    value: 60,
    writable: true,
    configurable: true,
  });

  return element;
}

/**
 * Clean up test elements
 */
export function cleanup(): void {
  document.body.innerHTML = '';
}

/**
 * Wait for next tick (useful for async operations)
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
