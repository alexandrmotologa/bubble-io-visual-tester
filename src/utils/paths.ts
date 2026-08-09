import fs   from 'node:fs';
import path from 'node:path';
import type { BrowserName, SnapshotTarget } from '../types.js';

// ─── Directory layout ─────────────────────────────────────────────────────────
//
//  snapshots/
//    baseline/   <page>-<viewport>[-<browser>].png
//    current/    <page>-<viewport>[-<browser>].png
//    diff/       <page>-<viewport>[-<browser>]-diff.png
//  visual-report/
//    index.html

const SNAPSHOTS_DIR = 'snapshots';
const REPORT_DIR    = 'visual-report';

// ─── Sanitise names so they're safe as filenames ──────────────────────────────

export function sanitiseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanum with dash
    .replace(/^-+|-+$/g, '');      // trim leading/trailing dashes
}

// ─── Build a snapshot file path ───────────────────────────────────────────────

export function getSnapshotPath(
  target:   SnapshotTarget,
  pageName: string,
  viewport: string,
  browser:  BrowserName,
): string {
  const file = `${sanitiseName(pageName)}-${sanitiseName(viewport)}-${browser}.png`;
  return path.resolve(process.cwd(), SNAPSHOTS_DIR, target, file);
}

// ─── Build a diff image path (always goes to snapshots/diff/) ──────────────────

export function getDiffPath(
  pageName: string,
  viewport: string,
  browser:  BrowserName,
): string {
  const file = `${sanitiseName(pageName)}-${sanitiseName(viewport)}-${browser}-diff.png`;
  return path.resolve(process.cwd(), SNAPSHOTS_DIR, 'diff', file);
}

// ─── Report path ──────────────────────────────────────────────────────────────

export function getReportPath(): string {
  return path.resolve(process.cwd(), REPORT_DIR, 'index.html');
}

// ─── Directory helpers ────────────────────────────────────────────────────────

export function ensureDirectories(): void {
  for (const dir of [
    path.join(SNAPSHOTS_DIR, 'baseline'),
    path.join(SNAPSHOTS_DIR, 'current'),
    path.join(SNAPSHOTS_DIR, 'diff'),
    REPORT_DIR,
  ]) {
    fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
  }
}

export function ensureSnapshotTargetDir(target: SnapshotTarget): void {
  fs.mkdirSync(
    path.resolve(process.cwd(), SNAPSHOTS_DIR, target),
    { recursive: true },
  );
}

export function ensureDiffDir(): void {
  fs.mkdirSync(
    path.resolve(process.cwd(), SNAPSHOTS_DIR, 'diff'),
    { recursive: true },
  );
}

export function ensureReportDir(): void {
  fs.mkdirSync(path.resolve(process.cwd(), REPORT_DIR), { recursive: true });
}

// ─── Clean helpers ────────────────────────────────────────────────────────────

export function cleanSnapshots(): void {
  const dir = path.resolve(process.cwd(), SNAPSHOTS_DIR);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function cleanReport(): void {
  const dir = path.resolve(process.cwd(), REPORT_DIR);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Utility: check if a file exists ─────────────────────────────────────────

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
