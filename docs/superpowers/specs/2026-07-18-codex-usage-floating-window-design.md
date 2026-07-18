# Codex Usage Floating Window Design

Date: 2026-07-18

## Goal

Evolve Codex Usage Dashboard into a Windows desktop floating window that appears when Codex is running. The app should use a compact Chinese interface, present only quota capacity, token consumption, and current task progress, and use a macOS-style visual treatment while remaining local-first and read-only.

## Product Shape

The app becomes an Electron desktop app for Windows.

- Runs a background Electron main process.
- Monitors local Windows processes for Codex.
- Shows the floating window when Codex is detected.
- Hides the floating window when Codex is not detected.
- Keeps the app process alive while hidden so it can reappear when Codex starts again.
- Uses an always-on-top, frameless, draggable floating window.
- Keeps the existing local web dashboard code path only if it remains useful for development; the primary user experience is the floating window.

The first floating-window release is not a full task manager, account switcher, reset-credit redeemer, or official billing tool.

## Architecture

Use Electron on top of the existing Node.js codebase.

- `electron/main.js`
  - Creates the frameless floating window.
  - Sets `alwaysOnTop`.
  - Monitors Codex processes on Windows.
  - Shows or hides the window based on process detection.
  - Handles IPC requests from the renderer for usage data.

- `electron/preload.js`
  - Exposes a narrow `window.codexUsage` API.
  - Allows the renderer to request safe usage/task metadata.
  - Does not expose Node.js directly to the renderer.

- `src/codex-reader.js`
  - Continues reading local session JSONL metadata for quota and token counters.
  - Remains read-only.

- `src/task-reader.js`
  - Reads local Codex SQLite state, starting with `%USERPROFILE%\.codex\state_5.sqlite`.
  - Extracts safe task/thread metadata only.
  - Never returns prompt text, assistant responses, command output, diffs, or secrets.

- `src/process-monitor.js`
  - Detects whether Codex is running on Windows.
  - Uses safe local process inspection.
  - Keeps matching rules narrow enough to avoid unrelated processes when possible.

- `public/`
  - Becomes the floating-window renderer UI.
  - Uses Chinese copy.
  - Shows only the three approved sections.

## UI Design

The UI is a compact Chinese macOS-style floating widget.

Window behavior:

- Frameless.
- Always on top.
- Draggable by the top handle/header.
- Compact default size.
- No browser-style navigation.
- Hidden when Codex is not running.

Visual direction:

- macOS-inspired panel with subtle glass effect.
- Red, yellow, and green circular control dots at the top.
- Soft shadows and compact rounded sections.
- Neutral base with cyan, green, amber, and rose status accents.
- No large marketing hero, no broad dashboard layout, no decorative orb backgrounds.

Visible sections:

- Capacity section. UI label: `容量`.
  - Shows 5-hour remaining percentage.
  - Shows weekly or 7-day remaining percentage.
  - Uses compact rings or bars.
  - Shows status labels where needed: `真实`, `推断`, `演示`, or `暂无`.

- Token consumption section. UI label: `Token 消耗`.
  - Shows total tokens.
  - Shows input, cached input, and output.
  - Uses compact metric rows.

- Current task section. UI label: `当前任务`.
  - Shows current or most recent active task/thread.
  - Shows status.
  - Shows progress bar.
  - Shows confidence label: `真实`, `推断`, or `暂无`.

## Data Design

### Capacity

Capacity continues to come from local Codex session JSONL metadata:

- Scan `%USERPROFILE%\.codex\sessions`.
- Prefer the latest recognizable `token_count.rate_limits` snapshot.
- Normalize 5-hour and weekly/7-day windows into remaining percentages.
- If unavailable, show clearly labeled demo or unavailable state.

### Token Consumption

Token consumption continues to come from local `token_count` records:

- Total.
- Input.
- Cached input.
- Output.

Only counters are displayed. Transcript content is never displayed.

### Current Task And Progress

Task data is read from local Codex state storage:

- Prefer `%USERPROFILE%\.codex\state_5.sqlite`.
- Inspect available table names and columns defensively.
- Prefer explicit task/thread status fields when available.
- Prefer explicit progress fields when available.
- If no explicit progress exists, infer a coarse progress/status from safe metadata such as recent activity time or archived/completed markers.

Confidence states:

- `真实`: explicit task/progress fields were found.
- `推断`: task state is inferred from safe metadata.
- `暂无`: no safe task metadata is available.

The UI must not pretend inferred progress is exact.

## Process Monitoring

The Electron main process monitors Windows processes on an interval.

Behavior:

- If a process matching Codex is running, show the floating window.
- If no Codex process is running, hide the floating window.
- Keep the Electron app process alive while hidden.
- Allow manual quit from development tools or app lifecycle.

Process matching should include likely Codex process names such as `codex`, `Codex`, and known Codex desktop process names if observed locally during implementation. Unknown matches should be conservative.

## Data Handling Rules

- Read local Codex files only.
- Do not modify `.codex` files.
- Do not upload usage, task, or process data.
- Do not call OpenAI, ChatGPT, GitHub, or other external services at runtime.
- Do not expose Node.js directly to the renderer.
- Do not display absolute local paths by default.
- Never return prompt text, assistant responses, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.

## Error Handling

- Electron unavailable or install failure: keep the existing Node test suite useful and report install failure clearly.
- Missing Codex sessions: show unavailable/demo capacity.
- Missing SQLite state file: show `暂无任务数据`.
- SQLite schema changed: show task confidence `暂无` or `推断`, not guessed exact progress.
- Process inspection fails: keep window hidden and show a safe warning in development logs.
- Renderer data request fails: show compact Chinese error text in the affected section only.

The floating window must never be blank because local data is missing or a Codex format changed.

## Testing

Automated checks:

- Keep existing normalizer, reader, and server tests passing.
- Add process-monitor tests for matching and non-matching process names.
- Add task-reader tests using temporary SQLite fixtures when SQLite support is available.
- Add renderer data-shape tests where practical without overbuilding a browser test framework.

Manual checks on Windows:

- Run Electron app.
- Confirm the window is frameless and always on top.
- Confirm the window is draggable.
- Confirm Chinese UI copy.
- Confirm only the three Chinese UI sections are shown: `容量`, `Token 消耗`, and `当前任务`.
- Confirm hidden state when Codex is not detected.
- Confirm visible state when a Codex-like process is detected or process detection is simulated in development.
- Confirm API/IPC output contains no transcript content or auth data.

## Repository Management

Work continues on `main` because the user explicitly requested direct main-branch modifications earlier.

Use focused commits:

- Electron shell and scripts.
- Process monitoring.
- Task reader.
- Chinese floating-window UI.
- Verification and documentation.

Push to `origin/main` after tests and manual checks pass, unless the user redirects.

## Out Of Scope For This Revision

- Installer packaging.
- Code signing.
- System tray controls.
- Manual task editing.
- Multi-account switching.
- Auto-start at Windows login.
- Official billing or subscription reporting.
- Online account endpoint reads.

## Success Criteria

- `npm run app` starts a Windows floating window experience.
- The floating window is always-on-top and macOS-styled.
- The UI is Chinese.
- Only capacity, token consumption, and current task/progress are visible.
- The window shows when Codex is detected and hides when Codex is not detected.
- Missing or changed Codex local data degrades safely.
- Tests pass.
- Changes are committed and pushed to GitHub.
