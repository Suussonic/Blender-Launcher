import React from 'react';
import Filter, { RecentBlendFile } from './Filter';

type Props = {
  selectedBlender: { path: string } | null;
  recentLoading: boolean;
  recentError: string | null;
  recentFiles: RecentBlendFile[];
  displayFiles: RecentBlendFile[];
  setDisplayFiles: (files: RecentBlendFile[]) => void;
  setRenderForFile: (p: string | null) => void;
  setOpenWithFile: (p: string | null) => void;
};

const ViewRecentFile: React.FC<Props> = ({ selectedBlender, recentLoading, recentError, recentFiles, displayFiles, setDisplayFiles, setRenderForFile, setOpenWithFile }) => {

  const openRecent = (filePath: string) => {
    if (!selectedBlender || !window.electronAPI) return;
    if ((window.electronAPI as any).send) {
      (window.electronAPI as any).send('open-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
    }
  };

  const revealRecent = (filePath: string) => {
    if ((window as any).electronAPI?.send) {
      (window as any).electronAPI.send('reveal-in-folder', { path: filePath });
    }
  };

  const removeRecentPersistent = async (filePath: string) => {
    // optimistic UI update - build a new array from current recentFiles
    try {
      const updated = recentFiles.filter((f: RecentBlendFile) => f.path !== filePath);
      setDisplayFiles(updated);
    } catch {}
    if (!selectedBlender || !window.electronAPI?.invoke) return;
    try {
      const res = await window.electronAPI.invoke('remove-recent-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
      if (!res?.success) {
        try {
          const reload = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
          if (reload && reload.files) {
            setDisplayFiles(reload.files);
          }
        } catch {}
      }
    } catch (e) { console.error('removeRecentPersistent error', e); }
  };

  if (recentLoading) {
    return <div style={{ color: '#94a3b8', fontSize: 14 }}>Chargement...</div>;
  }
  if (recentError) {
    return <div style={{ color: '#ef4444', fontSize: 14 }}>Erreur: {recentError}</div>;
  }
  if (!recentLoading && !recentError && recentFiles.length === 0) {
    return <div style={{ color: '#64748b', fontSize: 14 }}>Aucun fichier récent disponible pour ce build.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {(displayFiles.length ? displayFiles : recentFiles).map((f, idx) => {
        const createdStr = f.ctime ? new Date(f.ctime).toLocaleString() : '';
        const usedStr = f.mtime ? new Date(f.mtime).toLocaleString() : '';
        const sizeStr = f.size ? `${(f.size/1024).toFixed(1)} Ko` : '';
        return (
          <div
            key={f.path + idx}
            role={f.exists ? 'button' : undefined}
            tabIndex={f.exists ? 0 : -1}
            onKeyDown={(e) => { if (f.exists && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRecent(f.path); }}}
            onClick={() => { if (f.exists) openRecent(f.path); }}
            style={{
              background: '#131a20',
              border: '1px solid #1e2530',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 1fr) 170px 170px 110px 140px',
              gap: 12,
              alignItems: 'center',
              position: 'relative',
              opacity: f.exists ? 1 : 0.55,
              cursor: f.exists ? 'pointer' : 'default',
              transition: 'background 0.15s, border-color 0.15s',
              minWidth: 0
            }}
            onMouseOver={e => { if (f.exists) { e.currentTarget.style.background = '#182129'; e.currentTarget.style.borderColor = '#26303b'; }}}
            onMouseOut={e => { e.currentTarget.style.background = '#131a20'; e.currentTarget.style.borderColor = '#1e2530'; }}
          >
            {/* Col 1: Nom + meta + chemin */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: f.exists ? '#e2e8f0' : '#f87171',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={f.path + (f.exists ? '' : ' (fichier introuvable)')}
              >
                {f.name}{!f.exists && ' (manquant)'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#64748b', fontSize: 12 }}>
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: 0.85,
                    display: 'inline-block',
                    direction: 'rtl',
                    textAlign: 'left'
                  }}
                  title={f.path}
                >
                  {f.path}
                </span>
              </div>
            </div>
            {/* Col 2: Date de création */}
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{createdStr}</div>
            {/* Col 3: Date d'utilisation */}
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{usedStr}</div>
            {/* Col 4: Taille */}
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{sizeStr}</div>
            {/* Col 5: Actions */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: 140, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={(e) => { e.stopPropagation(); if (f.exists) setRenderForFile(f.path); }}
                disabled={!f.exists}
                style={{
                  background: '#1e2530',
                  border: 'none',
                  color: '#94a3b8',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  cursor: f.exists ? 'pointer' : 'default',
                  opacity: f.exists ? 1 : 0.5
                }}
                title="Configurer un rendu pour ce fichier"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                  <line x1="8" y1="20" x2="16" y2="20"></line>
                  <line x1="12" y1="16" x2="12" y2="20"></line>
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (f.exists) setOpenWithFile(f.path); }}
                disabled={!f.exists}
                style={{
                  background: '#1e2530',
                  border: 'none',
                  color: '#94a3b8',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  cursor: f.exists ? 'pointer' : 'default',
                  opacity: f.exists ? 1 : 0.5
                }}
                title="Ouvrir avec une autre version"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                  <polyline points="3 9 3 3 9 3" />
                  <polyline points="21 15 21 21 15 21" />
                  <line x1="3" y1="3" x2="10" y2="10" />
                  <line x1="21" y1="21" x2="14" y2="14" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); revealRecent(f.path); }}
                style={{
                  background: '#1e2530',
                  border: 'none',
                  color: '#94a3b8',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
                title="Ouvrir le dossier"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeRecentPersistent(f.path); }}
                style={{
                  background: '#31141b',
                  border: '1px solid #842b3b',
                  color: '#f87171',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
                title="Retirer de la liste"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ViewRecentFile;
