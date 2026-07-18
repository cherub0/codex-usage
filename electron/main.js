const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { createDesktopSnapshot } = require('../src/desktop-snapshot');
const { isCodexRunning } = require('../src/process-monitor');

const FORCE_SHOW = process.env.CODEX_USAGE_FORCE_SHOW === '1';
const CHECK_INTERVAL_MS = 3000;

let mainWindow = null;
let codexRunning = false;
let monitorTimer = null;

function createFloatingWindow() {
  const window = new BrowserWindow({
    width: 360,
    height: 520,
    minWidth: 320,
    minHeight: 460,
    resizable: false,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.setAlwaysOnTop(true, 'screen-saver');
  window.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
  return window;
}

async function updateWindowVisibility() {
  codexRunning = FORCE_SHOW || await isCodexRunning();
  if (!mainWindow) return;

  if (codexRunning) {
    if (!mainWindow.isVisible()) mainWindow.show();
  } else if (mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

function registerIpcHandlers() {
  ipcMain.handle('codex-usage:get-snapshot', () => createDesktopSnapshot());
  ipcMain.handle('codex-usage:get-process-state', () => ({ codexRunning }));
}

function startProcessMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = setInterval(updateWindowVisibility, CHECK_INTERVAL_MS);
  updateWindowVisibility();
}

app.whenReady().then(() => {
  registerIpcHandlers();
  mainWindow = createFloatingWindow();
  startProcessMonitor();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createFloatingWindow();
      updateWindowVisibility();
    }
  });
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
  if (mainWindow) mainWindow.hide();
});

app.on('before-quit', () => {
  clearInterval(monitorTimer);
});
