# Configuration Reference — `visual.config.json`

This document covers every configuration option available in `visual.config.json` in detail.

---

## Full Example

```jsonc
{
  "appUrlLive":  "https://myapp.bubbleapps.io",
  "appUrlTest":  "https://myapp.bubbleapps.io/version-test",
  "browsers":    ["chromium"],
  "viewports": [
    { "name": "desktop", "width": 1920, "height": 1080 },
    { "name": "tablet",  "width": 768,  "height": 1024 },
    { "name": "mobile",  "width": 375,  "height": 812  }
  ],
  "pages": [
    { "path": "/", "name": "Home" },
    {
      "path":            "/dashboard",
      "name":            "Dashboard",
      "waitForSelector": ".dashboard-content",
      "waitForTimeout":  1500
    }
  ],
  "auth": {
    "enabled":          true,
    "loginUrl":         "https://myapp.bubbleapps.io/login",
    "storageStatePath": "./auth.json"
  },
  "options": {
    "threshold":      0.1,
    "maskSelectors":  [".timestamp", ".user-avatar", ".live-chart"],
    "failOnMismatch": true,
    "fullPage":       false,
    "concurrency":    3
  }
}
```

---

## Top-Level Fields

### `appUrlLive` *(string, required)*

The URL of your **production / live** Bubble app. This is used as the **baseline source** — the reference point that all future tests are compared against.

```json
"appUrlLive": "https://myapp.bubbleapps.io"
```

> ⚠️ Make sure this URL is accessible without authentication, or that `auth` is configured correctly.

---

### `appUrlTest` *(string, required)*

The URL of your **test / staging** environment. This is the app state that will be compared against the baseline.

For Bubble apps, this is usually the `version-test` URL:

```json
"appUrlTest": "https://myapp.bubbleapps.io/version-test"
```

---

### `browsers` *(string[], required — min 1)*

Which browser engines to run tests in. Each browser runs a **separate pass** across all pages and viewports.

```json
"browsers": ["chromium", "webkit", "firefox"]
```

| Value | Engine | Notes |
|---|---|---|
| `"chromium"` | Playwright Chromium | Recommended, fastest |
| `"webkit"` | WebKit (Safari-like) | Good for iOS/Safari testing |
| `"firefox"` | Firefox | Additional coverage |

> Each additional browser multiplies test count and run time.

---

### `viewports` *(array, required — min 1)*

Defines the screen sizes to capture. Each entry must have `name`, `width`, and `height`.

```json
"viewports": [
  { "name": "desktop", "width": 1920, "height": 1080 },
  { "name": "mobile",  "width": 375,  "height": 812  }
]
```

The `name` is used in snapshot filenames and the HTML report.

**Common sizes:**

| Name | Width | Height | Use case |
|---|---|---|---|
| `desktop` | 1920 | 1080 | Full HD desktop |
| `laptop` | 1280 | 800 | Smaller laptop |
| `tablet` | 768 | 1024 | iPad portrait |
| `mobile` | 375 | 812 | iPhone X |
| `mobile-sm` | 320 | 568 | iPhone SE |

> When using the **Setup Wizard**, you can choose a preset that auto-populates this field.

---

### `pages` *(array, required — min 1)*

Defines which pages to capture. Each entry must have a `path`. `name` is optional (auto-generated from path if omitted).

```json
"pages": [
  { "path": "/",          "name": "Home" },
  { "path": "/login",     "name": "Login" },
  { "path": "/dashboard", "name": "Dashboard" }
]
```

#### Page Options

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | ✅ | URL path (must start with `/`) |
| `name` | string | ❌ | Human-readable label (defaults to title-cased path) |
| `waitForSelector` | string | ❌ | CSS selector to wait for before screenshotting |
| `waitForTimeout` | number | ❌ | Additional wait in ms after navigation settles |

#### `waitForSelector` — Recommended for Dynamic Bubble Pages

