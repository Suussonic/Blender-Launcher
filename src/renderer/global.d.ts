interface ElectronAPI {
	send: (channel: string, data?: any) => void;
}

interface Window {
	electronAPI?: ElectronAPI;
}
declare module '*.ico';
