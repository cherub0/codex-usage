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

## Windows Floating Window

```powershell
npm install
npm run app
```

The Electron app watches for a local Codex process. When Codex is detected, it shows an always-on-top Chinese floating window. For development without a running Codex process:

```powershell
npm run app:dev
```

The floating window is frameless, always on top, and styled like a compact macOS widget. The interface is Chinese and intentionally shows only:

- `容量`: 5-hour and weekly remaining capacity when local quota snapshots are available.
- `Token 消耗`: total, input, cached input, and output token counters.
- `当前任务`: the current or most recent local task state and progress when safe task metadata is available.

The normal app mode uses local Windows process inspection. If a Codex process is detected, the window is shown. If Codex is not detected, the Electron process stays alive in the background and the window is hidden until Codex appears again.

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
