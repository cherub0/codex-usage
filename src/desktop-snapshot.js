const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { readLatestUsageSnapshot } = require('./codex-reader');
const { readCurrentTask } = require('./task-reader');

const sampleUsagePath = path.join(__dirname, '..', 'sample-data', 'usage.json');

async function loadDemoUsage() {
  const content = await fs.readFile(sampleUsagePath, 'utf8');
  return JSON.parse(content);
}

async function createDesktopSnapshot(options = {}) {
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const demoUsage = options.demoUsage || await loadDemoUsage();
  const lookbackDays = Number(options.lookbackDays || process.env.CODEX_LOOKBACK_DAYS || 14);

  const readUsage = options.readUsage || (() => readLatestUsageSnapshot({
    codexHome,
    demoUsage,
    lookbackDays
  }));
  const readTask = options.readTask || (() => readCurrentTask({ codexHome }));

  const [usage, task] = await Promise.all([
    readUsage(),
    readTask()
  ]);

  return {
    usage,
    task,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  createDesktopSnapshot
};
