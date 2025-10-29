// Preload script pour exposer une API sécurisée au renderer
const { contextBridge, ipcRenderer } = require('electron');

// Ajout de logs de debug pour diagnostiquer l'absence de invoke côté renderer
const api = {
  send: (channel, ...args) => {
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-folder-dialog', 'launch-blender', 'change-executable', 'delete-executable', 'open-blend-file', 'reveal-in-folder'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn('[preload] Channel send non autorisé:', channel);
    }
  },
  on: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated', 'executable-deleted', 'delete-executable-result', 'render-progress', 'navigate-home', 'open-settings', 'toast', 'clone-progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    } else {
      console.warn('[preload] Channel on non autorisé:', channel);
    }
  },
  off: (channel, func) => {
    const validChannels = ['selected-blender-folder', 'config-updated', 'executable-updated', 'executable-deleted', 'delete-executable-result', 'render-progress', 'navigate-home', 'open-settings', 'toast', 'clone-progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.off(channel, func);
    } else {
      console.warn('[preload] Channel off non autorisé:', channel);
    }
  },
  invoke: (channel, ...args) => {
    const validChannels = [
      'get-blenders',
  'reorder-blenders',
      'update-executable-title',
      'delete-executable',
      'get-recent-blend-files',
      'remove-recent-blend-file',
      'get-general-config',
      'update-general-config',
      'get-discord-config',
      'update-discord-config',
      'update-discord-presence',
      'get-discord-availability',
      'get-steam-config',
      'update-steam-config',
      'get-steam-availability'
      , 'scan-and-merge-blenders'
      , 'get-blend-metadata'
      , 'select-output-folder'
      , 'start-render'
      // Addons-related IPC
      , 'get-addons'
      , 'scan-addons-fs'
      , 'enable-addon'
      , 'remove-addon'
      , 'install-addon-on'
      // Clone repository
      , 'clone-repository'
      // Build tools helpers
      , 'check-build-tools'
      , 'install-build-tools'
    ];
    if (validChannels.includes(channel)) {
      // Retry wrapper: some races in packaged builds caused the renderer
      // to call invoke() before main registered handlers. Retry a few times
      // with backoff when we detect handler-missing or transient errors.
      const maxAttempts = 4;
      let attempt = 0;
      const attemptInvoke = async () => {
        attempt++;
        try {
          // Debug log to help diagnosing missing-handler issues in production
          try { console.debug && console.debug('[preload] invoke', channel, 'attempt', attempt); } catch {}
          const res = await ipcRenderer.invoke(channel, ...args);
          return res;
        } catch (err) {
          const msg = (err && err.message) ? err.message : String(err);
          try { console.warn('[preload] invoke error', channel, 'attempt', attempt, msg); } catch {}
          // If error message indicates no handler registered, or if we haven't exhausted attempts, retry
          const isNoHandler = msg && msg.toLowerCase().includes('no handler registered');
          if (attempt < maxAttempts && (isNoHandler || true)) {
            // backoff delay
            const delay = 120 * attempt;
            await new Promise(r => setTimeout(r, delay));
            return attemptInvoke();
          }
          throw err;
        }
      };
      return attemptInvoke();
    }
    console.warn('[preload] Canal invoke non autorisé demandé:', channel);
    return Promise.reject(new Error(`Canal non autorisé: ${channel}`));
  },
  getBlenders: () => ipcRenderer.invoke('get-blenders'),
  // convenience helpers for addons
  getAddons: (exePath) => ipcRenderer.invoke('get-addons', exePath),
  scanAddonsFs: (payload) => ipcRenderer.invoke('scan-addons-fs', payload),
  enableAddon: (params) => ipcRenderer.invoke('enable-addon', params),
  removeAddon: (params) => ipcRenderer.invoke('remove-addon', params),
  installAddon: (params) => ipcRenderer.invoke('install-addon-on', params),
  debugInfo: () => ({
    keys: Object.keys(apiRef),
    hasInvoke: typeof apiRef.invoke === 'function'
  })
};

// Pour éviter référence circulaire sur debugInfo
const apiRef = api;

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[preload] API exposée, clés =', Object.keys(api));
