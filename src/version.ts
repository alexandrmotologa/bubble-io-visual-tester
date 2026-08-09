/**
 * Single source of truth for the package version.
 * Keeps the banner in logger.ts and Commander's .version() in sync
 * without requiring a JSON import (which complicates strict ESM).
 */
export const VERSION = '1.1.0';
