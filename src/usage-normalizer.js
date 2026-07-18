function clampPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeWindowId(raw, fallbackId) {
  const text = String(raw.id || raw.window || raw.name || raw.type || fallbackId || '').toLowerCase();
  if (text.includes('5') || text.includes('primary') || text.includes('hour')) return '5h';
  if (text.includes('week') || text.includes('7d') || text.includes('7-day') || text.includes('weekly')) return 'weekly';
  return fallbackId || text || 'unknown';
}

function labelForWindow(id) {
  if (id === '5h') return '5-hour window';
  if (id === 'weekly') return 'Weekly window';
  return 'Usage window';
}

function pickFirst(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return null;
}

function normalizeResetAt(value) {
  if (typeof value === 'string' && value.trim()) return value;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const milliseconds = number > 100000000000 ? number : number * 1000;
  return new Date(milliseconds).toISOString();
}

function normalizeWindow(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const id = normalizeWindowId(raw, fallbackId);
  const remainingRaw = pickFirst(raw, ['remainingPercent', 'remaining_percent', 'remaining', 'remaining_pct']);
  const usedRaw = pickFirst(raw, ['usedPercent', 'used_percent', 'used', 'used_pct', 'percent_used']);
  let remainingPercent = clampPercent(remainingRaw);
  let usedPercent = clampPercent(usedRaw);

  if (remainingPercent === null && usedPercent !== null) remainingPercent = 100 - usedPercent;
  if (usedPercent === null && remainingPercent !== null) usedPercent = 100 - remainingPercent;
  if (remainingPercent === null || usedPercent === null) return null;

  const resetAt = normalizeResetAt(pickFirst(raw, ['resetAt', 'reset_at', 'resets_at', 'resetTime']));
  const resetSecondsRaw = pickFirst(raw, ['resetSeconds', 'reset_seconds', 'resets_in_seconds', 'seconds_until_reset']);
  const resetSeconds = resetSecondsRaw === null ? null : Number(resetSecondsRaw);

  return {
    id,
    label: labelForWindow(id),
    remainingPercent,
    usedPercent,
    resetAt,
    resetSeconds: Number.isFinite(resetSeconds) ? resetSeconds : null,
    confidence: raw.confidence || 'live'
  };
}

function extractWindows(snapshot) {
  if (Array.isArray(snapshot.rate_limits)) return snapshot.rate_limits;
  if (snapshot.rate_limits && typeof snapshot.rate_limits === 'object') {
    return Object.entries(snapshot.rate_limits).map(([key, value]) => ({ id: key, ...value }));
  }
  if (Array.isArray(snapshot.windows)) return snapshot.windows;
  return [];
}

function normalizeUsageSnapshot(snapshot, meta = {}, demoUsage = null) {
  const windows = extractWindows(snapshot || {})
    .map((window, index) => normalizeWindow(window, index === 0 ? '5h' : 'weekly'))
    .filter(Boolean);

  const generatedAt = new Date().toISOString();
  const tokenTotals = snapshot?.token_totals || snapshot?.tokenTotals || {
    input: 0,
    cachedInput: 0,
    output: 0,
    total: 0
  };

  if (windows.length > 0) {
    return {
      mode: windows.some((window) => window.confidence === 'partial') ? 'partial' : 'live',
      generatedAt,
      message: 'Live Codex usage snapshot loaded from local session metadata.',
      windows,
      summary: {
        source: meta.source || 'local Codex sessions',
        latestSnapshotAt: meta.latestSnapshotAt || null,
        scannedFiles: meta.scannedFiles || 0,
        skippedLines: meta.skippedLines || 0,
        tokenTotals
      },
      warnings: meta.warnings || []
    };
  }

  if (meta.sawTokenRecords) {
    return {
      mode: 'format_changed',
      generatedAt,
      message: 'Codex session metadata was found, but the quota format was not recognized.',
      windows: [],
      summary: {
        source: meta.source || 'local Codex sessions',
        latestSnapshotAt: meta.latestSnapshotAt || null,
        scannedFiles: meta.scannedFiles || 0,
        skippedLines: meta.skippedLines || 0,
        tokenTotals,
        unknownRateLimitKeys: meta.unknownRateLimitKeys || []
      },
      warnings: ['Data format changed. The dashboard avoided displaying guessed quota values.']
    };
  }

  if (demoUsage) {
    return {
      ...demoUsage,
      generatedAt,
      summary: {
        ...demoUsage.summary,
        scannedFiles: meta.scannedFiles || demoUsage.summary.scannedFiles || 0,
        skippedLines: meta.skippedLines || demoUsage.summary.skippedLines || 0
      }
    };
  }

  return {
    mode: 'demo',
    generatedAt,
    message: 'Demo mode: no readable Codex rate-limit snapshot was found.',
    windows: [],
    summary: {
      source: 'demo',
      latestSnapshotAt: null,
      scannedFiles: meta.scannedFiles || 0,
      skippedLines: meta.skippedLines || 0,
      tokenTotals
    },
    warnings: ['Use Codex at least once so local sessions contain quota snapshots.']
  };
}

module.exports = {
  clampPercent,
  normalizeWindow,
  normalizeUsageSnapshot
};
