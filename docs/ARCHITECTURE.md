# Architecture — bubble-io-visual-tester

This document describes the internal architecture, data flow, and design decisions of the tool.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                      │
│                       src/index.ts                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Commander   │  │  @clack TUI  │  │  Setup Wizard    │  │
│  │  (commands)  │  │  (no-args)   │  │  (config.ts)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Config Layer                             │
│                    src/config.ts                            │
│   Loads & validates visual.config.json via Zod schema       │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐
│   Capture    │  │    Diff      │  │      Reporter        │
│   Engine     │  │   Engine     │  │                      │
│ capture.ts   │  │  diff.ts     │  │  html-reporter.ts    │
│              │  │              │  │                      │
│  Playwright  │  │  pixelmatch  │  │  Self-contained HTML │
│  multi-      │  │  pngjs       │  │  with base64 images  │
│  browser,    │  │              │  │  slider comparison   │
│  concurrency │  │              │  │                      │
└──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘
       │                 │                      │
       ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System Layout                        │
│  snapshots/baseline/   ← baseline PNGs (commit to git)      │
│  snapshots/current/    ← current PNGs  (gitignored)         │
│  snapshots/diff/       ← diff PNGs     (gitignored)         │
│  visual-report/        ← HTML report   (gitignored)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### `src/index.ts` — CLI & TUI Entry Point

The entry point wires together Commander (for direct CLI invocations) and the interactive TUI menu (when no arguments are provided).

**Key decisions:**
- When run with no arguments in a real terminal (`stdout.isTTY`), the TUI menu launches.
- When run with no arguments in a non-TTY context (CI, pipes), `--help` is printed instead, preventing hangs.
- TUI actions are executed as **child processes** via `spawn`, so that when they finish the TUI loop resumes cleanly rather than exiting.
- Global flags (`--version`, `--help`) are routed directly to Commander before any TUI logic.

```
node dist/index.js           → TUI menu (if TTY) or --help (if non-TTY)
node dist/index.js baseline  → Commander baseline command
node dist/index.js test      → Commander test command
node dist/index.js --version → Commander version
```

---

### `src/config.ts` — Config Loader & Setup Wizard

Responsible for reading, validating, and writing `visual.config.json`.

