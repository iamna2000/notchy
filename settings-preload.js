// Cầu nối cho cửa sổ Cài đặt (renderer/settings.html)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (key, val) => ipcRenderer.invoke('settings:set', String(key), val),
  act: (name) => ipcRenderer.invoke('settings:act', String(name)),
  geo: (q) => ipcRenderer.invoke('settings:geo', String(q || '')),
  onState: (cb) => ipcRenderer.on('settings:state', (_e, v) => cb(v)),
  onGoto: (cb) => ipcRenderer.on('settings:goto', (_e, v) => cb(String(v || ''))),
});
