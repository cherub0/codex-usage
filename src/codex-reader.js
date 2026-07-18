const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeUsageSnapshot } = require('./usage-normalizer');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findSessionFiles(sessionsDir, lookbackDays = 14) {
  const files = [];
  if (!(await pathExists(sessionsDir))) return files;

  const cutoff = Date.now() - Number(lookbackDays || 14) * 24 * 60 * 60 * 1000;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;

      try {
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs >= cutoff) {
          files.push({ path: fullPath, mtimeMs: stat.mtimeMs });
        }
      } catch {
        // Ignore files that disappear or become unreadable during scanning.
      }
    }
  }

  await walk(sessionsDir);
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).map((file) => file.path);
}

function numberFrom(raw, keys) {
  for (const key of keys) {
    const value = raw?.[key];
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function tokenTotalsFrom(tokenCount) {
  const input = numberFrom(tokenCount, ['input_tokens', 'input']);
  const cachedInput = numberFrom(tokenCount, ['cached_input_tokens', 'cachedInput']);
  const output = numberFrom(tokenCount, ['output_tokens', 'output']);
  const total = numberFrom(tokenCount, ['total_tokens', 'total']) || input + output;
  return { input, cachedInput, output, total };
}

function safeSnapshotFromRecord(record) {
  const tokenCount = record?.token_count;
  if (!tokenCount || typeof tokenCount !== 'object') return null;

  return {
    timestamp: record.timestamp || record.created_at || record.time || null,
    rate_limits: tokenCount.rate_limits || tokenCount.rateLimits || null,
    token_totals: tokenTotalsFrom(tokenCount)
  };
}

async function scanFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let skippedLines = 0;
  let latestSnapshot = null;
  let sawTokenRecords = false;
  const unknownRateLimitKeys = new Set();

  for (const line of lines) {
    if (!line.trim()) continue;

    let record;
    try {
      record = JSON.parse(line);
    } catch {
      skippedLines += 1;
      continue;
    }

    const snapshot = safeSnapshotFromRecord(record);
    if (!snapshot) continue;
    sawTokenRecords = true;

    if (Array.isArray(snapshot.rate_limits)) {
      for (const item of snapshot.rate_limits) {
        if (item && typeof item === 'object') {
          for (const key of Object.keys(item)) unknownRateLimitKeys.add(key);
        }
      }
    }

    latestSnapshot = snapshot;
  }

  return {
    latestSnapshot,
    skippedLines,
    sawTokenRecords,
    unknownRateLimitKeys: Array.from(unknownRateLimitKeys)
  };
}

async function readLatestUsageSnapshot(options = {}) {
  const codexHome = options.codexHome;
  const sessionsDir = path.join(codexHome, 'sessions');
  const files = await findSessionFiles(sessionsDir, options.lookbackDays || 14);
  let skippedLines = 0;
  let sawTokenRecords = false;
  let unknownRateLimitKeys = [];

  for (const file of files) {
    try {
      const result = await scanFile(file);
      skippedLines += result.skippedLines;
      sawTokenRecords = sawTokenRecords || result.sawTokenRecords;
      unknownRateLimitKeys = [...new Set([...unknownRateLimitKeys, ...result.unknownRateLimitKeys])];

      if (result.latestSnapshot) {
        return normalizeUsageSnapshot(result.latestSnapshot, {
          latestSnapshotAt: result.latestSnapshot.timestamp,
          scannedFiles: files.length,
          skippedLines,
          source: path.basename(file),
          sawTokenRecords,
          unknownRateLimitKeys
        }, options.demoUsage || null);
      }
    } catch {
      skippedLines += 1;
    }
  }

  return normalizeUsageSnapshot({}, {
    scannedFiles: files.length,
    skippedLines,
    source: 'local Codex sessions',
    sawTokenRecords,
    unknownRateLimitKeys
  }, options.demoUsage || null);
}

module.exports = {
  findSessionFiles,
  readLatestUsageSnapshot
};
