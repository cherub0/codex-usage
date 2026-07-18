$ErrorActionPreference = "Stop"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Codex Usage Floating Window.lnk"

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
  Write-Host "Removed startup shortcut: $shortcutPath"
} else {
  Write-Host "Startup shortcut not found: $shortcutPath"
}
