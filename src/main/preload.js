
// Preload script pour exposer une API sécurisée au renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, ...args) => {
    // On ne permet que les canaux autorisés
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-folder-dialog'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  }
});
