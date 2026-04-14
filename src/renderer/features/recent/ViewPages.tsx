import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ViewSettings from '../settings/ViewSettings';
import ViewOpenWith from '../settings/ViewOpenWith';
import Filter, { RecentBlendFile } from './Filter';
import FindBar from './FindBar';
import ViewRecentFile from './ViewRecentFile';
import ViewAddon from '../addons/ViewAddon';
import ViewRender from '../render/ViewRender';
import { AiOutlineAppstore, AiOutlineUnorderedList } from 'react-icons/ai';

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
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentBlendFile[]>([]);
  const [displayFiles, setDisplayFiles] = useState<RecentBlendFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openWithFile, setOpenWithFile] = useState<string | null>(null);
  const [renderForFile, setRenderForFile] = useState<string | null>(null);
  const [recentViewMode, setRecentViewMode] = useState<'list' | 'preview'>('list');
  const [panel, setPanel] = useState<'recent' | 'addons'>('recent');
  const recentLoadTokenRef = useRef(0);

  const panelButtonStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#1f2937' : 'transparent',
    border: active ? '1px solid #374151' : '1px solid transparent',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: 8,
    fontWeight: active ? 700 : 500
  });

  const viewModeButtonStyle = (active: boolean): React.CSSProperties => ({
    width: 38,
    height: 30,
    borderRadius: 8,
    border: 'none',
    background: active ? '#334155' : 'transparent',
    color: active ? '#e2e8f0' : '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  });

  // Tokenized loading avoids stale updates when selection changes quickly.
  const loadRecent = async (opts?: { hardReset?: boolean }) => {
    const token = ++recentLoadTokenRef.current;
    if (!selectedBlender || !window.electronAPI || !window.electronAPI.invoke) {
      if (token !== recentLoadTokenRef.current) return;
      setRecentFiles([]);
      setDisplayFiles([]);
      setRecentLoading(false);
      return;
    }

    if (opts?.hardReset) {
      setRecentFiles([]);
      setDisplayFiles([]);
    }

    setRecentLoading(true);
    setRecentError(null);
    try {
      const res = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
      if (token !== recentLoadTokenRef.current) return;
      if (res && res.files) {
        setRecentFiles(res.files);
      } else {
        setRecentFiles([]);
        setDisplayFiles([]);
      }
    } catch (e:any) {
      if (token !== recentLoadTokenRef.current) return;
      setRecentError(e?.message || t('unknown_error', 'Erreur inconnue'));
    } finally {
      if (token === recentLoadTokenRef.current) {
        setRecentLoading(false);
      }
    }
  };

  useEffect(() => { loadRecent({ hardReset: true }); }, [selectedBlender?.path]);

  useEffect(() => {
    if (panel !== 'recent' || recentViewMode !== 'list' || !selectedBlender?.path) return;
    loadRecent();
  }, [panel, recentViewMode, selectedBlender?.path]);

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
          }
        } catch {}
      }
    } catch {}
  };

  // Render completion can update recents, so refresh once Blender has flushed files.
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
        }
      } catch {}
      finally { refreshing = false; }
    };
    const handler = (_: any, payload: any) => {
      if (payload?.event === 'EXIT' || payload?.event === 'DONE') {
        setTimeout(refresh, 400);
      }
    };
    api.on('render-progress', handler);
    return () => { try { api.off?.('render-progress', handler); } catch {} };
  }, [selectedBlender?.path]);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = (updatedBlender: BlenderExe) => {
    if (window.electronAPI && window.electronAPI.invoke) {
      const payload = { path: updatedBlender.path, title: updatedBlender.title };
      window.electronAPI.invoke('update-executable-title', payload)
        .then(() => {})
        .catch(() => {});
    } else {
      if (selectedBlender) {
        selectedBlender.title = updatedBlender.title;
      }
    }
  };

  if (selectedBlender) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0F1419'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '20px 32px 14px 32px',
          background: '#0F1419',
          boxShadow: '0 4px 8px -4px rgba(0,0,0,0.55)',
          minWidth: 0
        }}>
            <img
            src={selectedBlender.icon || require('../../../../public/logo/png/Blender-Launcher-64x64.png')}
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
                  display: '-webkit-box',
                  WebkitLineClamp: 2 as any,
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word'
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
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2 as any,
                WebkitBoxOrient: 'vertical' as any,
                textOverflow: 'ellipsis',
                lineHeight: 1.35,
                wordBreak: 'break-all'
              }}>
                {selectedBlender.path}
              </p>
            </div>
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
                {t('launch', 'Lancer')}
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
                title={t('change_executable', 'Changer l\'exécutable')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)' }} />
  <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 32px 32px 32px', overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setPanel('recent'); loadRecent(); }}
                style={panelButtonStyle(panel === 'recent')}
              >
                {t('recent_files', 'Fichiers récents')}
              </button>
              <button
                onClick={() => { setPanel('addons'); }}
                style={panelButtonStyle(panel === 'addons')}
              >
                {t('addons', 'Add-ons')}
              </button>
            </div>
          </div>
          <FindBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('search', 'Rechercher...')}
            rightSlot={panel === 'recent' ? (
              <div style={{ display: 'inline-flex', gap: 4, padding: 2, borderRadius: 10, background: '#1a222b', border: '1px solid #2a3642', flexShrink: 0 }}>
                <button
                  onClick={() => setRecentViewMode('list')}
                  style={viewModeButtonStyle(recentViewMode === 'list')}
                  title={t('recent.list_view', 'Vue liste')}
                >
                  <AiOutlineUnorderedList size={17} />
                </button>
                <button
                  onClick={() => setRecentViewMode('preview')}
                  style={viewModeButtonStyle(recentViewMode === 'preview')}
                  title={t('recent.preview_view', 'Vue preview')}
                >
                  <AiOutlineAppstore size={17} />
                </button>
              </div>
            ) : null}
          />

          {panel === 'recent' ? (
            <>
              {recentLoading && (
                <div style={{ color: '#94a3b8', fontSize: 14 }}>{t('loading', 'Chargement...')}</div>
              )}
              {recentError && (
                <div style={{ color: '#ef4444', fontSize: 14 }}>{t('error', 'Erreur')}: {recentError}</div>
              )}
              {!recentLoading && !recentError && recentFiles.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 14 }}>{t('recent.none_for_build', 'Aucun fichier récent disponible pour ce build.')}</div>
              )}
              <div style={{ display: recentViewMode === 'list' ? 'block' : 'none' }}>
                <Filter files={recentFiles} query={searchQuery} onSorted={(sorted) => { setDisplayFiles(sorted); }} />
              </div>

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
                  viewMode={recentViewMode}
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
              <ViewAddon selectedBlender={selectedBlender} query={searchQuery} />
            </div>
          )}
        </div>
        
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
