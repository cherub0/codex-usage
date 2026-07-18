# Codex Usage Floating Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Codex Usage Dashboard into a Windows Electron floating window that appears when Codex is running and shows only Chinese capacity, token consumption, and current task progress.

**Architecture:** Add an Electron shell around the existing local-first Node data readers. The Electron main process owns the always-on-top frameless window, process monitoring, and IPC; the preload exposes a narrow renderer API; the renderer becomes a compact Chinese macOS-style widget.

**Tech Stack:** Node.js 18+, Electron, Node built-in `node:test`, PowerShell process inspection on Windows, optional local SQLite inspection via `node:child_process` calling available system tooling or safe fallback.

## Global Constraints

- The app becomes an Electron desktop app for Windows.
- Shows the floating window when Codex is detected.
- Hides the floating window when Codex is not detected.
- Keeps the app process alive while hidden so it can reappear when Codex starts again.
- Uses an always-on-top, frameless, draggable floating window.
- The UI is Chinese.
- Only the three Chinese UI sections are shown: `容量`, `Token 消耗`, and `当前任务`.
- Read local Codex files only.
- Do not modify `.codex` files.
- Do not upload usage, task, or process data.
- Do not call OpenAI, ChatGPT, GitHub, or other external services at runtime.
- Do not expose Node.js directly to the renderer.
- Never return prompt text, assistant responses, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.
- Work continues on `main` because the user explicitly requested direct main-branch modifications earlier.
- Push to `origin/main` after tests and manual checks pass, unless the user redirects.

---

## File Structure

- `package.json`: add Electron dependency and scripts `app`, `app:dev`, and keep `start` for the local web dashboard.
- `electron/main.js`: Electron lifecycle, floating window creation, IPC, and Codex process visibility loop.
- `electron/preload.js`: context-bridge API exposing `getUsage`, `getTask`, and `getSnapshot`.
- `src/process-monitor.js`: pure process matching plus Windows process-list command wrapper.
- `src/task-reader.js`: safe local Codex task metadata reader with SQLite CLI fallback and no transcript exposure.
- `src/desktop-snapshot.js`: combines usage and task data into the renderer shape.
- `public/index.html`: compact widget markup only.
- `public/app.js`: renderer calls preload API when available and falls back to `/api/usage` for browser development.
- `public/styles.css`: macOS-style floating widget CSS.
- `test/process-monitor.test.js`: process matching tests.
- `test/task-reader.test.js`: task/progress normalization tests with safe fake rows.
- `test/desktop-snapshot.test.js`: combined data-shape tests.
- `README.md`: document Electron app mode, Chinese widget, process-trigger behavior, and development commands.

---

### Task 1: Electron Dependency And Scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces npm scripts:
  - `npm run app`: launches Electron normally.
  - `npm run app:dev`: launches Electron with `CODEX_USAGE_FORCE_SHOW=1` so the floating window appears even when Codex is not detected.

- [ ] **Step 1: Update package metadata**

Modify `package.json` to include:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "start": "node server.js",
    "app": "electron .",
    "app:dev": "cross-env CODEX_USAGE_FORCE_SHOW=1 electron .",
    "test": "node --test",
    "test:watch": "node --test --watch"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "electron": "^31.7.7"
  }
}
```

Keep existing fields such as `name`, `version`, `description`, `private`, `type`, `engines`, and `license`.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created or updated, and `node_modules/` remains ignored.

- [ ] **Step 3: Update ignore rules**

Ensure `.gitignore` includes:

```gitignore
node_modules/
out/
release/
*.asar
```

- [ ] **Step 4: Update README command summary**

Add a short section to `README.md`:

```markdown
## Windows Floating Window

```powershell
npm install
npm run app
```

The Electron app watches for a local Codex process. When Codex is detected, it shows an always-on-top Chinese floating window. For development without a running Codex process:

```powershell
npm run app:dev
```
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: existing 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore README.md
git commit -m "chore: add Electron app scripts"
```

---

### Task 2: Process Monitor

**Files:**
- Create: `src/process-monitor.js`
- Create: `test/process-monitor.test.js`

**Interfaces:**
- Produces:
  - `isCodexProcessName(name: string): boolean`
  - `parseWindowsProcessList(stdout: string): Array<{ name: string, pid: number | null }>`
  - `hasCodexProcess(processes: Array<{ name: string }>): boolean`
  - `getWindowsProcesses(): Promise<Array<{ name: string, pid: number | null }>>`
  - `isCodexRunning(): Promise<boolean>`

- [ ] **Step 1: Write failing process monitor tests**

Create `test/process-monitor.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCodexProcessName,
  parseWindowsProcessList,
  hasCodexProcess
} = require('../src/process-monitor');

