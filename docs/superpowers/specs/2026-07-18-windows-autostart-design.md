# Windows Autostart Design

Date: 2026-07-18

## Goal

Add a Windows current-user startup entry so the Codex Usage Electron monitor starts automatically after Windows login, runs in the background, and shows the floating window only when Codex is detected.

## Product Behavior

- `npm run autostart:install` installs autostart for the current Windows user.
- `npm run autostart:uninstall` removes autostart for the current Windows user.
- Autostart launches the existing Electron app mode, equivalent to `npm run app`.
- The monitor process starts after login and remains alive.
- Existing Codex process detection remains responsible for showing or hiding the floating window.
- No administrator permissions are required.

## Implementation

Use the current user's Startup folder:

```text
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

Create a shortcut named:

```text
Codex Usage Floating Window.lnk
```

The shortcut launches a repository script that starts Electron without leaving a visible PowerShell or command prompt window.

Files:

- `scripts/start-hidden.vbs`
  - Starts `npm run app` from the repository root.
  - Uses a hidden window style.

- `scripts/install-autostart.ps1`
  - Resolves the repository root.
  - Creates the Startup folder if needed.
  - Creates or replaces the `.lnk` shortcut.
  - Points the shortcut at `wscript.exe`.
  - Passes `scripts/start-hidden.vbs` as the argument.

- `scripts/uninstall-autostart.ps1`
  - Deletes the `.lnk` shortcut if present.
  - Does not stop any currently running Electron process.

- `package.json`
  - Adds `autostart:install`.
  - Adds `autostart:uninstall`.

## Safety

- Do not write to HKCU/HKLM registry.
- Do not create a scheduled task.
- Do not require administrator permissions.
- Do not modify Codex files.
- The uninstall command must only delete the known shortcut path.

## Testing

Automated checks:

- Existing `npm test` must keep passing.
- Add a small Node test verifying:
  - package scripts exist.
  - startup scripts exist.
  - install script references the expected shortcut name.

Manual checks on Windows:

- Run `npm run autostart:install`.
- Confirm the `.lnk` exists in the current user's Startup folder.
- Run `npm run autostart:uninstall`.
- Confirm the `.lnk` is removed.

## Success Criteria

- Current user can install autostart with one command.
- Current user can uninstall autostart with one command.
- Windows login starts the monitor in the background.
- The app still shows/hides based on Codex process detection.
