// ─── Core domain types for bubble-io-visual-tester ───────────────────────────

export type BrowserName = 'chromium' | 'webkit' | 'firefox';
export type SnapshotTarget = 'baseline' | 'current';
export type TestStatus = 'passed' | 'failed' | 'error' | 'missing-baseline';

// ─── Per-test result ──────────────────────────────────────────────────────────

export interface TestResult {
  /** Human-readable page name from config */
  pageName: string;
  /** URL path from config (e.g. "/dashboard") */
  pagePath: string;
  /** Viewport name from config (e.g. "desktop") */
  viewport: string;
  /** Browser used for this capture */
  browser: BrowserName;
  /** Outcome of the visual diff */
  status: TestStatus;
  /** Percentage of pixels that differ (0–100) */
  mismatchPercentage: number;
  /** Absolute number of mismatched pixels */
  mismatchPixels: number;
  /** Total pixels in the image (width × height) */
  totalPixels: number;
  /** Absolute file path to the baseline PNG */
  baselinePath: string;
  /** Absolute file path to the current PNG */
  currentPath: string;
  /** Absolute file path to the generated diff PNG (only on failure) */
  diffPath?: string;
  /** Human-readable error message (only on status === 'error') */
  error?: string;
  /** Duration of the diff operation in milliseconds */
  duration: number;
}

// ─── Diff engine output ───────────────────────────────────────────────────────

export interface DiffResult {
  mismatchPixels: number;
  mismatchPercentage: number;
  totalPixels: number;
  diffPath?: string;
}

// ─── Report summary for the HTML reporter ────────────────────────────────────

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  missingBaseline: number;
  avgMismatch: number;
  timestamp: string;
  durationMs: number;
}

// ─── Capture options passed between commands and engine ───────────────────────

export interface CaptureOptions {
  target: SnapshotTarget;
  browserOverride?: BrowserName;
}
