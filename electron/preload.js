const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexUsage', {
  getSnapshot: () => ipcRenderer.invoke('codex-usage:get-snapshot'),
  getProcessState: () => ipcRenderer.invoke('codex-usage:get-process-state')
});
