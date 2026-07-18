const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampPercent,
  normalizeWindow,
  normalizeUsageSnapshot
} = require('../src/usage-normalizer');

test('clampPercent rounds and clamps valid numeric values', () => {
  assert.equal(clampPercent(68.4), 68);
  assert.equal(clampPercent(-4), 0);
  assert.equal(clampPercent(104), 100);
  assert.equal(clampPercent('42.8'), 43);
  assert.equal(clampPercent('nope'), null);
});

test('normalizeWindow converts used percentage into remaining percentage', () => {
  const result = normalizeWindow({
    id: 'primary',
    used_percent: 31.6,
    reset_seconds: 3600
  }, '5h');

  assert.equal(result.id, '5h');
  assert.equal(result.label, '5-hour window');
  assert.equal(result.usedPercent, 32);
  assert.equal(result.remainingPercent, 68);
  assert.equal(result.resetSeconds, 3600);
  assert.equal(result.confidence, 'live');
});

test('normalizeWindow converts remaining percentage into used percentage', () => {
  const result = normalizeWindow({
    name: 'weekly',
    remaining_percent: 44,
    reset_at: '2026-07-21T02:00:00.000Z'
  }, 'weekly');

  assert.equal(result.id, 'weekly');
  assert.equal(result.label, 'Weekly window');
  assert.equal(result.remainingPercent, 44);
  assert.equal(result.usedPercent, 56);
  assert.equal(result.resetAt, '2026-07-21T02:00:00.000Z');
});

test('normalizeUsageSnapshot returns live response for recognizable windows', () => {
  const result = normalizeUsageSnapshot({
    rate_limits: [
      { window: '5h', remaining_percent: 70 },
      { window: 'weekly', used_percent: 25 }
    ],
    token_totals: { input: 10, cachedInput: 2, output: 5, total: 15 }
  }, {
    latestSnapshotAt: '2026-07-18T09:00:00.000Z',
    scannedFiles: 2,
    skippedLines: 1,
    source: 'recent session'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.windows.length, 2);
  assert.equal(result.summary.scannedFiles, 2);
  assert.equal(result.summary.skippedLines, 1);
});

test('normalizeUsageSnapshot returns format_changed when token records exist but quota fields do not', () => {
  const result = normalizeUsageSnapshot({
    token_totals: { input: 10, cachedInput: 0, output: 5, total: 15 }
  }, {
    latestSnapshotAt: '2026-07-18T09:00:00.000Z',
    scannedFiles: 1,
    skippedLines: 0,
    source: 'recent session',
    sawTokenRecords: true,
    unknownRateLimitKeys: ['mystery']
  });

  assert.equal(result.mode, 'format_changed');
  assert.equal(result.windows.length, 0);
  assert.match(result.message, /format/i);
});
