const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesktopSnapshot } = require('../src/desktop-snapshot');

test('createDesktopSnapshot combines usage and task data without transcript fields', async () => {
  const snapshot = await createDesktopSnapshot({
    readUsage: async () => ({
      mode: 'demo',
      windows: [{ id: '5h', label: '5-hour window', remainingPercent: 68, usedPercent: 32, confidence: 'demo' }],
      summary: { tokenTotals: { input: 10, cachedInput: 2, output: 4, total: 14 } },
      warnings: []
    }),
    readTask: async () => ({
      title: '实现悬浮窗',
      status: '运行中',
      progressPercent: 50,
      confidence: '真实',
      updatedAt: null,
      message: ''
    })
  });

  assert.equal(snapshot.usage.windows[0].remainingPercent, 68);
  assert.equal(snapshot.task.title, '实现悬浮窗');
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, 'prompt'), false);
  assert.equal(typeof snapshot.generatedAt, 'string');
});