Bubble Repeating Groups and API-driven pages may appear blank briefly after load. Use `waitForSelector` to wait for a key element:

```json
{
  "path": "/dashboard",
  "name": "Dashboard",
  "waitForSelector": "[data-type='repeating-group-item']",
  "waitForTimeout":  1000
}
```

---

## `auth` Object

Controls authentication for protected pages.

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | boolean | ✅ | Set `true` to use saved auth state |
| `loginUrl` | string | ❌ | URL of your login page (needed for `auth capture`) |
| `storageStatePath` | string | ✅ | Path to the saved session file |

```json
"auth": {
  "enabled":          true,
  "loginUrl":         "https://myapp.bubbleapps.io/login",
  "storageStatePath": "./auth.json"
}
```

> See [AUTH.md](./AUTH.md) for the full authentication guide.

---

## `options` Object

### `threshold` *(number, 0.0–1.0, default: `0.1`)*

Per-pixel color sensitivity. A pixel is counted as "different" only if its color difference exceeds this value.

The test **fails** if the proportion of changed pixels also exceeds this value.

```json
"threshold": 0.05
```

| Value | Meaning |
|---|---|
| `0.0` | Strictest — any color difference counts |
| `0.1` | Default — 10% color tolerance per pixel |
| `0.2` | Lenient — useful for anti-aliasing heavy fonts |
| `0.5` | Very lenient — only major layout changes detected |

> **Tip**: Start with `0.1`. If you get too many false positives from font rendering or anti-aliasing, raise to `0.15`.

---

### `maskSelectors` *(string[], default: `[]`)*

CSS selectors for elements that should be masked with a solid grey rectangle before screenshotting. Use this for elements that legitimately change between runs.

```json
"maskSelectors": [
  ".timestamp",
  ".user-avatar",
  ".realtime-chart",
  "[data-type='countdown']"
]
```

Common candidates in Bubble apps:
- Timestamps and "time ago" labels
- User profile pictures (loaded from external URLs)
- Live data charts
- Countdown timers
- Ads or embedded third-party widgets

---

### `failOnMismatch` *(boolean, default: `false`)*

If `true`, the process exits with **code `1`** when any test fails. This blocks CI/CD pipelines.

```json
"failOnMismatch": true
```

> Set to `true` in CI. Leave `false` locally for exploratory runs.

---

### `fullPage` *(boolean, default: `false`)*

If `true`, captures the entire scrollable page height, not just the visible viewport.

```json
"fullPage": true
```

> ⚠️ Full-page captures are slower and produce larger files. Recommended only if your critical UI is below the fold.

---

### `concurrency` *(number, 1–10, default: `3`)*

Maximum number of browser page captures running in parallel. Higher values speed up runs with many pages/viewports but consume more memory.

```json
"concurrency": 5
```

| Value | Use case |
|---|---|
| `1` | Low memory (< 4 GB RAM), debugging |
| `3` | Default — good balance |
| `5` | Fast machines with 8+ GB RAM |
| `10` | High-end CI runners |

---

## Multiple Config Files

You can maintain separate configs for different scenarios:

```bash
# Mobile-only quick check
node dist/index.js test --config ./configs/mobile.config.json

# Full cross-browser suite
node dist/index.js test --config ./configs/full.config.json
```

Example `configs/mobile.config.json`:
```json
{
  "appUrlLive": "https://myapp.bubbleapps.io",
  "appUrlTest": "https://myapp.bubbleapps.io/version-test",
  "browsers":   ["chromium"],
  "viewports":  [{ "name": "mobile", "width": 375, "height": 812 }],
  "pages":      [{ "path": "/", "name": "Home" }],
  "auth":       { "enabled": false, "storageStatePath": "./auth.json" },
  "options":    { "threshold": 0.1, "maskSelectors": [], "failOnMismatch": true, "fullPage": false, "concurrency": 2 }
}
```
