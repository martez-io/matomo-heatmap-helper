# Contributing to Matomo Heatmap Helper

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/martez-io/matomo-heatmap-helper.git
cd matomo-heatmap-helper

# Install dependencies
npm install

# Start development server (Chrome)
npm run dev

# Start development server (Firefox)
npm run dev:firefox
```

The extension will hot-reload as you make changes.

## Project Structure

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

## Running Tests

```bash
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage report
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation only
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests

Examples:
```
feat: add dark mode support
fix: resolve memory leak in content script
docs: update installation instructions
```

## Pull Request Process

1. Fork the repository and create a branch from `dev`
2. Make your changes
3. Write or update tests as needed
4. Ensure all tests pass (`npm run test:run`)
5. Ensure the build works (`npm run build`)
6. Submit a pull request to `dev` branch
7. Fill out the PR template

## Adding a New Fixer

The extension uses a composable fixer system. To add a new fix:

1. Create a file in `entrypoints/content/fixers/element/` or `global/`
2. Implement the `Fixer` interface with `id`, `priority`, `scope`, `shouldApply()`, `apply()`
3. Import it in `entrypoints/content/fixers/index.ts`
4. Add tests in `__tests__/`

See `entrypoints/content/fixers/README.md` for detailed documentation.

## Code Style

- TypeScript for all code
- React for UI components
- Tailwind CSS for styling
- Follow existing patterns in the codebase

## Questions?

Feel free to open an issue for questions or discussions.
