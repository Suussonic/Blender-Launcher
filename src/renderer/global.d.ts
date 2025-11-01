interface ElectronAPI {
  send: (channel: string, data?: any) => void; // inclut open-blend-file, reveal-in-folder
  on: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result' | 'render-progress' | 'navigate-home' | 'open-settings' | 'toast' | 'install-progress' | 'clone-progress' | 'build-tools-progress', func: (...args: any[]) => void) => void;
  off: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated' | 'executable-deleted' | 'delete-executable-result' | 'render-progress' | 'navigate-home' | 'open-settings' | 'toast' | 'install-progress' | 'clone-progress' | 'build-tools-progress', func: (...args: any[]) => void) => void;
  invoke: (channel: string, data?: any) => Promise<any>;
  getBlenders: () => Promise<any[]>;
  reorderBlenders?: (paths: string[]) => Promise<{success:boolean}>;
  // Discord
  // Steam
  // get-steam-config -> { enabled:boolean }
  // update-steam-config -> { success:boolean; steam?:object }
  // get-discord-config -> { enabled:boolean; showFile:boolean; showTitle:boolean; appId:string } (showTime supprimé)
  // update-discord-config -> { success:boolean; discord?:object }
  // update-discord-presence -> { success:boolean }
  // Nouvelle méthode utilitaire éventuelle
  // getRecentBlendFiles?: (exePath: string) => Promise<{version: string|null; files: Array<{path:string; name:string; exists:boolean; size?:number; mtime?:number}>}>;
  // remove-recent-blend-file: (exePath, blendPath) => { success:boolean; reason?:string }
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
