const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readLatestUsageSnapshot } = require('../src/codex-reader');

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'codex-usage-reader-'));
}

test('readLatestUsageSnapshot extracts latest rate limit snapshot', async () => {
  const root = await makeTempDir();
  const sessionsDir = path.join(root, 'sessions', '2026', '07', '18');
  await fs.mkdir(sessionsDir, { recursive: true });
  const file = path.join(sessionsDir, 'rollout-test.jsonl');
  await fs.writeFile(file, [
    JSON.stringify({ type: 'token_count', token_count: { input_tokens: 10, output_tokens: 5 } }),
    JSON.stringify({
      type: 'token_count',
      timestamp: '2026-07-18T10:00:00.000Z',
      token_count: {
        input_tokens: 100,
        cached_input_tokens: 40,
        output_tokens: 20,
        rate_limits: [
          { window: '5h', remaining_percent: 66, reset_seconds: 1200 },
          { window: 'weekly', used_percent: 48, reset_at: '2026-07-21T02:00:00.000Z' }
        ]
      }
    })
  ].join('\n'));

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage: null,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.windows.length, 2);
  assert.equal(result.windows[0].remainingPercent, 66);
  assert.equal(result.summary.tokenTotals.total, 120);
});

test('readLatestUsageSnapshot skips malformed lines and returns format_changed for unknown quota metadata', async () => {
  const root = await makeTempDir();
  const sessionsDir = path.join(root, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(path.join(sessionsDir, 'session.jsonl'), [
    '{bad json',
    JSON.stringify({
      type: 'token_count',
      timestamp: '2026-07-18T10:00:00.000Z',
      token_count: {
        input_tokens: 12,
        output_tokens: 8,
        rate_limits: [{ mystery_percent: 77 }]
      }
    })
  ].join('\n'));

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage: null,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'format_changed');
  assert.equal(result.summary.skippedLines, 1);
});

test('readLatestUsageSnapshot returns demo usage when sessions directory is missing', async () => {
  const root = await makeTempDir();
  const demoUsage = {
    mode: 'demo',
    generatedAt: '2026-07-18T00:00:00.000Z',
    message: 'Demo mode',
    windows: [],
    summary: { source: 'sample-data', latestSnapshotAt: null, scannedFiles: 0, skippedLines: 0, tokenTotals: { input: 0, cachedInput: 0, output: 0, total: 0 } },
    warnings: []
  };

  const result = await readLatestUsageSnapshot({
    codexHome: root,
    demoUsage,
    lookbackDays: 30
  });

  assert.equal(result.mode, 'demo');
  assert.equal(result.summary.source, 'sample-data');
});