test('isCodexProcessName matches narrow Codex process names', () => {
  assert.equal(isCodexProcessName('codex.exe'), true);
  assert.equal(isCodexProcessName('Codex.exe'), true);
  assert.equal(isCodexProcessName('OpenAI Codex.exe'), true);
  assert.equal(isCodexProcessName('codex-cli.exe'), true);
  assert.equal(isCodexProcessName('my-codex-notes.exe'), false);
  assert.equal(isCodexProcessName('node.exe'), false);
});

test('parseWindowsProcessList extracts process names and pids from csv', () => {
  const stdout = [
    '"Name","ProcessId"',
    '"Code.exe","100"',
    '"codex.exe","200"',
    '"node.exe","300"'
  ].join('\\r\\n');

  assert.deepEqual(parseWindowsProcessList(stdout), [
    { name: 'Code.exe', pid: 100 },
    { name: 'codex.exe', pid: 200 },
    { name: 'node.exe', pid: 300 }
  ]);
});

test('hasCodexProcess returns true only for matching process rows', () => {
  assert.equal(hasCodexProcess([{ name: 'node.exe' }, { name: 'codex.exe' }]), true);
  assert.equal(hasCodexProcess([{ name: 'node.exe' }, { name: 'chrome.exe' }]), false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/process-monitor.test.js`

Expected: FAIL because `src/process-monitor.js` does not exist.

- [ ] **Step 3: Implement process monitor**

Create `src/process-monitor.js` with:

- `isCodexProcessName` matching lowercased names exactly or near-exactly:
  - `codex`
  - `codex.exe`
  - `codex-cli`
  - `codex-cli.exe`
  - `openai codex`
  - `openai codex.exe`
- CSV parsing for `Get-CimInstance Win32_Process | Select-Object Name,ProcessId | ConvertTo-Csv -NoTypeInformation`.
- `getWindowsProcesses` using `child_process.execFile('powershell.exe', ['-NoProfile', '-Command', <command>])`.
- `isCodexRunning` returning false on command failure.

- [ ] **Step 4: Run process monitor tests**

Run: `npm test -- test/process-monitor.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/process-monitor.js test/process-monitor.test.js
git commit -m "feat: detect Codex process"
```

---

### Task 3: Task Reader And Progress Normalization

**Files:**
- Create: `src/task-reader.js`
- Create: `test/task-reader.test.js`

**Interfaces:**
- Produces:
  - `normalizeTaskRow(row: object): TaskState`
  - `createUnavailableTask(reason: string): TaskState`
  - `readCurrentTask(options?: { codexHome?: string }): Promise<TaskState>`
- `TaskState` shape:
  - `title: string`
  - `status: string`
  - `progressPercent: number`
  - `confidence: "真实" | "推断" | "暂无"`
  - `updatedAt: string | null`
  - `message: string`

- [ ] **Step 1: Write failing task-reader tests**

Create `test/task-reader.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTaskRow,
  createUnavailableTask
} = require('../src/task-reader');

test('normalizeTaskRow uses explicit progress and status when available', () => {
  const task = normalizeTaskRow({
    title: '实现悬浮窗',
    status: 'running',
    progress: 64,
    updated_at: '2026-07-18T10:00:00.000Z'
  });

  assert.equal(task.title, '实现悬浮窗');
  assert.equal(task.status, '运行中');
  assert.equal(task.progressPercent, 64);
  assert.equal(task.confidence, '真实');
});

test('normalizeTaskRow infers progress from archived marker', () => {
  const task = normalizeTaskRow({
    name: '整理 README',
    archived: 1,
    updated_at: '2026-07-18T09:00:00.000Z'
  });

  assert.equal(task.title, '整理 README');
  assert.equal(task.status, '已完成');
  assert.equal(task.progressPercent, 100);
  assert.equal(task.confidence, '推断');
});

test('normalizeTaskRow returns safe fallback title without transcript content', () => {
  const task = normalizeTaskRow({
    prompt: 'secret prompt should not appear',
    updated_at: '2026-07-18T09:00:00.000Z'
  });

  assert.equal(task.title, '最近 Codex 任务');
  assert.equal(task.confidence, '推断');
  assert.equal(task.title.includes('secret'), false);
});

test('createUnavailableTask returns Chinese unavailable state', () => {
  const task = createUnavailableTask('state_5.sqlite not found');
  assert.equal(task.title, '暂无任务数据');
  assert.equal(task.status, '暂无');
  assert.equal(task.progressPercent, 0);
  assert.equal(task.confidence, '暂无');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/task-reader.test.js`

Expected: FAIL because `src/task-reader.js` does not exist.

- [ ] **Step 3: Implement task-reader normalization**

Create `src/task-reader.js` with:

- `normalizeStatus(value)` mapping:
  - `running`, `active`, `in_progress` -> `运行中`
  - `queued`, `pending`, `waiting` -> `等待中`
  - `done`, `complete`, `completed`, `archived` -> `已完成`
  - `idle` -> `空闲`
  - missing -> `推断中`
- `normalizeTaskRow(row)` selecting safe title from `title`, `name`, `summary`, `workspace`, not from `prompt`, `message`, `response`, `diff`, or command fields.
- Clamp progress to `0..100`.
- If explicit progress exists, confidence `真实`.
- If archived/completed marker exists, progress `100`, confidence `推断`.
- If no explicit progress, progress `35` for running/active, `15` for waiting/pending, `5` otherwise, confidence `推断`.
- `createUnavailableTask(reason)`.
- `readCurrentTask` checks for `%USERPROFILE%\.codex\state_5.sqlite` and returns unavailable if missing. Add a narrow implementation that can be extended later; do not block the UI when SQLite tools are unavailable.

- [ ] **Step 4: Run task-reader tests**

Run: `npm test -- test/task-reader.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/task-reader.js test/task-reader.test.js
git commit -m "feat: normalize Codex task progress"
```

---

### Task 4: Desktop Snapshot Aggregator

**Files:**
- Create: `src/desktop-snapshot.js`
- Create: `test/desktop-snapshot.test.js`

**Interfaces:**
- Consumes:
  - `readLatestUsageSnapshot({ codexHome, demoUsage, lookbackDays })`
  - `readCurrentTask({ codexHome })`
- Produces:
  - `createDesktopSnapshot(options): Promise<{ usage, task, generatedAt }>`

- [ ] **Step 1: Write failing desktop snapshot test**

Create `test/desktop-snapshot.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesktopSnapshot } = require('../src/desktop-snapshot');

test('createDesktopSnapshot combines usage and task data without transcript fields', async () => {
  const snapshot = await createDesktopSnapshot({
    readUsage: async () => ({
      mode: 'demo',
      windows: [{ id: '5h', label: '5-hour window', remainingPercent: 68, usedPercent: 32, confidence: 'demo' }],
      summary: { tokenTotals: { input: 10, cachedInput: 2, output: 4, total: 14 } },
      warnings: []
    }),
    readTask: async () => ({
      title: '实现悬浮窗',
      status: '运行中',
      progressPercent: 50,
      confidence: '真实',
      updatedAt: null,
      message: ''
    })
  });

  assert.equal(snapshot.usage.windows[0].remainingPercent, 68);
  assert.equal(snapshot.task.title, '实现悬浮窗');
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'prompt'), false);
  assert.equal(typeof snapshot.generatedAt, 'string');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/desktop-snapshot.test.js`

Expected: FAIL because `src/desktop-snapshot.js` does not exist.

- [ ] **Step 3: Implement aggregator**

Create `src/desktop-snapshot.js`:

- Load `sample-data/usage.json`.
- Resolve `codexHome` from option, `CODEX_HOME`, or `os.homedir()/.codex`.
- Call usage reader and task reader.
- Return only `{ usage, task, generatedAt }`.
- Accept dependency injection `readUsage` and `readTask` for tests.

- [ ] **Step 4: Run snapshot tests**

Run: `npm test -- test/desktop-snapshot.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/desktop-snapshot.js test/desktop-snapshot.test.js
git commit -m "feat: combine desktop usage snapshot"
```

---

### Task 5: Electron Shell And IPC

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`

**Interfaces:**
- Consumes:
  - `isCodexRunning()`
  - `createDesktopSnapshot()`
- Produces renderer API:
  - `window.codexUsage.getSnapshot(): Promise<DesktopSnapshot>`
  - `window.codexUsage.getProcessState(): Promise<{ codexRunning: boolean }>`

- [ ] **Step 1: Create Electron preload**

Create `electron/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexUsage', {
  getSnapshot: () => ipcRenderer.invoke('codex-usage:get-snapshot'),
  getProcessState: () => ipcRenderer.invoke('codex-usage:get-process-state')
});
```

- [ ] **Step 2: Create Electron main process**

Create `electron/main.js` with:

- `BrowserWindow` width `360`, height `520`, transparent, frameless, resizable false.
- `alwaysOnTop: true`.
- `webPreferences.preload` set to `electron/preload.js`.
- IPC handlers for snapshot and process state.
- Visibility loop every `3000ms`.
- `CODEX_USAGE_FORCE_SHOW=1` override for development.
- Load `public/index.html`.
- Hide instead of quit when Codex is absent.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Launch dev Electron window**

Run: `npm run app:dev`

Expected: floating window opens even if Codex is not detected. Confirm no Node integration warnings from renderer code.

- [ ] **Step 5: Commit**

```bash
git add electron/main.js electron/preload.js
git commit -m "feat: add Electron floating shell"
```

---

### Task 6: Chinese Floating Window Renderer

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

**Interfaces:**
- Consumes:
  - `window.codexUsage.getSnapshot()` when running in Electron.
  - `/api/usage` fallback when running in browser.
- Produces: Chinese compact UI with only `容量`, `Token 消耗`, and `当前任务`.

- [ ] **Step 1: Replace HTML structure**

Update `public/index.html` to contain:

- macOS control dots.
- Drag header with title `Codex 用量`.
- Section containers:
  - `capacity-section`
  - `tokens-section`
  - `task-section`
- No old dashboard side panel or warning panel.

- [ ] **Step 2: Rewrite renderer logic**

Update `public/app.js`:

- `loadSnapshot()` uses `window.codexUsage.getSnapshot()` if available.
- Browser fallback wraps `/api/usage` into `{ usage, task, generatedAt }`.
- Render Chinese labels only.
- Capacity section renders 5h and weekly compact bars/rings.
- Token section renders total/input/cached/output.
- Task section renders title, status, progress bar, confidence.
- Refresh every `5000ms`.

- [ ] **Step 3: Rewrite CSS as floating widget**

Update `public/styles.css`:

- Fixed compact layout for 360px wide Electron window.
- `-webkit-app-region: drag` on header.
- `-webkit-app-region: no-drag` on interactive controls.
- Glass-like panel using translucent backgrounds and backdrop-filter.
- macOS red/yellow/green dots.
- No full-page dashboard layout.
- Ensure text fits in Chinese at 320px width.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Manual UI check**

Run: `npm run app:dev`

Expected:

- Window is compact and frameless.
- Chinese labels are visible.
- Only `容量`, `Token 消耗`, and `当前任务` sections appear.
- Window is draggable from the header.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "feat: add Chinese floating window UI"
```

---

### Task 7: Verification, Documentation, And Push

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-18-codex-usage-floating-window-design.md` only if implementation differs.

**Interfaces:**
- Consumes: complete app from Tasks 1-6.
- Produces: verified and pushed `origin/main`.

- [ ] **Step 1: Run full automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run Electron dev mode**

Run: `npm run app:dev`

Expected: floating window appears without Codex process due to force-show override.

- [ ] **Step 3: Check process-trigger mode**

Run: `npm run app`

Expected: if no Codex process is detected, Electron stays alive with the window hidden. If Codex is running, the window appears.

- [ ] **Step 4: IPC privacy spot check**

Use Electron dev mode or a small Node invocation of `createDesktopSnapshot()`:

```powershell
node -e "require('./src/desktop-snapshot').createDesktopSnapshot().then(x=>console.log(JSON.stringify(x,null,2)))"
```

Expected: output includes `usage`, `task`, and `generatedAt`; output contains no prompt text, assistant text, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.

- [ ] **Step 5: Update README**

Ensure README documents:

- `npm install`
- `npm run app`
- `npm run app:dev`
- Codex process-trigger behavior.
- Chinese floating widget scope.
- Privacy limitations.

- [ ] **Step 6: Commit docs if changed**

```bash
git add README.md docs/superpowers/specs/2026-07-18-codex-usage-floating-window-design.md
git commit -m "docs: document floating window mode"
```

If no docs changed, skip this commit.

- [ ] **Step 7: Push main**

Run:

```bash
git status -sb
git push origin main
```

Expected: `main` pushes successfully to `https://github.com/cherub0/codex-usage`.

