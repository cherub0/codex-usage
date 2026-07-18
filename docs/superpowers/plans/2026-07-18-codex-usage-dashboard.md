# Codex Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Windows-friendly local web dashboard that shows Codex remaining usage from local session metadata, with a clearly labeled demo fallback.

**Architecture:** A small dependency-free Node.js app serves static dashboard assets and a `/api/usage` endpoint. Data reading is isolated in `src/codex-reader.js`, normalization in `src/usage-normalizer.js`, and the browser UI in `public/`.

**Tech Stack:** Node.js 18+, Node built-in `http`, `fs`, `path`, `os`, and `node:test`; browser HTML/CSS/JavaScript with no build step.

## Global Constraints

- Default URL: `http://127.0.0.1:8787`
- Default data source: `%USERPROFILE%\.codex\sessions`
- Default behavior: local-only, read-only, no external network requests
- Primary display mode: remaining quota percentage
- Fallback behavior: demo data with visible `Demo mode` status
- Use a small single-repository Node.js app with no runtime npm dependencies for the first version.
- The API should never return prompt text, assistant responses, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.
- The UI must never appear blank because of missing or changed local data.
- Before pushing to GitHub, confirm repository name, public or private visibility, and remote owner or organization.

---

## File Structure

- `.gitignore`: ignores Node artifacts, logs, local env files, and generated reports.
- `LICENSE`: MIT license.
- `README.md`: user-facing install/run docs, privacy model, limitations, and development commands.
- `package.json`: scripts for `start`, `test`, and `test:watch`; sets CommonJS project metadata.
- `server.js`: dependency-free HTTP server, static file serving, and `/api/usage`.
- `src/usage-normalizer.js`: pure functions for percent, reset, quota-window, and response normalization.
- `src/codex-reader.js`: filesystem scanner and JSONL parser for safe Codex metadata extraction.
- `sample-data/usage.json`: demo response used when real data is unavailable.
- `public/index.html`: dashboard markup.
- `public/styles.css`: polished responsive dashboard styling.
- `public/app.js`: fetches usage JSON, renders quota panels, status, and refresh behavior.
- `test/usage-normalizer.test.js`: unit tests for normalization.
- `test/codex-reader.test.js`: fixture-style reader tests using temporary directories.
- `test/server.test.js`: API and static server smoke tests.

---

### Task 1: Repository Baseline And Demo Contract

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `package.json`
- Create: `sample-data/usage.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `sample-data/usage.json` with dashboard response shape:
  - `mode: "demo" | "live" | "partial" | "format_changed"`
  - `generatedAt: string`
  - `message: string`
  - `windows: Array<{ id, label, remainingPercent, usedPercent, resetAt, resetSeconds, confidence }>`
  - `summary: { source, latestSnapshotAt, scannedFiles, skippedLines, tokenTotals }`

- [ ] **Step 1: Create repository metadata files**

Create `.gitignore`:

```gitignore
node_modules/
npm-debug.log*
.env
.env.*
coverage/
.nyc_output/
dist/
*.log
codex_*_report_*
```

Create `package.json`:

```json
{
  "name": "codex-usage-dashboard",
  "version": "0.1.0",
  "description": "Local-first Codex remaining usage dashboard.",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "test": "node --test",
    "test:watch": "node --test --watch"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT"
}
```

Create `LICENSE` with the MIT license using copyright holder `Codex Usage Dashboard contributors`.

- [ ] **Step 2: Create demo data**

Create `sample-data/usage.json`:

```json
{
  "mode": "demo",
  "generatedAt": "2026-07-18T00:00:00.000Z",
  "message": "Demo mode: no readable Codex rate-limit snapshot was found.",
  "windows": [
    {
      "id": "5h",
      "label": "5-hour window",
      "remainingPercent": 68,
      "usedPercent": 32,
      "resetAt": "2026-07-18T15:30:00.000Z",
      "resetSeconds": null,
      "confidence": "demo"
    },
    {
      "id": "weekly",
      "label": "Weekly window",
      "remainingPercent": 41,
      "usedPercent": 59,
      "resetAt": "2026-07-21T02:00:00.000Z",
      "resetSeconds": null,
      "confidence": "demo"
    }
  ],
  "summary": {
    "source": "sample-data",
    "latestSnapshotAt": null,
    "scannedFiles": 0,
    "skippedLines": 0,
    "tokenTotals": {
      "input": 128400,
      "cachedInput": 84300,
      "output": 21600,
      "total": 150000
    }
  },
  "warnings": [
    "Connect Codex by using it at least once so local session logs contain quota snapshots."
  ]
}
```

- [ ] **Step 3: Write README baseline**

Create `README.md` with:

```markdown
# Codex Usage Dashboard

