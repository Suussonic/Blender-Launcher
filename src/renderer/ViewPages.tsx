import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ViewSettings from './ViewSettings';
import ViewOpenWith from './ViewOpenWith';
import Filter, { RecentBlendFile } from './Filter';
import FindBar from './FindBar';
import ViewRecentFile from './ViewRecentFile';
import ViewAddon from './ViewAddon';
import ViewExtension from './ViewExtension';
import ViewExtensionsResults from './ViewExtensionsResults';
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
  const [searchScope, setSearchScope] = useState<string>('all');
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);
  const [extensionQuery, setExtensionQuery] = useState<string | null>(null);
  const [extSuggestions, setExtSuggestions] = useState<Array<{title:string;href:string;thumb?:string;author?:string}>>([]);
  const [extLoading, setExtLoading] = useState(false);
  let extDebounceRef: any = null;
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

  // Live search: when searchQuery changes and panel is addons, request suggestions from main
  useEffect(() => {
    if (panel !== 'addons') return;
    const q = (searchQuery || '').trim();
    // clear if empty
    if (!q) { setExtSuggestions([]); setExtLoading(false); return; }
    setExtLoading(true);
    // debounce
    if (extDebounceRef) clearTimeout(extDebounceRef);
    extDebounceRef = setTimeout(async () => {
      try {
        const api: any = (window as any).electronAPI;
        let res: any = null;
        if (api?.searchExtensions) res = await api.searchExtensions(q);
        else if (api?.invoke) res = await api.invoke('extensions-search', q);
        const html = res?.html || '';
        // parse HTML using DOMParser and extract anchors to /addon/
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const items: Array<{title:string;href:string;thumb?:string;author?:string}> = [];
        try {
          const anchors = Array.from(doc.querySelectorAll('a'));
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            if (!href.includes('/addon/')) continue;
            // attempt to find title within anchor or descendants
            let title = '';
            const h = a.querySelector('h3') || a.querySelector('.card-title') || a.querySelector('.title');
            if (h && h.textContent) title = h.textContent.trim();
            if (!title) title = a.textContent ? a.textContent.trim().split('\n')[0].trim() : '';
            // thumbnail
            const img = a.querySelector('img');
            const thumb = img ? (img.getAttribute('src') || '') : '';
            // author - try to find element with author class
            let author = '';
            const au = a.querySelector('.author') || a.querySelector('.card-author') || a.querySelector('.meta .author');
            if (au && au.textContent) author = au.textContent.trim();
            const full = href.startsWith('http') ? href : ('https://extensions.blender.org' + href);
            // avoid duplicates
            if (!items.find(x => x.href === full)) items.push({ title: title || full, href: full, thumb, author });
            if (items.length >= 10) break;
          }
        } catch (e) { /* ignore parse errors */ }
        setExtSuggestions(items);
      } catch (e) {
        setExtSuggestions([]);
      } finally {
        setExtLoading(false);
      }
    }, 350);
    return () => { try { if (extDebounceRef) clearTimeout(extDebounceRef); } catch {} };
  }, [searchQuery, panel]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FindBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher..."
              scope={searchScope}
              onScopeChange={setSearchScope}
              onSubmit={async () => {
                // When user presses Enter while viewing Add‑ons, open the in-app extensions results modal.
                if (panel === 'addons' && searchQuery && searchQuery.trim() !== '') {
                  setExtensionQuery(searchQuery.trim());
                  return;
                }
              }}
            />
            {/* Live external suggestions when typing in Addons panel */}
            {panel === 'addons' && searchQuery && searchQuery.trim() !== '' && (
              <div style={{ position: 'relative', width: '100%', maxWidth: 1060 }}>
                <div style={{ position: 'absolute', top: 48, left: 0, right: 0, background: '#071018', border: '1px solid #17202a', borderRadius: 8, padding: 8, zIndex: 40 }}>
                  {extLoading && <div style={{ color: '#94a3b8', padding: 8 }}>Recherche…</div>}
                  {!extLoading && extSuggestions.length === 0 && <div style={{ color: '#64748b', padding: 8 }}>Aucun résultat externe</div>}
                  {!extLoading && extSuggestions.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px', cursor: 'pointer' }} onClick={async () => {
                      try { if ((window as any).electronAPI?.openExternal) await (window as any).electronAPI.openExternal(it.href); else window.open(it.href, '_blank'); } catch { try { window.open(it.href, '_blank'); } catch {} }
                    }}>
                      <img src={it.thumb || ''} alt="" style={{ width: 48, height: 34, objectFit: 'cover', borderRadius: 6, background: '#0b1220' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ color: '#e6eef8', fontWeight: 600 }}>{it.title}</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{it.author || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {panel === 'addons' && searchQuery && searchQuery.trim() !== '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={async () => {
                    const url = `https://extensions.blender.org/search/?q=${encodeURIComponent(searchQuery.trim())}`;
                    try {
                      if ((window as any).electronAPI?.openExternal) await (window as any).electronAPI.openExternal(url);
                      else window.open(url, '_blank');
                    } catch (e) { try { window.open(url, '_blank'); } catch {} }
                  }}
                  style={{ background: '#0b1220', border: '1px solid #22303a', color: '#cbd5e1', padding: '8px 10px', borderRadius: 8 }}>
                  Rechercher sur extensions.blender.org
                </button>
              </div>
            )}
          </div>

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
        {extensionUrl && (
          <ViewExtension url={extensionUrl} onClose={() => setExtensionUrl(null)} />
        )}
        {extensionQuery && (
          <ViewExtensionsResults query={extensionQuery} onClose={() => setExtensionQuery(null)} />
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