**Validation** is handled by [Zod](https://zod.dev/), which provides clear, structured error messages instead of generic JSON parse errors.

**Setup Wizard** uses `@clack/prompts` to interactively collect:
1. Live & Test app URLs
2. Browsers (multiselect)
3. Viewport preset → expands to a list of `{ name, width, height }` objects
4. Page paths (comma-separated)
5. Authentication (enabled/disabled + loginUrl)
6. Pixel threshold, fullPage, failOnMismatch, maskSelectors

**Viewport Presets** (built-in):

| Preset | Viewports |
|---|---|
| `desktop` | 1920×1080 |
| `mobile` | 375×812 |
| `desktop+mobile` | 1920×1080 + 375×812 |
| `full` | 1920×1080 + 768×1024 + 375×812 |

---

### `src/engine/capture.ts` — Snapshot Engine

Manages all Playwright interactions. Key responsibilities:

**Multi-browser support**: Iterates over `config.browsers` and launches a separate browser instance for each.

**Concurrency**: Uses a hand-rolled `Semaphore` class to cap the number of simultaneously open `BrowserContext` objects. This prevents memory exhaustion on pages with many viewports/browsers.

```typescript
class Semaphore {
  constructor(limit: number) { ... }
  async run<T>(fn: () => Promise<T>): Promise<T> { ... }
}
```

**Auth state injection**: If `auth.enabled` is true, loads a Playwright `storageState` (cookies + localStorage) from `auth.json`. This state was previously captured by `auth capture`.

**Dynamic element masking**: Before screenshotting, injects a `<style>` tag that paints configured selectors with a solid `#cccccc` colour, eliminating false positives from timestamps, avatars, or real-time charts.

**Animations**: Every `BrowserContext` is created with `reducedMotion: 'reduce'`, which sets the `prefers-reduced-motion` CSS media query. This disables CSS transitions and animations that would otherwise cause flaky diffs.

---

### `src/engine/diff.ts` — Diff Engine

Iterates over every `browser × viewport × page` combination, loads the baseline and current PNGs via `pngjs`, and compares them pixel-by-pixel using `pixelmatch`.

**Threshold logic**: The `threshold` config option controls per-pixel color sensitivity (0.0–1.0). A pixel is counted as "changed" only if its color difference exceeds this value. The *test fails* if the ratio of changed pixels to total pixels exceeds the same threshold value.

**Diff image**: On failure, a red-highlighted PNG is written to `snapshots/diff/`. The red color (`#FF0044`) is chosen to be highly visible against both dark and light backgrounds.

**Dimension mismatch**: If the baseline and current images have different dimensions (e.g. a responsive breakpoint changed), the test immediately reports 100% failure with a clear error message.

---

### `src/reporters/html-reporter.ts` — HTML Report Generator

Generates a single, fully self-contained `visual-report/index.html` with no external dependencies.

**Self-containment**: All images (baseline, current, diff) are embedded as `data:image/png;base64,...` URIs. This means the report can be emailed or uploaded as a CI artifact and viewed without any additional files.

**Interactive slider**: Each card has a drag-based before/after comparison slider implemented in vanilla JavaScript. It also supports touch events for mobile viewing.

**Filter tabs**: Buttons at the top filter cards by status (`All`, `Passed`, `Failed`, `Errors`, `Missing Baseline`).

**Dark theme**: Uses CSS custom properties (variables) for the entire color system, making theming straightforward.

---

### `src/utils/logger.ts` — Terminal Output

Thin wrappers around `@clack/prompts` log methods with `picocolors` colour prefixes. Exports:
- `printBanner()` — ASCII box with version (reads from `src/version.ts`)
- `logger.{info,success,warn,error,step,message}` — structured log output
- `printSummaryTable(results)` — aligned table of test results
- `printFinalSummary(results)` — coloured PASSED/FAILED badge with counts

---

### `src/utils/paths.ts` — File System Paths

All file path logic is centralised here. Nothing else in the codebase constructs paths manually.

Key exports:
- `getSnapshotPath(target, pageName, viewport, browser)` — returns the path for a baseline or current PNG
- `getDiffPath(pageName, viewport, browser)` — returns the path for a diff PNG in `snapshots/diff/`
- `sanitiseName(name)` — lowercases and replaces non-alphanum chars with dashes, making names safe for filenames

---

### `src/version.ts` — Single Version Source

Contains the package version as a single exported constant. Both `logger.ts` (banner) and `index.ts` (Commander `.version()`) import from here to ensure they never drift apart.

---

## Data Flow: `test` Command

```
node dist/index.js test
        │
        ▼
  loadConfig()         → reads & validates visual.config.json
        │
        ▼
  captureSnapshots()   → Playwright: screenshots → snapshots/current/
  [concurrency: N]
        │
        ▼
  runDiff()            → pixelmatch: compares baseline vs current
                          saves diff images to snapshots/diff/
        │
        ▼
  buildSummary()       → aggregates stats (passed, failed, errors, avgMismatch)
        │
        ▼
  printSummaryTable()  → prints aligned table to terminal
  printFinalSummary()  → prints PASSED/FAILED badge
        │
        ▼
  generateReport()     → writes visual-report/index.html (base64 images)
        │
        ▼
  open(reportPath)     → opens HTML in default browser
        │
        ▼
  process.exit(1)      → only if failOnMismatch=true AND failures exist
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| ESM (`"type":"module"`) | Future-proof; required by `open` v10 and `pixelmatch` v6 |
| `spawn` for TUI sub-commands | Allows clean return to the TUI menu without `process.exit()` interference |
| Base64 images in HTML report | Report is portable — no external file references needed |
| `reducedMotion: 'reduce'` | Eliminates a major class of flaky visual diffs caused by CSS animations |
| `Semaphore` vs `Promise.all` | Unbounded concurrency can crash Node.js; semaphore caps parallel Playwright contexts |
| Zod config validation | Provides structured, human-readable errors vs raw JSON.parse failures |
| `getDiffPath()` separate from `getSnapshotPath()` | Semantic clarity — diff files live in a different folder and serve a different purpose |