An unofficial local dashboard for viewing Codex remaining usage from local session metadata.

## Features

- Shows 5-hour and weekly Codex usage windows when local snapshots are available.
- Falls back to clearly labeled demo data instead of rendering a blank screen.
- Runs locally at `http://127.0.0.1:8787` by default.
- Reads local `.codex` session metadata only.
- Uses no runtime npm dependencies.

## Quick Start

```powershell
npm start
```

Open `http://127.0.0.1:8787`.

## Configuration

- `PORT`: server port, default `8787`
- `HOST`: bind host, default `127.0.0.1`
- `CODEX_HOME`: Codex home directory, default `%USERPROFILE%\.codex`
- `CODEX_LOOKBACK_DAYS`: session scan window, default `14`

## Privacy

This tool reads local Codex metadata and does not upload data. It does not display prompts, assistant responses, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.

## Limitations

This is not an official OpenAI tool. Codex local log formats can change, and quota data is available only after Codex writes usable local session snapshots.

## Development

```powershell
npm test
npm start
```

## License

MIT
```

- [ ] **Step 4: Run baseline verification**

Run: `npm test`

Expected: Node test runner starts and reports no tests or all discovered tests passing. If `npm` creates `package-lock.json`, keep it only if npm needs it for scripts; otherwise no dependencies are installed.

- [ ] **Step 5: Commit**

```bash
git add .gitignore LICENSE package.json README.md sample-data/usage.json
git commit -m "chore: add project baseline"
```

---

### Task 2: Usage Normalizer

**Files:**
- Create: `src/usage-normalizer.js`
- Create: `test/usage-normalizer.test.js`

**Interfaces:**
- Produces:
  - `clampPercent(value): number | null`
  - `normalizeWindow(raw, fallbackId): NormalizedWindow | null`
  - `normalizeUsageSnapshot(snapshot, meta, demoUsage): DashboardUsage`

- [ ] **Step 1: Write failing normalizer tests**

Create `test/usage-normalizer.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampPercent,
  normalizeWindow,
  normalizeUsageSnapshot
} = require('../src/usage-normalizer');

test('clampPercent rounds and clamps valid numeric values', () => {
  assert.equal(clampPercent(68.4), 68);
  assert.equal(clampPercent(-4), 0);
  assert.equal(clampPercent(104), 100);
  assert.equal(clampPercent('42.8'), 43);
  assert.equal(clampPercent('nope'), null);
});

test('normalizeWindow converts used percentage into remaining percentage', () => {
  const result = normalizeWindow({
    id: 'primary',
    used_percent: 31.6,
    reset_seconds: 3600
  }, '5h');

  assert.equal(result.id, '5h');
  assert.equal(result.label, '5-hour window');
  assert.equal(result.usedPercent, 32);
  assert.equal(result.remainingPercent, 68);
  assert.equal(result.resetSeconds, 3600);
  assert.equal(result.confidence, 'live');
});

test('normalizeWindow converts remaining percentage into used percentage', () => {
  const result = normalizeWindow({
    name: 'weekly',
    remaining_percent: 44,
    reset_at: '2026-07-21T02:00:00.000Z'
  }, 'weekly');

  assert.equal(result.id, 'weekly');
  assert.equal(result.label, 'Weekly window');
  assert.equal(result.remainingPercent, 44);
  assert.equal(result.usedPercent, 56);
  assert.equal(result.resetAt, '2026-07-21T02:00:00.000Z');
});

