# CI/CD Integration Guide

This guide covers integrating bubble-io-visual-tester into your CI/CD pipelines for automated visual regression testing.

---

## Recommended Workflow

```
Developer makes Bubble editor changes
        │
        ▼
  Deploys to version-test (or staging)
        │
        ▼
  CI pipeline triggers (push / PR)
        │
        ▼
  bubble-tester test --no-open
        │
      ┌─┴─────────────────────┐
      │ Pass (0 regressions)  │ Fail (regressions found)
      ▼                       ▼
  PR approved             PR blocked
  Deploy to live          Upload diff report
                          Developer reviews HTML report
```

> **Prerequisite**: `snapshots/baseline/` must be committed to your repository before any CI test run.

---

## GitHub Actions

### Basic Setup

Create `.github/workflows/visual-regression.yml`:

```yaml
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

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Build CLI
        run: npm run build

      - name: Run visual regression tests
        run: node dist/index.js test --no-open

      - name: Upload HTML report (always)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-report
          path: visual-report/
          retention-days: 30

      - name: Upload diff snapshots (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: diff-snapshots
          path: snapshots/diff/
          retention-days: 7
```

---

### With Authentication

If your app requires login, decode the `auth.json` from a CI secret:

```yaml
      - name: Restore auth session
        run: echo "${{ secrets.BUBBLE_AUTH_STATE }}" | base64 --decode > auth.json

      - name: Run visual regression tests
        run: node dist/index.js test --no-open
```

> See [AUTH.md](./AUTH.md) for how to encode and store `auth.json` as a secret.

---

### Multi-Browser Matrix

```yaml
jobs:
  visual-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, webkit, firefox]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npx playwright install --with-deps ${{ matrix.browser }}
      - run: npm run build

      - name: Run visual regression tests (${{ matrix.browser }})
        run: node dist/index.js test --no-open --browser ${{ matrix.browser }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: report-${{ matrix.browser }}
          path: visual-report/
```

---

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test

visual-regression:
  stage: test
  image: mcr.microsoft.com/playwright:v1.44.0-jammy
  script:
    - npm ci
    - npm run build
    - node dist/index.js test --no-open
  artifacts:
    when: always
    paths:
      - visual-report/
      - snapshots/diff/
    expire_in: 1 week
```

---

## Bitbucket Pipelines

```yaml
# bitbucket-pipelines.yml
pipelines:
  default:
    - step:
        name: Visual Regression Tests
        image: mcr.microsoft.com/playwright:v1.44.0-jammy
        script:
          - npm ci
          - npm run build
          - node dist/index.js test --no-open
        artifacts:
          - visual-report/**
          - snapshots/diff/**
```

---

## Managing the Baseline in CI

### Strategy A — Baseline in Git (Recommended for small teams)

Commit `snapshots/baseline/` directly to your repository. Update it intentionally when visual changes are approved:

```bash
# After approving intentional visual changes:
node dist/index.js baseline
git add snapshots/baseline/
git commit -m "chore: update visual baseline"
git push
```

### Strategy B — Baseline from CI Artifacts

For large teams where committing binary PNG files is undesirable:
1. Store baseline screenshots as a CI cache or artifact from the `main` branch
2. Download them at the start of each test run
3. This requires custom CI scripting

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | All tests passed (or `failOnMismatch: false`) |
| `1` | Visual regressions found (`failOnMismatch: true`) |
| `2` | Configuration error, missing baseline, or capture failure |

---

## Tips for Stable CI Runs

1. **Pin Playwright version**: Use an exact version in `package.json` (e.g. `"playwright": "1.44.1"`) to avoid unexpected browser changes.
2. **Use `maskSelectors`**: Mask timestamps, avatars, and any live data that changes between runs.
3. **Set a modest threshold**: `0.1` (10% per-pixel tolerance) handles most font rendering differences across OSes.
4. **Run on a stable network**: CI runners with slow or flaky networks may cause `networkidle` timeouts. Increase `timeout` in capture if needed.
5. **Use `--with-deps`**: `npx playwright install --with-deps chromium` installs OS-level dependencies too, preventing crashes on headless Linux runners.
