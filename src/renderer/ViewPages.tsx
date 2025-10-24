import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ViewSettings from './ViewSettings';
import ViewOpenWith from './ViewOpenWith';
import Filter, { RecentBlendFile, TableHeader } from './Filter';
import FindBar from './FindBar';
import ViewRecentFile from './ViewRecentFile';
import ViewAddon from './ViewAddon';
import ViewRender from './ViewRender';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface ViewPagesProps {
  selectedBlender: BlenderExe | null;
  onLaunch?: (b: BlenderExe) => void;
}

const ViewPages: React.FC<ViewPagesProps> = ({ selectedBlender, onLaunch }) => {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Etat fichiers récents
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentBlendFile[]>([]);
  const [displayFiles, setDisplayFiles] = useState<RecentBlendFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentVersion, setRecentVersion] = useState<string | null>(null);
  const [openWithFile, setOpenWithFile] = useState<string | null>(null);
  const [renderForFile, setRenderForFile] = useState<string | null>(null);
  // Addons state (moved to ViewAddon)
  const [addonQuery, setAddonQuery] = useState('');
  const [panel, setPanel] = useState<'recent' | 'addons'>('recent');
  // Debug panel for last probe output
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastProbeStdout, setLastProbeStdout] = useState<string | null>(null);
  const [lastProbeStderr, setLastProbeStderr] = useState<string | null>(null);

  // Load recent files function (call on selection change or when user switches to Recent panel)
  const loadRecent = async () => {
    if (!selectedBlender || !window.electronAPI || !window.electronAPI.invoke) {
      setRecentFiles([]);
      setRecentVersion(null);
      return;
    }
    setRecentLoading(true);
    setRecentError(null);
    try {
      const res = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
      if (res && res.files) {
        setRecentFiles(res.files);
        setRecentVersion(res.version || null);
      } else {
        setRecentFiles([]);
        setRecentVersion(res?.version || null);
      }
    } catch (e:any) {
      setRecentError(e?.message || 'Erreur inconnue');
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => { loadRecent(); }, [selectedBlender?.path]);

  // Addon loading moved to ViewAddon

  console.log('[ViewPages] Rendu avec selectedBlender:', selectedBlender);
  console.log('[ViewPages] isSettingsOpen:', isSettingsOpen);

  const handleLaunch = () => {
    if (selectedBlender && window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('launch-blender', selectedBlender.path);
      if (onLaunch) onLaunch(selectedBlender);
    }
  };

  const openRecent = (filePath: string) => {
    if (!selectedBlender || !window.electronAPI) return;
    if ((window.electronAPI as any).send) {
      (window.electronAPI as any).send('open-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
    }
  };

  const revealRecent = (filePath: string) => {
    if ((window.electronAPI as any).send) {
      (window.electronAPI as any).send('reveal-in-folder', { path: filePath });
    }
  };

  const removeRecentPersistent = async (filePath: string) => {
    setRecentFiles(prev => prev.filter(f => f.path !== filePath));
    if (!selectedBlender || !window.electronAPI?.invoke) return;
    try {
      const res = await window.electronAPI.invoke('remove-recent-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
      if (!res?.success) {
        try {
          const reload = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
          if (reload && reload.files) {
            setRecentFiles(reload.files);
            setRecentVersion(reload.version || null);
          }
        } catch {}
      }
    } catch (e) { console.error('removeRecentPersistent error', e); }
  };

  // Refresh recent files when a render session exits (headless render may write new files and update recent list)
  useEffect(() => {
    const api: any = (window as any).electronAPI;
    if (!api || typeof api.on !== 'function') return;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      if (!selectedBlender?.path || !api?.invoke) return;
      try {
        const res = await api.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
        if (res && res.files) {
          setRecentFiles(res.files);
          setRecentVersion(res.version || null);
        }
      } catch {}
      finally { refreshing = false; }
    };
    const handler = (_: any, payload: any) => {
      if (payload?.event === 'EXIT' || payload?.event === 'DONE') {
        // slight debounce to ensure Blender wrote recent files
        setTimeout(refresh, 400);
      }
    };
    api.on('render-progress', handler);
    return () => { try { api.off?.('render-progress', handler); } catch {} };
  }, [selectedBlender?.path]);

  const handleOpenSettings = () => {
    console.log('[ViewPages] Clic sur le bouton paramètres détecté!');
    console.log('[ViewPages] selectedBlender:', selectedBlender);
    setIsSettingsOpen(true);
    console.log('[ViewPages] isSettingsOpen défini à true');
  };

  const handleSaveSettings = (updatedBlender: BlenderExe) => {
    console.log('[ViewPages] Envoi de la mise à jour du titre:', updatedBlender.title, 'pour', updatedBlender.path);
    console.log('[ViewPages] window.electronAPI disponible:', !!window.electronAPI);
    console.log('[ViewPages] window.electronAPI:', window.electronAPI);
    console.log('[ViewPages] window.electronAPI.invoke existe:', !!window.electronAPI?.invoke);
    if (window.electronAPI) {
      // Affiche les clés réellement présentes pour debug
      try {
        console.log('[ViewPages] Clés electronAPI:', Object.keys(window.electronAPI as any));
      } catch {}
    }
    
    if (window.electronAPI && window.electronAPI.invoke) {
      const payload = { path: updatedBlender.path, title: updatedBlender.title };
      console.log('[ViewPages] Envoi IPC avec payload:', payload);
      // Fire-and-forget; UI already reflects the input
      window.electronAPI.invoke('update-executable-title', payload)
        .then((result: any) => {
          console.log('[ViewPages] Résultat reçu:', result);
          if (!result?.success) {
            console.error('[ViewPages] Erreur lors de la mise à jour:', result?.error);
          }
        })
        .catch((error: any) => console.error('[ViewPages] Erreur lors de l\'appel IPC:', error));
    } else {
      console.error('[ViewPages] electronAPI.invoke non disponible!');
      // Fallback : mise à jour optimiste du titre uniquement en mémoire pour ne pas perdre l'action utilisateur
      // (ne persiste pas dans config.json mais évite frustration visuelle)
      if (selectedBlender) {
        selectedBlender.title = updatedBlender.title;
      }
    }
  };

  // (Global scrollbar styles now injected in index.html)

  // Si un Blender est sélectionné, affiche sa page dédiée
  if (selectedBlender) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0F1419'
      }}>
        {/* Header non scrollable */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '20px 32px 14px 32px',
          background: '#0F1419',
          boxShadow: '0 4px 8px -4px rgba(0,0,0,0.55)',
          minWidth: 0
        }}>
            {/* Icône */}
            <img
            src={selectedBlender.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
            alt="icon"
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 12,
              background: 'transparent',
              flexShrink: 0,
              flexGrow: 0
            }}
            draggable={false}
            />
            {/* Titre et adresse */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: 32,
                fontWeight: 700,
                margin: '0 0 6px 0',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0
              }}>
                <span style={{
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {selectedBlender.title || selectedBlender.name}
                </span>
                {selectedBlender.path.toLowerCase().includes('steamapps') && (
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#93c5fd',
                    background: 'rgba(59,130,246,0.15)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                    transform: 'translateY(2px)'
                  }}>
                    Steam
                  </span>
                )}
              </h1>
              <p style={{
                fontSize: 14,
                color: '#888',
                margin: '0 0 12px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.35,
              }}>
                {selectedBlender.path}
              </p>
            </div>
            {/* Boutons à droite */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <button
                onClick={handleLaunch}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  padding: '10px 20px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
                onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
              >
                Lancer
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenSettings(); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: '#9ca3af',
                  fontSize: 16,
                  padding: '8px',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
                title="Changer l'exécutable"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        {/* Barre décor pleine largeur */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)' }} />
        {/* Contenu scrollable (la scrollbar ne dépasse plus le header) */}
  <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 32px 32px 32px', overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setPanel('recent'); loadRecent(); }}
                style={{
                  background: panel === 'recent' ? '#1f2937' : 'transparent',
                  border: panel === 'recent' ? '1px solid #374151' : '1px solid transparent',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontWeight: panel === 'recent' ? 700 : 500
                }}
              >
                Fichiers récents
              </button>
              <button
                onClick={() => { setPanel('addons'); /* loadAddons will be triggered by effect */ }}
                style={{
                  background: panel === 'addons' ? '#1f2937' : 'transparent',
                  border: panel === 'addons' ? '1px solid #374151' : '1px solid transparent',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontWeight: panel === 'addons' ? 700 : 500
                }}
              >
                Add‑ons
              </button>
            </div>
          </div>
          {/* Shared FindBar used for both Recent files and Addons */}
          <FindBar value={searchQuery} onChange={setSearchQuery} placeholder="Rechercher..." />

          {panel === 'recent' ? (
            <>
              {recentLoading && (
                <div style={{ color: '#94a3b8', fontSize: 14 }}>Chargement...</div>
              )}
              {recentError && (
                <div style={{ color: '#ef4444', fontSize: 14 }}>Erreur: {recentError}</div>
              )}
              {!recentLoading && !recentError && recentFiles.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 14 }}>Aucun fichier récent disponible pour ce build.</div>
              )}
              {/* Filter component (sorting / filtering UI) - it will provide a sorted+filtered set via query prop */}
              <Filter files={recentFiles} query={searchQuery} onSorted={(sorted) => { setDisplayFiles(sorted); }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
                <ViewRecentFile
                  selectedBlender={selectedBlender}
                  recentLoading={recentLoading}
                  recentError={recentError}
                  recentFiles={recentFiles}
                  displayFiles={displayFiles}
                  setDisplayFiles={setDisplayFiles}
                  setRenderForFile={setRenderForFile}
                  setOpenWithFile={setOpenWithFile}
                  onOpenRecent={openRecent}
                  onRevealRecent={revealRecent}
                  onRemoveRecent={removeRecentPersistent}
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
              {/* Keep the column header in the same position as the Filter header for parity */}
              <TableHeader
                variant="addons"
                activeField={undefined}
                activeDir={'asc'}
                onToggle={(f) => {
                  // Relay header clicks down via a custom event — ViewAddon handles its own sorting locally.
                  const ev = new CustomEvent('blender-launcher-addon-sort', { detail: { field: f } });
                  window.dispatchEvent(ev);
                }}
              />
              <ViewAddon selectedBlender={selectedBlender} query={searchQuery} />
            </div>
          )}
        </div>
        
        {/* Popup de paramètres */}
        {selectedBlender && (
          <ViewSettings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            selectedBlender={selectedBlender}
            onSave={handleSaveSettings}
          />
        )}
        <ViewOpenWith
          isOpen={!!openWithFile}
          filePath={openWithFile}
          onClose={() => setOpenWithFile(null)}
        />
        {/* Render popup embedded without launcher card */}
        {renderForFile && (
          <ViewRender
            showLauncherButton={false}
            open={!!renderForFile}
            onClose={() => setRenderForFile(null)}
            filePath={renderForFile}
            selected={selectedBlender as any}
          />
        )}
      </div>
    );
  }

  // Sinon, affiche la homepage par défaut
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      overflow: 'auto',
    }}>
      <h1 style={{ fontWeight: 700, fontSize: 48, marginBottom: 16 }}>{t('title')}</h1>
      <p style={{ fontSize: 20, opacity: 0.8, marginBottom: 32 }}>
        {t('subtitle')}
      </p>
    </div>
  );
};

export default ViewPages;
