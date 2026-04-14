import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PendingBuild } from '../features/build/ViewBuildManager';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface SidebarProps {
  onSelectBlender: (blender: BlenderExe | null) => void;
  selectedBlender: BlenderExe | null;
  pendingBuilds?: PendingBuild[];
  onSelectPending?: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectBlender, selectedBlender, pendingBuilds = [], onSelectPending }) => {
  const { t } = useTranslation();
  const [blenders, setBlenders] = useState<BlenderExe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pendingRaf = useRef<number | null>(null);
  const lastClientY = useRef<number | null>(null);

  useEffect(() => {
    const loadBlenders = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getBlenders) {
          const list = await window.electronAPI.getBlenders();
          if (Array.isArray(list)) {
            setBlenders(list as BlenderExe[]);
          }
        }
      } catch (e) {
        console.error('[Sidebar] load failed:', e);
      }
    };
    loadBlenders();
  }, []);


  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !api.on) return;

    const refreshList = async () => {
      try {
        const list = await api.getBlenders?.();
        if (Array.isArray(list)) setBlenders(list as BlenderExe[]);
      } catch (e) {
        console.error('[Sidebar] refresh failed:', e);
      }
    };

    const onSelectedFolder = (_event: any, payload: any) => {
      const filePath = payload?.filePath;
      if (!filePath) return;
      setBlenders((prev) => {
        const exists = prev.some((b) => b.path === filePath);
        if (exists) setError(t('import.already_exists', 'Ce fichier est déjà importé !'));
        return prev;
      });
    };

    const onConfigUpdated = async () => {
      await refreshList();
    };

    const onExecutableUpdated = async (_event: any, payload: any) => {
      await refreshList();
      if (payload?.newExecutable && selectedBlender?.path === payload.oldPath) {
        onSelectBlender(payload.newExecutable);
      }
    };

    api.on('selected-blender-folder', onSelectedFolder);
    api.on('config-updated', onConfigUpdated as any);
    api.on('executable-updated', onExecutableUpdated as any);

    return () => {
      try {
        api.off?.('selected-blender-folder', onSelectedFolder);
        api.off?.('config-updated', onConfigUpdated as any);
        api.off?.('executable-updated', onExecutableUpdated as any);
      } catch {}
    };
  }, [onSelectBlender, selectedBlender?.path, t]);


  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleClick = (exe: BlenderExe) => {
    onSelectBlender(exe);
  };

  const handleDoubleClick = (exe: BlenderExe) => {
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('launch-blender', exe.path);
    }
  };

  const spinnerStyle = `
    @keyframes bl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;

  const pendingStatusColor = (status: PendingBuild['status']) => {
    if (status === 'done') return '#22c55e';
    if (status === 'error') return '#ef4444';
    return '#60a5fa';
  };
  const pendingStatusLabel = (status: PendingBuild['status']) => {
    if (status === 'cloning') return t('clone.in_progress_short', 'Clonage…');
    if (status === 'cloned') return t('status.ready_to_build', 'Prêt à compiler');
    if (status === 'building') return t('compile.in_progress_short', 'Compilation…');
    if (status === 'done') return t('done', 'Terminé');
    if (status === 'error') return t('error', 'Erreur');
    return '';
  };

  return (
    <div style={{
      width: 220,
      background: '#181A20',
      borderRight: '1.5px solid #23272F',
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 99,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: 'absolute',
            top: 24,
            left: 16,
            right: 16,
            background: '#ef4444',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 10,
            boxShadow: '0 2px 12px #ef444488',
            padding: '14px 18px',
            textAlign: 'center',
            zIndex: 999,
            cursor: 'pointer',
            animation: 'fadeIn 0.2s',
          }}
        >
          {error}
        </div>
      )}
      {blenders.length > 0 && (
        <>
          <div style={{ width: '100%', padding: '24px 0 24px 0', textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.5, opacity: 0.95 }}>
            {t('my_apps')}
          </div>
          <div style={{ height: 2, width: '100%', background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)', margin: '0 0 8px 0' }} />
        </>
      )}
  <div ref={containerRef} className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: blenders.length === 0 && pendingBuilds.length === 0 ? 'center' : 'flex-start', alignItems: 'center', overflowY: 'auto', paddingBottom: 24, touchAction: isDragging ? 'none' : 'pan-y' }}>
        <style dangerouslySetInnerHTML={{ __html: spinnerStyle }} />
        {blenders.length === 0 && pendingBuilds.length === 0 ? (
          <span style={{ color: '#888', fontSize: 16, opacity: 0.7, textAlign: 'center', marginTop: 0 }}>{t('no_app')}</span>
        ) : (
          <>
          {blenders.map((b, i) => (
            <div
              key={b.path + i}
              style={{
                padding: '8px 18px 8px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.15s, transform 0.18s cubic-bezier(.2,.9,.2,1), box-shadow 0.12s',
                willChange: 'transform',
                transform: pressedIndex === i || (isDragging && draggingIndexRef.current === i) ? 'translateY(-6px) scale(1.02)' : undefined,
                boxShadow: pressedIndex === i || (isDragging && draggingIndexRef.current === i) ? '0 8px 18px rgba(0,0,0,0.45)' : undefined,
                color: '#fff',
                fontWeight: 500,
                fontSize: 16,
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: 180,
                background: selectedBlender?.path === b.path ? '#2a2d36' : 'transparent',
              }}
              onClick={() => { if (isDragging) { console.log('[Sidebar] click suppressed because dragging'); return; } handleClick(b); }}
              onDoubleClick={() => handleDoubleClick(b)}
              title={b.path}
            >
              <img
                src={b.icon ? b.icon : require('../../../public/logo/png/Blender-Launcher-64x64.png')}
                alt="icon"
                style={{ width: 36, height: 36, borderRadius: 7, marginRight: 8, background: 'transparent', flexShrink: 0 }}
                draggable={false}
              />
              <div style={{
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 14,
                lineHeight: '20px'
              }} title={b.title || b.name}>
                {b.title || b.name}
              </div>

              <div
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                  setPressedIndex(i);
                  if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                  if (ev.pointerType === 'mouse') {
                    draggingIndexRef.current = i;
                    setIsDragging(true);
                  } else {
                    longPressTimer.current = window.setTimeout(() => {
                      draggingIndexRef.current = i;
                      setIsDragging(true);
                    }, 260) as unknown as number;
                  }
                }}
                onPointerMove={(ev) => {
                  ev.preventDefault();
                  lastClientY.current = ev.clientY;
                  if (!isDragging) return;
                  if (pendingRaf.current) return;
                  pendingRaf.current = window.requestAnimationFrame(() => {
                    try {
                      const y = lastClientY.current;
                      const container = containerRef.current;
                      if (!container || y == null) { pendingRaf.current = null; return; }
                      const children = Array.from(container.children) as HTMLElement[];
                      let targetIdx = children.length - 1;
                      for (let idx = 0; idx < children.length; idx++) {
                        const r = children[idx].getBoundingClientRect();
                        const mid = r.top + r.height / 2;
                        if (y < mid) { targetIdx = idx; break; }
                      }
                      const fromIdx = draggingIndexRef.current;
                      if (fromIdx == null) { pendingRaf.current = null; return; }
                      if (fromIdx === targetIdx) { pendingRaf.current = null; return; }
                      const copy = blenders.slice();
                      const [moved] = copy.splice(fromIdx, 1);
                      copy.splice(targetIdx, 0, moved);
                      draggingIndexRef.current = targetIdx;
                      setBlenders(copy);
                    } catch (e) { console.error('pointer drag rAF error', e); }
                    pendingRaf.current = null;
                  });
                }}
                onPointerUp={(ev) => {
                  ev.stopPropagation();
                  try { (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId); } catch {}
                  if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  if (isDragging) {
                    setIsDragging(false);
                    const paths = blenders.map(x => x.path);
                    try { window.electronAPI?.invoke('reorder-blenders', paths); } catch (e) { console.error('reorder-blenders ipc failed', e); }
                    draggingIndexRef.current = null;
                  }
                  setPressedIndex(null);
                }}
                onPointerCancel={(ev) => {
                  ev.stopPropagation();
                  if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                  draggingIndexRef.current = null;
                  setIsDragging(false);
                  setPressedIndex(null);
                }}
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  width: 28,
                  height: 40,
                  paddingRight: 4,
                  boxSizing: 'border-box',
                  cursor: draggingIndexRef.current === i && isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
              >
                {(() => {
                  const active = (pressedIndex === i) || (isDragging && draggingIndexRef.current === i);
                  const fill = active ? '#ffffff' : '#94a3b8';
                  const opacity = active ? 1 : 0.95;
                  return (
                    <svg width="16" height="24" viewBox="0 0 16 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }} aria-hidden>
                      <g fill={fill} opacity={opacity}>
                        <circle cx="4" cy="4" r="1.6" />
                        <circle cx="12" cy="4" r="1.6" />
                        <circle cx="4" cy="12" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="4" cy="20" r="1.6" />
                        <circle cx="12" cy="20" r="1.6" />
                      </g>
                    </svg>
                  );
                })()}
              </div>
            </div>
          ))}
          {pendingBuilds.length > 0 && (
            <>
              {blenders.length > 0 && (
                <div style={{ height: 1, width: 160, background: '#1f2937', margin: '6px 0 4px 0', opacity: 0.6 }} />
              )}
              {pendingBuilds.map((pb) => {
                const isActive = pb.status === 'building' || pb.status === 'cloning';
                const color = pendingStatusColor(pb.status);
                const label = pendingStatusLabel(pb.status);
                return (
                  <div
                    key={pb.id}
                    title={`${pb.repoName} · ${label}\n${t('sidebar.click_for', 'Cliqué pour')} ${pb.status === 'cloned' ? t('compile', 'compiler') : t('view_status', 'voir le statut')}`}
                    onClick={() => onSelectPending?.(pb.id)}
                    style={{
                      padding: '7px 14px 7px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: 180,
                      background: 'transparent',
                      opacity: 0.55,
                      border: `1px solid ${color}22`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.background = '#1a232b'; }}
                    onMouseOut={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {isActive && pb.progress > 0 && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: `${pb.progress}%`, background: color, transition: 'width .4s ease', borderRadius: 1 }} />
                    )}
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: '#1a2430', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isActive ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'bl-spin 1.2s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : pb.status === 'done' ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : pb.status === 'error' ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 8 12 12 14 14"/></svg>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pb.repoName.split('/').pop() || pb.repoName}
                      </div>
                      <div style={{ fontSize: 10, color, marginTop: 1 }}>{label}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
