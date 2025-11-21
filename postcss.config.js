export default {
  plugins: {
    '@tailwindcss/postcss': {},
    '@thedutchcoder/postcss-rem-to-px': {
      // Convert rem to px with 16px base (1rem = 16px)
      // This ensures consistent sizing in Shadow DOM regardless of page's root font-size
      baseValue: 16,
    },
    autoprefixer: {},
  },
}
