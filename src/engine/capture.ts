import { chromium, webkit, firefox } from 'playwright';
import type {
  Browser,
  BrowserContext,
  Page,
} from 'playwright';
import fs     from 'node:fs';
import * as p from '@clack/prompts';
import pc     from 'picocolors';
import type { VisualConfig }                       from '../config.js';
import type { BrowserName, SnapshotTarget }        from '../types.js';
import { getSnapshotPath, ensureSnapshotTargetDir } from '../utils/paths.js';
import { logger }                                  from '../utils/logger.js';

// ─── Browser factory ──────────────────────────────────────────────────────────

const BROWSER_LAUNCHERS = { chromium, webkit, firefox } as const;

// ─── Concurrency semaphore ────────────────────────────────────────────────────

class Semaphore {
  private available: number;
  private readonly queue: Array<() => void> = [];

  constructor(limit: number) {
    this.available = limit;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.available++;
    }
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function captureSnapshots(
  config:          VisualConfig,
  target:          SnapshotTarget,
  browserOverride?: BrowserName,
): Promise<void> {
  const browsersToRun: BrowserName[] = browserOverride
    ? [browserOverride]
    : (config.browsers as BrowserName[]);

  ensureSnapshotTargetDir(target);

  for (const browserName of browsersToRun) {
    logger.step(`Launching ${pc.cyan(browserName)} browser…`);
    const browser = await BROWSER_LAUNCHERS[browserName].launch({ headless: true });

    try {
      await captureForBrowser(config, target, browserName, browser);
    } finally {
      await browser.close();
    }
  }
}

// ─── Per-browser capture ──────────────────────────────────────────────────────

async function captureForBrowser(
  config:      VisualConfig,
  target:      SnapshotTarget,
  browserName: BrowserName,
  browser:     Browser,
): Promise<void> {
  const baseUrl = target === 'baseline' ? config.appUrlLive : config.appUrlTest;
  const sem     = new Semaphore(config.options.concurrency);

  // Build every combination of page × viewport
  const tasks = config.viewports.flatMap(viewport =>
    config.pages.map(page => ({ viewport, page })),
  );

  const total = tasks.length;
  let completed = 0;

  await Promise.all(
    tasks.map(({ viewport, page }) =>
      sem.run(async () => {
        const label = `${page.name} @ ${viewport.name} [${browserName}]`;

        const context = await createContext(browser, config, viewport);
        try {
          await capturePage(context, config, target, browserName, viewport, page, baseUrl);
          completed++;
          logger.success(`[${completed}/${total}] ${label}`);
        } catch (err) {
          completed++;
          logger.warn(`[${completed}/${total}] ${label} — ${String(err)}`);
        } finally {
          await context.close();
        }
      }),
    ),
  );
}

// ─── Context creation (auth + viewport) ──────────────────────────────────────

async function createContext(
  browser:  Browser,
  config:   VisualConfig,
  viewport: { width: number; height: number },
): Promise<BrowserContext> {
  const ctxOptions: Parameters<Browser['newContext']>[0] = {
    viewport:         { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    // Disable animations — reduces false positives from CSS transitions
    reducedMotion: 'reduce',
  };

  // Load stored auth state if enabled and file exists
  if (config.auth.enabled) {
    const statePath = config.auth.storageStatePath;
    if (fs.existsSync(statePath)) {
      ctxOptions.storageState = statePath;
    } else {
      logger.warn(
        `Auth is enabled but storage state not found at ${pc.yellow(statePath)}.\n` +
        `  Run ${pc.cyan('bubble-tester auth capture')} to save your session.`,
      );
    }
  }

  return browser.newContext(ctxOptions);
}

// ─── Single page capture ──────────────────────────────────────────────────────

async function capturePage(
  context:     BrowserContext,
  config:      VisualConfig,
  target:      SnapshotTarget,
  browserName: BrowserName,
  viewport:    { name: string; width: number; height: number },
  page:        VisualConfig['pages'][number],
  baseUrl:     string,
): Promise<void> {
  const url        = `${baseUrl.replace(/\/$/, '')}${page.path}`;
  const outputPath = getSnapshotPath(target, page.name, viewport.name, browserName);

  const pwPage: Page = await context.newPage();

  try {
    // Navigate and wait for network to settle
    await pwPage.goto(url, {
      waitUntil: 'networkidle',
      timeout:   30_000,
    });

    // Optional: wait for a specific DOM element to confirm data has loaded
    if (page.waitForSelector) {
      await pwPage.waitForSelector(page.waitForSelector, { timeout: 15_000 });
    }

    // Optional: additional timeout after selector for animations/transitions
    if (page.waitForTimeout) {
      await pwPage.waitForTimeout(page.waitForTimeout);
    }

    // Mask volatile dynamic elements with a solid grey colour
    await injectMaskingStyles(pwPage, config.options.maskSelectors);

    // Take the screenshot
    await pwPage.screenshot({
      path:     outputPath,
      fullPage: config.options.fullPage,
      type:     'png',
    });
  } finally {
    await pwPage.close();
  }
}

// ─── Dynamic element masking ──────────────────────────────────────────────────

async function injectMaskingStyles(pwPage: Page, selectors: string[]): Promise<void> {
  if (selectors.length === 0) return;

  const css = selectors
    .map(
      sel => `
      ${sel} {
        background: #cccccc !important;
        background-image: none !important;
        color: transparent !important;
        border-color: #cccccc !important;
        filter: none !important;
        box-shadow: none !important;
      }
    `,
    )
    .join('\n');

  await pwPage.addStyleTag({ content: css });
}

// ─── Auth capture (headed browser for manual login) ───────────────────────────

export async function captureAuthState(config: VisualConfig): Promise<void> {
  if (!config.auth.loginUrl) {
    throw new Error(
      `No loginUrl specified in config auth section.\n` +
      `Add "auth.loginUrl" to your visual.config.json and try again.`,
    );
  }

  const storageStatePath = config.auth.storageStatePath;

  p.intro(pc.bgCyan(pc.black(' 🔐  Auth Capture — Manual Login Flow ')));
  logger.info(`Launching a ${pc.bold('visible')} browser. Please log in manually.`);
  logger.info(`The session will be saved to: ${pc.yellow(storageStatePath)}`);
  logger.message(pc.dim('Press Enter in this terminal once you are logged in and on the app.\n'));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pwPage  = await context.newPage();

  await pwPage.goto(config.auth.loginUrl, { waitUntil: 'networkidle' });

  // Wait for the user to press Enter
  await p.text({
    message: 'Press Enter once you are fully logged in…',
    placeholder: '(just press Enter)',
  });

  // Save storage state
  await context.storageState({ path: storageStatePath });
  await browser.close();

  p.outro(pc.green(`✓ Auth session saved → ${pc.bold(storageStatePath)}`));
}
