/**
 * Edge case tests for URL detection with HTML-encoded quotes
 */
import { describe, it, expect, afterEach } from 'vitest';
import { extractCssUrls, detectRelativeUrls } from '../../utils/url-detector';
import { applyAbsoluteUrls, restoreOriginalUrls } from '../../utils/url-converter';

describe('HTML-encoded URL detection edge cases', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should detect background-image set via innerHTML with encoded quotes', () => {
    // This simulates how HTML with &quot; entities would be parsed by the browser
    document.body.innerHTML = `<div style="background-image: url(&quot;/assets/images/teacher/kogler-4.jpg&quot;);"></div>`;

    const div = document.body.querySelector('div')!;
    console.log('getAttribute style:', div.getAttribute('style'));
    console.log('style.backgroundImage:', div.style.backgroundImage);

    const results = detectRelativeUrls(document.body);
    console.log('Detection results:', results);

    expect(results).toHaveLength(1);
    expect(results[0].urlInValue).toBe('/assets/images/teacher/kogler-4.jpg');
  });

  it('should handle background shorthand with URL', () => {
    document.body.innerHTML = `<div style="background: url(&quot;/assets/images/bg.jpg&quot;) no-repeat center;"></div>`;

    const div = document.body.querySelector('div')!;
    console.log('getAttribute style:', div.getAttribute('style'));
    console.log('style.backgroundImage:', div.style.backgroundImage);
    console.log('style.background:', div.style.background);

    const results = detectRelativeUrls(document.body);
    console.log('Detection results:', results);

    expect(results).toHaveLength(1);
  });

  it('should handle style attribute with single quotes around value', () => {
    document.body.innerHTML = `<div style='background-image: url("/assets/test.jpg");'></div>`;

    const div = document.body.querySelector('div')!;
    console.log('style.backgroundImage:', div.style.backgroundImage);

    const results = detectRelativeUrls(document.body);
    expect(results).toHaveLength(1);
  });

  it('should handle multiple background images', () => {
    document.body.innerHTML = `<div style="background-image: url(&quot;/img/a.jpg&quot;), url(&quot;/img/b.png&quot;);"></div>`;

    const div = document.body.querySelector('div')!;
    console.log('style.backgroundImage:', div.style.backgroundImage);

    const results = detectRelativeUrls(document.body);
    console.log('Detection results:', JSON.stringify(results, null, 2));

    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe('URL conversion end-to-end', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should convert and verify background-image URL in DOM', () => {
    document.body.innerHTML = `<div style="background-image: url(&quot;/assets/images/test.jpg&quot;);"></div>`;

    const div = document.body.querySelector('div')!;

    // Before conversion
    console.log('BEFORE - style.backgroundImage:', div.style.backgroundImage);
    console.log('BEFORE - getAttribute:', div.getAttribute('style'));
    console.log('BEFORE - outerHTML:', div.outerHTML);

    // Detect and apply
    const resources = detectRelativeUrls(document.body);
    expect(resources).toHaveLength(1);

    const applied = applyAbsoluteUrls(resources);
    expect(applied).toHaveLength(1);

    // After conversion
    console.log('AFTER - style.backgroundImage:', div.style.backgroundImage);
    console.log('AFTER - getAttribute:', div.getAttribute('style'));
    console.log('AFTER - outerHTML:', div.outerHTML);

    // Verify the URL is now absolute
    expect(div.style.backgroundImage).toContain('http://localhost:3000/assets/images/test.jpg');
    expect(div.outerHTML).toContain('http://localhost:3000/assets/images/test.jpg');
  });

  it('should convert multiple background images', () => {
    document.body.innerHTML = `<div style="background-image: url(&quot;/img/a.jpg&quot;), url(&quot;/img/b.png&quot;);"></div>`;

    const div = document.body.querySelector('div')!;

    // Before
    console.log('BEFORE - style.backgroundImage:', div.style.backgroundImage);

    // Detect and apply
    const resources = detectRelativeUrls(document.body);
    const applied = applyAbsoluteUrls(resources);

    // After
    console.log('AFTER - style.backgroundImage:', div.style.backgroundImage);
    console.log('AFTER - outerHTML:', div.outerHTML);

    // Both URLs should be absolute
    expect(div.style.backgroundImage).toContain('http://localhost:3000/img/a.jpg');
    expect(div.style.backgroundImage).toContain('http://localhost:3000/img/b.png');
  });

  it('should restore original URL after conversion', () => {
    document.body.innerHTML = `<div style="background-image: url(&quot;/test.jpg&quot;);"></div>`;

    const div = document.body.querySelector('div')!;
    const originalStyleAttr = div.getAttribute('style');

    // Apply
    const resources = detectRelativeUrls(document.body);
    applyAbsoluteUrls(resources);

    // Verify absolute URL is in the style attribute (not just CSSOM)
    expect(div.getAttribute('style')).toContain('http://localhost:3000');

    // Restore
    restoreOriginalUrls(resources);
    console.log('RESTORED - getAttribute style:', div.getAttribute('style'));

    // The style attribute should be restored
    expect(div.getAttribute('style')).toContain('url("/test.jpg")');
  });

  it('should preserve absolute URL in outerHTML after conversion (CSSOM normalization bypass)', () => {
    // This test specifically verifies the fix for browser CSSOM URL normalization
    // Browsers re-relativize same-origin URLs when setting via element.style.backgroundImage
    // We must use setAttribute to bypass this behavior
    document.body.innerHTML = `<div style="background-image: url(&quot;/test.jpg&quot;);"></div>`;

    const div = document.body.querySelector('div')!;

    // Detect and apply
    const resources = detectRelativeUrls(document.body);
    applyAbsoluteUrls(resources);

    // The outerHTML should contain the absolute URL
    // This is critical because Matomo serializes the DOM and needs absolute URLs
    const outerHTML = div.outerHTML;
    console.log('outerHTML after conversion:', outerHTML);

    expect(outerHTML).toContain('http://localhost:3000/test.jpg');
  });

  it('should preserve other style properties when updating background-image', () => {
    document.body.innerHTML = `<div style="color: red; background-image: url(&quot;/test.jpg&quot;); display: flex;"></div>`;

    const div = document.body.querySelector('div')!;

    // Detect and apply
    const resources = detectRelativeUrls(document.body);
    applyAbsoluteUrls(resources);

    const styleAttr = div.getAttribute('style')!;
    console.log('Style after conversion:', styleAttr);

    // Should preserve other properties
    expect(styleAttr).toContain('color: red');
    expect(styleAttr).toContain('display: flex');
    // And have the absolute URL
    expect(styleAttr).toContain('http://localhost:3000/test.jpg');
  });
});
