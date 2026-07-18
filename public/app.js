const elements = {
  statusPill: document.getElementById('status-pill'),
  lastRefresh: document.getElementById('last-refresh'),
  quotaGrid: document.getElementById('quota-grid'),
  sourceSummary: document.getElementById('source-summary'),
  tokenSummary: document.getElementById('token-summary'),
  warnings: document.getElementById('warnings'),
  refreshButton: document.getElementById('refresh-button')
};

const statusLabels = {
  live: 'Live data',
  partial: 'Partial data',
  demo: 'Demo mode',
  format_changed: 'Format changed'
};

async function fetchUsage() {
  const response = await fetch('/api/usage', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Usage API returned ${response.status}`);
  }
  return response.json();
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `${Math.round(value)}%`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat().format(number);
}

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatReset(windowData) {
  if (Number.isFinite(windowData.resetSeconds)) {
    const totalMinutes = Math.max(0, Math.round(windowData.resetSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  return formatDateTime(windowData.resetAt);
}

function setStatus(mode) {
  elements.statusPill.className = `status-pill status-${mode || 'loading'}`;
  elements.statusPill.textContent = statusLabels[mode] || 'Loading';
}

function renderWindowCard(windowData) {
  const remaining = Math.max(0, Math.min(100, Number(windowData.remainingPercent || 0)));
  const card = document.createElement('article');
  card.className = `quota-card quota-${windowData.confidence || 'live'}`;
  card.innerHTML = `
    <div class="quota-card-head">
      <div>
        <span class="panel-kicker">${windowData.id === '5h' ? 'Active' : 'Rolling'}</span>
        <h2>${windowData.label}</h2>
      </div>
      <span class="confidence">${windowData.confidence || 'live'}</span>
    </div>
    <div class="ring-wrap">
      <div class="quota-ring" style="--value: ${remaining}">
        <div class="ring-core">
          <strong>${formatPercent(remaining)}</strong>
          <span>remaining</span>
        </div>
      </div>
    </div>
    <div class="quota-metrics">
      <div>
        <span>Used</span>
        <strong>${formatPercent(windowData.usedPercent)}</strong>
      </div>
      <div>
        <span>Reset</span>
        <strong>${formatReset(windowData)}</strong>
      </div>
    </div>
  `;
  return card;
}

function renderQuotaGrid(data) {
  elements.quotaGrid.replaceChildren();
  if (!Array.isArray(data.windows) || data.windows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = data.message || 'No quota windows are available yet.';
    elements.quotaGrid.append(empty);
    return;
  }
  for (const windowData of data.windows) {
    elements.quotaGrid.append(renderWindowCard(windowData));
  }
}

function renderSource(data) {
  const summary = data.summary || {};
  elements.sourceSummary.innerHTML = `
    <dl>
      <div><dt>Mode</dt><dd>${statusLabels[data.mode] || data.mode || 'Unknown'}</dd></div>
      <div><dt>Source</dt><dd>${summary.source || 'Unknown'}</dd></div>
      <div><dt>Latest snapshot</dt><dd>${formatDateTime(summary.latestSnapshotAt)}</dd></div>
      <div><dt>Scanned files</dt><dd>${formatNumber(summary.scannedFiles)}</dd></div>
      <div><dt>Skipped lines</dt><dd>${formatNumber(summary.skippedLines)}</dd></div>
    </dl>
    <p class="source-message">${data.message || ''}</p>
  `;
}

function renderTokens(data) {
  const totals = data.summary?.tokenTotals || {};
  elements.tokenSummary.innerHTML = `
    <div class="token-row"><span>Total</span><strong>${formatNumber(totals.total)}</strong></div>
    <div class="token-row"><span>Input</span><strong>${formatNumber(totals.input)}</strong></div>
    <div class="token-row"><span>Cached input</span><strong>${formatNumber(totals.cachedInput)}</strong></div>
    <div class="token-row"><span>Output</span><strong>${formatNumber(totals.output)}</strong></div>
  `;
}

function renderWarnings(data) {
  elements.warnings.replaceChildren();
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  if (warnings.length === 0) {
    const quiet = document.createElement('p');
    quiet.className = 'quiet-note';
    quiet.textContent = 'No warnings. Local data is being read without exposing transcript content.';
    elements.warnings.append(quiet);
    return;
  }
  for (const warning of warnings) {
    const item = document.createElement('p');
    item.className = 'warning-item';
    item.textContent = warning;
    elements.warnings.append(item);
  }
}

function renderUsage(data) {
  setStatus(data.mode);
  elements.lastRefresh.textContent = `Updated ${formatDateTime(data.generatedAt)}`;
  renderQuotaGrid(data);
  renderSource(data);
  renderTokens(data);
  renderWarnings(data);
}

function renderError(error) {
  setStatus('format_changed');
  elements.lastRefresh.textContent = 'Refresh failed';
  elements.quotaGrid.innerHTML = `<div class="empty-state">The dashboard could not load usage data.</div>`;
  elements.sourceSummary.innerHTML = `<p class="source-message">${error.message}</p>`;
  elements.tokenSummary.innerHTML = '';
  elements.warnings.innerHTML = `<p class="warning-item">Check that the local server is still running.</p>`;
}

async function refresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.classList.add('is-loading');
  try {
    renderUsage(await fetchUsage());
  } catch (error) {
    renderError(error);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.classList.remove('is-loading');
  }
}

elements.refreshButton.addEventListener('click', refresh);
refresh();
