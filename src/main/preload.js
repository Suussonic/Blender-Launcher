// Preload script pour exposer une API sécurisée au renderer
const { contextBridge, ipcRenderer } = require('electron');

// Ajout de logs de debug pour diagnostiquer l'absence de invoke côté renderer
const api = {
  send: (channel, ...args) => {
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-folder-dialog', 'launch-blender', 'change-executable'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn('[preload] Channel send non autorisé:', channel);
    }
  },
  on: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    } else {
      console.warn('[preload] Channel on non autorisé:', channel);
    }
  },
  off: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, func);
    } else {
      console.warn('[preload] Channel off non autorisé:', channel);
    }
  },
  invoke: (channel, ...args) => {
    const validChannels = ['get-blenders', 'update-executable-title'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn('[preload] Canal invoke non autorisé demandé:', channel);
    return Promise.reject(new Error(`Canal non autorisé: ${channel}`));
  },
  getBlenders: () => ipcRenderer.invoke('get-blenders'),
  debugInfo: () => ({
    keys: Object.keys(apiRef),
    hasInvoke: typeof apiRef.invoke === 'function'
  })
};

// Pour éviter référence circulaire sur debugInfo
const apiRef = api;

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] API exposée, clés =', Object.keys(api));
