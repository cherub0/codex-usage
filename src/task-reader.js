const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

const SAFE_TITLE_KEYS = ['title', 'thread_name', 'display_title', 'name', 'summary', 'workspace'];
const SENSITIVE_KEYS = new Set(['prompt', 'message', 'response', 'diff', 'command', 'output', 'first_user_message']);

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
  return '状态未知';
}

function normalizeUpdatedAt(value) {
  if (typeof value === 'string' && value.trim()) return value;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number > 100000000000 ? number : number * 1000;
  return new Date(milliseconds).toISOString();
}

function safeTitleFrom(row) {
  for (const key of SAFE_TITLE_KEYS) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim() && !value.includes('\uFFFD')) {
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
  const confidence = explicitProgress !== null ? '真实' : '状态';

  if (progressPercent === null && completed) {
    progressPercent = 100;
  }

  return {
    title: safeTitleFrom(row),
    status,
    progressPercent,
    confidence,
    updatedAt: normalizeUpdatedAt(row.updated_at || row.updatedAt || row.last_active_at),
    message: confidence === '真实' ? '读取到明确任务进度' : '读取到本机任务状态'
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

function normalizeComparablePath(value) {
  if (!value) return '';
  return path.normalize(String(value).replace(/^\\\\\?\\/, '')).toLowerCase();
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

function runPythonSqliteQuery(sqlitePath, sql) {
  const script = [
    'import json, os, sqlite3',
    'con = sqlite3.connect("file:{}?mode=ro".format(os.environ["CODEX_USAGE_SQLITE_PATH"].replace("\\\\", "/")), uri=True)',
    'con.row_factory = sqlite3.Row',
    'rows = [dict(row) for row in con.execute(os.environ["CODEX_USAGE_SQL"]).fetchall()]',
    'con.close()',
    'print(json.dumps(rows, ensure_ascii=False))'
  ].join('\n');

  return new Promise((resolve, reject) => {
    execFile('py', ['-3', '-c', script], {
      windowsHide: true,
      maxBuffer: 1024 * 512,
      env: {
        ...process.env,
        CODEX_USAGE_SQLITE_PATH: sqlitePath,
        CODEX_USAGE_SQL: sql
      }
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

async function querySqlite(sqlitePath, sql) {
  try {
    return await runSqliteQuery(sqlitePath, sql);
  } catch {
    return runPythonSqliteQuery(sqlitePath, sql);
  }
}

async function readLatestSessionIndexTask(codexHome, options = {}) {
  const indexPath = path.join(codexHome, 'session_index.jsonl');
  if (!(await exists(indexPath))) return null;

  const content = await fs.readFile(indexPath, 'utf8');
  let latest = null;
  const projectCwd = normalizeComparablePath(options.projectCwd);

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (projectCwd) {
      const rowCwd = normalizeComparablePath(row.cwd || row.source_cwd);
      if (rowCwd && rowCwd !== projectCwd) continue;
    }

    const updatedAt = row.updated_at || row.updatedAt || row.last_active_at || row.created_at || null;
    if (!latest || String(updatedAt || '') > String(latest.updated_at || '')) {
      latest = {
        title: row.thread_name || row.title || row.display_title || row.id,
        status: 'active',
        updated_at: updatedAt
      };
    }
  }

  return latest ? normalizeTaskRow(latest) : null;
}

async function readSessionIndexTaskById(codexHome, threadId) {
  if (!threadId) return null;
  const indexPath = path.join(codexHome, 'session_index.jsonl');
  if (!(await exists(indexPath))) return null;

  const content = await fs.readFile(indexPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (row.id !== threadId) continue;
    return normalizeTaskRow({
      title: row.thread_name || row.title || row.display_title || row.id,
      status: 'active',
      updated_at: row.updated_at || row.updatedAt || row.last_active_at || row.created_at || null
    });
  }

  return null;
}

async function readSqliteTask(sqlitePath, options = {}) {
  const tables = await querySqlite(sqlitePath, "SELECT name FROM sqlite_master WHERE type='table'");
  const names = tables.map((row) => row.name);
  const tableName = names.find((name) => name === 'threads')
    || names.find((name) => /thread|task|session/i.test(name));
  if (!tableName) return null;

  const safeTable = tableName.replace(/"/g, '');
  const rows = await querySqlite(sqlitePath, `SELECT * FROM "${safeTable}" ORDER BY updated_at DESC LIMIT 20`);
  if (!rows.length) return null;
  const projectCwd = normalizeComparablePath(options.projectCwd || process.env.CODEX_USAGE_PROJECT_CWD || process.cwd());
  const row = rows.find((item) => normalizeComparablePath(item.cwd) === projectCwd) || rows[0];
  const indexedTask = options.codexHome ? await readSessionIndexTaskById(options.codexHome, row.id) : null;
  const indexedTitle = indexedTask?.title;
  return normalizeTaskRow({
    ...row,
    title: indexedTitle || row.title,
    status: row.status || (hasCompletionMarker(row) ? 'completed' : 'active')
  });
}

async function readCurrentTask(options = {}) {
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const projectCwd = options.projectCwd || process.env.CODEX_USAGE_PROJECT_CWD || process.cwd();
  const sqlitePath = path.join(codexHome, 'state_5.sqlite');

  if (await exists(sqlitePath)) {
    try {
      const sqliteTask = await readSqliteTask(sqlitePath, { codexHome, projectCwd });
      if (sqliteTask) return sqliteTask;
    } catch {
      // Fall back to session_index.jsonl when sqlite3 is unavailable or the schema is unreadable.
    }
  }

  const indexedTask = await readLatestSessionIndexTask(codexHome, { projectCwd })
    || await readLatestSessionIndexTask(codexHome);
  if (indexedTask) return indexedTask;

  return createUnavailableTask(await exists(sqlitePath) ? '无法读取本机任务数据库' : 'state_5.sqlite not found');
}

module.exports = {
  normalizeTaskRow,
  createUnavailableTask,
  readCurrentTask,
  readLatestSessionIndexTask,
  readSessionIndexTaskById
};
