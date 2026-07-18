# Codex Usage Dashboard Design

Date: 2026-07-18

## Goal

Build a new, unofficial Windows-friendly local web dashboard for showing Codex remaining usage. The first version should look polished, run locally with minimal setup, read real Codex usage metadata when available, and fall back to clearly labeled demo data when local logs do not contain usable quota snapshots.

The project will be managed as a GitHub-ready open-source repository from the start, with clean structure, README, license, ignore rules, and an initial commit.

## Product Shape

The app is a local Node.js service with a browser dashboard.

- Default URL: `http://127.0.0.1:8787`
- Default data source: `%USERPROFILE%\.codex\sessions`
- Default behavior: local-only, read-only, no external network requests
- Primary display mode: remaining quota percentage
- Fallback behavior: demo data with visible `Demo mode` status

The first release is not a tray app, desktop widget, or multi-account manager. Those can be considered after the web dashboard is stable.

## Architecture

Use a small single-repository Node.js app with no runtime npm dependencies for the first version.

- `server.js`
  - Starts the local HTTP server.
  - Serves static files from `public/`.
  - Exposes `/api/usage`.
  - Reads `PORT`, `HOST`, and `CODEX_HOME` from environment variables.

- `src/codex-reader.js`
  - Scans recent Codex session `.jsonl` files.
  - Limits scanning to a configurable lookback window, default 14 days.
  - Finds the latest usable `token_count.rate_limits` or equivalent rate-limit snapshot.
  - Returns metadata only: timestamps, source path summary, counters, and parse status.

- `src/usage-normalizer.js`
  - Converts Codex rate-limit fields into stable dashboard data.
  - Normalizes 5-hour and weekly quota windows.
  - Converts between used and remaining percentages when possible.
  - Normalizes reset timestamps or reset seconds.
  - Adds confidence labels such as `live`, `partial`, `demo`, or `format_changed`.

- `public/`
  - Contains the dashboard HTML, CSS, and browser JavaScript.
  - Calls `/api/usage` for data.
  - Renders the dashboard without requiring a build step.

- `sample-data/usage.json`
  - Provides representative demo data for empty first-run states and UI development.

## UI Design

The dashboard should feel like a refined local monitoring console, not a marketing page.

The first screen includes:

- Header with product name, data status, last refresh time, and a refresh button.
- Two primary quota panels:
  - 5-hour window
  - Weekly or 7-day window
- Each quota panel shows:
  - Large circular remaining percentage
  - Used percentage
  - Reset countdown or reset time
  - Confidence/status label
- Side panel with:
  - Latest snapshot time
  - Session scan summary
  - Data source mode
  - Clear warning for demo or changed-format states
- Lower section with:
  - Today token summary when available
  - Recent activity summary based on safe metadata

Visual direction:

- Modern dashboard layout with dense but readable information.
- Avoid a one-color palette.
- Use neutral surfaces with cyan, green, amber, and rose accents for status.
- Support responsive desktop and narrow browser widths.
- Keep controls familiar: icon-style refresh button with text fallback, status badges, compact cards, and clear hover states.

## Data Flow

1. Browser loads `public/index.html`.
2. Browser calls `GET /api/usage`.
3. Server scans local Codex sessions under `CODEX_HOME` or the default user `.codex` folder.
4. Reader extracts the latest safe usage snapshot.
5. Normalizer converts it into dashboard shape.
6. API returns normalized JSON.
7. UI renders live, partial, demo, or format-changed state.

The API should never return prompt text, assistant responses, command output, diffs, access tokens, refresh tokens, cookies, or raw auth data.

## Data Handling Rules

- Read local Codex files only.
- Do not modify `.codex` files.
- Do not upload usage data.
- Do not call OpenAI, ChatGPT, GitHub, or other external services at runtime.
- Avoid displaying absolute local paths by default; show a shortened source summary instead.
- Include debug summaries only when they are safe metadata.

## Error Handling

- Missing Codex directory: return demo data with a clear message.
- No session files: return demo data with a clear message.
- No recognizable rate-limit snapshot: return demo data or `format_changed`, depending on whether relevant token records were found.
- Malformed JSONL lines: skip bad lines and report skipped count.
- File access errors: continue scanning other files and include a safe warning.
- Unknown quota fields: return `format_changed` and a safe field summary.

The UI must never appear blank because of missing or changed local data.

## Testing

Automated checks:

- Normalizer unit tests for:
  - used to remaining conversion
  - remaining to used conversion
  - reset timestamp and reset seconds handling
  - missing fields
  - unknown format handling
- Reader fixture tests for:
  - latest snapshot selection
  - malformed JSONL line skipping
  - empty session directory fallback
- Basic server test for:
  - `/api/usage` returns valid JSON
  - static files are served

Manual checks:

- Start local server on Windows PowerShell.
- Open dashboard in browser.
- Confirm real-data mode when local Codex snapshots are available.
- Confirm demo mode when `CODEX_HOME` points to an empty fixture directory.
- Confirm no prompt or transcript content appears in API responses.

## Repository Management

Initialize the project as a Git repository and prepare it for GitHub.

Initial repository files:

- `README.md`
- `LICENSE` with MIT license
- `.gitignore`
- `server.js`
- `src/`
- `public/`
- `sample-data/`
- `test/`

The first commit should include the approved design document and repository baseline. Suggested first commit message:

```text
Initial Codex usage dashboard
```

Before pushing to GitHub, confirm:

- repository name
- public or private visibility
- remote owner or organization

## Out Of Scope For First Version

- System tray integration
- Desktop floating widget
- Multi-account switching
- Auto-redeeming reset credits
- Reading undocumented online account endpoints
- Official billing or subscription reporting
- Mobile app packaging
- Authentication or remote access

## Success Criteria

- A Windows user can run one command and open a local dashboard.
- The dashboard shows real Codex remaining usage when local snapshots are available.
- The dashboard shows clearly labeled demo data when real data is unavailable.
- UI is polished, responsive, and not visually generic.
- The project is ready to publish to GitHub with clear documentation and license.