test('normalizeUsageSnapshot returns live response for recognizable windows', () => {
  const result = normalizeUsageSnapshot({
    rate_limits: [
      { window: '5h', remaining_percent: 70 },
      { window: 'weekly', used_percent: 25 }
    ],
    token_totals: { input: 10, cachedInput: 2, output: 5, total: 15 }
  }, {
    latestSnapshotAt: '2026-07-18T09:00:00.000Z',
    scannedFiles: 2,
    skippedLines: 1,
    source: 'recent session'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.windows.length, 2);
  assert.equal(result.summary.scannedFiles, 2);
  assert.equal(result.summary.skippedLines, 1);
});

test('normalizeUsageSnapshot returns format_changed when token records exist but quota fields do not', () => {
  const result = normalizeUsageSnapshot({
    token_totals: { input: 10, cachedInput: 0, output: 5, total: 15 }
  }, {
    latestSnapshotAt: '2026-07-18T09:00:00.000Z',
    scannedFiles: 1,
    skippedLines: 0,
    source: 'recent session',
    sawTokenRecords: true,
    unknownRateLimitKeys: ['mystery']
  });

  assert.equal(result.mode, 'format_changed');
  assert.equal(result.windows.length, 0);
  assert.match(result.message, /format/i);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/usage-normalizer.test.js`

Expected: FAIL because `src/usage-normalizer.js` does not exist.

- [ ] **Step 3: Implement normalizer**

Create `src/usage-normalizer.js` with pure normalization helpers. Use these exact exports:

```js
function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeWindowId(raw, fallbackId) {
  const text = String(raw.id || raw.window || raw.name || raw.type || fallbackId || '').toLowerCase();
  if (text.includes('5') || text.includes('primary') || text.includes('hour')) return '5h';
  if (text.includes('week') || text.includes('7d') || text.includes('7-day') || text.includes('weekly')) return 'weekly';
  return fallbackId || text || 'unknown';
}

function labelForWindow(id) {
  if (id === '5h') return '5-hour window';
  if (id === 'weekly') return 'Weekly window';
  return 'Usage window';
}

function pickFirst(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return null;
}

function normalizeWindow(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const id = normalizeWindowId(raw, fallbackId);
  const remainingRaw = pickFirst(raw, ['remainingPercent', 'remaining_percent', 'remaining', 'remaining_pct']);
  const usedRaw = pickFirst(raw, ['usedPercent', 'used_percent', 'used', 'used_pct', 'percent_used']);
  let remainingPercent = clampPercent(remainingRaw);
  let usedPercent = clampPercent(usedRaw);

  if (remainingPercent === null && usedPercent !== null) remainingPercent = 100 - usedPercent;
  if (usedPercent === null && remainingPercent !== null) usedPercent = 100 - remainingPercent;
  if (remainingPercent === null || usedPercent === null) return null;

  const resetAt = pickFirst(raw, ['resetAt', 'reset_at', 'resets_at', 'resetTime']);
  const resetSecondsRaw = pickFirst(raw, ['resetSeconds', 'reset_seconds', 'resets_in_seconds', 'seconds_until_reset']);
  const resetSeconds = resetSecondsRaw === null ? null : Number(resetSecondsRaw);

  return {
    id,
    label: labelForWindow(id),
    remainingPercent,
    usedPercent,
    resetAt: typeof resetAt === 'string' ? resetAt : null,
    resetSeconds: Number.isFinite(resetSeconds) ? resetSeconds : null,
    confidence: raw.confidence || 'live'
  };
}

function extractWindows(snapshot) {
  if (Array.isArray(snapshot.rate_limits)) return snapshot.rate_limits;
  if (snapshot.rate_limits && typeof snapshot.rate_limits === 'object') {
    return Object.entries(snapshot.rate_limits).map(([key, value]) => ({ id: key, ...value }));
  }
  if (Array.isArray(snapshot.windows)) return snapshot.windows;
  return [];
}

function normalizeUsageSnapshot(snapshot, meta = {}, demoUsage = null) {
  const windows = extractWindows(snapshot || {})
    .map((window, index) => normalizeWindow(window, index === 0 ? '5h' : 'weekly'))
    .filter(Boolean);

  const generatedAt = new Date().toISOString();
  const tokenTotals = snapshot?.token_totals || snapshot?.tokenTotals || {
    input: 0,
    cachedInput: 0,
    output: 0,
    total: 0
  };

  if (windows.length > 0) {
    return {
      mode: windows.some((window) => window.confidence === 'partial') ? 'partial' : 'live',
      generatedAt,
      message: 'Live Codex usage snapshot loaded from local session metadata.',
      windows,
      summary: {
        source: meta.source || 'local Codex sessions',
        latestSnapshotAt: meta.latestSnapshotAt || null,
        scannedFiles: meta.scannedFiles || 0,
        skippedLines: meta.skippedLines || 0,
        tokenTotals
      },
      warnings: meta.warnings || []
    };
  }

  if (meta.sawTokenRecords) {
    return {
      mode: 'format_changed',
      generatedAt,
      message: 'Codex session metadata was found, but the quota format was not recognized.',
      windows: [],
      summary: {
        source: meta.source || 'local Codex sessions',
        latestSnapshotAt: meta.latestSnapshotAt || null,
        scannedFiles: meta.scannedFiles || 0,
        skippedLines: meta.skippedLines || 0,
        tokenTotals,
        unknownRateLimitKeys: meta.unknownRateLimitKeys || []
      },
      warnings: ['Data format changed. The dashboard avoided displaying guessed quota values.']
    };
  }

  if (demoUsage) {
    return {
      ...demoUsage,
      generatedAt,
      summary: {
        ...demoUsage.summary,
        scannedFiles: meta.scannedFiles || demoUsage.summary.scannedFiles || 0,
        skippedLines: meta.skippedLines || demoUsage.summary.skippedLines || 0
      }
    };
  }

  return {
    mode: 'demo',
    generatedAt,
    message: 'Demo mode: no readable Codex rate-limit snapshot was found.',
    windows: [],
    summary: {
      source: 'demo',
      latestSnapshotAt: null,
      scannedFiles: meta.scannedFiles || 0,
      skippedLines: meta.skippedLines || 0,
      tokenTotals
    },
    warnings: ['Use Codex at least once so local sessions contain quota snapshots.']
  };
}

module.exports = {
  clampPercent,
  normalizeWindow,
  normalizeUsageSnapshot
};
```

- [ ] **Step 4: Run normalizer tests**

Run: `npm test -- test/usage-normalizer.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/usage-normalizer.js test/usage-normalizer.test.js
git commit -m "feat: normalize Codex usage snapshots"
```

---

### Task 3: Codex Session Reader

**Files:**
- Create: `src/codex-reader.js`
- Create: `test/codex-reader.test.js`

**Interfaces:**
- Consumes: `normalizeUsageSnapshot(snapshot, meta, demoUsage)`
- Produces:
  - `findSessionFiles(sessionsDir, lookbackDays): Promise<string[]>`
  - `readLatestUsageSnapshot(options): Promise<DashboardUsage>`

- [ ] **Step 1: Write failing reader tests**

Create `test/codex-reader.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readLatestUsageSnapshot } = require('../src/codex-reader');

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'codex-usage-reader-'));
}

