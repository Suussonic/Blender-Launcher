import React, { useEffect, useState } from 'react';
import ViewBuild from './ViewBuild';

interface ViewCloneProps {
	isOpen: boolean;
	onClose: () => void;
	repoName: string;
	repoUrl: string;
	owner: string;
	onCloneStateChange?: (state: { isCloning: boolean; progress: number; text: string; repoName?: string; } | null) => void;
}

const ViewClone: React.FC<ViewCloneProps> = ({ isOpen, onClose, repoName, repoUrl, owner, onCloneStateChange }) => {
	const [selectedBranch, setSelectedBranch] = useState('main');
	const [targetLocation, setTargetLocation] = useState('');
	const [folderName, setFolderName] = useState('');
	const [branches, setBranches] = useState<string[]>(['main']);
	const [showBuildModal, setShowBuildModal] = useState(false);
	const [missingTools, setMissingTools] = useState<string[] | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [cloning, setCloning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load branches
	useEffect(() => {
		if (!isOpen || !owner || !repoName) return;
		const loadBranches = async () => {
			setLoading(true);
			try {
				const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches`);
				if (response.ok) {
					const branchData = await response.json();
					const branchNames = branchData.map((b: any) => b.name);
					setBranches(branchNames);
					if (branchNames.includes('main')) setSelectedBranch('main');
					else if (branchNames.includes('master')) setSelectedBranch('master');
					else if (branchNames.length > 0) setSelectedBranch(branchNames[0]);
				}
			} catch (e) { console.error('[ViewClone] loadBranches error', e); }
			finally { setLoading(false); }
		};
		void loadBranches();
	}, [isOpen, owner, repoName]);

	// Default folder name from repo+branch
	useEffect(() => {
		if (repoName && selectedBranch) setFolderName(`${repoName}-${selectedBranch}`);
	}, [repoName, selectedBranch]);

	// Progress routing to bottom bar
	useEffect(() => {
		if (!isOpen) return;
		const handler = (_: any, progressData: any) => {
			const pct = typeof progressData?.progress === 'number' ? progressData.progress : 0;
			const text = progressData?.text || '';
			onCloneStateChange?.({ isCloning: true, progress: pct, text, repoName: `${owner}/${repoName}` });
			// If main preflight reports missing tools, open the build tools modal here
			if (progressData?.event === 'MISSING_TOOLS') {
				const miss = Array.isArray(progressData?.missing) ? progressData.missing as string[] : undefined;
				setMissingTools(miss);
				setShowBuildModal(true);
			}
		};
		(window as any).electronAPI?.on?.('clone-progress', handler);
		return () => { (window as any).electronAPI?.off?.('clone-progress', handler); };
	}, [isOpen, owner, repoName, onCloneStateChange]);

	const handleSelectFolder = async () => {
		try {
			const result = await (window as any).electronAPI?.invoke?.('select-output-folder');
			if (typeof result === 'string' && result.trim()) setTargetLocation(result);
		} catch (e) { console.warn('[ViewClone] select-output-folder failed', e); }
	};

	const handleClone = async () => {
		if (!targetLocation || !folderName.trim()) return;
		try {
			const check = await (window as any).electronAPI?.invoke?.('check-build-tools');
			if (check && Array.isArray(check.missing) && check.missing.length > 0) {
				setMissingTools(check.missing);
				setShowBuildModal(true);
				return;
			}
		} catch (e) {
			setMissingTools(undefined);
			setShowBuildModal(true);
			return;
		}

		const doClone = async () => {
			setCloning(true); setError(null);
			onCloneStateChange?.({ isCloning: true, progress: 0, text: 'Clonage en cours...', repoName: `${owner}/${repoName}` });
			try {
				console.log('[ViewClone] invoke clone-repository with', { repoUrl, branch: selectedBranch, target: targetLocation, name: folderName.trim() });
				// Fire and close immediately; bottom bar will track
				(window as any).electronAPI?.invoke?.('clone-repository', {
					// Accept both shapes in main: repoUrl/url, target/targetPath, name/folderName
					repoUrl, url: repoUrl,
					branch: selectedBranch,
					target: targetLocation, targetPath: targetLocation,
					name: folderName.trim(), folderName: folderName.trim(),
				}).catch((e:any)=> console.error('[ViewClone] clone invoke error', e));
				onClose();
			} catch (error) {
				console.error('[ViewClone] clone error', error);
				const msg = error instanceof Error ? error.message : 'Erreur inconnue';
				setError(msg);
				onCloneStateChange?.({ isCloning: false, progress: 0, text: `Erreur: ${msg}`, repoName: `${owner}/${repoName}` });
			} finally {
				setCloning(false);
			}
		};
		await doClone();
	};

	const onBuildInstalled = async (success: boolean) => {
		setShowBuildModal(false);
		if (success) try { await handleClone(); } catch {}
	};

	if (!isOpen) return null;

	return (
		<>
			<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
				<div style={{ background: '#11181f', border: '1px solid #24303a', borderRadius: 16, width: 520, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.6)' }}>
					<div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2932', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<h3 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>Cloner le dépôt</h3>
						<button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }} title="Fermer">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
					<div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
						<div style={{ fontSize: 14, color: '#94a3b8' }}><strong style={{ color: '#e2e8f0' }}>{owner}/{repoName}</strong></div>
						<div>
							<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Branche à cloner</label>
							<select value={selectedBranch} onChange={(e)=> setSelectedBranch(e.target.value)} disabled={loading} style={{ width: '100%', padding: '10px 12px', background: '#1a232b', border: '1px solid #24303a', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}>
								{branches.map((b)=> <option key={b} value={b}>{b}</option>)}
							</select>
							{loading && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Chargement des branches...</div>}
						</div>
						<div>
							<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Emplacement de destination</label>
							<div style={{ display: 'flex', gap: 8 }}>
								<input type="text" value={targetLocation} onChange={(e)=> setTargetLocation(e.target.value)} placeholder="Sélectionnez un dossier ou tapez le chemin..." style={{ flex:1, padding:'10px 12px', background:'#1a232b', border:'1px solid #24303a', borderRadius:8, color:'#e2e8f0', fontSize:14 }} />
								<button onClick={handleSelectFolder} style={{ padding: '10px 12px', background: '#1e2530', border: '1px solid #24303a', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }} title="Sélectionner un dossier">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3"/><path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
								</button>
							</div>
						</div>
						{targetLocation && (
							<div>
								<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Nom du dossier créé</label>
								<input type="text" value={folderName} onChange={(e)=> setFolderName(e.target.value)} placeholder="Nom du dossier..." style={{ width: '100%', padding:'10px 12px', background:'#1a232b', border:'1px solid #24303a', borderRadius:8, color:'#e2e8f0', fontSize:14, fontFamily:'monospace' }} />
							</div>
						)}
					</div>
					{error && (
						<div style={{ padding: '16px 24px', borderTop: '1px solid #1f2932', borderBottom:'1px solid #1f2932', background:'#1a0f0f' }}>
							<div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>❌ Erreur de clonage</div>
							<div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>{error}</div>
						</div>
					)}
					<div style={{ padding:'16px 24px', borderTop:'1px solid #1f2932', display:'flex', gap:12, justifyContent:'flex-end' }}>
						<button onClick={handleClone} disabled={!targetLocation || !folderName.trim() || cloning} style={{ padding:'8px 16px', background:(!targetLocation || !folderName.trim() || cloning) ? '#1a232b' : (error ? '#dc2626' : '#2563eb'), border:'none', borderRadius:8, color:(!targetLocation || !folderName.trim() || cloning) ? '#64748b' : '#fff', cursor:(!targetLocation || !folderName.trim() || cloning) ? 'not-allowed':'pointer', fontSize:14, fontWeight:500 }}>
							{cloning ? 'Clonage...' : (error ? 'Réessayer' : 'Cloner')}
						</button>
					</div>
				</div>
			</div>
			<ViewBuild isOpen={showBuildModal} onClose={()=> setShowBuildModal(false)} onInstalled={onBuildInstalled} missingTools={missingTools} />
		</>
	);
};

export default ViewClone;