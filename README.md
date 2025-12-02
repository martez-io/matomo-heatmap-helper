<p align="center">
  <img src="public/icons/icon128.png" alt="Matomo Heatmap Helper" width="128" height="128">
</p>

<h1 align="center">Matomo Heatmap Helper</h1>
<p align="center">
  A browser extension that fixes common issues with Matomo heatmap screenshots.
</p>


<p align="center">
  <img src="https://img.shields.io/github/v/release/martez-io/matomo-heatmap-helper?style=flat-square" alt="GitHub Release">
  <img src="https://img.shields.io/github/license/martez-io/matomo-heatmap-helper?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/chrome-MV3-brightgreen?style=flat-square&logo=googlechrome" alt="Chrome MV3">
</p>

## About

Matomo's heatmap feature captures screenshots of your pages to overlay click and scroll data. However, many modern websites use custom scroll containers, fixed headers, overflow:hidden, and cross-origin resources that break these screenshots—resulting in incomplete or broken heatmaps.

This extension detects and fixes these issues before Matomo captures the screenshot:

- **Interactive Mode**: Click on any scrollable container to "lock" it for expansion
- **Automatic Fixes**: Expands heights, removes overflow restrictions, converts relative URLs
- **CORS Handling**: Fetches cross-origin images and fonts, converts them to data URIs
- **Clean Restoration**: All changes are reverted after the screenshot completes

## Installation

### From GitHub Releases (Recommended while google chrome store is reviewing)

1. Go to the [Releases page](../../releases)
2. Download the latest `matomo-heatmap-helper-X.X.X-chrome.zip`
3. Extract the zip file
4. Go to `chrome://extensions` (or `edge://extensions` for Edge)
5. Enable "Developer mode" (toggle in top right)
6. Click "Load unpacked" and select the extracted folder

### Initial Setup

1. Click the extension icon to open the popup
2. Enter your Matomo instance URL (e.g., `https://analytics.example.com`)
3. Enter your Matomo auth token (found in Matomo under Settings > Personal > Security > Auth tokens)
4. The extension will automatically detect when you're on a page tracked by your Matomo instance

## Usage

1. Navigate to a page you want to capture a heatmap for
2. If the page is tracked by your configured Matomo instance, a control bar appears
3. **Enable Interactive Mode** to click on scrollable elements you want expanded
4. **Lock elements** by clicking them (they'll show a lock indicator)
5. **Select a heatmap** from the dropdown
6. Click **Take Screenshot** - the extension will:
   - Expand all locked elements
   - Fix CSS issues
   - Capture and upload to Matomo
   - Restore the page to its original state

## Browser Support

- Chrome (Manifest V3)
- Edge, Brave, and other Chromium-based browsers

> **Note:** Firefox support is coming soon!

## Contributing

Contributions are welcome! Here's how to get started:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/matomo-heatmap-helper.git
cd matomo-heatmap-helper

# Install dependencies
npm install

# Start development server
npm run dev
```

The extension will hot-reload as you make changes.

### Project Structure

```
entrypoints/
├── background.ts           # Service worker (API calls, screenshot coordination)
├── content/                # Content script (DOM manipulation)
│   └── fixers/             # Modular fix system for CSS/DOM issues
├── persistentBar.content/  # React control bar (Shadow DOM)
├── popup/                  # Extension popup
└── options/                # Settings page

lib/                        # Shared utilities
components/                 # Shared React components
types/                      # TypeScript type definitions
```

### Running Tests

```bash
# Run tests in watch mode
npm run test

# Single run
npm run test:run

# With coverage
npm run test:coverage
```

### Adding a New Fixer

The extension uses a composable fixer system. To add a new fix:

1. Create a file in `entrypoints/content/fixers/element/` or `global/`
2. Implement the `Fixer` interface
3. Import it in `entrypoints/content/fixers/index.ts`
4. Add tests in `__tests__/`

See `entrypoints/content/fixers/README.md` for detailed documentation.

### Building for Production

```bash
# Build
npm run build

# Create distributable zip
npm run zip
```

### Pull Request Guidelines

1. Fork the repository and create a branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass (`npm run test:run`)
4. Update documentation if needed
5. Submit a pull request with a clear description of changes

## License

GPL-3.0

## Acknowledgments

Built with:
- [Matomo](https://matomo.org/) - Privacy-focused web analytics
- [WXT](https://wxt.dev/) - Next-gen web extension framework
- [React](https://react.dev/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