test('readLatestUsageSnapshot extracts latest rate limit snapshot', async () => {
  const root = await makeTempDir();
  const sessionsDir = path.join(root, 'sessions', '2026', '07', '18');
  await fs.mkdir(sessionsDir, { recursive: true });
  const file = path.join(sessionsDir, 'rollout-test.jsonl');
  await fs.writeFile(file, [
    JSON.stringify({ type: 'token_count', token_count: { input_tokens: 10, output_tokens: 5 } }),
    JSON.stringify({
      type: 'token_count',
      timestamp: '2026-07-18T10:00:00.000Z',
      token_count: {
        input_tokens: 100,
        cached_input_tokens: 40,
        output_tokens: 20,
        rate_limits: [
          { window: '5h', remaining_percent: 66, reset_seconds: 1200 },
          { window: 'weekly', used_percent: 48, reset_at: '2026-07-21T02:00:00.000Z' }
        ]
      }
    })
  ].join('\n'));

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage: null,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.windows.length, 2);
  assert.equal(result.windows[0].remainingPercent, 66);
  assert.equal(result.summary.tokenTotals.total, 120);
});

test('readLatestUsageSnapshot skips malformed lines and returns format_changed for unknown quota metadata', async () => {
  const root = await makeTempDir();
  const sessionsDir = path.join(root, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(path.join(sessionsDir, 'session.jsonl'), [
    '{bad json',
    JSON.stringify({
      type: 'token_count',
      timestamp: '2026-07-18T10:00:00.000Z',
      token_count: {
        input_tokens: 12,
        output_tokens: 8,
        rate_limits: [{ mystery_percent: 77 }]
      }
    })
  ].join('\n'));

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage: null,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'format_changed');
  assert.equal(result.summary.skippedLines, 1);
});

