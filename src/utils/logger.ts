import * as p from '@clack/prompts';
import pc from 'picocolors';
import { VERSION } from '../version.js';
import type { TestResult } from '../types.js';

// ─── Banner ───────────────────────────────────────────────────────────────────

export function printBanner(): void {
  const v = `v${VERSION}`;
  const title = ` 🫧  bubble-io-visual-tester  ${v} `;
  // Pad the box to fixed width (44 chars interior)
  const pad = '═'.repeat(44);
  console.log('');
  console.log(pc.magenta(`  ╔${pad}╗`));
  console.log(pc.magenta('  ║') + pc.bold(pc.white(title.padStart(23 + v.length).padEnd(44))) + pc.magenta('║'));
  console.log(pc.magenta(`  ╚${pad}╝`));
  console.log('');
}

// ─── Clack wrappers ───────────────────────────────────────────────────────────

export const logger = {
  info: (msg: string): void => p.log.info(pc.cyan(msg)),
  success: (msg: string): void => p.log.success(pc.green(msg)),
  warn: (msg: string): void => p.log.warn(pc.yellow(msg)),
  error: (msg: string): void => p.log.error(pc.red(msg)),
  step: (msg: string): void => p.log.step(pc.white(msg)),
  message: (msg: string): void => p.log.message(pc.dim(msg)),
};

// ─── Result summary table ─────────────────────────────────────────────────────

export function printSummaryTable(results: TestResult[]): void {
  console.log('');
  console.log(pc.bold(pc.white('  ── Test Results ──────────────────────────────────────────')));
  console.log('');

  const colWidths = { page: 22, viewport: 10, browser: 10, status: 18, mismatch: 10 };

  const header = [
    pc.dim('Page'.padEnd(colWidths.page)),
    pc.dim('Viewport'.padEnd(colWidths.viewport)),
    pc.dim('Browser'.padEnd(colWidths.browser)),
    pc.dim('Status'.padEnd(colWidths.status)),
    pc.dim('Mismatch'.padEnd(colWidths.mismatch)),
  ].join('  ');

  console.log('  ' + header);
  console.log('  ' + pc.dim('─'.repeat(74)));

  for (const r of results) {
    const page = r.pageName.slice(0, colWidths.page - 1).padEnd(colWidths.page);
    const vp   = r.viewport.slice(0, colWidths.viewport - 1).padEnd(colWidths.viewport);
    const br   = r.browser.slice(0, colWidths.browser - 1).padEnd(colWidths.browser);

    let statusStr: string;
    switch (r.status) {
      case 'passed':
        statusStr = pc.green('✓ PASSED'.padEnd(colWidths.status));
        break;
      case 'failed':
        statusStr = pc.red('✗ FAILED'.padEnd(colWidths.status));
        break;
      case 'error':
        statusStr = pc.yellow('⚠ ERROR'.padEnd(colWidths.status));
        break;
      case 'missing-baseline':
        statusStr = pc.magenta('○ NO BASELINE'.padEnd(colWidths.status));
        break;
    }

    const mismatch = r.status === 'passed'
      ? pc.dim('0.00%'.padEnd(colWidths.mismatch))
      : pc.red(`${r.mismatchPercentage.toFixed(2)}%`.padEnd(colWidths.mismatch));

    console.log(`  ${pc.white(page)}  ${pc.dim(vp)}  ${pc.dim(br)}  ${statusStr}  ${mismatch}`);
  }

  console.log('  ' + pc.dim('─'.repeat(74)));
  console.log('');
}

// ─── Final summary banner ─────────────────────────────────────────────────────

export function printFinalSummary(results: TestResult[]): void {
  const passed    = results.filter(r => r.status === 'passed').length;
  const failed    = results.filter(r => r.status === 'failed').length;
  const errors    = results.filter(r => r.status === 'error').length;
  const missing   = results.filter(r => r.status === 'missing-baseline').length;
  const total     = results.length;

  const allOk = failed === 0 && errors === 0;

  console.log('');
  if (allOk) {
    console.log(pc.bgGreen(pc.black(` PASSED `)) + pc.green(` All ${total} test${total !== 1 ? 's' : ''} passed`));
  } else {
    const parts: string[] = [];
    if (failed > 0)  parts.push(pc.red(`${failed} failed`));
    if (errors > 0)  parts.push(pc.yellow(`${errors} errored`));
    if (missing > 0) parts.push(pc.magenta(`${missing} missing baseline`));
    parts.push(pc.green(`${passed} passed`));
    console.log(pc.bgRed(pc.white(` FAILED `)) + ' ' + parts.join(pc.dim(' · ')));
  }
  console.log('');
}
