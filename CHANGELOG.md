# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.1] — 2026-08-09

### Fixed
- Fixed an `ENOENT` crash during `test` when the `visual-report` directory doesn't exist yet, by ensuring the directory is created before writing `results.json`.

---

## [2.0.0] — 2026-08-09

### Added
- **Component-Level Testing**: You can now define an `elements` array in your `pages` config to capture specific DOM selectors instead of the whole page.
- **S3 Cloud Storage**: Added `storage` config block. The CLI can now push (`--push`) and pull (`--pull`) baseline snapshots from AWS S3 compatible buckets.
- **Color Ignoring**: Added `ignoreColors` to `options` to automatically mask dynamic colors across all snapshots before diffing.
- **CI Sharding**: The `test` command now accepts a `--shard <current>/<total>` flag to parallelize work.
- **Merge Reports**: Added `merge-reports` command to merge multiple sharded JSON results into a single HTML report.

---

## [1.1.0] — 2026-08-09

### Added
- **Slack/Discord Webhooks**: Automatically send test results to a webhook URL by configuring `notifications.webhookUrl`.
- **Ignore Regions**: Mask specific absolute coordinate areas using `options.ignoreRegions` (useful for canvas or cross-origin iFrames).
- **Auto-Login**: `auth capture` can now fully automate the login flow if `auth.autoLogin` is configured with credentials and CSS selectors.
- **CI/CD Pipeline**: Added standard GitHub Actions workflow for visual regression testing.
- **NPM Package Metadate**: Added repository and author info to `package.json` for NPM publishing.

---

## [1.0.0] — 2026-08-09

### Added

- **CLI entry point** (`src/index.ts`) with Commander command parsing and interactive TUI fallback
- **Interactive TUI menu** using `@clack/prompts` — launches when run with no arguments in a real terminal; loops back to menu after each action instead of exiting
- **`baseline` command** — captures screenshots of the live app across all configured viewports and browsers
- **`test` command** — captures current app screenshots, diffs against baseline, and generates an HTML report
- **`auth capture` command** — opens a headed browser for manual login and saves Playwright session state to `auth.json`
- **`setup` command** — interactive wizard to create or update `visual.config.json`
- **`clean` command** — deletes all snapshots and reports (with confirmation prompt)
- **`report` command** — re-opens the last generated HTML report in the default browser
- **Config loader** (`src/config.ts`) with Zod schema validation and clear error messages
- **Snapshot engine** (`src/engine/capture.ts`) with:
  - Multi-browser support (Chromium, WebKit, Firefox)
  - Configurable viewports
  - Auth state injection via Playwright `storageState`
  - `waitForSelector` and `waitForTimeout` per page
  - Dynamic element masking via CSS injection
  - `reducedMotion: 'reduce'` to suppress CSS animation flicker
  - Concurrency control via `Semaphore` class
- **Diff engine** (`src/engine/diff.ts`) with:
  - Pixel-by-pixel comparison using `pixelmatch`
  - Configurable per-pixel threshold
  - Diff image generation (red-highlighted changed pixels)
  - Dimension mismatch detection (reported as 100% failure)
- **HTML reporter** (`src/reporters/html-reporter.ts`) with:
  - Dark-themed self-contained report (images as base64 URIs)
  - Interactive drag-to-compare slider (baseline vs current)
  - Diff image panel
  - Filter tabs (All / Passed / Failed / Errors / Missing Baseline)
  - Summary statistics bar
- **`src/version.ts`** — single source of truth for package version
- **`src/utils/paths.ts`** — centralised path management with `sanitiseName`, `getSnapshotPath`, `getDiffPath`
- **`src/utils/logger.ts`** — banner, structured log output, summary table, final PASSED/FAILED badge
- **Auto-open report** in default browser after `test` command (disable with `--no-open`)
- **CI gate** — exits with code `1` when regressions found and `failOnMismatch: true`
- **`--browser` flag** to override the configured browser for a single run
- **`--config` flag** to use an alternative config file path
- **TTY guard** — prints `--help` instead of crashing when run in non-interactive environments (CI, pipes)
- **Documentation**:
  - `README.md` — Quick start, CLI reference, config reference, CI/CD guide
  - `docs/ARCHITECTURE.md` — Internal design docs and data flow diagrams
  - `docs/CONFIGURATION.md` — Detailed config field reference
  - `docs/CI-CD.md` — GitHub Actions, GitLab CI, Bitbucket Pipelines examples
  - `docs/AUTH.md` — Authentication guide including CI secret setup
  - `CONTRIBUTING.md` — Development setup and contribution guidelines
  - `visual.config.example.json` — Fully annotated example config

### Fixed

- `auth capture` no longer requires Google Chrome to be installed — uses Playwright's bundled Chromium
- Diff path no longer semantically misleads by passing `'baseline'` as target — replaced with dedicated `getDiffPath()` function

---

## Upcoming

See [open issues](https://github.com/your-org/bubble-io-visual-tester/issues) for planned features and known limitations.