test('readLatestUsageSnapshot returns demo usage when sessions directory is missing', async () => {
  const root = await makeTempDir();
  const demoUsage = {
    mode: 'demo',
    generatedAt: '2026-07-18T00:00:00.000Z',
    message: 'Demo mode',
    windows: [],
    summary: { source: 'sample-data', latestSnapshotAt: null, scannedFiles: 0, skippedLines: 0, tokenTotals: { input: 0, cachedInput: 0, output: 0, total: 0 } },
    warnings: []
  };

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'demo');
  assert.equal(result.summary.source, 'sample-data');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/codex-reader.test.js`

Expected: FAIL because `src/codex-reader.js` does not exist.

- [ ] **Step 3: Implement reader**

Create `src/codex-reader.js` with recursive scanning, JSONL parsing, and safe metadata extraction. It should:

- Resolve sessions directory as `path.join(codexHome, 'sessions')`.
- Recursively find `.jsonl` files.
- Sort candidates by file modified time descending.
- Parse each line with `JSON.parse`, skipping malformed lines.
- Treat records with `token_count` as safe metadata.
- Convert token fields:
  - `input_tokens` or `input` -> `input`
  - `cached_input_tokens` or `cachedInput` -> `cachedInput`
  - `output_tokens` or `output` -> `output`
  - `total_tokens` or computed input + output -> `total`
- Pass latest snapshot and meta into `normalizeUsageSnapshot`.

- [ ] **Step 4: Run reader tests**

Run: `npm test -- test/codex-reader.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/codex-reader.js test/codex-reader.test.js
git commit -m "feat: read local Codex usage snapshots"
```

---

### Task 4: Local HTTP Server

**Files:**
- Create: `server.js`
- Create: `test/server.test.js`
- Modify: `src/codex-reader.js` only if needed to support dependency injection for tests.

**Interfaces:**
- Consumes: `readLatestUsageSnapshot({ codexHome, demoUsage, lookbackDays })`
- Produces:
  - `createServer(options): http.Server`
  - `startServer(options): http.Server`

- [ ] **Step 1: Write failing server tests**

Create `test/server.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test('server returns usage JSON', async () => {
  const server = createServer({
    readUsage: async () => ({
      mode: 'demo',
      generatedAt: new Date().toISOString(),
      message: 'Demo',
      windows: [],
      summary: { source: 'test', latestSnapshotAt: null, scannedFiles: 0, skippedLines: 0, tokenTotals: { input: 0, cachedInput: 0, output: 0, total: 0 } },
      warnings: []
    })
  });
  const baseUrl = await listen(server);
  const response = await fetch(`${baseUrl}/api/usage`);
  const json = await response.json();
  server.close();

  assert.equal(response.status, 200);
  assert.equal(json.mode, 'demo');
  assert.equal(response.headers.get('content-type').includes('application/json'), true);
});

test('server serves index html', async () => {
  const server = createServer({ readUsage: async () => ({}) });
  const baseUrl = await listen(server);
  const response = await fetch(`${baseUrl}/`);
  const text = await response.text();
  server.close();

  assert.equal(response.status, 200);
  assert.match(text, /Codex Usage/i);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/server.test.js`

Expected: FAIL because `server.js` and `public/index.html` do not exist.

- [ ] **Step 3: Implement server**

Create `server.js` with:

- MIME map for `.html`, `.css`, `.js`, `.json`, `.svg`, `.ico`.
- Static serving from `public/`.
- `/api/usage` route returning JSON.
- `createServer` export for tests.
- `startServer` export and direct-run behavior for `npm start`.
- Environment defaults:
  - `HOST=127.0.0.1`
  - `PORT=8787`
  - `CODEX_HOME=path.join(os.homedir(), '.codex')`
  - `CODEX_LOOKBACK_DAYS=14`

- [ ] **Step 4: Add minimal static index**

Create `public/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Codex Usage Dashboard</title>
  </head>
  <body>
    <main>
      <h1>Codex Usage Dashboard</h1>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Run server tests**

Run: `npm test -- test/server.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.js public/index.html test/server.test.js
git commit -m "feat: serve local usage API"
```

---

### Task 5: Dashboard UI

**Files:**
- Modify: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

**Interfaces:**
- Consumes: `GET /api/usage` dashboard response shape from Task 1.
- Produces: Responsive dashboard UI that renders live, demo, partial, and format-changed states.

- [ ] **Step 1: Replace HTML with dashboard structure**

Update `public/index.html` to include:

- Header with app title, status pill, last refresh, and refresh button.
- Empty containers with IDs:
  - `status-pill`
  - `last-refresh`
  - `quota-grid`
  - `source-summary`
  - `token-summary`
  - `warnings`
- Links to `styles.css` and `app.js`.

- [ ] **Step 2: Implement browser rendering**

Create `public/app.js` with functions:

- `fetchUsage()`
- `renderUsage(data)`
- `renderWindowCard(window)`
- `formatPercent(value)`
- `formatReset(window)`
- `renderError(error)`

Behavior:

- Fetch `/api/usage` on load.
- Refresh when the button is clicked.
- Show demo and format-changed states visibly.
- Never render raw transcript content.
- Render empty quota state with clear message if `windows` is empty.

- [ ] **Step 3: Implement polished CSS**

Create `public/styles.css` with:

- Neutral dashboard background.
- Responsive grid layout.
- Circular quota ring using `conic-gradient`.
- Distinct status colors:
  - live: green/cyan
  - partial: amber
  - demo: rose/amber
  - format_changed: rose
- Mobile layout where cards stack cleanly.
- No text overlap at widths down to 360px.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Start local server for manual inspection**

Run: `npm start`

Expected: terminal prints local URL `http://127.0.0.1:8787`. Open it in a browser and confirm the dashboard is visually complete.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/styles.css public/app.js
git commit -m "feat: add polished dashboard UI"
```

---

### Task 6: End-To-End Verification And GitHub Readiness

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-18-codex-usage-dashboard-design.md` only if implementation reveals a documented mismatch.

**Interfaces:**
- Consumes: complete app from Tasks 1-5.
- Produces: verified local app and GitHub-ready repository.

- [ ] **Step 1: Run full automated verification**

Run: `npm test`

Expected: PASS for normalizer, reader, and server tests.

- [ ] **Step 2: Run demo-mode verification**

Run in PowerShell:

```powershell
$env:CODEX_HOME="$PWD\test-empty-codex"
npm start
```

Expected: dashboard loads and clearly shows `Demo mode`.

Stop the server and remove `test-empty-codex` after inspection.

- [ ] **Step 3: Run default local verification**

Run:

```powershell
Remove-Item Env:\CODEX_HOME -ErrorAction SilentlyContinue
npm start
```

Expected: dashboard loads at `http://127.0.0.1:8787`; if real Codex snapshots are present, live or format-changed state appears; if not, demo state appears.

- [ ] **Step 4: Privacy spot check**

Run:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/usage | ConvertTo-Json -Depth 8
```

Expected: JSON contains no prompt text, assistant text, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.

- [ ] **Step 5: Update README with final screenshots note omitted**

Update README if needed so quick start, config, privacy, tests, and limitations match the implemented behavior. Do not add screenshots unless an actual screenshot file exists in the repository.

- [ ] **Step 6: Final commit**

```bash
git add README.md docs/superpowers/specs/2026-07-18-codex-usage-dashboard-design.md
git commit -m "docs: finalize dashboard usage docs"
```

If no documentation changes are needed, skip the commit and state that no final docs commit was necessary.

- [ ] **Step 7: Report GitHub publication choices**

Ask the user for:

- repository name
- public or private visibility
- GitHub owner or organization

Do not create or push a GitHub remote until those are confirmed.
