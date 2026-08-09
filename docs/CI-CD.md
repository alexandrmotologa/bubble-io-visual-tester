# CI/CD and Sharding Guide (v2.0)

With version 2.0, `bubble-io-visual-tester` supports massively parallel execution using **Sharding** and **AWS S3 Cloud Storage** for baselines. 
This allows you to run dozens of browsers and viewports simultaneously across multiple CI runners, cutting test times from 30 minutes down to 3 minutes.

---

## 1. Cloud Storage Configuration (AWS S3)

To share baselines across multiple ephemeral CI runners, you must store your baselines in a central cloud storage bucket.
Add the `storage` configuration to your `visual.config.json`:

```jsonc
"storage": {
  "provider": "s3",
  "bucket": "my-bubble-baselines",
  "region": "eu-central-1",
  "prefix": "snapshots/"
}
```

### Authentication
The CLI uses the standard AWS SDK. In your GitHub Actions repository secrets, add:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### CLI Commands for S3
- **Push Baselines**: Uploads your local baselines to S3.
  `npx bubble-tester baseline --push`
- **Pull Baselines**: Downloads baselines from S3 before running a test.
  `npx bubble-tester test --pull`

---

## 2. Sharding with GitHub Actions Matrix Jobs

When you have hundreds of pages to test, running them sequentially takes too long.
Sharding splits your test array into chunks. For example, `--shard 1/3` runs the first third of the tasks.

### Generating the Report
Each shard runs independently and generates its own `.json` results file. 
At the end of the pipeline, you download all the JSON artifacts and run `bubble-tester merge-reports` to generate a single unified HTML report.

### Full GitHub Actions Example

Create `.github/workflows/visual-tests.yml`:

```yaml
name: Visual Regression Tests
on: [push, pull_request]

jobs:
  test:
    name: Run Tests (Shard ${{ matrix.shard }}/${{ strategy.job-total }})
    runs-on: ubuntu-latest
    
    # We create 3 parallel runners
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run Visual Tests
        # We pass --pull to download baselines from S3, and --shard to split work
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: npx bubble-tester test --pull --shard ${{ matrix.shard }}/3

      - name: Upload Shard Artifact
        if: always() # Upload results even if tests fail
        uses: actions/upload-artifact@v4
        with:
          name: shard-results-${{ matrix.shard }}
          path: visual-report/results.json
          retention-days: 1

  merge:
    name: Merge Reports
    needs: [test]
    runs-on: ubuntu-latest
    if: always()

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Download all shard artifacts
        uses: actions/download-artifact@v4
        with:
          path: visual-report
          pattern: shard-results-*
          merge-multiple: true

      - name: Merge Reports
        run: npx bubble-tester merge-reports --dir visual-report

      - name: Upload Final HTML Report
        uses: actions/upload-artifact@v4
        with:
          name: final-visual-report
          path: visual-report/index.html
          retention-days: 7
```

### How this works:
1. GitHub spins up **3 parallel Ubuntu servers**.
2. Each server downloads the full baseline from AWS S3.
3. Server 1 tests chunk 1/3, Server 2 tests chunk 2/3, Server 3 tests chunk 3/3.
4. Each server uploads its `results.json` as a GitHub Artifact.
5. The `merge` job runs last, downloads all JSONs into one folder, and runs `merge-reports`.
6. A single HTML file is generated and attached to the GitHub Action for you to download.
