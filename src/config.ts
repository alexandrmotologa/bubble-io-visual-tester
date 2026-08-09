import { z }  from 'zod';
import fs      from 'node:fs';
import path    from 'node:path';
import * as p  from '@clack/prompts';
import pc      from 'picocolors';
import type { BrowserName } from './types.js';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const viewportSchema = z.object({
  name:   z.string().min(1, 'Viewport name is required'),
  width:  z.number().int().positive('Width must be a positive integer'),
  height: z.number().int().positive('Height must be a positive integer'),
});

const pageSchema = z.object({
  path:            z.string().regex(/^\//, 'Page path must start with /'),
  name:            z.string().min(1, 'Page name is required'),
  waitForSelector: z.string().optional(),
  waitForTimeout:  z.number().int().positive().optional(),
});

const autoLoginSchema = z.object({
  username:         z.string().min(1, 'Username is required'),
  password:         z.string().min(1, 'Password is required'),
  usernameSelector: z.string().min(1, 'Username selector is required'),
  passwordSelector: z.string().min(1, 'Password selector is required'),
  submitSelector:   z.string().min(1, 'Submit selector is required'),
});

const authSchema = z.object({
  enabled:          z.boolean().default(false),
  loginUrl:         z.string().url('auth.loginUrl must be a valid URL').optional(),
  storageStatePath: z.string().default('./auth.json'),
  autoLogin:        autoLoginSchema.optional(),
});

const ignoreRegionSchema = z.object({
  x:      z.number().int().nonnegative(),
  y:      z.number().int().nonnegative(),
  width:  z.number().int().positive(),
  height: z.number().int().positive(),
  page:   z.string().optional(),
});

const notificationsSchema = z.object({
  webhookUrl:    z.string().url('Webhook URL must be valid'),
  onFailureOnly: z.boolean().default(true),
});

const optionsSchema = z.object({
  threshold:       z.number().min(0).max(1).default(0.1),
  maskSelectors:   z.array(z.string()).default([]),
  ignoreRegions:   z.array(ignoreRegionSchema).default([]),
  failOnMismatch:  z.boolean().default(true),
  fullPage:        z.boolean().default(false),
  concurrency:     z.number().int().positive().max(10).default(3),
});

export const configSchema = z.object({
  appUrlTest: z.string().url('appUrlTest must be a valid URL'),
  appUrlLive: z.string().url('appUrlLive must be a valid URL'),
  browsers: z
    .array(z.enum(['chromium', 'webkit', 'firefox']))
    .min(1, 'At least one browser is required')
    .default(['chromium']),
  viewports: z
    .array(viewportSchema)
    .min(1, 'At least one viewport is required')
    .default([
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'mobile',  width: 375,  height: 812  },
    ]),
  pages:   z.array(pageSchema).min(1, 'At least one page is required'),
  auth:    authSchema.default({ enabled: false, storageStatePath: './auth.json' }),
  notifications: notificationsSchema.optional(),
  options: optionsSchema.default({}),
});

export type VisualConfig = z.infer<typeof configSchema>;

// ─── Config Loader ────────────────────────────────────────────────────────────

const CONFIG_FILE = 'visual.config.json';

export function loadConfig(configPath?: string): VisualConfig {
  const filePath = configPath ?? path.resolve(process.cwd(), CONFIG_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Config file not found: ${pc.yellow(filePath)}\n` +
      `Run ${pc.cyan('bubble-tester')} without arguments to launch the interactive setup wizard.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse config file: ${filePath}\n${String(err)}`);
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  ${pc.red('✗')} ${pc.bold(e.path.join('.'))} — ${e.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${pc.yellow(CONFIG_FILE)}:\n${errors}`);
  }

  return result.data;
}

// ─── Interactive Setup Wizard ─────────────────────────────────────────────────

const VIEWPORT_PRESETS: Record<string, Array<{ name: string; width: number; height: number }>> = {
  'desktop':        [{ name: 'desktop', width: 1920, height: 1080 }],
  'mobile':         [{ name: 'mobile',  width: 375,  height: 812  }],
  'desktop+mobile': [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile',  width: 375,  height: 812  },
  ],
  'full': [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet',  width: 768,  height: 1024 },
    { name: 'mobile',  width: 375,  height: 812  },
  ],
};

function toTitleCase(str: string): string {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function checkCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }
  return value as T;
}

