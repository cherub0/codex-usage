const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  normalizeTaskRow,
  createUnavailableTask,
  readCurrentTask,
  readSessionIndexTaskById
} = require('../src/task-reader');

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'codex-task-reader-'));
}

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

test('readCurrentTask falls back to the latest safe session index entry', async () => {
  const root = await makeTempDir();
  await fs.writeFile(path.join(root, 'session_index.jsonl'), [
    JSON.stringify({
      id: 'older',
      thread_name: '旧任务',
      updated_at: '2026-07-18T09:00:00.000Z'
    }),
    JSON.stringify({
      id: 'newer',
      thread_name: '修正用量数据',
      updated_at: '2026-07-18T10:00:00.000Z'
    })
  ].join('\n'));

  const task = await readCurrentTask({ codexHome: root });

  assert.equal(task.title, '修正用量数据');
  assert.equal(task.status, '运行中');
  assert.equal(task.progressPercent, 35);
  assert.equal(task.confidence, '推断');
});

test('readCurrentTask prefers session index entries from the current project', async () => {
  const root = await makeTempDir();
  const projectDir = path.join(root, 'project');
  await fs.mkdir(projectDir);
  await fs.writeFile(path.join(root, 'session_index.jsonl'), [
    JSON.stringify({
      id: 'other',
      thread_name: '隔壁项目',
      cwd: path.join(root, 'other'),
      updated_at: '2026-07-18T11:00:00.000Z'
    }),
    JSON.stringify({
      id: 'current',
      thread_name: '当前项目',
      cwd: projectDir,
      updated_at: '2026-07-18T10:00:00.000Z'
    })
  ].join('\n'));

  const task = await readCurrentTask({ codexHome: root, projectCwd: projectDir });

  assert.equal(task.title, '当前项目');
});

test('readSessionIndexTaskById returns a safe title for a known thread id', async () => {
  const root = await makeTempDir();
  await fs.writeFile(path.join(root, 'session_index.jsonl'), [
    JSON.stringify({
      id: 'wanted',
      thread_name: '可读任务标题',
      updated_at: '2026-07-18T10:00:00.000Z'
    }),
    JSON.stringify({
      id: 'other',
      thread_name: '其他任务',
      updated_at: '2026-07-18T11:00:00.000Z'
    })
  ].join('\n'));

  const task = await readSessionIndexTaskById(root, 'wanted');

  assert.equal(task.title, '可读任务标题');
});
