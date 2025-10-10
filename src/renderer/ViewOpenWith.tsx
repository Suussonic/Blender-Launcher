import React, { useEffect, useState, useRef } from 'react';

type BlenderExe = {
	path: string;
	name: string;
	title: string;
	icon?: string;
};

interface ViewOpenWithProps {
	isOpen: boolean;
	filePath: string | null;
	onClose: () => void;
	// optional callback when a blender is chosen; if provided, it's called with the blender object
	onSelect?: (b: BlenderExe) => void;
}

const ViewOpenWith: React.FC<ViewOpenWithProps> = ({ isOpen, filePath, onClose, onSelect }) => {
	const [blenders, setBlenders] = useState<BlenderExe[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const firstBtnRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		const load = async () => {
			setLoading(true); setError(null);
			try {
				const list = await window.electronAPI?.getBlenders?.();
				if (!cancelled && list) setBlenders(list as any);
			} catch (e:any) {
				if (!cancelled) setError(e.message || 'Erreur chargement');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		load();
		// Focus trap initial sur premier bouton
		setTimeout(() => { firstBtnRef.current?.focus(); }, 10);
		return () => { cancelled = true; };
	}, [isOpen]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { onClose(); }
		};
		if (isOpen) window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [isOpen, onClose]);

	// (Global scrollbar styles now injected in index.html)

	if (!isOpen) return null;
	return (
		<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div style={{ width: 540, maxWidth: '100%', maxHeight: '80vh', background: '#11181f', border: '1px solid #24303a', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.6)' }}>
				<div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2932', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<h3 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>Ouvrir avec</h3>
					<button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }} title="Fermer">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
				<div className="hide-scrollbar" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
					{filePath && (
						<div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Fichier: {filePath}</div>
					)}
					{loading && <div style={{ color: '#94a3b8', fontSize: 14 }}>Chargement...</div>}
					{error && <div style={{ color: '#ef4444', fontSize: 14 }}>Erreur: {error}</div>}
					{!loading && !error && blenders.length === 0 && <div style={{ color: '#64748b', fontSize: 14 }}>Aucun Blender enregistré.</div>}
					{!loading && !error && blenders.map((b, idx) => (
						<button
							key={b.path + idx}
							ref={idx === 0 ? firstBtnRef : undefined}
							onClick={() => {
								if (onSelect) {
									try { onSelect(b); } catch {};
								} else {
									if (filePath && window.electronAPI?.send) {
										window.electronAPI.send('open-blend-file', { exePath: b.path, blendPath: filePath });
									}
								}
								onClose();
							}}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 14,
								width: '100%',
								background: '#1a232b',
								border: '1px solid #24303a',
								color: '#e2e8f0',
								padding: '10px 12px',
								borderRadius: 10,
								cursor: 'pointer',
								textAlign: 'left',
								transition: 'background 0.15s, border-color 0.15s'
							}}
							onMouseOver={(e) => { e.currentTarget.style.background = '#23313c'; e.currentTarget.style.borderColor = '#2f3e4a'; }}
							onMouseOut={(e) => { e.currentTarget.style.background = '#1a232b'; e.currentTarget.style.borderColor = '#24303a'; }}
						>
							<img
								src={b.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
								alt=''
								style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', background: 'transparent', boxShadow: 'none' }}
							/>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title || b.name}</div>
								<div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.path}</div>
							</div>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
						</button>
					))}
				</div>
				{/* Footer supprimé (bouton Annuler retiré) */}
			</div>
		</div>
	);
};

export default ViewOpenWith;
