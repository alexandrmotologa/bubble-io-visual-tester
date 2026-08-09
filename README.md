# 🫧 bubble-io-visual-tester

> **Visual Regression Testing CLI for Bubble.io applications.**  
> Catch pixel-level layout regressions before they reach production — automatically.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.44-purple)](https://playwright.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

Bubble.io apps rely heavily on visual layouts, responsive constraints, and dynamic states. A single editor change can silently break your mobile layout, shift a Group container, or cause a Repeating Group to overflow. There is no source diff to catch this — only your eyes.

- **Component-Level Testing**: Screenshot specific DOM elements (like forms or sidebars) instead of just the whole page.
- **Enterprise CI/CD Sharding**: Split your tests across dozens of CI runners (`--shard 1/3`) for lightning-fast execution.
- **Cloud Storage (AWS S3)**: Automatically push/pull baseline snapshots from S3 to keep your Git repository clean.
- **Smart Masking**: Ignore dynamic areas via CSS selectors (`.timestamp`), exact coordinates, or specific RGB colors!
- **Auto-Login Support**: Supports fully automated credentials login or persisting session cookies for protected pages.

**bubble-io-visual-tester** automates this process:

1. **Captures a baseline** — screenshots of your live app across every viewport and browser you specify.
2. **After a deployment or editor change**, captures the current `version-test` build.
3. **Diffs every screenshot pixel-by-pixel** using Playwright + pixelmatch.
4. **Generates an interactive HTML report** with a before/after slider comparison.
5. **Exits with code `1`** if regressions are found — blocking broken CI/CD pipelines.

---

## Installation

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Playwright browsers (first time only)
npx playwright install chromium
# For all browsers (WebKit + Firefox too):
npx playwright install

# 3. Build the CLI
npm run build
```

After building, all commands are run via:
```bash
node dist/index.js <command>
```

**Optional — install globally** so you can use `bubble-tester` as a command anywhere:
```bash
npm link
# Then use:
bubble-tester <command>
```

---

## Quick Start

### 1. Set up your config

Launch the **interactive TUI menu** — it stays open after each action:

```bash
node dist/index.js
# → Choose "⚙️ Setup Wizard" from the menu
```

Or run the setup wizard directly:

```bash
node dist/index.js setup
```

Or copy and edit the example config manually:

```bash
cp visual.config.example.json visual.config.json
# Edit visual.config.json with your Bubble app URLs and pages
```

### 2. Capture a baseline

```bash
node dist/index.js baseline
```

This screenshots your **live app** (`appUrlLive`) across all configured viewports and browsers.  
Saved to `./snapshots/baseline/`. **Commit this folder to version control.**

### 3. Make changes in the Bubble editor

Deploy to `version-test`, or make changes in your test environment.

### 4. Run the visual regression test

```bash
node dist/index.js test
```

This captures your **test app** (`appUrlTest`), runs a pixel diff against the baseline, and opens an interactive HTML report in your browser.

---

## Interactive TUI Menu

Running `node dist/index.js` with no arguments launches a menu-driven interface.  
**The menu remains open after each action** — you can run multiple commands in sequence without restarting.

```
┌   🫧  bubble-io-visual-tester
│
◆  What would you like to do?
│  ● 📸  Capture Baseline         (Screenshot your live app)
│  ○ 🔍  Run Visual Tests         (Compare current vs baseline)
│  ○ 📊  Open Last Report         (View the HTML report)
│  ○ 🔐  Capture Auth Session     (Save login state for protected pages)
│  ○ 🗑   Clean Snapshots & Reports
│  ○ ⚙️   Setup Wizard            (Create or update visual.config.json)
└
```

Press `Ctrl+C` at any time to exit.

---

## CLI Commands

```
node dist/index.js [options] [command]
```

| Command | Description |
|---|---|
| *(no args)* | Interactive TUI menu (stays open between actions) |
| `setup` | Run the interactive setup wizard |
| `baseline` | Capture live app as baseline reference |
| `test` | Capture current state + diff + HTML report |
| `auth capture` | Launch headed browser for manual login → save session |
| `clean` | Delete all snapshots and reports |
| `report` | Re-open the last generated HTML report |

### Global Options

| Flag | Description |
|---|---|
| `--config <path>` | Use a custom config file path |
| `--no-open` | Don't auto-open the HTML report |
| `-v, --version` | Print version |

### Command Options

```bash
# Override browser for a single run
node dist/index.js test --browser webkit
node dist/index.js baseline --browser firefox

# Use a custom config file
node dist/index.js test --config ./configs/mobile.config.json

# CI-friendly: no browser popup, exit code 1 on failures
node dist/index.js test --no-open
```

---

## Configuration Reference (`visual.config.json`)

```jsonc
{
  // URL of your live/production app (used as baseline source)
  "appUrlLive": "https://myapp.bubbleapps.io",

  // URL of your test/version-test environment
  "appUrlTest": "https://myapp.bubbleapps.io/version-test",

  // Browsers to test with (at least one required)
  "browsers": ["chromium"],                    // "webkit" | "firefox" also supported

  // Viewport configurations
  "viewports": [
    { "name": "desktop", "width": 1920, "height": 1080 },
    { "name": "tablet",  "width": 768,  "height": 1024 },
    { "name": "mobile",  "width": 375,  "height": 812  }
  ],

  // Pages to test
  "pages": [
    { "path": "/", "name": "Home" },
    { "path": "/login", "name": "Login" },
    {
      "path": "/dashboard",
      "name": "Dashboard",
      // Wait for a specific element before screenshotting (Repeating Groups, API data)
      "waitForSelector": ".dashboard-loaded",
      // Additional delay in ms after selector (for animations)
      "waitForTimeout": 1500
    }
  ],

  // Authentication (for protected Bubble pages)
  "auth": {
    "enabled": false,
    // URL of your login page
    "loginUrl": "https://myapp.bubbleapps.io/login",
    // Path to save/load the session state
    "storageStatePath": "./auth.json"
  },

  "options": {
    // Per-pixel color difference tolerance (0.0–1.0, default 0.1)
    // Lower = stricter. 0.1 means 10% color diff allowed per pixel before counting it as changed.
    "threshold": 0.1,

    // CSS selectors to mask with solid grey before screenshotting.
    // Use for: live clocks, user avatars, real-time charts, animated elements.
    "maskSelectors": [".timestamp", ".user-avatar", ".realtime-chart"],

    // Exit with code 1 on failure (blocks CI pipelines)
    "failOnMismatch": true,

    // Capture the full scrolling page, not just the visible viewport
    "fullPage": false,

    // Number of pages to capture in parallel (default 3, max 10)
    "concurrency": 3
  }
}
```

> 📖 See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full configuration reference.

---

## Authentication for Protected Pages

If your Bubble app requires users to be logged in:

### Step 1: Enable auth in config

```json
"auth": {
  "enabled": true,
  "loginUrl": "https://myapp.bubbleapps.io/login",
  "storageStatePath": "./auth.json"
}
```

### Step 2: Capture your session

```bash
node dist/index.js auth capture
```

A real (visible) browser window opens. Log in manually, then press **Enter** in the terminal. Your session cookies and local storage are saved to `auth.json`.

> ⚠️ **Never commit `auth.json` to version control.** It is already in `.gitignore`.

### Step 3: Run normally

All subsequent `baseline` and `test` commands will load the saved session automatically.

> 📖 See [docs/AUTH.md](docs/AUTH.md) for the full authentication guide including CI/CD secret setup.

---

## CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build CLI
        run: npm run build

      - name: Run visual regression tests
        run: node dist/index.js test --no-open

      - name: Upload visual report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-report
          path: visual-report/
          retention-days: 30

      - name: Upload diff snapshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: diff-snapshots
          path: snapshots/diff/
```

> 📖 See [docs/CI-CD.md](docs/CI-CD.md) for GitLab CI, Bitbucket Pipelines, and multi-browser matrix examples.

---

## Snapshot Directory Layout

```
snapshots/
  baseline/
    home-desktop-chromium.png       ← commit to git ✅
    home-mobile-chromium.png
    dashboard-desktop-chromium.png
  current/
    home-desktop-chromium.png       ← gitignored ❌
    ...
  diff/
    home-desktop-chromium-diff.png  ← gitignored ❌ (red-highlighted changes)
visual-report/
  index.html                        ← gitignored ❌ (self-contained, images as base64)
```

> **Tip**: Commit `snapshots/baseline/` to version control. Never commit `snapshots/current/` or `snapshots/diff/`.

---

## HTML Report Features

- 📊 **Summary bar** — Total / Passed / Failed / Errors / Pass Rate / Avg Mismatch
- 🔍 **Filter tabs** — All / Passed / Failed / Errors / Missing Baseline
- 🖼️ **Interactive slider** — drag to compare Baseline vs Current
- 🔴 **Diff image** — highlights changed pixels in vivid red
- 💾 **Self-contained** — single HTML file with images embedded as base64, shareable via email
- 📱 **Responsive** — works on any screen size

---

## Development

```bash
# Run CLI in development (no build step needed)
npm run dev

# Compile to dist/
npm run build

# Run compiled version
node dist/index.js
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Internal design, data flow diagrams, module breakdown |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Detailed reference for every config field |
| [docs/CI-CD.md](docs/CI-CD.md) | GitHub Actions, GitLab CI, Bitbucket Pipelines |
| [docs/AUTH.md](docs/AUTH.md) | Authentication guide for protected Bubble pages |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to this project |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **TypeScript 5.4** | Type-safe source with strict ESM |
| **Playwright 1.44** | Headless browser automation (Chromium, WebKit, Firefox) |
| **pixelmatch** | Pixel-by-pixel image comparison |
| **pngjs** | PNG image read/write |
| **zod** | Config schema validation with clear error messages |
| **commander** | CLI argument parsing |
| **@clack/prompts** | Beautiful interactive TUI menus and wizards |
| **picocolors** | Lightweight terminal colour output |
| **open** | Cross-platform browser launching |

---

## License

MIT © bubble-io-visual-tester contributors