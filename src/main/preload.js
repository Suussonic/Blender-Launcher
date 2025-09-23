// Preload script pour exposer une API sécurisée au renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-folder-dialog', 'launch-blender', 'change-executable'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    }
  },
  off: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, func);
    }
  },
  getBlenders: () => ipcRenderer.invoke('get-blenders')
});
