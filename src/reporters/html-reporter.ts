import fs   from 'node:fs';
import type { TestResult, ReportSummary } from '../types.js';
import { getReportPath, ensureReportDir }  from '../utils/paths.js';

// ─── Entry point ──────────────────────────────────────────────────────────────

export function generateReport(
  results:   TestResult[],
  summary:   ReportSummary,
): string {
  ensureReportDir();

  const reportPath = getReportPath();
  const html       = buildHtml(results, summary);

  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

// ─── Image → base64 data URI ──────────────────────────────────────────────────

function imgToDataUri(filePath: string | undefined): string {
  if (!filePath || !fs.existsSync(filePath)) {
    return 'data:image/png;base64,' + PLACEHOLDER_PNG_B64;
  }
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:image/png;base64,${b64}`;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusBadgeClass(status: TestResult['status']): string {
  switch (status) {
    case 'passed':           return 'badge-pass';
    case 'failed':           return 'badge-fail';
    case 'error':            return 'badge-error';
    case 'missing-baseline': return 'badge-missing';
  }
}

function statusLabel(status: TestResult['status']): string {
  switch (status) {
    case 'passed':           return '✓ PASSED';
    case 'failed':           return '✗ FAILED';
    case 'error':            return '⚠ ERROR';
    case 'missing-baseline': return '○ NO BASELINE';
  }
}

// ─── Per-result card ──────────────────────────────────────────────────────────

function renderCard(r: TestResult, index: number): string {
  const baselineUri = imgToDataUri(r.baselinePath);
  const currentUri  = imgToDataUri(r.currentPath);
  const diffUri     = r.diffPath ? imgToDataUri(r.diffPath) : null;
  const cardStatus  = r.status === 'passed' ? 'passed' : 'failed';

  const mismatchBar = r.mismatchPercentage > 0
    ? `<div class="mismatch-bar-bg">
         <div class="mismatch-bar-fill" style="width: ${Math.min(r.mismatchPercentage, 100).toFixed(2)}%"></div>
       </div>`
    : '';

  const errorMsg = r.error
    ? `<div class="error-msg">⚠ ${escHtml(r.error)}</div>`
    : '';

  const diffPanel = diffUri
    ? `<div class="img-panel">
         <div class="img-panel-label">Diff</div>
         <img class="snap-img" src="${diffUri}" alt="Diff image" loading="lazy" />
       </div>`
    : '';

  return `
  <div class="card ${cardStatus}" data-status="${r.status}" id="card-${index}">
    <div class="card-header">
      <div class="card-title">
        <span class="page-name">${escHtml(r.pageName)}</span>
        <span class="page-path">${escHtml(r.pagePath)}</span>
      </div>
      <div class="card-badges">
        <span class="badge badge-viewport">${escHtml(r.viewport)}</span>
        <span class="badge badge-browser">${escHtml(r.browser)}</span>
        <span class="badge ${statusBadgeClass(r.status)}">${statusLabel(r.status)}</span>
        ${r.mismatchPercentage > 0
          ? `<span class="badge badge-mismatch">${r.mismatchPercentage.toFixed(2)}%</span>`
          : ''}
      </div>
    </div>

    ${errorMsg}
    ${mismatchBar}

    <div class="images-row">
      <!-- Baseline / Current slider -->
      <div class="img-panel img-panel-wide">
        <div class="img-panel-label">Baseline ↔ Current</div>
        <div class="compare-widget" id="cw-${index}">
          <div class="compare-current">
            <img class="snap-img" src="${currentUri}" alt="Current" loading="lazy" />
          </div>
          <div class="compare-before" style="width:50%">
            <img class="snap-img" src="${baselineUri}" alt="Baseline" loading="lazy" />
          </div>
          <div class="compare-divider">
            <div class="compare-handle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
          <div class="compare-label compare-label-left">BASELINE</div>
          <div class="compare-label compare-label-right">CURRENT</div>
          <input type="range" class="compare-range" min="0" max="100" value="50"
                 aria-label="Comparison slider" />
        </div>
      </div>

      ${diffPanel}
    </div>
  </div>`;
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Main HTML builder ────────────────────────────────────────────────────────

function buildHtml(results: TestResult[], summary: ReportSummary): string {
  const cards   = results.map((r, i) => renderCard(r, i)).join('\n');
  const passRate = summary.total > 0
    ? ((summary.passed / summary.total) * 100).toFixed(1)
    : '0';

  const formattedDate = new Date(summary.timestamp).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const durationSec = (summary.durationMs / 1000).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visual Regression Report — bubble-io-visual-tester</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    /* ── Reset & Tokens ─────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           hsl(240, 10%, 4%);
      --surface:      hsl(240, 8%, 8%);
      --surface-2:    hsl(240, 6%, 12%);
      --surface-3:    hsl(240, 5%, 17%);
      --border:       hsl(240, 5%, 22%);
      --border-2:     hsl(240, 4%, 28%);
      --text:         hsl(240, 10%, 92%);
      --text-muted:   hsl(240, 5%, 55%);
      --text-dim:     hsl(240, 4%, 38%);
      --pass:         hsl(142, 71%, 45%);
      --pass-dim:     hsl(142, 71%, 18%);
      --fail:         hsl(0, 80%, 58%);
      --fail-dim:     hsl(0, 70%, 15%);
      --warn:         hsl(38, 92%, 52%);
      --warn-dim:     hsl(38, 60%, 16%);
      --missing:      hsl(280, 60%, 60%);
      --missing-dim:  hsl(280, 40%, 14%);
      --accent:       hsl(243, 75%, 62%);
      --accent-2:     hsl(243, 60%, 40%);
      --radius:       10px;
      --radius-sm:    6px;
      --radius-lg:    14px;
      --shadow:       0 4px 24px rgba(0,0,0,.45);
      --shadow-sm:    0 2px 8px rgba(0,0,0,.3);
    }

    html { font-size: 15px; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
    }

    /* ── Layout ─────────────────────────────────────────────────────────── */
    .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .header {
      background: linear-gradient(135deg, hsl(243,75%,14%) 0%, hsl(280,60%,10%) 50%, var(--surface) 100%);
      border-bottom: 1px solid var(--border);
      padding: 40px 0 32px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .header-inner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      font-size: 32px;
      filter: drop-shadow(0 0 12px hsl(243,75%,70%));
    }

    .brand-text h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(90deg, var(--text) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .brand-text p {
      font-size: .75rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Summary cards ──────────────────────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-top: 28px;
    }

    .stat-card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      text-align: center;
      transition: border-color .2s;
    }

    .stat-card:hover { border-color: var(--border-2); }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--text-muted);
      font-weight: 500;
    }

    .stat-pass  .stat-value { color: var(--pass); }
    .stat-fail  .stat-value { color: var(--fail); }
    .stat-warn  .stat-value { color: var(--warn); }
    .stat-total .stat-value { color: var(--text); }
    .stat-rate  .stat-value { color: var(--accent); }

    /* ── Progress bar ───────────────────────────────────────────────────── */
    .progress-bar-bg {
      height: 4px;
      background: var(--surface-3);
      border-radius: 99px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, var(--accent) 0%, var(--pass) 100%);
      transition: width .6s ease;
    }

    /* ── Controls ───────────────────────────────────────────────────────── */
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 0;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 7px 16px;
      border-radius: 99px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      font-size: .8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all .2s;
    }

    .filter-btn:hover { border-color: var(--border-2); color: var(--text); }

    .filter-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 20px hsl(243,75%,40%);
    }

    .result-count {
      margin-left: auto;
      font-size: .78rem;
      color: var(--text-dim);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Cards ──────────────────────────────────────────────────────────── */
    .cards-list { display: flex; flex-direction: column; gap: 20px; padding-bottom: 60px; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: border-color .2s, transform .2s, box-shadow .2s;
      box-shadow: var(--shadow-sm);
    }

    .card:hover {
      border-color: var(--border-2);
      transform: translateY(-1px);
      box-shadow: var(--shadow);
    }

    .card.passed { border-left: 3px solid var(--pass); }
    .card.failed { border-left: 3px solid var(--fail); }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 22px;
      flex-wrap: wrap;
    }

    .card-title { display: flex; flex-direction: column; gap: 2px; }

    .page-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .page-path {
      font-size: .78rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .card-badges { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

    /* ── Badges ─────────────────────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: .72rem;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
    }

    .badge-viewport  { background: var(--surface-3); color: var(--text-muted); }
    .badge-browser   { background: hsl(243,50%,20%); color: hsl(243,80%,80%); }
    .badge-pass      { background: var(--pass-dim); color: var(--pass); }
    .badge-fail      { background: var(--fail-dim); color: var(--fail); }
    .badge-error     { background: var(--warn-dim); color: var(--warn); }
    .badge-missing   { background: var(--missing-dim); color: var(--missing); }
    .badge-mismatch  { background: hsl(0,60%,18%); color: hsl(0,80%,70%); }

    /* ── Error message ──────────────────────────────────────────────────── */
    .error-msg {
      margin: 0 22px 12px;
      padding: 10px 14px;
      background: var(--warn-dim);
      border: 1px solid hsl(38,60%,30%);
      border-radius: var(--radius-sm);
      font-size: .8rem;
      color: var(--warn);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Mismatch bar ───────────────────────────────────────────────────── */
    .mismatch-bar-bg {
      height: 3px;
      background: var(--surface-3);
      margin: 0 22px 16px;
      border-radius: 99px;
      overflow: hidden;
    }

    .mismatch-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--fail) 0%, hsl(0,80%,80%) 100%);
      border-radius: 99px;
    }

    /* ── Image row ──────────────────────────────────────────────────────── */
    .images-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding: 0 22px 22px;
    }

    .images-row:has(:only-child) { grid-template-columns: 1fr; }

    .img-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .img-panel-label {
      font-size: .7rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--text-dim);
      font-weight: 600;
    }

    .snap-img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      object-fit: contain;
      background: var(--surface-3);
    }

    /* ── Comparison Slider ──────────────────────────────────────────────── */
    .compare-widget {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      cursor: col-resize;
      user-select: none;
      touch-action: none;
    }

    .compare-current { display: block; width: 100%; }
    .compare-current img { border: none; border-radius: 0; }

    .compare-before {
      position: absolute;
      top: 0; left: 0;
      height: 100%;
      overflow: hidden;
      border-right: 2px solid rgba(255,255,255,0.8);
    }

    .compare-before img {
      display: block;
      width: auto;
      max-width: none;
      height: 100%;
      border: none;
      border-radius: 0;
    }

    .compare-divider {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      transform: translateX(-50%);
      pointer-events: none;
    }

    .compare-handle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 99px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      color: #1a1a2e;
      box-shadow: 0 2px 12px rgba(0,0,0,.5);
    }

    .compare-label {
      position: absolute;
      top: 8px;
      padding: 2px 8px;
      background: rgba(0,0,0,.7);
      border-radius: 4px;
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .1em;
      color: rgba(255,255,255,.9);
      pointer-events: none;
    }

    .compare-label-left  { left: 8px; }
    .compare-label-right { right: 8px; }

    .compare-range {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: col-resize;
      z-index: 10;
      margin: 0;
    }

    /* ── Diff panel ─────────────────────────────────────────────────────── */
    .img-panel:not(.img-panel-wide) {
      width: 280px;
      min-width: 200px;
    }

    .img-panel:not(.img-panel-wide) .snap-img {
      max-height: 300px;
      object-fit: contain;
    }

    /* ── Footer ─────────────────────────────────────────────────────────── */
    .footer {
      border-top: 1px solid var(--border);
      padding: 24px 0;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .footer-meta {
      font-size: .75rem;
      color: var(--text-dim);
      font-family: 'JetBrains Mono', monospace;
    }

    .footer-brand {
      font-size: .75rem;
      color: var(--text-dim);
    }

    .footer-brand a {
      color: var(--accent);
      text-decoration: none;
    }

    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .images-row { grid-template-columns: 1fr; }
      .img-panel:not(.img-panel-wide) { width: 100%; }
      .header { position: static; }
      .stats-grid { grid-template-columns: repeat(3, 1fr); }
    }

    /* ── Animations ─────────────────────────────────────────────────────── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .card { animation: fadeIn .3s ease both; }
    .card:nth-child(1)  { animation-delay: .04s; }
    .card:nth-child(2)  { animation-delay: .08s; }
    .card:nth-child(3)  { animation-delay: .12s; }
    .card:nth-child(4)  { animation-delay: .16s; }
    .card:nth-child(5)  { animation-delay: .20s; }

    .card.hidden { display: none; }

    /* ── No results ─────────────────────────────────────────────────────── */
    .no-results {
      text-align: center;
      padding: 60px 0;
      color: var(--text-dim);
      font-size: .9rem;
      display: none;
    }
  </style>
</head>
<body>

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<header class="header">
  <div class="container">
    <div class="header-inner">
      <div class="brand">
        <span class="brand-icon">🫧</span>
        <div class="brand-text">
          <h1>Visual Regression Report</h1>
          <p>bubble-io-visual-tester · ${formattedDate} · ${durationSec}s</p>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-total">
        <div class="stat-value">${summary.total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card stat-pass">
        <div class="stat-value">${summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card stat-fail">
        <div class="stat-value">${summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card stat-warn">
        <div class="stat-value">${summary.errors + summary.missingBaseline}</div>
        <div class="stat-label">Errors / Missing</div>
      </div>
      <div class="stat-card stat-rate">
        <div class="stat-value">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${passRate}%"></div>
        </div>
      </div>
      <div class="stat-card stat-total">
        <div class="stat-value">${summary.avgMismatch.toFixed(2)}%</div>
        <div class="stat-label">Avg Mismatch</div>
      </div>
    </div>
  </div>
</header>

<!-- ── Main ─────────────────────────────────────────────────────────────────── -->
<main>
  <div class="container">

    <!-- Filter controls -->
    <div class="controls">
      <button class="filter-btn active" data-filter="all">All <strong>${summary.total}</strong></button>
      <button class="filter-btn" data-filter="passed">Passed <strong>${summary.passed}</strong></button>
      <button class="filter-btn" data-filter="failed">Failed <strong>${summary.failed}</strong></button>
      ${summary.errors > 0
        ? `<button class="filter-btn" data-filter="error">Errors <strong>${summary.errors}</strong></button>`
        : ''}
      ${summary.missingBaseline > 0
        ? `<button class="filter-btn" data-filter="missing-baseline">Missing <strong>${summary.missingBaseline}</strong></button>`
        : ''}
      <span class="result-count" id="result-count">Showing ${summary.total} of ${summary.total}</span>
    </div>

    <!-- Cards -->
    <div class="cards-list" id="cards-list">
      ${cards}
    </div>

    <div class="no-results" id="no-results">No tests match the selected filter.</div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-meta">
        Generated: ${formattedDate} · Duration: ${durationSec}s
      </div>
      <div class="footer-brand">
        <a href="https://github.com/alexandrmotologa/bubble-io-visual-tester" target="_blank" rel="noopener">
          bubble-io-visual-tester
        </a>
      </div>
    </footer>

  </div>
</main>

<script>
  // ── Comparison slider ────────────────────────────────────────────────────────
  document.querySelectorAll('.compare-widget').forEach((widget) => {
    const range   = widget.querySelector('.compare-range');
    const before  = widget.querySelector('.compare-before');
    const divider = widget.querySelector('.compare-divider');

    function update(val) {
      const pct = val + '%';
      before.style.width   = pct;
      divider.style.left   = pct;
    }

    range.addEventListener('input', () => update(range.value));

    // Also support drag on the widget itself
    let dragging = false;

    widget.addEventListener('mousedown', (e) => {
      if (e.target === range) return; // let native range handle it
      dragging = true;
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    widget.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = widget.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      range.value = pct;
      update(pct);
    });

    // Touch support
    widget.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect  = widget.getBoundingClientRect();
      const touch = e.touches[0];
      const pct   = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
      range.value = pct;
      update(pct);
    }, { passive: false });

    update(50);
  });

  // ── Filter buttons ───────────────────────────────────────────────────────────
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const cards       = document.querySelectorAll('.card');
  const noResults   = document.getElementById('no-results');
  const resultCount = document.getElementById('result-count');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      let visible  = 0;

      cards.forEach((card) => {
        const status = card.dataset.status;
        const show   = filter === 'all' || status === filter;
        card.classList.toggle('hidden', !show);
        if (show) visible++;
      });

      resultCount.textContent = 'Showing ' + visible + ' of ' + cards.length;
      noResults.style.display = visible === 0 ? 'block' : 'none';
    });
  });

  // ── Fix baseline image widths for slider ──────────────────────────────────────
  // The baseline img inside .compare-before must match the container's rendered width
  document.querySelectorAll('.compare-widget').forEach((widget) => {
    const containerImg = widget.querySelector('.compare-current img');
    const beforeImg    = widget.querySelector('.compare-before img');

    function syncWidth() {
      if (containerImg.naturalWidth > 0) {
        const w = containerImg.offsetWidth;
        beforeImg.style.width = w + 'px';
      }
    }

    if (containerImg.complete) {
      syncWidth();
    } else {
      containerImg.addEventListener('load', syncWidth);
    }

    window.addEventListener('resize', syncWidth);
  });
</script>
</body>
</html>`;
}

// ─── 1×1 transparent PNG placeholder (base64) ────────────────────────────────
// Used when an image file is missing, to avoid broken <img> tags.
const PLACEHOLDER_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ─── Re-export path helper for convenience ────────────────────────────────────
export { getReportPath };
