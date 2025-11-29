import tailwindcss from '@tailwindcss/postcss';
import remToPx from '@thedutchcoder/postcss-rem-to-px';
import autoprefixer from 'autoprefixer';

/**
 * PostCSS plugin to scope Tailwind CSS for Shadow DOM content scripts only.
 *
 * This plugin ONLY transforms CSS files that are destined for Shadow DOM injection
 * (content scripts with cssInjectionMode: 'ui'). It leaves popup/options CSS unchanged.
 *
 * Transformations applied to content script CSS:
 * 1. Removes :root from selectors (keeping only :host)
 * 2. Scopes universal selectors (*, ::before, ::after, ::backdrop) inside :host
 * 3. REMOVES @property declarations (they are GLOBAL and leak out of Shadow DOM!)
 *
 * This prevents Tailwind CSS variables from leaking to the host page while
 * maintaining proper styling for popup/options pages.
 */
function scopeForShadowDom() {
  return {
    postcssPlugin: 'scope-for-shadow-dom',
    Once(root, { result }) {
      // Only apply transformations to content script CSS files
      const inputFile = result.opts.from || '';
      const isContentScript = /\.content[\/\\]styles\.css$/.test(inputFile) ||
                              /\.content\.css$/.test(inputFile);

      if (!isContentScript) {
        // Skip transformation - popup/options need :root to work
        return;
      }

      // CRITICAL: Remove @property at-rules - they are GLOBAL and not scoped by Shadow DOM!
      // @property registers custom properties at the document level, which affects ALL elements
      // on the page. The initial-value (like #0000 for gradients) would override page styles.
      root.walkAtRules('property', atRule => {
        atRule.remove();
      });

      // Transform rules for Shadow DOM scoping
      root.walkRules(rule => {
        // Skip if not a style rule
        if (!rule.selector) return;

        // Handle :root,:host selectors - remove :root, keep only :host
        if (rule.selector.includes(':root') && rule.selector.includes(':host')) {
          rule.selector = rule.selector
            .split(',')
            .filter(s => !s.trim().startsWith(':root'))
            .join(',');
        }
        // Handle standalone :root - convert to :host
        else if (rule.selector.match(/^:root$/)) {
          rule.selector = ':host';
        }

        // Scope universal selectors to prevent global pollution
        // Match selectors that are just *, ::before, ::after, ::backdrop (not already scoped)
        const universalPattern = /^(\*|::?(?:before|after|backdrop))$/;
        const needsScoping = rule.selector
          .split(',')
          .some(s => universalPattern.test(s.trim()));

        if (needsScoping) {
          // Rewrite selectors to be scoped inside :host
          rule.selector = rule.selector
            .split(',')
            .map(s => {
              const trimmed = s.trim();
              if (universalPattern.test(trimmed)) {
                // Scope * to :host * and pseudo-elements to :host ::before etc
                return trimmed === '*' ? ':host *' : `:host ${trimmed}`;
              }
              return s;
            })
            .join(',');
        }
      });
    },
  };
}
scopeForShadowDom.postcss = true;

export default {
  plugins: [
    tailwindcss(),
    remToPx({
      // Convert rem to px with 16px base (1rem = 16px)
      // This ensures consistent sizing in Shadow DOM regardless of page's root font-size
      baseValue: 16,
    }),
    autoprefixer(),
    scopeForShadowDom(),
  ],
}
