interface ElectronAPI {
	send: (channel: string, data?: any) => void;
	on: (channel: string, func: (...args: any[]) => void) => void;
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
