# Release Workflow

This project uses [release-please](https://github.com/googleapis/release-please) for automated releases.

## How It Works

1. **Make changes** on `dev` branch using [conventional commits](#conventional-commits)
2. **Merge to `main`** when ready to release
3. **release-please creates a Release PR** automatically with:
   - Version bump (based on commit types)
   - Auto-generated CHANGELOG.md
4. **Merge the Release PR** to trigger the release
5. **GitHub Actions builds and publishes**:
   - Chrome extension zip uploaded to GitHub Release
   - Chrome Web Store submission (automatic)
   - Firefox support coming soon

## Conventional Commits

Use these prefixes in commit messages:

| Prefix | Version Bump | Example |
|--------|--------------|---------|
| `feat:` | Minor (0.6.0 → 0.7.0) | `feat: add dark mode support` |
| `fix:` | Patch (0.6.0 → 0.6.1) | `fix: resolve memory leak` |
| `feat!:` or `BREAKING CHANGE:` | Major (0.6.0 → 1.0.0) | `feat!: redesign API` |
| `chore:`, `docs:`, `refactor:` | No bump | `chore: update dependencies` |

## Manual Release (if needed)

If you need to release without waiting for release-please:

```bash
# Build both extensions
npm run zip
npm run zip:firefox

# Outputs in dist/
# - matomo-heatmap-helper-X.Y.Z-chrome.zip
# - matomo-heatmap-helper-X.Y.Z-firefox.zip
```

## Configuration

- `release-please-config.json` - Release-please settings
- `.release-please-manifest.json` - Current version tracking
- `.github/workflows/release-please.yml` - Creates Release PRs
- `.github/workflows/release.yml` - Builds and publishes on release

## Version Locations

Version is automatically synced in:
- `package.json`
- `wxt.config.ts` (via `x-release-please-version` annotation)
