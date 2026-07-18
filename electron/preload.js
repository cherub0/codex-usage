const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexUsage', {
  getSnapshot: () => ipcRenderer.invoke('codex-usage:get-snapshot'),
  getProcessState: () => ipcRenderer.invoke('codex-usage:get-process-state'),
  controlWindow: (action) => ipcRenderer.invoke('codex-usage:window-control', action)
});
