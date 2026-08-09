# Authentication Guide

This guide explains how to test Bubble.io pages that require a user to be logged in.

---

## How It Works

Playwright supports saving and restoring browser session state (cookies, localStorage, sessionStorage) to a JSON file. This tool uses this feature to authenticate once and reuse the session across all test runs.

```
bubble-tester auth capture
        │
        ▼
  Playwright opens a VISIBLE browser window
        │
        ▼
  You log in manually in that window
        │
        ▼
  You press Enter in the terminal
        │
        ▼
  Session state saved → auth.json
        │
        ▼
  Future runs load auth.json automatically
```

---

## Step-by-Step Setup

### 1. Enable auth in your config

Edit `visual.config.json`:

```json
"auth": {
  "enabled":          true,
  "loginUrl":         "https://myapp.bubbleapps.io/login",
  "storageStatePath": "./auth.json"
}
```

Or re-run the Setup Wizard (`node dist/index.js setup`) and answer **Yes** to the authentication question.

---

### 2. Capture your session

```bash
node dist/index.js auth capture
```

A **visible browser window** will open and navigate to your `loginUrl`. Log in as the user you want to use for testing. Once you are fully logged in and can see the app, go back to the terminal and press **Enter**.

The session is saved to `auth.json`.

---

### 3. Run tests normally

```bash
node dist/index.js baseline
node dist/index.js test
```

Both commands will automatically load `auth.json` and inject the session into every browser context before navigating to any page.

---

## Important Security Notes

> ⚠️ **Never commit `auth.json` to version control.**

The file contains your session cookies and localStorage data. Anyone with this file can access your Bubble app as the test user.

`auth.json` is already listed in `.gitignore` by default.

---

## Using Auth in CI/CD

For CI environments, you have two options:

### Option A: Store as a CI Secret (Recommended)

1. Capture `auth.json` locally
2. Base64-encode it:
   ```bash
   # On macOS/Linux:
   base64 -i auth.json
   # On Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("auth.json"))
   ```
3. Add the base64 string as a repository secret (e.g. `BUBBLE_AUTH_STATE`)
4. Decode it in your CI workflow before running tests:

   ```yaml
   - name: Restore auth session
     run: |
       echo "${{ secrets.BUBBLE_AUTH_STATE }}" | base64 --decode > auth.json
   
   - name: Run visual tests
     run: node dist/index.js test --no-open
   ```

### Option B: Public / Guest Pages Only

If your test pages don't require authentication, set `auth.enabled: false` in your config and skip the `auth capture` step entirely.

---

## Session Expiry

Bubble sessions typically last several days to weeks depending on your app's settings. If tests start failing with login redirects, simply re-run `auth capture` to refresh the session.

---

## Testing Multiple User Roles

You can maintain separate auth files for different roles:

```json
"auth": {
  "enabled":          true,
  "loginUrl":         "https://myapp.bubbleapps.io/login",
  "storageStatePath": "./auth-admin.json"
}
```

```bash
node dist/index.js baseline --config configs/admin.config.json
node dist/index.js test     --config configs/admin.config.json
```