export async function runSetupWizard(): Promise<VisualConfig> {
  p.intro(pc.bgMagenta(pc.white(' 🫧  bubble-io-visual-tester — Setup Wizard ')));

  p.log.message(pc.dim('This wizard will create a visual.config.json in your project root.'));
  p.log.message(pc.dim('Press Ctrl+C at any time to cancel.\n'));

  // ── Step 1: URLs ────────────────────────────────────────────────────────────
  const appUrlLive = checkCancel(
    await p.text({
      message: 'Live app URL ' + pc.dim('(baseline source)'),
      placeholder: 'https://myapp.bubbleapps.io',
      validate: (v) => { try { new URL(v); } catch { return 'Must be a valid URL'; } return undefined; },
    }),
  );

  const appUrlTest = checkCancel(
    await p.text({
      message: 'Test app URL ' + pc.dim('(version-test or staging)'),
      placeholder: 'https://myapp.bubbleapps.io/version-test',
      validate: (v) => { try { new URL(v); } catch { return 'Must be a valid URL'; } return undefined; },
    }),
  );

  // ── Step 2: Browsers ────────────────────────────────────────────────────────
  const browsers = checkCancel(
    await p.multiselect<BrowserName>({
      message: 'Browsers to test with ' + pc.dim('(space to select)'),
      options: [
        { value: 'chromium', label: 'Chromium', hint: 'recommended' },
        { value: 'webkit',   label: 'WebKit / Safari' },
        { value: 'firefox',  label: 'Firefox' },
      ] as Array<{ value: BrowserName; label: string; hint?: string }>,
      initialValues: ['chromium'],
      required: true,
    }),
  );

  // ── Step 3: Viewports ───────────────────────────────────────────────────────
  const viewportPreset = checkCancel(
    await p.select({
      message: 'Viewport preset',
      options: [
        { value: 'desktop+mobile', label: 'Desktop + Mobile', hint: '1920×1080 + 375×812' },
        { value: 'full',           label: 'Desktop + Tablet + Mobile', hint: '1920 + 768 + 375' },
        { value: 'desktop',        label: 'Desktop only', hint: '1920×1080' },
        { value: 'mobile',         label: 'Mobile only', hint: '375×812' },
      ],
      initialValue: 'desktop+mobile',
    }),
  );

  // ── Step 4: Pages ───────────────────────────────────────────────────────────
  const pagesInput = checkCancel(
    await p.text({
      message: 'Pages to test ' + pc.dim('(comma-separated paths)'),
      placeholder: '/, /login, /dashboard',
      validate: (v): string | undefined => {
        if (!v.trim()) return 'At least one page path is required';
        const parts = v.split(',').map(x => x.trim()).filter(Boolean);
        const bad = parts.find(part => !part.startsWith('/'));
        if (bad) return `Path "${bad}" must start with /`;
        return undefined;
      },
    }),
  );

  // ── Step 5: Authentication ──────────────────────────────────────────────────
  const authEnabled = checkCancel(
    await p.confirm({
      message: 'Does your app require authentication?',
      initialValue: false,
    }),
  );

  let loginUrl: string | undefined;
  if (authEnabled) {
    loginUrl = checkCancel(
      await p.text({
        message: 'Login page URL',
        placeholder: 'https://myapp.bubbleapps.io/login',
        validate: (v) => { try { new URL(v); } catch { return 'Must be a valid URL'; } return undefined; },
      }),
    );
    p.log.info(`Run ${pc.cyan('bubble-tester auth capture')} to save your session state.`);
  }

  // ── Step 6: Options ─────────────────────────────────────────────────────────
  const thresholdStr = checkCancel(
    await p.text({
      message: 'Pixel mismatch threshold ' + pc.dim('(0.0–1.0, default 0.1 = 10%)'),
      placeholder: '0.1',
      initialValue: '0.1',
      validate: (v): string | undefined => {
        const n = parseFloat(v);
        if (isNaN(n) || n < 0 || n > 1) return 'Must be a number between 0.0 and 1.0';
        return undefined;
      },
    }),
  );

  const fullPage = checkCancel(
    await p.confirm({
      message: 'Capture full scrolling page? ' + pc.dim('(slower, more thorough)'),
      initialValue: false,
    }),
  );

  const failOnMismatch = checkCancel(
    await p.confirm({
      message: 'Exit with code 1 on visual mismatch? ' + pc.dim('(recommended for CI)'),
      initialValue: true,
    }),
  );

  const maskSelectorsStr = checkCancel(
    await p.text({
      message: 'CSS selectors to mask ' + pc.dim('(comma-separated, or leave empty)'),
      placeholder: '.timestamp, .user-avatar, .realtime-chart',
    }),
  );

  // ── Build config object ─────────────────────────────────────────────────────
  const pages = (pagesInput as string)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pagePath => ({
      path: pagePath,
      name: pagePath === '/' ? 'Home' : toTitleCase(pagePath.slice(1)),
    }));

  const maskSelectors = maskSelectorsStr
    ? (maskSelectorsStr as string).split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const config: VisualConfig = {
    appUrlLive:  appUrlLive as string,
    appUrlTest:  appUrlTest as string,
    browsers:    browsers as BrowserName[],
    viewports:   VIEWPORT_PRESETS[viewportPreset as string] ?? VIEWPORT_PRESETS['desktop+mobile'],
    pages,
    auth: {
      enabled:          authEnabled as boolean,
      loginUrl,
      storageStatePath: './auth.json',
    },
    options: {
      threshold:      parseFloat(thresholdStr as string),
      fullPage:        fullPage as boolean,
      failOnMismatch:  failOnMismatch as boolean,
      maskSelectors,
      ignoreRegions:   [],
      concurrency:     3,
    },
  };

  // ── Write to disk ───────────────────────────────────────────────────────────
  const outPath = path.resolve(process.cwd(), CONFIG_FILE);
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf-8');

  p.outro(pc.green(`✓ Config saved → ${pc.bold(CONFIG_FILE)}`));

  return config;
}
