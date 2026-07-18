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
