interface ElectronAPI {
	send: (channel: string, data?: any) => void;
	on: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated', func: (...args: any[]) => void) => void;
	off: (channel: 'selected-blender-folder' | 'config-updated' | 'executable-updated', func: (...args: any[]) => void) => void;
	getBlenders: () => Promise<any[]>;
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
