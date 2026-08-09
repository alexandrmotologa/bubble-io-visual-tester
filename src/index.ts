#!/usr/bin/env node
import { Command }          from 'commander';
import * as p               from '@clack/prompts';
import pc                   from 'picocolors';
import openBrowser          from 'open';
import { spawn }            from 'node:child_process';

import { loadConfig, runSetupWizard, type VisualConfig } from './config.js';
import { captureSnapshots, captureAuthState }            from './engine/capture.js';
import { runDiff, buildSummary }                         from './engine/diff.js';
import { generateReport, getReportPath }                 from './reporters/html-reporter.js';
import { cleanSnapshots, cleanReport, fileExists }       from './utils/paths.js';
import { printBanner, printSummaryTable, printFinalSummary, logger } from './utils/logger.js';
import type { BrowserName }                              from './types.js';
import { VERSION }                                       from './version.js';


// ─── Shared config loader with wizard fallback ────────────────────────────────

async function getConfig(configPath?: string): Promise<VisualConfig> {
  try {
    return loadConfig(configPath);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('not found')) {
      logger.warn('No visual.config.json found — launching setup wizard…\n');
      return runSetupWizard();
    }
    throw err;
  }
}

// ─── Commander setup ──────────────────────────────────────────────────────────

const program = new Command();

program
  .name('bubble-tester')
  .description('Visual regression testing CLI for Bubble.io applications')
  .version(VERSION, '-v, --version')
  .option('--config <path>', 'Path to a custom config file (default: ./visual.config.json)')
  .option('--no-open', 'Disable auto-opening the HTML report in the browser');

// ── baseline ──────────────────────────────────────────────────────────────────

program
  .command('baseline')
  .description('Capture live app screenshots as the baseline reference')
  .option('--browser <name>', 'Override browser for this run (chromium|webkit|firefox)')
  .action(async (opts, cmd) => {
    printBanner();
    const globalOpts = cmd.parent?.opts() as { config?: string; open: boolean };

    p.intro(pc.bgBlue(pc.white(' 📸  Capturing Baseline ')));

    let config: VisualConfig;
    try {
      config = await getConfig(globalOpts.config);
    } catch (err) {
      logger.error(String(err));
      process.exit(2);
    }

    const browserOverride = opts.browser as BrowserName | undefined;
    if (browserOverride && !['chromium', 'webkit', 'firefox'].includes(browserOverride)) {
      logger.error(`Unknown browser: ${browserOverride}. Use chromium, webkit, or firefox.`);
      process.exit(2);
    }

    const spinner = p.spinner();
    spinner.start('Launching browser and capturing screenshots…');

    try {
      await captureSnapshots(config, 'baseline', browserOverride);
      spinner.stop(pc.green('✓ Baseline captured successfully'));
    } catch (err) {
      spinner.stop(pc.red('✗ Baseline capture failed'));
      logger.error(String(err));
      process.exit(2);
    }

    p.outro(
      pc.green('Baseline saved to ') + pc.bold('./snapshots/baseline/') + '\n' +
      `  Run ${pc.cyan('bubble-tester test')} to compare against a new snapshot.`,
    );
  });

// ── test ──────────────────────────────────────────────────────────────────────

program
  .command('test')
  .description('Capture current app, diff against baseline, and generate a report')
  .option('--browser <name>', 'Override browser for this run (chromium|webkit|firefox)')
  .action(async (opts, cmd) => {
    printBanner();
    const globalOpts = cmd.parent?.opts() as { config?: string; open: boolean };
    const startTime  = Date.now();

    p.intro(pc.bgMagenta(pc.white(' 🔍  Running Visual Regression Tests ')));

    let config: VisualConfig;
    try {
      config = await getConfig(globalOpts.config);
    } catch (err) {
      logger.error(String(err));
      process.exit(2);
    }

    const browserOverride = opts.browser as BrowserName | undefined;
    if (browserOverride && !['chromium', 'webkit', 'firefox'].includes(browserOverride)) {
      logger.error(`Unknown browser: ${browserOverride}. Use chromium, webkit, or firefox.`);
      process.exit(2);
    }

    // Step 1: capture current
    const spinner = p.spinner();
    spinner.start('Capturing current app screenshots…');

    try {
      await captureSnapshots(config, 'current', browserOverride);
      spinner.stop(pc.green('✓ Current screenshots captured'));
    } catch (err) {
      spinner.stop(pc.red('✗ Capture failed'));
      logger.error(String(err));
      process.exit(2);
    }

    // Step 2: diff
    logger.step('Running pixel diff…');

    let results;
    try {
      results = await runDiff(config);
    } catch (err) {
      logger.error(`Diff engine error: ${String(err)}`);
      process.exit(2);
    }

    const durationMs = Date.now() - startTime;
    const summary    = buildSummary(results, durationMs);

    // Step 3: print results
    printSummaryTable(results);
    printFinalSummary(results);

    // Step 4: generate HTML report
    let reportPath: string;
    try {
      reportPath = generateReport(results, summary);
      logger.success(`Report generated → ${pc.bold(reportPath)}`);
    } catch (err) {
      logger.warn(`Could not generate HTML report: ${String(err)}`);
      reportPath = '';
    }

    // Step 5: auto-open report
    if (reportPath && globalOpts.open !== false) {
      try {
        await openBrowser(reportPath);
      } catch {
        // Non-fatal — user can open manually
      }
    }

    p.outro(
      summary.failed > 0 || summary.errors > 0
        ? pc.red(`✗ ${summary.failed} regression${summary.failed !== 1 ? 's' : ''} detected`)
        : pc.green(`✓ All ${summary.total} tests passed`),
    );

    // CI exit code
    if ((summary.failed > 0 || summary.errors > 0) && config.options.failOnMismatch) {
      process.exit(1);
    }
  });

