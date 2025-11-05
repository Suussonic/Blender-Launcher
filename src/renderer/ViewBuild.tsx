import React, { useEffect, useMemo, useState } from 'react';

interface ViewBuildProps {
	isOpen: boolean;
	onClose: () => void;
	onInstalled?: (success: boolean) => void;
	missingTools?: string[];
}

type Tools = { git?: boolean; cmake?: boolean; ninja?: boolean; python?: boolean; msvc?: boolean };

const ViewBuild: React.FC<ViewBuildProps> = ({ isOpen, onClose, onInstalled, missingTools }) => {
	const [tools, setTools] = useState<Tools>({});
	const [checking, setChecking] = useState(false);
	const [installing, setInstalling] = useState(false);
	const [progress, setProgress] = useState<number>(0);
	const [status, setStatus] = useState<string>('');

	const missing = useMemo(() => Object.entries(tools).filter(([, v]) => v === false).map(([k]) => k), [tools]);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (_: any, payload: any) => {
			if (typeof payload?.progress === 'number') setProgress(Math.max(0, Math.min(100, payload.progress)));
			if (payload?.message) setStatus(String(payload.message));
		};
		(window as any).electronAPI?.on?.('build-tools-progress', handler);
		return () => { (window as any).electronAPI?.off?.('build-tools-progress', handler); };
	}, [isOpen]);

	const check = async () => {
		setChecking(true);
		try {
			const res = await (window as any).electronAPI?.invoke?.('check-build-tools');
			if (res?.success) setTools(res.tools || {});
		} finally { setChecking(false); }
	};

	const doInstall = async () => {
		setInstalling(true);
		setProgress(0);
		setStatus('Préparation de l\'installation…');
		try {
			const list = (Array.isArray(missingTools) && missingTools.length > 0)
				? missingTools
				: Object.entries(tools).filter(([, v]) => v === false).map(([k]) => k);
			const res = await (window as any).electronAPI?.invoke?.('install-build-tools', { tools: list });
			if (onInstalled) onInstalled(!!res?.success);
			// Re-check to update the grid statuses
			await check();
		} finally { setInstalling(false); }
	};

	useEffect(() => { if (isOpen) { void check(); } }, [isOpen]);

	if (!isOpen) return null;

	return (
		<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
			<div style={{ width: 720, maxWidth: '94vw', background: '#0b1220', borderRadius: 12, padding: 20, color: '#e6eef6', border: '1px solid #1f2a3a' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h3 style={{ margin: 0 }}>Outils de build requis</h3>
					<button onClick={onClose} disabled={installing} style={{ background: 'transparent', border: 'none', color: '#9fb0c2', cursor: 'pointer' }} title="Fermer">✕</button>
				</div>

				<div style={{ marginTop: 12, padding: 12, background: '#1a0f0f', border: '1px solid #3a1f1f', borderRadius: 8, fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
					<strong style={{ color: '#ef4444' }}>⚠️ Installation requise</strong>
					<br/>
					Les outils suivants sont nécessaires pour compiler Blender (make update + make compile) :
					<br/>• <strong>Git</strong> : Clonage du code source
					<br/>• <strong>CMake</strong> : Génération des fichiers de build
					<br/>• <strong>Visual Studio 2022</strong> (MSVC) : Compilateur C++ (avec "Desktop development with C++")
					<br/>• <strong>Ninja</strong> : Outil de build rapide
					<br/><br/>
					Sans ces outils, le clonage et la compilation ne peuvent pas aboutir.
				</div>

				<div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					{['git','cmake','msvc','ninja'].map(k => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid #253446', borderRadius: 8, background: '#0f1827' }}>
							<div style={{ width: 10, height: 10, borderRadius: 999, background: tools[k as keyof Tools] ? '#22c55e' : '#ef4444' }} />
							<div style={{ color: '#9fb0c2', fontSize: 13 }}>{k.toUpperCase()}</div>
						</div>
					))}
				</div>

						<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
					<button onClick={check} disabled={checking || installing} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6' }}>Re-vérifier</button>
					<button onClick={doInstall} disabled={installing} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#1f7aeb', color: '#fff' }}>Installer les prérequis</button>
				</div>

						{Array.isArray(missingTools) && missingTools.length > 0 && (
							<div style={{ marginTop: 10, padding: 10, background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 8 }}>
								<div style={{ color: '#ef4444', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>❌ Impossible de cloner et compiler</div>
								<div style={{ color: '#fca5a5', fontSize: 13 }}>
									Outils manquants détectés : <strong>{missingTools.join(', ')}</strong>
									<br/><br/>
									<strong>Que faire ?</strong>
									<br/>1. Cliquez sur "Installer les prérequis" pour les installer automatiquement
									<br/>2. OU installez-les manuellement :
									<br/>   • <strong>Git</strong> : <a href="https://git-scm.com/download/win" target="_blank" style={{ color: '#60a5fa' }}>git-scm.com</a>
									<br/>   • <strong>CMake</strong> : <a href="https://cmake.org/download/" target="_blank" style={{ color: '#60a5fa' }}>cmake.org</a>
									<br/>   • <strong>Visual Studio 2022</strong> : <a href="https://visualstudio.microsoft.com/fr/downloads/" target="_blank" style={{ color: '#60a5fa' }}>visualstudio.com</a> (version Community gratuite, avec "Desktop development with C++")
									<br/><br/>
									Une fois installés, cliquez sur "Re-vérifier" puis retentez le clonage.
								</div>
							</div>
						)}

					{/* Simple progress bar instead of verbose logs */}
					{installing && (
						<div style={{ marginTop: 12 }}>
							<div style={{ height: 10, background: '#132034', borderRadius: 6, overflow: 'hidden', border: '1px solid #253446' }}>
								<div style={{ width: `${progress}%`, height: '100%', background: '#1f7aeb', transition: 'width 200ms ease' }} />
							</div>
							<div style={{ marginTop: 6, color: '#9fb0c2', fontSize: 12 }}>{status || 'Installation en cours…'}</div>
						</div>
					)}

				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
					<button onClick={onClose} disabled={installing} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6' }}>Fermer</button>
				</div>
			</div>
		</div>
	);
};

export default ViewBuild;
