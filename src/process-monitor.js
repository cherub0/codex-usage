const { execFile } = require('node:child_process');

const CODEX_PROCESS_NAMES = new Set([
  'codex',
  'codex.exe',
  'codex-cli',
  'codex-cli.exe',
  'openai codex',
  'openai codex.exe'
]);

function isCodexProcessName(name) {
  if (!name || typeof name !== 'string') return false;
  return CODEX_PROCESS_NAMES.has(name.trim().toLowerCase());
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseWindowsProcessList(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      const [name, pid] = parseCsvLine(line);
      const parsedPid = Number(pid);
      return {
        name,
        pid: Number.isFinite(parsedPid) ? parsedPid : null
      };
    })
    .filter((row) => row.name);
}

function hasCodexProcess(processes) {
  return Array.isArray(processes) && processes.some((process) => isCodexProcessName(process.name));
}

function getWindowsProcesses() {
  const command = 'Get-CimInstance Win32_Process | Select-Object Name,ProcessId | ConvertTo-Csv -NoTypeInformation';
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', command], {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(parseWindowsProcessList(stdout));
    });
  });
}

async function isCodexRunning() {
  try {
    return hasCodexProcess(await getWindowsProcesses());
  } catch {
    return false;
  }
}

module.exports = {
  isCodexProcessName,
  parseWindowsProcessList,
  hasCodexProcess,
  getWindowsProcesses,
  isCodexRunning
};
