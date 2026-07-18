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
