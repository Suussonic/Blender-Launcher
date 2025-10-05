import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ViewSettings from './ViewSettings';
import ViewOpenWith from './ViewOpenWith';
import Filter, { RecentBlendFile } from './Filter';

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
  const [recentVersion, setRecentVersion] = useState<string | null>(null);
  const [openWithFile, setOpenWithFile] = useState<string | null>(null);

  // Chargement des fichiers récents quand l'exécutable change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedBlender || !window.electronAPI || !window.electronAPI.invoke) {
        setRecentFiles([]);
        setRecentVersion(null);
        return;
      }
      setRecentLoading(true);
      setRecentError(null);
      try {
        const res = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
        if (cancelled) return;
        if (res && res.files) {
          setRecentFiles(res.files);
          setRecentVersion(res.version || null);
        } else {
          setRecentFiles([]);
          setRecentVersion(res?.version || null);
        }
      } catch (e:any) {
        if (!cancelled) setRecentError(e?.message || 'Erreur inconnue');
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedBlender?.path]);

  const openRecent = (filePath: string) => {
    if (!selectedBlender || !window.electronAPI) return;
    // Requiert côté main un canal open-blend-file (à implémenter)
    if ((window.electronAPI as any).send) {
      (window.electronAPI as any).send('open-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
    }
  };

  const revealRecent = (filePath: string) => {
    if ((window.electronAPI as any).send) {
      (window.electronAPI as any).send('reveal-in-folder', { path: filePath });
    }
  };

  const removeRecentLocal = (filePath: string) => {
    // Retrait local immédiat (UX). Si on ajoute plus tard un backend, on enverra un canal.
    setRecentFiles(prev => prev.filter(f => f.path !== filePath));
  };

  const removeRecentPersistent = async (filePath: string) => {
    // Optimiste: retirer tout de suite
    setRecentFiles(prev => prev.filter(f => f.path !== filePath));
    if (!selectedBlender || !window.electronAPI?.invoke) return;
    try {
      const res = await window.electronAPI.invoke('remove-recent-blend-file', { exePath: selectedBlender.path, blendPath: filePath });
      if (!res?.success) {
        console.warn('[ViewPages] Echec suppression persistante recent file:', res?.reason);
        // Recharger la liste pour refléter l'état réel
        try {
          const reload = await window.electronAPI.invoke('get-recent-blend-files', { exePath: selectedBlender.path });
          if (reload && reload.files) {
            setRecentFiles(reload.files);
            setRecentVersion(reload.version || null);
          }
        } catch {}
      }
    } catch (e) {
      console.error('[ViewPages] Exception remove-recent-blend-file:', e);
    }
  };

  console.log('[ViewPages] Rendu avec selectedBlender:', selectedBlender);
  console.log('[ViewPages] isSettingsOpen:', isSettingsOpen);

  const handleLaunch = () => {
    if (selectedBlender && window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('launch-blender', selectedBlender.path);
      if (onLaunch) onLaunch(selectedBlender);
    }
  };

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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#f1f5f9' }}>
            Fichiers récents
          </h2>
          {recentLoading && (
            <div style={{ color: '#94a3b8', fontSize: 14 }}>Chargement...</div>
          )}
          {recentError && (
            <div style={{ color: '#ef4444', fontSize: 14 }}>Erreur: {recentError}</div>
          )}
          {!recentLoading && !recentError && recentFiles.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 14 }}>Aucun fichier récent disponible pour ce build.</div>
          )}
          <Filter files={recentFiles} onSorted={(sorted) => setDisplayFiles(sorted)} />
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
                          // Keep the end of the path visible (start-ellipsis)
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
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>
                    {createdStr}
                  </div>
                  {/* Col 3: Date d'utilisation */}
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>
                    {usedStr}
                  </div>
                  {/* Col 4: Taille */}
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>
                    {sizeStr}
                  </div>
                  {/* Col 5: Actions */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: 140, justifyContent: 'flex-end', flexShrink: 0 }}>
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
                      {/* Icône expand (4 flèches vers l'extérieur) */}
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
                      {/* Icône dossier */}
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
                      {/* Icône croix */}
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
