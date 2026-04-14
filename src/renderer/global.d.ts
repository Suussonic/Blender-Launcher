interface ElectronAPI {
  // Fire-and-forget IPC messages from renderer to main.
  send: (channel: string, data?: any) => void;
  on: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result' | 'render-progress' | 'navigate-home' | 'open-settings' | 'toast' | 'install-progress' | 'clone-progress' | 'build-tools-progress', func: (...args: any[]) => void) => void;
  off: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result' | 'render-progress' | 'navigate-home' | 'open-settings' | 'toast' | 'install-progress' | 'clone-progress' | 'build-tools-progress', func: (...args: any[]) => void) => void;
  invoke: (channel: string, data?: any) => Promise<any>;
  getBlenders: () => Promise<any[]>;
  reorderBlenders?: (paths: string[]) => Promise<{success:boolean}>;
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
