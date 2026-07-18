const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('renderer uses relative asset paths so Electron file loading works', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="app\.js"/);
  assert.doesNotMatch(html, /href="\/styles\.css"/);
  assert.doesNotMatch(html, /src="\/app\.js"/);
});

test('renderer keeps Chinese labels and refreshes automatically', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  assert.match(html, /Codex 实时监控/);
  assert.match(app, /const AUTO_REFRESH_MS = 5000/);
  assert.match(app, /setInterval\(refresh, AUTO_REFRESH_MS\)/);
  assert.match(app, /Token 消耗/);
});

test('renderer exposes mac traffic light window controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

  assert.match(html, /data-window-action="close"/);
  assert.match(html, /data-window-action="minimize"/);
  assert.match(html, /data-window-action="maximize"/);
  assert.match(html, /Codex 实时监控/);
  assert.match(app, /controlWindow/);
  assert.match(css, /\.red::before/);
  assert.match(css, /\.red::after/);
  assert.match(css, /\.yellow::before/);
  assert.match(css, /\.green::before/);
  assert.match(css, /\.green::after/);
});

test('renderer hides task progress when no real progress is available', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  assert.match(app, /rawProgress !== null/);
  assert.match(app, /rawProgress !== undefined/);
  assert.match(app, /task-progress is-hidden/);
  assert.doesNotMatch(app, /progressPercent:\s*5/);
  assert.doesNotMatch(app, /推断/);
});
