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