// ── auth capture ──────────────────────────────────────────────────────────────

const authCmd = program
  .command('auth')
  .description('Authentication helpers');

authCmd
  .command('capture')
  .description('Launch a headed browser for manual login and save session state')
  .action(async (_opts, cmd) => {
    printBanner();
    const globalOpts = cmd.parent?.parent?.opts() as { config?: string };

    let config: VisualConfig;
    try {
      config = await getConfig(globalOpts.config);
    } catch (err) {
      logger.error(String(err));
      process.exit(2);
    }

    try {
      await captureAuthState(config);
    } catch (err) {
      logger.error(String(err));
      process.exit(2);
    }
  });

// ── clean ─────────────────────────────────────────────────────────────────────

program
  .command('clean')
  .description('Delete all snapshots and reports')
  .option('--snapshots-only', 'Only delete snapshots, keep the report')
  .option('--report-only',    'Only delete the report, keep snapshots')
  .action(async (opts) => {
    printBanner();

    const confirmed = await p.confirm({
      message: pc.yellow('This will permanently delete captured screenshots. Continue?'),
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Clean cancelled.');
      return;
    }

    if (!opts.reportOnly) {
      cleanSnapshots();
      logger.success('Deleted ./snapshots/');
    }

    if (!opts.snapshotsOnly) {
      cleanReport();
      logger.success('Deleted ./visual-report/');
    }

    p.outro(pc.green('✓ Clean complete'));
  });

// ── report ────────────────────────────────────────────────────────────────────

program
  .command('report')
  .description('Open the last generated HTML report in the browser')
  .action(async () => {
    printBanner();

    const reportPath = getReportPath();
    if (!fileExists(reportPath)) {
      logger.error(`No report found at ${pc.yellow(reportPath)}`);
      logger.info(`Run ${pc.cyan('bubble-tester test')} to generate one.`);
      process.exit(2);
    }

    try {
      await openBrowser(reportPath);
      logger.success(`Opened report: ${pc.bold(reportPath)}`);
    } catch (err) {
      logger.error(`Could not open browser: ${String(err)}`);
      logger.info(`Open manually: ${pc.cyan('file://' + reportPath)}`);
      process.exit(2);
    }
  });

// ── setup ─────────────────────────────────────────────────────────────────────

program
  .command('setup')
  .description('Run the interactive setup wizard to create or update visual.config.json')
  .action(async () => {
    try {
      await runSetupWizard();
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        process.exit(0);
      }
      logger.error(String(err));
      process.exit(2);
    }
  });

// ── Interactive TUI (no command given) ────────────────────────────────────────

async function runInteractiveMenu(): Promise<void> {
  printBanner();
  p.intro(pc.bgMagenta(pc.white(' 🫧  bubble-io-visual-tester ')));

  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'baseline', label: '📸  Capture Baseline',         hint: 'Screenshot your live app' },
      { value: 'test',     label: '🔍  Run Visual Tests',          hint: 'Compare current vs baseline' },
      { value: 'report',   label: '📊  Open Last Report',          hint: 'View the HTML report' },
      { value: 'auth',     label: '🔐  Capture Auth Session',      hint: 'Save login state for protected pages' },
      { value: 'clean',    label: '🗑   Clean Snapshots & Reports', hint: 'Delete all generated files' },
      { value: 'setup',    label: '⚙️   Setup Wizard',             hint: 'Create or update visual.config.json' },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel('Goodbye!');
    return;
  }

  // Delegate to the appropriate command by re-invoking argv
  const cmds: Record<string, string[]> = {
    baseline: ['baseline'],
    test:     ['test'],
    report:   ['report'],
    auth:     ['auth', 'capture'],
    clean:    ['clean'],
    setup:    ['__setup__'],
  };

  const selected = cmds[action as string];

  if (action === 'setup') {
    await runSetupWizard();
    console.log('\n');
    return runInteractiveMenu();
  }

  // For other commands, run them in a child process so they don't exit the TUI
  await new Promise<void>((resolve) => {
    const child = spawn(process.argv[0], [process.argv[1], ...selected], { stdio: 'inherit' });
    child.on('close', () => resolve());
  });

  console.log('\n');
  return runInteractiveMenu();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawArgs  = process.argv.slice(2);
  const cmdArgs  = rawArgs.filter(a => !a.startsWith('-'));

  // Global flags (--version, --help) → hand straight to Commander
  if (rawArgs.length > 0 && cmdArgs.length === 0) {
    await program.parseAsync(process.argv);
    return;
  }

  // No command → interactive TUI (only when running in a real terminal)
  if (cmdArgs.length === 0) {
    if (process.stdout.isTTY) {
      await runInteractiveMenu();
    } else {
      // Non-TTY environment (piped, CI, etc.) → print help and exit cleanly
      program.outputHelp();
    }
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(pc.red('\n✗ Unexpected error:'), err);
  process.exit(2);
});
