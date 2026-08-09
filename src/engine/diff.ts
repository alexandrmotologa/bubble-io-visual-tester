import fs         from 'node:fs';
import { PNG }    from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { VisualConfig }                                          from '../config.js';
import type { TestResult, BrowserName }                               from '../types.js';
import { getSnapshotPath, getDiffPath, ensureDiffDir, fileExists } from '../utils/paths.js';
import { logger }                                                     from '../utils/logger.js';
import pc                                                             from 'picocolors';

// ─── Run diff for all page × viewport × browser combinations ─────────────────

export async function runDiff(config: VisualConfig): Promise<TestResult[]> {
  ensureDiffDir();

  const browsers: BrowserName[] = config.browsers as BrowserName[];
  const results: TestResult[]   = [];

  for (const browser of browsers) {
    for (const viewport of config.viewports) {
      for (const page of config.pages) {
        const result = await diffOne(config, browser, viewport, page);
        results.push(result);
      }
    }
  }

  return results;
}

// ─── Diff a single baseline vs current pair ───────────────────────────────────

async function diffOne(
  config:   VisualConfig,
  browser:  BrowserName,
  viewport: VisualConfig['viewports'][number],
  page:     VisualConfig['pages'][number],
): Promise<TestResult> {
  const baselinePath = getSnapshotPath('baseline', page.name, viewport.name, browser);
  const currentPath  = getSnapshotPath('current',  page.name, viewport.name, browser);
  const label        = `${page.name} @ ${viewport.name} [${browser}]`;

  const base: Partial<TestResult> = {
    pageName:            page.name,
    pagePath:            page.path,
    viewport:            viewport.name,
    browser,
    baselinePath,
    currentPath,
    mismatchPercentage:  0,
    mismatchPixels:      0,
    totalPixels:         0,
    duration:            0,
  };

  // ── Missing baseline ────────────────────────────────────────────────────────
  if (!fileExists(baselinePath)) {
    logger.warn(`No baseline for ${label} — run ${pc.cyan('bubble-tester baseline')} first`);
    return { ...base, status: 'missing-baseline' } as TestResult;
  }

  // ── Missing current ─────────────────────────────────────────────────────────
  if (!fileExists(currentPath)) {
    logger.error(`No current snapshot for ${label}`);
    return {
      ...base,
      status: 'error',
      error:  'Current snapshot not found. Run bubble-tester test to capture it.',
    } as TestResult;
  }

  // ── Diff ────────────────────────────────────────────────────────────────────
  const start = Date.now();

  try {
    const baselineImg = PNG.sync.read(fs.readFileSync(baselinePath));
    const currentImg  = PNG.sync.read(fs.readFileSync(currentPath));

    // Dimension mismatch → treat as complete failure
    if (baselineImg.width !== currentImg.width || baselineImg.height !== currentImg.height) {
      const duration = Date.now() - start;
      logger.error(
        `${label} — dimension mismatch: ` +
        `baseline ${baselineImg.width}×${baselineImg.height} vs ` +
        `current ${currentImg.width}×${currentImg.height}`,
      );
      return {
        ...base,
        status:             'failed',
        mismatchPercentage: 100,
        mismatchPixels:     baselineImg.width * baselineImg.height,
        totalPixels:        baselineImg.width * baselineImg.height,
        error:              `Dimension mismatch: baseline ${baselineImg.width}×${baselineImg.height} vs current ${currentImg.width}×${currentImg.height}`,
        duration,
      } as TestResult;
    }

    const { width, height } = baselineImg;
    const totalPixels       = width * height;
    const diffImg           = new PNG({ width, height });

    const mismatchPixels = pixelmatch(
      baselineImg.data,
      currentImg.data,
      diffImg.data,
      width,
      height,
      {
        threshold:        config.options.threshold,
        includeAA:        false,      // ignore anti-aliasing differences
        diffColor:        [255, 0, 68],  // vivid red for changed pixels
        diffColorAlt:     [0, 255, 0],   // green for anti-aliasing (shown only if includeAA=true)
      },
    );

    const mismatchPercentage = (mismatchPixels / totalPixels) * 100;
    const duration           = Date.now() - start;

    // Determine pass/fail
    const thresholdPixels = totalPixels * config.options.threshold;
    const failed          = mismatchPixels > thresholdPixels;

    let diffPath: string | undefined;

    if (failed) {
      // Save diff image
      diffPath = getDiffPath(page.name, viewport.name, browser);
      const buffer = PNG.sync.write(diffImg);
      fs.writeFileSync(diffPath, buffer);
      logger.error(
        `✗ ${label} — ${mismatchPercentage.toFixed(2)}% mismatch (${mismatchPixels.toLocaleString()} px)`,
      );
    } else {
      logger.success(`✓ ${label} — ${mismatchPercentage.toFixed(2)}%`);
    }

    return {
      pageName:           page.name,
      pagePath:           page.path,
      viewport:           viewport.name,
      browser,
      status:             failed ? 'failed' : 'passed',
      mismatchPercentage,
      mismatchPixels,
      totalPixels,
      baselinePath,
      currentPath,
      diffPath,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - start;
    logger.error(`⚠ ${label} — error during diff: ${String(err)}`);
    return {
      ...base,
      status:   'error',
      error:    String(err),
      duration,
    } as TestResult;
  }
}

// ─── Utility: build a summary from results ────────────────────────────────────

export function buildSummary(results: TestResult[], durationMs: number) {
  const passed  = results.filter(r => r.status === 'passed').length;
  const failed  = results.filter(r => r.status === 'failed').length;
  const errors  = results.filter(r => r.status === 'error').length;
  const missing = results.filter(r => r.status === 'missing-baseline').length;

  const withMismatch = results.filter(r => r.mismatchPercentage > 0);
  const avgMismatch  = withMismatch.length
    ? withMismatch.reduce((acc, r) => acc + r.mismatchPercentage, 0) / withMismatch.length
    : 0;

  return {
    total:          results.length,
    passed,
    failed,
    errors,
    missingBaseline: missing,
    avgMismatch,
    timestamp:       new Date().toISOString(),
    durationMs,
  };
}
