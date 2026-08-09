# Contributing to bubble-io-visual-tester

Thank you for your interest in contributing! This document explains how to set up the project locally and submit changes.

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/bubble-io-visual-tester.git
cd bubble-io-visual-tester

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run the CLI in development mode (no build step needed)
npm run dev

# Or compile first and run the compiled version
npm run build
node dist/index.js
```

---

## Project Structure

```
src/
  index.ts              ← CLI entry point (Commander + TUI)
  config.ts             ← Config loader, Zod validation, Setup Wizard
  version.ts            ← Single source of truth for package version
  types.ts              ← Shared TypeScript interfaces
  declarations.d.ts     ← Type declarations for modules without .d.ts
  engine/
    capture.ts          ← Playwright snapshot engine
    diff.ts             ← pixelmatch diff engine
  reporters/
    html-reporter.ts    ← Self-contained HTML report generator
  utils/
    logger.ts           ← Terminal output helpers
    paths.ts            ← File path management

docs/
  ARCHITECTURE.md       ← Internal design docs
  CONFIGURATION.md      ← Config reference
  CI-CD.md              ← CI/CD integration guide
  AUTH.md               ← Authentication guide
```

---

## Code Style

- **TypeScript strict mode** — no `any`, all types explicit
- **ESM** — use `.js` extensions in import paths (TypeScript NodeNext requirement)
- **No default exports** — named exports only (easier to grep and refactor)
- **Comments in English** — all code, comments, and commit messages must be in English
- **Descriptive variable names** — prefer `mismatchPercentage` over `pct`

---

## Making Changes

1. Create a branch: `git checkout -b feat/your-feature`
2. Make your changes in `src/`
3. Ensure the build passes: `npm run build`
4. Test manually: `node dist/index.js`
5. Commit: `git commit -m "feat: description of change"`
6. Push and open a Pull Request

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for custom report output directory
fix: prevent auth capture from requiring Google Chrome
docs: update CI/CD guide with Bitbucket Pipelines example
chore: update Playwright to 1.45.0
refactor: extract getDiffPath from getSnapshotPath
```

---

## Adding a New Feature

Before implementing a large feature:
1. Open an issue describing the feature
2. Discuss the approach with maintainers
3. Reference the issue in your Pull Request

---

## Reporting Bugs

Please open an issue with:
- Your OS and Node.js version
- Your `visual.config.json` (redact any URLs if needed)
- The exact command you ran
- The full terminal output
- Expected vs actual behaviour

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
