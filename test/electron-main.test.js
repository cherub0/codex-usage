const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Electron window is cropped to the footer height', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');

  assert.match(main, /height:\s*500/);
  assert.match(main, /minHeight:\s*460/);
});

test('Electron main process handles mac traffic light controls', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8');

  assert.match(main, /codex-usage:window-control/);
  assert.match(main, /\.minimize\(\)/);
  assert.match(main, /\.maximize\(\)/);
  assert.match(main, /\.unmaximize\(\)/);
  assert.match(main, /app\.quit\(\)/);
  assert.match(preload, /controlWindow/);
});

test('package can build a Windows exe artifact', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

  assert.equal(pkg.scripts.dist, 'electron-builder --win');
  assert.equal(pkg.build.win.target[0], 'portable');
  assert.equal(pkg.build.win.artifactName, '${productName}-${version}-win.${ext}');
});
