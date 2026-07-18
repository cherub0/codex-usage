const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { createDesktopSnapshot } = require('../src/desktop-snapshot');
const { isCodexRunning } = require('../src/process-monitor');

const FORCE_SHOW = process.env.CODEX_USAGE_FORCE_SHOW === '1';
const CHECK_INTERVAL_MS = 3000;

let mainWindow = null;
let codexRunning = false;
let monitorTimer = null;
let userMinimized = false;

function createFloatingWindow() {
  const window = new BrowserWindow({
    width: 360,
    height: 500,
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
  window.on('restore', () => {
    userMinimized = false;
  });
  window.on('show', () => {
    if (!window.isMinimized()) userMinimized = false;
  });
  window.webContents.on('did-finish-load', async () => {
    if (process.env.CODEX_USAGE_DEBUG_LOAD === '1') {
      const text = await window.webContents.executeJavaScript('new Promise((resolve) => setTimeout(() => resolve(document.body.innerText), 1500))');
      console.log(`Loaded ${window.webContents.getURL()}`);
      console.log(text);
    }
    if (process.env.CODEX_USAGE_CAPTURE_PATH) {
      setTimeout(async () => {
        const image = await window.webContents.capturePage();
        require('node:fs').writeFileSync(process.env.CODEX_USAGE_CAPTURE_PATH, image.toPNG());
        console.log(`Captured ${process.env.CODEX_USAGE_CAPTURE_PATH}`);
      }, 1800);
    }
  });
  window.webContents.on('console-message', (_event, level, message) => {
    if (process.env.CODEX_USAGE_DEBUG_LOAD === '1') {
      console.log(`renderer[${level}]: ${message}`);
    }
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });
  window.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
  return window;
}

function handleWindowControl(action) {
  if (!mainWindow) return;
  if (action === 'minimize') {
    userMinimized = true;
    mainWindow.minimize();
    return;
  }
  if (action === 'maximize') {
    userMinimized = false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return;
  }
  if (action === 'close') {
    app.quit();
  }
}

async function updateWindowVisibility() {
  codexRunning = FORCE_SHOW || await isCodexRunning();
  if (!mainWindow) return;

  if (codexRunning) {
    if (!mainWindow.isVisible() && !userMinimized) mainWindow.show();
  } else if (mainWindow.isVisible()) {
    userMinimized = false;
    mainWindow.hide();
  }
}

function registerIpcHandlers() {
  ipcMain.handle('codex-usage:get-snapshot', () => createDesktopSnapshot());
  ipcMain.handle('codex-usage:get-process-state', () => ({ codexRunning }));
  ipcMain.handle('codex-usage:window-control', (_event, action) => handleWindowControl(action));
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
