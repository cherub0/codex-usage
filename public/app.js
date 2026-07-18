const AUTO_REFRESH_MS = 5000;

const elements = {
  capacity: document.getElementById('capacity-section'),
  tokens: document.getElementById('tokens-section'),
  task: document.getElementById('task-section'),
  processState: document.getElementById('process-state'),
  updatedAt: document.getElementById('updated-at'),
  refreshButton: document.getElementById('refresh-button'),
  windowControls: document.querySelectorAll('[data-window-action]')
};

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return `${Math.round(number)}%`;
}

function formatTime(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function windowLabel(id) {
  if (id === '5h') return '5 小时';
  if (id === 'weekly') return '7 天';
  return '额度';
}

async function loadSnapshot() {
  if (window.codexUsage?.getSnapshot) {
    return window.codexUsage.getSnapshot();
  }

  const response = await fetch('/api/usage', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const usage = await response.json();
  return {
    usage,
    task: {
      title: '浏览器预览模式',
      status: '状态读取',
      progressPercent: null,
      confidence: '状态',
      updatedAt: null,
      message: 'Electron 模式会读取本机任务状态'
    },
    generatedAt: usage.generatedAt
  };
}

async function loadProcessState() {
  if (window.codexUsage?.getProcessState) {
    return window.codexUsage.getProcessState();
  }
  return { codexRunning: true };
}

function renderCapacity(usage) {
  const windows = Array.isArray(usage.windows) ? usage.windows.slice(0, 2) : [];
  const content = windows.length ? windows.map((item) => {
    const remaining = Math.max(0, Math.min(100, Number(item.remainingPercent || 0)));
    return `
      <div class="capacity-item">
        <div class="ring" style="--value:${remaining}">
          <span>${formatPercent(remaining)}</span>
        </div>
        <div class="capacity-copy">
          <strong>${windowLabel(item.id)}</strong>
          <span>剩余容量</span>
          <em>${item.confidence === 'demo' ? '演示' : '真实'}</em>
        </div>
      </div>
    `;
  }).join('') : '<p class="empty-text">暂无真实容量</p>';

  elements.capacity.innerHTML = `
    <div class="section-head">
      <h2>容量</h2>
      <span>${usage.mode === 'demo' ? '演示' : '实时'}</span>
    </div>
    <div class="capacity-grid">${content}</div>
  `;
}

function renderTokens(usage) {
  const totals = usage.summary?.tokenTotals || {};
  elements.tokens.innerHTML = `
    <div class="section-head">
      <h2>Token 消耗</h2>
      <span>本机统计</span>
    </div>
    <div class="token-total">
      <span>总计</span>
      <strong>${formatNumber(totals.total)}</strong>
    </div>
    <div class="metric-grid">
      <div><span>输入</span><strong>${formatNumber(totals.input)}</strong></div>
      <div><span>缓存</span><strong>${formatNumber(totals.cachedInput)}</strong></div>
      <div><span>输出</span><strong>${formatNumber(totals.output)}</strong></div>
    </div>
  `;
}

function renderTask(task) {
  const rawProgress = task.progressPercent;
  const hasRealProgress = rawProgress !== null
    && rawProgress !== undefined
    && rawProgress !== ''
    && Number.isFinite(Number(rawProgress));
  const progress = hasRealProgress ? Math.max(0, Math.min(100, Number(rawProgress))) : null;
  const progressText = hasRealProgress ? formatPercent(progress) : '';
  const progressClass = hasRealProgress ? 'task-progress' : 'task-progress is-hidden';
  elements.task.innerHTML = `
    <div class="section-head">
      <h2>当前任务</h2>
      <span>${hasRealProgress ? task.confidence || '真实' : '状态'}</span>
    </div>
    <div class="task-title">${task.title || '暂无任务数据'}</div>
    <div class="task-row">
      <span>${task.status || '暂无'}</span>
      <strong>${progressText}</strong>
    </div>
    <div class="progress-track ${progressClass}">
      <div class="progress-fill" style="width:${progress || 0}%"></div>
    </div>
    <p class="task-message">${task.message || '等待本机 Codex 状态更新'}</p>
  `;
}

function renderProcessState(state) {
  elements.processState.textContent = state.codexRunning ? 'Codex 运行中' : '等待 Codex';
}

async function refresh() {
  elements.refreshButton.disabled = true;
  try {
    const [snapshot, processState] = await Promise.all([
      loadSnapshot(),
      loadProcessState()
    ]);
    renderCapacity(snapshot.usage || {});
    renderTokens(snapshot.usage || {});
    renderTask(snapshot.task || {});
    renderProcessState(processState);
    elements.updatedAt.textContent = `更新 ${formatTime(snapshot.generatedAt)}`;
  } catch (error) {
    elements.capacity.innerHTML = '<h2>容量</h2><p class="empty-text">读取失败</p>';
    elements.tokens.innerHTML = '<h2>Token 消耗</h2><p class="empty-text">读取失败</p>';
    elements.task.innerHTML = `<h2>当前任务</h2><p class="empty-text">${error.message}</p>`;
    elements.processState.textContent = '状态异常';
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener('click', refresh);
for (const control of elements.windowControls) {
  control.addEventListener('click', () => {
    window.codexUsage?.controlWindow?.(control.dataset.windowAction);
  });
}
refresh();
setInterval(refresh, AUTO_REFRESH_MS);
