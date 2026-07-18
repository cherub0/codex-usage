const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

const SAFE_TITLE_KEYS = ['title', 'name', 'summary', 'workspace'];
const SENSITIVE_KEYS = new Set(['prompt', 'message', 'response', 'diff', 'command', 'output']);

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase();
  if (['running', 'active', 'in_progress'].includes(text)) return '运行中';
  if (['queued', 'pending', 'waiting'].includes(text)) return '等待中';
  if (['done', 'complete', 'completed', 'archived'].includes(text)) return '已完成';
  if (text === 'idle') return '空闲';
  return '推断中';
}

function safeTitleFrom(row) {
  for (const key of SAFE_TITLE_KEYS) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().slice(0, 80);
    }
  }

  for (const key of Object.keys(row || {})) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
  }

  return '最近 Codex 任务';
}

function hasCompletionMarker(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.archived === 1 || row.archived === true) return true;
  const status = String(row.status || '').toLowerCase();
  return ['done', 'complete', 'completed', 'archived'].includes(status);
}

function normalizeTaskRow(row = {}) {
  const explicitProgress = clampProgress(row.progress ?? row.progress_percent ?? row.percent ?? row.completion);
  const completed = hasCompletionMarker(row);
  const status = completed ? '已完成' : normalizeStatus(row.status || row.state);
  let progressPercent = explicitProgress;
  let confidence = explicitProgress !== null ? '真实' : '推断';

  if (progressPercent === null && completed) {
    progressPercent = 100;
  } else if (progressPercent === null && status === '运行中') {
    progressPercent = 35;
  } else if (progressPercent === null && status === '等待中') {
    progressPercent = 15;
  } else if (progressPercent === null) {
    progressPercent = 5;
  }

  return {
    title: safeTitleFrom(row),
    status,
    progressPercent,
    confidence,
    updatedAt: row.updated_at || row.updatedAt || row.last_active_at || null,
    message: confidence === '真实' ? '读取到明确任务进度' : '根据本机任务元数据推断'
  };
}

function createUnavailableTask(reason) {
  return {
    title: '暂无任务数据',
    status: '暂无',
    progressPercent: 0,
    confidence: '暂无',
    updatedAt: null,
    message: reason || '未找到可读取的本机任务状态'
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runSqliteQuery(sqlitePath, sql) {
  return new Promise((resolve, reject) => {
    execFile('sqlite3', ['-json', sqlitePath, sql], {
      windowsHide: true,
      maxBuffer: 1024 * 512
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout || '[]'));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

async function readCurrentTask(options = {}) {
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const sqlitePath = path.join(codexHome, 'state_5.sqlite');
  if (!(await exists(sqlitePath))) {
    return createUnavailableTask('state_5.sqlite not found');
  }

  try {
    const tables = await runSqliteQuery(sqlitePath, "SELECT name FROM sqlite_master WHERE type='table'");
    const tableName = tables.map((row) => row.name).find((name) => /thread|task|session/i.test(name));
    if (!tableName) return createUnavailableTask('未找到任务表');

    const safeTable = tableName.replace(/"/g, '');
    const rows = await runSqliteQuery(sqlitePath, `SELECT * FROM "${safeTable}" ORDER BY updated_at DESC LIMIT 1`);
    if (!rows.length) return createUnavailableTask('任务表为空');
    return normalizeTaskRow(rows[0]);
  } catch {
    return createUnavailableTask('无法读取本机任务数据库');
  }
}

module.exports = {
  normalizeTaskRow,
  createUnavailableTask,
  readCurrentTask
};
