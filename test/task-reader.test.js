const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTaskRow,
  createUnavailableTask
} = require('../src/task-reader');

test('normalizeTaskRow uses explicit progress and status when available', () => {
  const task = normalizeTaskRow({
    title: '实现悬浮窗',
    status: 'running',
    progress: 64,
    updated_at: '2026-07-18T10:00:00.000Z'
  });

  assert.equal(task.title, '实现悬浮窗');
  assert.equal(task.status, '运行中');
  assert.equal(task.progressPercent, 64);
  assert.equal(task.confidence, '真实');
});

test('normalizeTaskRow infers progress from archived marker', () => {
  const task = normalizeTaskRow({
    name: '整理 README',
    archived: 1,
    updated_at: '2026-07-18T09:00:00.000Z'
  });

  assert.equal(task.title, '整理 README');
  assert.equal(task.status, '已完成');
  assert.equal(task.progressPercent, 100);
  assert.equal(task.confidence, '推断');
});

test('normalizeTaskRow returns safe fallback title without transcript content', () => {
  const task = normalizeTaskRow({
    prompt: 'secret prompt should not appear',
    updated_at: '2026-07-18T09:00:00.000Z'
  });

  assert.equal(task.title, '最近 Codex 任务');
  assert.equal(task.confidence, '推断');
  assert.equal(task.title.includes('secret'), false);
});

test('createUnavailableTask returns Chinese unavailable state', () => {
  const task = createUnavailableTask('state_5.sqlite not found');
  assert.equal(task.title, '暂无任务数据');
  assert.equal(task.status, '暂无');
  assert.equal(task.progressPercent, 0);
  assert.equal(task.confidence, '暂无');
});
