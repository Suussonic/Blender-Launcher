import React, { useEffect, useState } from 'react';
import { AiOutlineBulb, AiOutlineCloseCircle } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import ModalCloseButton from '../../shared/components/ModalCloseButton';

interface ViewCloneProps {
	isOpen: boolean;
	onClose: () => void;
	repoName: string;
	repoUrl: string;
	owner: string;
	onCloneStateChange?: (state: { isCloning: boolean; progress: number; text: string; repoName?: string; } | null) => void;
}

const ViewClone: React.FC<ViewCloneProps> = ({ isOpen, onClose, repoName, repoUrl, owner, onCloneStateChange }) => {
	const { t } = useTranslation();
	const [selectedBranch, setSelectedBranch] = useState('main');
	const [targetLocation, setTargetLocation] = useState('');
	const [folderName, setFolderName] = useState('');
	const [branches, setBranches] = useState<string[]>(['main']);
	const [loading, setLoading] = useState(false);
	const [cloning, setCloning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load available branches when the modal opens.
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

	// Use branch name as default folder label.
	useEffect(() => {
		if (repoName && selectedBranch) {
			const cleanBranch = selectedBranch.replace(/^blender-/i, '');
			setFolderName(cleanBranch);
		}
	}, [repoName, selectedBranch]);

	// Route legacy clone-progress events (without jobId) to the bottom progress bar.
	useEffect(() => {
		if (!isOpen) return;
		const handler = (_: any, progressData: any) => {
			if (progressData?.jobId) return;
			const pct = typeof progressData?.progress === 'number' ? progressData.progress : 0;
			const text = progressData?.text || '';
			onCloneStateChange?.({ isCloning: true, progress: pct, text, repoName: `${owner}/${repoName}` });
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

		// Correlates UI events for this clone request across processes.
		const jobId = `clone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

		setCloning(true);
		setError(null);

		// Prefer the official forge URL when the public GitHub mirror is selected.
		let finalRepoUrl = repoUrl;
		if (repoUrl.includes('github.com/blender/blender')) {
			finalRepoUrl = 'https://projects.blender.org/blender/blender.git';
		}

		const displayName = `${owner}/${repoName}`;

		console.log('[ViewClone] invoking clone-only:', { jobId, repoUrl: finalRepoUrl, branch: selectedBranch, target: targetLocation, name: folderName.trim() });

		// Start clone only; compilation is explicitly started later from pending jobs.
		(window as any).electronAPI?.invoke?.('clone-only', {
			repoUrl: finalRepoUrl,
			url: finalRepoUrl,
			branch: selectedBranch,
			target: targetLocation,
			targetPath: targetLocation,
			name: folderName.trim(),
			folderName: folderName.trim(),
			jobId,
			repoDisplayName: displayName,
			repoName: displayName,
		}).catch((e: any) => {
			console.error('[ViewClone] clone-only error', e);
		});

		// Progress continues from the pending job in the sidebar.
		setCloning(false);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<>
			<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
				<div style={{ background: '#11181f', border: '1px solid #24303a', borderRadius: 16, width: 520, maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.6)' }}>
					<div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2932', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<h3 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>{t('clone.repo', 'Cloner le dépôt')}</h3>
						<ModalCloseButton onClick={onClose} title={t('close', 'Fermer')} />
					</div>
					<div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
						<div style={{ fontSize: 14, color: '#94a3b8' }}><strong style={{ color: '#e2e8f0' }}>{owner}/{repoName}</strong></div>
						<div>
							<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>{t('clone.branch', 'Branche à cloner')}</label>
							<select value={selectedBranch} onChange={(e)=> setSelectedBranch(e.target.value)} disabled={loading} style={{ width: '100%', padding: '10px 12px', background: '#1a232b', border: '1px solid #24303a', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}>
								{branches.map((b)=> <option key={b} value={b}>{b}</option>)}
							</select>
							{loading && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{t('clone.loading_branches', 'Chargement des branches...')}</div>}
						</div>
						<div>
							<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>{t('destination.location', 'Emplacement de destination')}</label>
							<div style={{ display: 'flex', gap: 8 }}>
								<input type="text" value={targetLocation} onChange={(e)=> setTargetLocation(e.target.value)} placeholder={t('select_folder_path', 'Sélectionnez un dossier ou tapez le chemin...')} style={{ flex:1, padding:'10px 12px', background:'#1a232b', border:'1px solid #24303a', borderRadius:8, color:'#e2e8f0', fontSize:14 }} />
								<button onClick={handleSelectFolder} style={{ padding: '10px 12px', background: '#1e2530', border: '1px solid #24303a', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }} title={t('select_folder', 'Sélectionner un dossier')}>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3"/><path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
								</button>
							</div>
						</div>
						{targetLocation && (
							<div>
								<label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>{t('folder_name_created', 'Nom du dossier créé')}</label>
								<input type="text" value={folderName} onChange={(e)=> setFolderName(e.target.value)} placeholder={t('folder_name_placeholder', 'Nom du dossier...')} style={{ width: '100%', padding:'10px 12px', background:'#1a232b', border:'1px solid #24303a', borderRadius:8, color:'#e2e8f0', fontSize:14, fontFamily:'monospace' }} />
							</div>
						)}
					</div>
				{/* Build is intentionally separated from clone to let users validate source first. */}
				{targetLocation && folderName.trim() && (
					<div style={{ padding: '12px 16px', borderTop: '1px solid #1f2932', background:'#0f1518' }}>
						<div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
							<AiOutlineBulb style={{ color: '#94a3b8', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }} /> Le dépôt sera cloné localement. Une fois cloné, cliquez sur l'entrée grisée dans la barre latérale pour lancer la compilation (30-90 min).
							</div>
						</div>
					)}
					{error && (
						<div style={{ padding: '16px 24px', borderTop: '1px solid #1f2932', borderBottom:'1px solid #1f2932', background:'#1a0f0f' }}>
							<div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}><AiOutlineCloseCircle style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('clone.error', 'Erreur de clonage')}</div>
							<div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>{error}</div>
						</div>
					)}
					<div style={{ padding:'16px 24px', borderTop:'1px solid #1f2932', display:'flex', gap:12, justifyContent:'flex-end' }}>
				<button onClick={handleClone} disabled={!targetLocation || !folderName.trim() || cloning} style={{ padding:'8px 16px', background:(!targetLocation || !folderName.trim() || cloning) ? '#1a232b' : '#2563eb', border:'none', borderRadius:8, color:(!targetLocation || !folderName.trim() || cloning) ? '#64748b' : '#fff', cursor:(!targetLocation || !folderName.trim() || cloning) ? 'not-allowed':'pointer', fontSize:14, fontWeight:500 }}>
						{cloning ? t('starting', 'Démarrage…') : t('clone', 'Cloner')}
						</button>
					</div>
				</div>
			</div>
		</>
	);
};

export default ViewClone;