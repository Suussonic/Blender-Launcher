interface ElectronAPI {
  send: (channel: string, data?: any) => void;
  on: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result', func: (...args: any[]) => void) => void;
  off: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result', func: (...args: any[]) => void) => void;
  invoke: (channel: string, data?: any) => Promise<any>;
  getBlenders: () => Promise<any[]>;
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
