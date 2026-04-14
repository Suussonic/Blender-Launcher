import React from 'react';
import { useTranslation } from 'react-i18next';
import { RecentBlendFile } from './Filter';

type RecentViewMode = 'list' | 'preview';

type Props = {
  selectedBlender: { path: string } | null;
  recentLoading: boolean;
  recentError: string | null;
  recentFiles: RecentBlendFile[];
  displayFiles: RecentBlendFile[];
  setDisplayFiles: (files: RecentBlendFile[]) => void;
  setRenderForFile: (p: string | null) => void;
  setOpenWithFile: (p: string | null) => void;
  // handlers passed from parent to centralize IPC and state changes
  onOpenRecent?: (p: string) => void;
  onRevealRecent?: (p: string) => void;
  onRemoveRecent?: (p: string) => Promise<void> | void;
  viewMode: RecentViewMode;
};

const ViewRecentFile: React.FC<Props> = ({ selectedBlender, recentLoading, recentError, recentFiles, displayFiles, setDisplayFiles, setRenderForFile, setOpenWithFile, onOpenRecent, onRevealRecent, onRemoveRecent, viewMode }) => {
  const { t } = useTranslation();
  const [previewByFile, setPreviewByFile] = React.useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = React.useState<Record<string, boolean>>({});
  const files = displayFiles.length ? displayFiles : recentFiles;
  const inFlightRef = React.useRef<Set<string>>(new Set());
  const previewByFileRef = React.useRef<Record<string, string>>({});

  const toFileUrl = React.useCallback((p: string) => {
    if (!p) return '';
    const normalized = p.replace(/\\/g, '/');
    return encodeURI(`file:///${normalized}`);
  }, []);

  React.useEffect(() => {
    setPreviewByFile({});
    setLoadingPreview({});
    inFlightRef.current.clear();
    previewByFileRef.current = {};
  }, [selectedBlender?.path]);

  React.useEffect(() => {
    previewByFileRef.current = previewByFile;
  }, [previewByFile]);

  React.useEffect(() => {
    if (!selectedBlender?.path) return;
    if (!window.electronAPI?.invoke) return;

    const maxPrefetch = viewMode === 'preview' ? 32 : 12;
    const candidates = files
      .filter((f) => f.exists)
      .filter((f) => !previewByFileRef.current[f.path] && !inFlightRef.current.has(f.path))
      .slice(0, maxPrefetch);
    if (!candidates.length) return;

    let cancelled = false;
    const concurrency = viewMode === 'preview' ? 4 : 2;

    const markDone = (p: string) => {
      inFlightRef.current.delete(p);
      setLoadingPreview((prev) => {
        const next = { ...prev };
        delete next[p];
        return next;
      });
    };

    const run = async () => {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, candidates.length) }).map(async () => {
        while (!cancelled) {
          const index = cursor;
          cursor += 1;
          if (index >= candidates.length) break;
          const f = candidates[index];
          inFlightRef.current.add(f.path);
          setLoadingPreview((prev) => ({ ...prev, [f.path]: true }));
          try {
            let res = await window.electronAPI?.invoke('get-blend-preview', {
              exePath: selectedBlender.path,
              blendPath: f.path,
              width: 360,
              height: 220
            });
            if (!res?.success) {
              // One immediate retry with lower resolution for fragile/heavy files.
              res = await window.electronAPI?.invoke('get-blend-preview', {
                exePath: selectedBlender.path,
                blendPath: f.path,
                width: 240,
                height: 150
              });
            }
            if (cancelled) continue;
            if (res?.success && res?.previewPath) {
              setPreviewByFile((prev) => ({ ...prev, [f.path]: toFileUrl(res.previewPath) }));
            }
          } catch {}
          finally {
            markDone(f.path);
          }
        }
      });
      await Promise.allSettled(workers);
    };
    run();
    return () => { cancelled = true; };
  }, [viewMode, files, selectedBlender?.path, toFileUrl]);

  // Use handlers passed from parent when available to centralize IPC/state
  const openRecent = (filePath: string) => {
    if (typeof onOpenRecent === 'function') return onOpenRecent(filePath);
    // fallback: no-op
  };

  const revealRecent = (filePath: string) => {
    if (typeof onRevealRecent === 'function') return onRevealRecent(filePath);
  };

  const removeRecentPersistent = (filePath: string) => {
    if (typeof onRemoveRecent === 'function') return onRemoveRecent(filePath);
    // fallback: optimistic UI update only
    try {
      const updated = recentFiles.filter((f: RecentBlendFile) => f.path !== filePath);
      setDisplayFiles(updated);
    } catch {}
  };

  if (recentLoading) {
    return <div style={{ color: '#94a3b8', fontSize: 14 }}>{t('loading', 'Loading...')}</div>;
  }
  if (recentError) {
    return <div style={{ color: '#ef4444', fontSize: 14 }}>{t('recent.error_prefix', 'Error:')} {recentError}</div>;
  }
  if (!recentLoading && !recentError && recentFiles.length === 0) {
    return <div style={{ color: '#64748b', fontSize: 14 }}>{t('recent.none_for_build', 'No recent file available for this build.')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {viewMode === 'list' && files.map((f, idx) => {
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
                title={f.path + (f.exists ? '' : ` (${t('recent.file_not_found', 'file not found')})`)}
              >
                {f.name}{!f.exists && ` (${t('recent.missing', 'missing')})`}
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
                title={t('recent.configure_render_for_file', 'Configure render for this file')}
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
                title={t('recent.open_with_other_version', 'Open with another version')}
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
                title={t('recent.open_folder', 'Open folder')}
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
                title={t('remove_from_list', 'Remove from list')}
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

      {viewMode === 'preview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          {files.map((f, idx) => {
            const thumb = previewByFile[f.path];
            const loading = !!loadingPreview[f.path];
            const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} Ko` : '';
            return (
              <div
                key={f.path + idx}
                role={f.exists ? 'button' : undefined}
                tabIndex={f.exists ? 0 : -1}
                onKeyDown={(e) => { if (f.exists && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRecent(f.path); } }}
                onClick={() => { if (f.exists) openRecent(f.path); }}
                style={{
                  background: '#131a20',
                  border: '1px solid #1e2530',
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: f.exists ? 1 : 0.55,
                  cursor: f.exists ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0
                }}
                onMouseOver={(e) => { if (f.exists) { e.currentTarget.style.background = '#182129'; e.currentTarget.style.borderColor = '#26303b'; } }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#131a20'; e.currentTarget.style.borderColor = '#1e2530'; }}
              >
                <div style={{ height: 126, background: '#0f1419', borderBottom: '1px solid #1e2530', position: 'relative' }}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={f.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
                      {loading ? t('loading', 'Chargement...') : t('recent.no_preview', 'Aperçu indisponible')}
                    </div>
                  )}
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: f.exists ? '#e2e8f0' : '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.path}>
                      {f.name}{!f.exists && ` (${t('recent.missing', 'missing')})`}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.path}>
                      {f.path}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{sizeStr}</span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (f.exists) setRenderForFile(f.path); }}
                        disabled={!f.exists}
                        style={{ background: '#1e2530', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: 7, cursor: f.exists ? 'pointer' : 'default', opacity: f.exists ? 1 : 0.5 }}
                        title={t('recent.configure_render_for_file', 'Configure render for this file')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="12" rx="2" ry="2"></rect>
                          <line x1="8" y1="20" x2="16" y2="20"></line>
                          <line x1="12" y1="16" x2="12" y2="20"></line>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (f.exists) setOpenWithFile(f.path); }}
                        disabled={!f.exists}
                        style={{ background: '#1e2530', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: 7, cursor: f.exists ? 'pointer' : 'default', opacity: f.exists ? 1 : 0.5 }}
                        title={t('recent.open_with_other_version', 'Open with another version')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); revealRecent(f.path); }}
                        style={{ background: '#1e2530', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: 7, cursor: 'pointer' }}
                        title={t('recent.open_folder', 'Open folder')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                          <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRecentPersistent(f.path); }}
                        style={{ background: '#31141b', border: '1px solid #842b3b', color: '#f87171', width: 30, height: 30, borderRadius: 7, cursor: 'pointer' }}
                        title={t('remove_from_list', 'Remove from list')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ViewRecentFile;
