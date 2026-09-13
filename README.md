# bubble-io-visual-tester

> Visual regression testing CLI for Bubble.io applications. Catch pixel-level layout regressions before they reach production.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.44-purple)](https://playwright.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

Bubble applications rely on responsive layouts and dynamic states. Editor updates can alter container positions or cause repeating groups to overflow without producing standard code diffs to review in git.

- **Component-level testing**: Capture targeted DOM elements (such as forms or navigation bars) instead of full pages.
- **CI/CD sharding**: Split test suites across multiple CI runners (`--shard 1/3`) for parallel execution.
- **Cloud storage (AWS S3)**: Push and pull baseline snapshots to or from S3 to avoid storing test assets in version control.
- **Dynamic masking**: Exclude volatile UI elements using CSS selectors (`.timestamp`), coordinates, or specific RGB color bounds.
- **Authentication handling**: Supports credential-based login automation and saved session storage states.

### Workflow

1. **Capture baseline**: Screenshots the live production app across specified viewports and browsers.
2. **Capture test build**: Screenshots the `version-test` build after changes are applied.
3. **Compare images**: Compares screenshots pixel-by-pixel with Playwright and pixelmatch.
4. **Generate report**: Creates an interactive HTML report with side-by-side and overlay sliders.
5. **Exit code enforcement**: Returns exit code `1` when regressions are detected to fail automated CI pipelines.

---

## Installation

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Playwright browsers (first run only)
npx playwright install chromium
# Or install all browsers (WebKit and Firefox included):
npx playwright install

# 3. Build the CLI
npm run build
```

After compilation, run commands with:
```bash
node dist/index.js <command>
```

To install the binary globally for direct terminal access:
```bash
npm link
# Then run:
bubble-tester <command>
```

---

## Quick Start

### 1. Configure the Project

Start the interactive terminal wizard:

```bash
node dist/index.js
# Select "Setup Wizard" from the menu
```

Alternatively, run the wizard directly:

```bash
node dist/index.js setup
```

Or copy and modify the sample configuration:

```bash
cp visual.config.example.json visual.config.json
```

### 2. Capture a Baseline

```bash
node dist/index.js baseline
```

This saves screenshots of your live app (`appUrlLive`) across all configured viewports and browsers into `./snapshots/baseline/`. Commit this directory to version control.

### 3. Deploy or Edit in Bubble

Deploy changes to `version-test` or update your development branch.

### 4. Run Visual Regression Tests

```bash
node dist/index.js test
```

This captures screenshots from `appUrlTest`, computes pixel diffs against the baseline, and opens the generated HTML report in your browser.

---

## Interactive Menu

Running `node dist/index.js` without arguments starts an interactive menu that remains open between operations:

```
┌   bubble-io-visual-tester
│
◆  What would you like to do?
│  ● Capture Baseline         (Screenshot live app)
│  ○ Run Visual Tests         (Compare current vs baseline)
│  ○ Open Last Report         (View the HTML report)
│  ○ Capture Auth Session     (Save login state for protected pages)
│  ○ Clean Snapshots & Reports
│  ○ Setup Wizard            (Create or update visual.config.json)
└
```

Press `Ctrl+C` to exit.

---

## CLI Reference

```
node dist/index.js [options] [command]
```

| Command | Description |
|---|---|
| *(no args)* | Interactive menu interface |
| `setup` | Run configuration wizard |
| `baseline` | Capture live environment as baseline reference |
| `test` | Capture test environment, compute diffs, and generate report |
| `auth capture` | Launch browser for manual login and save session state |
| `clean` | Remove snapshots and generated reports |
| `report` | Open the most recent HTML report in the browser |

### Global Options

| Option | Description |
|---|---|
| `--config <path>` | Path to custom configuration file |
| `--no-open` | Disable automatic opening of the HTML report |
| `-v, --version` | Display CLI version |

### Command Options

```bash
# Override browser for a specific run
node dist/index.js test --browser webkit
node dist/index.js baseline --browser firefox

# Use an alternate config file
node dist/index.js test --config ./configs/mobile.config.json

# Run in headless CI mode
node dist/index.js test --no-open
```

---

## Configuration Reference (`visual.config.json`)

```jsonc
{
  // Production URL used as the baseline source
  "appUrlLive": "https://myapp.bubbleapps.io",

  // Target environment URL for regression testing
  "appUrlTest": "https://myapp.bubbleapps.io/version-test",

  // Target browsers
  "browsers": ["chromium"], // Supports "webkit" and "firefox"

  // Viewport sizes
  "viewports": [
    { "name": "desktop", "width": 1920, "height": 1080 },
    { "name": "tablet",  "width": 768,  "height": 1024 },
    { "name": "mobile",  "width": 375,  "height": 812  }
  ],

  // Page definitions
  "pages": [
    { "path": "/", "name": "Home" },
    { "path": "/login", "name": "Login" },
    {
      "path": "/dashboard",
      "name": "Dashboard",
      // Wait for specific element before capture (useful for repeating groups and APIs)
      "waitForSelector": ".dashboard-loaded",
      // Additional stabilization delay in milliseconds
      "waitForTimeout": 1500
    }
  ],

  // Authentication configuration for restricted pages
  "auth": {
    "enabled": false,
    "loginUrl": "https://myapp.bubbleapps.io/login",
    "storageStatePath": "./auth.json"
  },

  "options": {
    // Pixel color difference threshold (0.0 to 1.0, default: 0.1)
    "threshold": 0.1,

    // CSS selectors masked with solid grey prior to capture
    "maskSelectors": [".timestamp", ".user-avatar", ".realtime-chart"],

    // Fail execution when mismatches are detected
    "failOnMismatch": true,

    // Capture full scrolling height instead of viewport size only
    "fullPage": false,

    // Number of pages captured in parallel (1-10, default: 3)
    "concurrency": 3
  }
}
```

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for full configuration details.

---

## Authentication for Protected Pages

For applications requiring user login:

### 1. Enable Authentication in Config

```json
"auth": {
  "enabled": true,
  "loginUrl": "https://myapp.bubbleapps.io/login",
  "storageStatePath": "./auth.json"
}
```

### 2. Capture Session State

```bash
node dist/index.js auth capture
```

A browser window opens to your login page. Log in manually, then press **Enter** in your terminal. Session cookies and local storage tokens are written to `auth.json`.

> Do not commit `auth.json` to source control. It is excluded by `.gitignore`.

### 3. Run Tests

Subsequent `baseline` and `test` executions load the stored session state automatically.

See [docs/AUTH.md](docs/AUTH.md) for instructions on setting up CI/CD secret sessions.

---

## CI/CD Pipeline (GitHub Actions)

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

See [docs/CI-CD.md](docs/CI-CD.md) for GitLab CI, Bitbucket Pipelines, and matrix build recipes.

---

## Directory Structure

```
snapshots/
  baseline/
    home-desktop-chromium.png       # Committed to git
    home-mobile-chromium.png
    dashboard-desktop-chromium.png
  current/
    home-desktop-chromium.png       # Ignored by git
  diff/
    home-desktop-chromium-diff.png  # Ignored by git (shows pixel differences)
visual-report/
  index.html                        # Self-contained report with base64 images
```

Commit `snapshots/baseline/` to version control. Directories `snapshots/current/` and `snapshots/diff/` should remain untracked.

---

## HTML Report

- Summary metrics for total, passed, failed, and error counts
- Status filtering tabs
- Before-and-after slider comparison
- Visual diff highlights showing changed pixels
- Standalone HTML artifact with base64 embedded images
- Responsive display for desktop and mobile viewports

---

## Development

```bash
# Start CLI in development mode
npm run dev

# Compile TypeScript
npm run build

# Execute compiled output
node dist/index.js
```

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Internal design and module structure
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) - Configuration options and schemas
- [docs/CI-CD.md](docs/CI-CD.md) - CI/CD pipeline examples
- [docs/AUTH.md](docs/AUTH.md) - Authentication setups for protected routes
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](CHANGELOG.md) - Release history

---

## Technology Stack

| Component | Library | Purpose |
|---|---|---|
| Language | TypeScript 5.4 | Type safety and ESM support |
| Browser Engine | Playwright 1.44 | Headless automation across Chromium, WebKit, Firefox |
| Image Comparison | pixelmatch | Pixel-level visual diffing |
| Image I/O | pngjs | PNG file encoding and decoding |
| Validation | zod | Schema validation for configurations |
| CLI Parser | commander | Command-line option parsing |
| Terminal UI | @clack/prompts | Interactive prompts and menu flows |
| Terminal Styling | picocolors | ANSI color formatting |
| Utilities | open | Cross-platform browser launch |

---

## License

MIT © bubble-io-visual-tester contributors