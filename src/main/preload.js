// Preload script pour exposer une API sécurisée au renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-folder-dialog', 'launch-blender'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, func) => {
    const validChannels = ['selected-blender-folder'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    }
  }
});
