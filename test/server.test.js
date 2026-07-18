const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test('server returns usage JSON', async () => {
  const server = createServer({
    readUsage: async () => ({
      mode: 'demo',
      generatedAt: new Date().toISOString(),
      message: 'Demo',
      windows: [],
      summary: { source: 'test', latestSnapshotAt: null, scannedFiles: 0, skippedLines: 0, tokenTotals: { input: 0, cachedInput: 0, output: 0, total: 0 } },
      warnings: []
    })
  });
  const baseUrl = await listen(server);
  const response = await fetch(`${baseUrl}/api/usage`);
  const json = await response.json();
  server.close();

  assert.equal(response.status, 200);
  assert.equal(json.mode, 'demo');
  assert.equal(response.headers.get('content-type').includes('application/json'), true);
});

test('server serves index html', async () => {
  const server = createServer({ readUsage: async () => ({}) });
  const baseUrl = await listen(server);
  const response = await fetch(`${baseUrl}/`);
  const text = await response.text();
  server.close();

  assert.equal(response.status, 200);
  assert.match(text, /Codex Usage/i);
});
