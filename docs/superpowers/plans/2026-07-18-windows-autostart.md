# Windows Autostart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add install/uninstall commands for a current-user Windows startup shortcut that launches the Codex Usage Electron monitor after login.

**Architecture:** Use a hidden VBScript launcher plus PowerShell install/uninstall scripts. Package scripts invoke the PowerShell scripts; tests verify script presence and expected shortcut wiring.

**Tech Stack:** Node.js 18+, npm scripts, PowerShell, Windows Script Host `.vbs`, Node built-in `node:test`.

## Global Constraints

- `npm run autostart:install` installs autostart for the current Windows user.
- `npm run autostart:uninstall` removes autostart for the current Windows user.
- Autostart launches the existing Electron app mode, equivalent to `npm run app`.
- No administrator permissions are required.
- Do not write to HKCU/HKLM registry.
- Do not create a scheduled task.
- Do not modify Codex files.
- The uninstall command must only delete the known shortcut path.

---

### Task 1: Startup Scripts And Package Commands

**Files:**
- Create: `scripts/start-hidden.vbs`
- Create: `scripts/install-autostart.ps1`
- Create: `scripts/uninstall-autostart.ps1`
- Create: `test/autostart-scripts.test.js`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces:
  - `npm run autostart:install`
  - `npm run autostart:uninstall`

- [ ] **Step 1: Write failing test**

Create `test/autostart-scripts.test.js` verifying:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('package exposes Windows autostart scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['autostart:install'], 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-autostart.ps1');
  assert.equal(pkg.scripts['autostart:uninstall'], 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-autostart.ps1');
});

test('autostart scripts wire the expected shortcut and hidden launcher', () => {
  const install = fs.readFileSync(path.join(root, 'scripts', 'install-autostart.ps1'), 'utf8');
  const uninstall = fs.readFileSync(path.join(root, 'scripts', 'uninstall-autostart.ps1'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'scripts', 'start-hidden.vbs'), 'utf8');

  assert.match(install, /Codex Usage Floating Window\.lnk/);
  assert.match(install, /start-hidden\.vbs/);
  assert.match(install, /WScript\.Shell/);
  assert.match(uninstall, /Codex Usage Floating Window\.lnk/);
  assert.match(launcher, /npm run app/);
  assert.match(launcher, /windowStyle = 0/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/autostart-scripts.test.js`

Expected: FAIL because scripts and package commands do not exist.

- [ ] **Step 3: Implement scripts and package commands**

Add package scripts:

```json
"autostart:install": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-autostart.ps1",
"autostart:uninstall": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-autostart.ps1"
```

Create `scripts/start-hidden.vbs`:

```vbscript
Set shell = CreateObject("WScript.Shell")
scriptPath = WScript.ScriptFullName
repoRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(CreateObject("Scripting.FileSystemObject").GetParentFolderName(scriptPath))
command = "cmd /c cd /d """ & repoRoot & """ && npm run app"
windowStyle = 0
waitOnReturn = False
shell.Run command, windowStyle, waitOnReturn
```

Create `scripts/install-autostart.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Codex Usage Floating Window.lnk"
$launcherPath = Join-Path $scriptDir "start-hidden.vbs"

New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = "`"$launcherPath`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$env:WINDIR\System32\shell32.dll,220"
$shortcut.Description = "Start Codex Usage Floating Window monitor"
$shortcut.Save()

Write-Host "Installed startup shortcut: $shortcutPath"
```

Create `scripts/uninstall-autostart.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Codex Usage Floating Window.lnk"

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
  Write-Host "Removed startup shortcut: $shortcutPath"
} else {
  Write-Host "Startup shortcut not found: $shortcutPath"
}
```

- [ ] **Step 4: Run targeted test**

Run: `npm test -- test/autostart-scripts.test.js`

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Manual install/uninstall check**

Run:

```powershell
npm run autostart:install
$startup = [Environment]::GetFolderPath("Startup")
Test-Path -LiteralPath (Join-Path $startup "Codex Usage Floating Window.lnk")
npm run autostart:uninstall
Test-Path -LiteralPath (Join-Path $startup "Codex Usage Floating Window.lnk")
```

Expected: first `Test-Path` returns `True`; second returns `False`.

- [ ] **Step 7: Update README**

Document:

```markdown
## Start With Windows

```powershell
npm run autostart:install
```

This creates a current-user Startup shortcut. It starts the monitor after Windows login; the floating window still appears only when Codex is running.

Remove it with:

```powershell
npm run autostart:uninstall
```
```

- [ ] **Step 8: Commit and push**

Run:

```bash
git add package.json README.md scripts/start-hidden.vbs scripts/install-autostart.ps1 scripts/uninstall-autostart.ps1 test/autostart-scripts.test.js
git commit -m "feat: add Windows autostart scripts"
git push origin main
```

