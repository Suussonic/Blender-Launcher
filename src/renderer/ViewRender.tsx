import React from 'react';

// Basic types re-used here to avoid importing app-level types
export type BlenderExe = {
  path: string;
  name: string;
  title?: string;
  icon?: string;
};

export type RenderEngine = 'CYCLES' | 'BLENDER_EEVEE' | 'BLENDER_EEVEE_NEXT';
export type RenderMode = 'IMAGE' | 'ANIMATION';

export interface RenderConfig {
  blender: BlenderExe | null;
  engine: RenderEngine;
  mode: RenderMode;
  resolution: { width: number; height: number };
  frames?: { start: number; end: number };
  stillFrame?: number; // used in IMAGE mode
  outputDir: string;
  // Output formatting
  imageFormat?: 'PNG' | 'JPEG' | 'OPEN_EXR' | 'TIFF' | 'BMP';
  videoMode?: 'VIDEO' | 'SEQUENCE';
  videoContainer?: 'MP4' | 'MKV' | 'AVI';
  videoCodec?: 'H264' | 'HEVC' | 'MPEG4';
  videoQuality?: 'fast' | 'good' | 'best';
  openRenderWindow?: boolean;
  shutdownOnFinish: boolean;
  filePath?: string;
}

interface ViewRenderProps {
  selected?: BlenderExe | null;
  blenders?: BlenderExe[];
  onChooseBlender?: (b: BlenderExe) => void;
  onStartRender?: (cfg: RenderConfig) => void;
  // Controlled modal support
  open?: boolean;
  onClose?: () => void;
  // Hide the launcher button when embedding as an action
  showLauncherButton?: boolean;
  // Optional file to render
  filePath?: string;
}

const defaultIcon = require('../../public/logo/png/Blender-Launcher-64x64.png');

const segmentBase: React.CSSProperties = {
  display: 'inline-flex',
  background: '#0e141b',
  border: '1px solid #22303b',
  borderRadius: 14,
  padding: 6,
  gap: 6,
  height: 44,
  alignItems: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 6px 14px rgba(0,0,0,0.28)'
};

const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '9px 14px',
  borderRadius: 12,
  border: active ? '1px solid #3b82f6' : '1px solid transparent',
  cursor: 'pointer',
  color: active ? '#0b1220' : '#cbd5e1',
  background: active ? 'linear-gradient(180deg, #5ea3f9 0%, #3f83f8 100%)' : 'transparent',
  boxShadow: active ? '0 8px 18px rgba(63,131,248,0.28), inset 0 -1px 0 rgba(0,0,0,0.25)' : 'none',
  fontWeight: 700,
  fontSize: 13,
  height: 32,
  lineHeight: '20px',
  transition: 'background .18s ease, color .18s ease, box-shadow .18s ease, border-color .18s ease'
});

const fieldLabel: React.CSSProperties = { fontSize: 12, color: '#a7b3c6', marginBottom: 6, fontWeight: 600 };
const inputBase: React.CSSProperties = { background: '#0b1016', color: '#e5e7eb', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px', boxSizing: 'border-box' };

// Small styled checkbox for nicer visual
const NiceCheckbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }>=({ checked, onChange, label })=>{
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e)=>{ if(e.key===' '|| e.key==='Enter'){ e.preventDefault(); onChange(!checked);} }}
      style={{
        display:'inline-flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none',
        background:'#11161c', border:'1px solid #22303b', borderRadius:10, padding:'8px 12px',
        transition:'background .15s, border-color .15s',
      }}
      onMouseOver={(e)=>{ (e.currentTarget as HTMLDivElement).style.background = '#16202a'; (e.currentTarget as HTMLDivElement).style.borderColor = '#2a3a48'; }}
      onMouseOut={(e)=>{ (e.currentTarget as HTMLDivElement).style.background = '#11161c'; (e.currentTarget as HTMLDivElement).style.borderColor = '#22303b'; }}
    >
      <div style={{ width:18, height:18, borderRadius:6, border: `2px solid ${checked ? '#22c55e' : '#3a4652'}`, background: checked ? '#22c55e' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0b1016" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{ color:'#e5e7eb', fontSize:14, fontWeight:600 }}>{label}</span>
    </div>
  );
};

// Styled select (custom dropdown)
type Option = { value: string; label: string };
const NiceSelect: React.FC<{
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  width?: number | string;
}> = ({ value, options, onChange, width = '100%' }) => {
  const [open, setOpen] = React.useState(false);
  const [hoverIdx, setHoverIdx] = React.useState<number>(() => Math.max(0, options.findIndex(o => o.value === value)));
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const selected = options.find(o => o.value === value) || options[0];
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  React.useEffect(() => {
    setHoverIdx(Math.max(0, options.findIndex(o => o.value === value)));
  }, [value, options]);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); return; }
    if (open) {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHoverIdx(i => Math.min(options.length - 1, i + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHoverIdx(i => Math.max(0, i - 1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); const opt = options[hoverIdx]; if (opt) { onChange(opt.value); setOpen(false); } return; }
    }
  };
  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKey} style={{ position: 'relative', width, outline: 'none' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          ...inputBase,
          width,
          height: 38,
          padding: '8px 12px',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', background: '#1a232b', border: '1px solid #24303a'
        }}
        onMouseOver={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = '#23313c'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2f3e4a'; }}
        onMouseOut={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = '#1a232b'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#24303a'; }}
      >
        <span style={{ color:'#e2e8f0', fontWeight:600, fontSize:13 }}>{selected?.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ea0b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#0f172a', border: '1px solid #1f2937', borderRadius: 10, padding: 6, boxShadow: '0 12px 30px rgba(0,0,0,0.45)', zIndex: 50, maxHeight: 220, overflowY: 'auto' }}>
          {options.map((opt, idx) => {
            const active = value === opt.value;
            const hover = idx === hoverIdx;
            return (
              <div key={opt.value}
                onMouseEnter={() => setHoverIdx(idx)}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 8,
                  background: hover ? '#182129' : 'transparent',
                  color: active ? '#93c5fd' : '#e5e7eb', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500
                }}
              >
                <span>{opt.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ViewRender: React.FC<ViewRenderProps> = ({ selected = null, blenders, onChooseBlender, onStartRender, open, onClose, showLauncherButton = true, filePath }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [blenderList, setBlenderList] = React.useState<BlenderExe[]>(blenders || []);
  const [chosen, setChosen] = React.useState<BlenderExe | null>(selected || null);
  const [engine, setEngine] = React.useState<RenderEngine>('BLENDER_EEVEE');
  const [mode, setMode] = React.useState<RenderMode>('IMAGE');
  const [resW, setResW] = React.useState<number>(1920);
  const [resH, setResH] = React.useState<number>(1080);
  const [frameStart, setFrameStart] = React.useState<number>(1);
  const [frameEnd, setFrameEnd] = React.useState<number>(250);
  const [outputDir, setOutputDir] = React.useState<string>('');
  const [openRenderWindow, setOpenRenderWindow] = React.useState<boolean>(true);
  const [shutdownOnFinish, setShutdownOnFinish] = React.useState<boolean>(false);
  const [showVersionSwitcher, setShowVersionSwitcher] = React.useState<boolean>(false);
  const metaRef = React.useRef<{ width?: number; height?: number; frame_start?: number; frame_end?: number; frame_current?: number; output?: string; engine?: string; file_format?: string }|null>(null);
  const lastPrefillKeyRef = React.useRef<string | null>(null);
  const [metaLoading, setMetaLoading] = React.useState<boolean>(false);
  const [metaError, setMetaError] = React.useState<string | null>(null);
  const [stillFrame, setStillFrame] = React.useState<number>(1);
  // Output settings
  const [imageFormat, setImageFormat] = React.useState<'PNG'|'JPEG'|'OPEN_EXR'|'TIFF'|'BMP'>('PNG');
  const [videoMode, setVideoMode] = React.useState<'VIDEO'|'SEQUENCE'>('VIDEO');
  const [videoContainer, setVideoContainer] = React.useState<'MP4'|'MKV'|'AVI'>('MP4');
  const [videoCodec, setVideoCodec] = React.useState<'H264'|'HEVC'|'MPEG4'>('H264');
  // Removed video quality control to simplify UI

  // Try to fetch blender list when opening if not provided
  const loadBlendersIfNeeded = async () => {
    if (blenderList && blenderList.length > 0) return;
    try {
      const api: any = (window as any).electronAPI;
      let list: any = undefined;
      if (api?.getBlenders) {
        list = await api.getBlenders();
      } else if (api?.invoke) {
        list = await api.invoke('get-blenders');
      }
      if (Array.isArray(list)) setBlenderList(list);
    } catch (e) {
      console.warn('[ViewRender] loadBlendersIfNeeded failed:', e);
    }
  };

  const prefillFromBlend = React.useCallback(async () => {
    // Avoid duplicate fetch for same exe+file while modal is open
    const exe = (chosen?.path || selected?.path);
    const key = exe && filePath ? `${exe}|${filePath}` : null;
    if (!exe || !filePath) { return; }
    if (lastPrefillKeyRef.current === key) { return; }
    setMetaLoading(true);
    setMetaError(null);
    try {
      const api: any = (window as any).electronAPI;
      if (api?.invoke) {
        const res = await api.invoke('get-blend-metadata', { exePath: exe, blendPath: filePath });
        if (res && res.success && res.data) {
          lastPrefillKeyRef.current = key;
          console.log('[ViewRender] Metadata received:', res.data);
          metaRef.current = res.data;
          if (typeof res.data.width === 'number' && res.data.width > 0) setResW(res.data.width);
          if (typeof res.data.height === 'number' && res.data.height > 0) setResH(res.data.height);
          if (typeof res.data.frame_start === 'number') setFrameStart(res.data.frame_start);
          if (typeof res.data.frame_end === 'number') setFrameEnd(res.data.frame_end);
          if (typeof res.data.frame_current === 'number') setStillFrame(res.data.frame_current);
          if (typeof res.data.output === 'string') setOutputDir(res.data.output);
          if (typeof res.data.engine === 'string') {
            const eng = res.data.engine as RenderEngine;
            if (eng === 'CYCLES' || eng === 'BLENDER_EEVEE' || eng === 'BLENDER_EEVEE_NEXT') setEngine(eng);
          }
          if (typeof res.data.file_format === 'string') {
            const fmt = res.data.file_format.toUpperCase();
            if (fmt === 'PNG' || fmt === 'JPEG' || fmt === 'OPEN_EXR' || fmt === 'TIFF' || fmt === 'BMP') setImageFormat(fmt);
          }
        } else {
          setMetaError(res?.reason || 'metadata-failed');
        }
      }
    } catch (e) {
      console.warn('[ViewRender] get-blend-metadata failed:', e);
      setMetaError((e as any)?.message || 'metadata-exception');
    } finally {
      setMetaLoading(false);
    }
  }, [chosen?.path, selected?.path, filePath]);

  const doOpen = async () => {
    setIsOpen(true);
    setShowVersionSwitcher(false);
    await loadBlendersIfNeeded();
    // Default selection from prop or first entry once available
    if (!chosen && selected) setChosen(selected);
    // Prefill when opening via internal launcher
    if (filePath) {
      setMetaLoading(true);
      setMetaError(null);
      await prefillFromBlend();
    }
  };

  const doClose = () => {
    if (onClose) onClose();
    setIsOpen(false);
  };

  const isModalOpen = typeof open === 'boolean' ? open : isOpen;

  const chooseFolder = async () => {
    if ((window as any).electronAPI?.invoke) {
      try {
        const result = await (window as any).electronAPI.invoke('select-output-folder');
        if (result && typeof result === 'string') setOutputDir(result);
        if (result && result.path) setOutputDir(result.path);
      } catch (e) {
        console.warn('[ViewRender] select-output-folder failed:', e);
      }
    }
  };

  // When the blender list changes and nothing is chosen, pick selected or the first in the list
  React.useEffect(() => {
    if (!chosen) {
      if (selected) {
        setChosen(selected);
      } else if (blenderList && blenderList.length > 0) {
        setChosen(blenderList[0]);
      }
    }
  }, [blenderList, selected]);

  // When modal is opened externally (open prop), auto-prefill from the .blend
  React.useEffect(() => {
    const isModalOpen = typeof open === 'boolean' ? open : isOpen;
    if (!isModalOpen) return;
    // Load available blenders if needed and prefill
    (async () => {
      await loadBlendersIfNeeded();
      if (!chosen && selected) setChosen(selected);
      if (filePath) {
        setMetaLoading(true);
        setMetaError(null);
        await prefillFromBlend();
      }
    })();
    // Reset prefill key when closing so reopening triggers fetch again
    return () => { lastPrefillKeyRef.current = null; };
  }, [open, isOpen, chosen?.path, selected?.path, filePath, prefillFromBlend]);

  const start = async () => {
    const cfg: RenderConfig = {
      blender: chosen,
      engine,
      mode,
      resolution: { width: resW, height: resH },
      frames: mode === 'ANIMATION' ? { start: frameStart, end: frameEnd } : undefined,
  // For still image, carry the selected frame
  stillFrame: mode === 'IMAGE' ? stillFrame : undefined,
      outputDir,
      imageFormat: mode === 'IMAGE' ? imageFormat : (videoMode === 'SEQUENCE' ? imageFormat : undefined),
      videoMode: mode === 'ANIMATION' ? videoMode : undefined,
      videoContainer: mode === 'ANIMATION' && videoMode === 'VIDEO' ? videoContainer : undefined,
      videoCodec: mode === 'ANIMATION' && videoMode === 'VIDEO' ? videoCodec : undefined,
  // videoQuality removed from config
      openRenderWindow,
      shutdownOnFinish,
      filePath
    };
    try {
      console.log('[ViewRender] Invoking start-render with cfg:', cfg);
      const api: any = (window as any).electronAPI;
      if (api?.invoke) {
        await api.invoke('start-render', cfg);
        console.log('[ViewRender] start-render invoked');
      }
      if (onStartRender) onStartRender(cfg);
    } catch (e) {
      console.warn('[ViewRender] start-render failed:', e);
    } finally {
      // Do not auto-close immediately: let the user see the progress bar
      setTimeout(() => doClose(), 500);
    }
  };

  return (
    <div>
      {/* Launch-style button as in the provided screenshot */}
      {showLauncherButton && (
        <button
          onClick={doOpen}
          style={{
            width: '100%',
            background: '#0b1016',
            border: '1px solid #26303b',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            color: '#e5e7eb',
          }}
          title="Configurer un rendu rapide"
        >
          <img src={(chosen?.icon || defaultIcon)} alt="blender" width={28} height={28} style={{ borderRadius: 6 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontWeight: 700 }}>{chosen?.title || chosen?.name || 'Choisir un Blender'}</div>
            <div style={{ fontSize: 12, color: '#8ea0b5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {chosen?.path || 'Sélectionnez un exécutable pour rendre'}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8ea0b5' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 'min(720px, 95vw)', maxWidth: '95vw', background: '#0F1419', border: '1px solid #26303b', borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', padding: 20, overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: '#e5e7eb' }}>Rendu rapide</h2>
              <button onClick={doClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Loading overlay for metadata */}
            {metaLoading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,20,25,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#cbd5e1', fontWeight: 600 }}>
                  <div className="blender-spinner" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #334155', borderTopColor: '#60a5fa', animation: 'spin 0.9s linear infinite' }} />
                  Chargement des paramètres du fichier…
                </div>
              </div>
            )}

            {filePath && (
              <div style={{ marginBottom: 12, color: '#9ca3af', fontSize: 12 }}>
                Fichier: <span style={{ color: '#cbd5e1' }}>{filePath}</span>
              </div>
            )}

            {/* Blender picker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'start', marginBottom: 16 }}>
              <div style={{ position: 'relative' }}>
                <div style={fieldLabel}>Blender</div>
                <button
                  onClick={async () => {
                    if (!showVersionSwitcher) await loadBlendersIfNeeded();
                    setShowVersionSwitcher(v => !v);
                  }}
                  title={chosen?.path || 'Sélectionner'}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#1a232b',
                    border: '1px solid #24303a',
                    color: '#e2e8f0',
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: 'none',
                    boxShadow: 'none'
                  }}
                >
                  <img src={(chosen?.icon || defaultIcon)} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chosen?.title || chosen?.name || 'Sélectionner'}</div>
                    <div style={{ fontSize: 10, color: '#8ea0b5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chosen?.path || ''}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8ea0b5', transform: showVersionSwitcher ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showVersionSwitcher && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
                  }}>
                    <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                      {blenderList.map((b) => (
                        <button
                          key={b.path}
                          onClick={() => { setChosen(b); if (onChooseBlender) onChooseBlender(b); setShowVersionSwitcher(false); }}
                          title={b.path}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: chosen?.path === b.path ? '#23313c' : '#1a232b',
                            border: `1px solid ${chosen?.path === b.path ? '#2f3e4a' : '#24303a'}`,
                            color: '#e2e8f0',
                            padding: '10px 12px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            width: '100%',
                            outline: 'none',
                            boxShadow: 'none',
                            textAlign: 'left'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#23313c'; e.currentTarget.style.borderColor = '#2f3e4a'; }}
                          onMouseOut={(e) => { if (chosen?.path !== b.path) { e.currentTarget.style.background = '#1a232b'; e.currentTarget.style.borderColor = '#24303a'; }}}
                        >
                          <img src={b.icon || defaultIcon} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title || b.name}</div>
                            <div style={{ fontSize: 10, color: '#8ea0b5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.path}</div>
                          </div>
                          {chosen?.path === b.path && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#93c5fd' }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Switches replaced by dropdowns */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ minWidth: 220 }}>
                <div style={fieldLabel}>Moteur de rendu</div>
                <NiceSelect
                  value={engine}
                  onChange={(v)=> setEngine(v as any)}
                  options={[
                    { value: 'BLENDER_EEVEE', label: 'Eevee' },
                    { value: 'BLENDER_EEVEE_NEXT', label: 'Eevee Next' },
                    { value: 'CYCLES', label: 'Cycles' },
                  ]}
                />
              </div>
              <div style={{ minWidth: 220 }}>
                <div style={fieldLabel}>Type de rendu</div>
                <NiceSelect
                  value={mode}
                  onChange={(v)=>{
                    if (v === 'ANIMATION') {
                      setMode('ANIMATION');
                      const m = metaRef.current;
                      if (m) {
                        if (typeof m.frame_start === 'number') setFrameStart(m.frame_start);
                        if (typeof m.frame_end === 'number') setFrameEnd(m.frame_end);
                      }
                    } else {
                      setMode('IMAGE');
                    }
                  }}
                  options={[
                    { value: 'IMAGE', label: 'Image' },
                    { value: 'ANIMATION', label: 'Vidéo' },
                  ]}
                />
              </div>
            </div>

            {metaError && (
              <div style={{ marginTop: -8, marginBottom: 8, color: '#f87171', fontSize: 12 }}>
                Impossible de charger les paramètres du .blend ({metaError}).
              </div>
            )}

            {/* Resolution + frames (responsive grid to avoid overlap) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: mode==='IMAGE' ? 'repeat(3, minmax(220px, 1fr))' : 'repeat(2, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
                alignItems: 'end'
              }}
            >
              <div>
                <div style={fieldLabel}>Résolution (largeur)</div>
                <input type="number" value={resW} onChange={e => setResW(Math.max(1, Number(e.target.value||0)))} style={{ ...inputBase, width: 160, height: 38 }} />
              </div>
              <div>
                <div style={fieldLabel}>Résolution (hauteur)</div>
                <input type="number" value={resH} onChange={e => setResH(Math.max(1, Number(e.target.value||0)))} style={{ ...inputBase, width: 160, height: 38 }} />
              </div>
              {mode==='IMAGE' && (
                <div>
                  <div style={fieldLabel}>Frame à rendre</div>
                  <input type="number" value={stillFrame} onChange={e => setStillFrame(Math.max(0, Number(e.target.value||0)))} style={{ ...inputBase, width: 160, height: 38 }} />
                </div>
              )}
              {mode==='ANIMATION' && (
                <>
                  <div>
                    <div style={fieldLabel}>Frame début</div>
                    <input type="number" value={frameStart} onChange={e => setFrameStart(Number(e.target.value||0))} style={{ ...inputBase, width: 160, height: 38 }} />
                  </div>
                  <div>
                    <div style={fieldLabel}>Frame fin</div>
                    <input type="number" value={frameEnd} onChange={e => setFrameEnd(Number(e.target.value||0))} style={{ ...inputBase, width: 160, height: 38 }} />
                  </div>
                </>
              )}
            </div>

            {/* Output format (IMAGE mode) */}
            {mode === 'IMAGE' && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={fieldLabel}>Format de l'image</div>
                  <NiceSelect
                    value={imageFormat}
                    onChange={(v)=> setImageFormat(v as any)}
                    options={[
                      { value: 'PNG', label: 'PNG' },
                      { value: 'JPEG', label: 'JPEG' },
                      { value: 'OPEN_EXR', label: 'OpenEXR' },
                      { value: 'TIFF', label: 'TIFF' },
                      { value: 'BMP', label: 'BMP' },
                    ]}
                  />
                </div>
              </div>
            )}

            {mode === 'ANIMATION' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12, marginBottom: 16, alignItems: 'end' }}>
                <div>
                  <div style={fieldLabel}>Type de sortie</div>
                  <NiceSelect
                    value={videoMode}
                    onChange={(v)=> setVideoMode(v as any)}
                    options={[
                      { value: 'VIDEO', label: 'Vidéo (MP4)' },
                      { value: 'SEQUENCE', label: "Séquence d'images" },
                    ]}
                  />
                </div>
                {videoMode === 'VIDEO' ? (
                  <>
                    <div>
                      <div style={fieldLabel}>Conteneur</div>
                      <NiceSelect
                        value={videoContainer}
                        onChange={(v)=> setVideoContainer(v as any)}
                        options={[
                          { value: 'MP4', label: 'MP4' },
                          { value: 'MKV', label: 'MKV' },
                          { value: 'AVI', label: 'AVI' },
                        ]}
                      />
                    </div>
                    <div>
                      <div style={fieldLabel}>Codec</div>
                      <NiceSelect
                        value={videoCodec}
                        onChange={(v)=> setVideoCodec(v as any)}
                        options={[
                          { value: 'H264', label: 'H.264' },
                          { value: 'HEVC', label: 'H.265 (HEVC)' },
                          { value: 'MPEG4', label: 'MPEG-4' },
                        ]}
                      />
                    </div>
                    
                  </>
                ) : (
                  <div>
                    <div style={fieldLabel}>Format d'image (séquence)</div>
                    <NiceSelect
                      value={imageFormat}
                      onChange={(v)=> setImageFormat(v as any)}
                      options={[
                        { value: 'PNG', label: 'PNG' },
                        { value: 'JPEG', label: 'JPEG' },
                        { value: 'OPEN_EXR', label: 'OpenEXR' },
                        { value: 'TIFF', label: 'TIFF' },
                        { value: 'BMP', label: 'BMP' },
                      ]}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Output (clean embedded icon) */}
            <div style={{ marginBottom: 16 }}>
              <div style={fieldLabel}>Dossier de sortie</div>
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <input
                  type="text"
                  value={outputDir}
                  onChange={e => setOutputDir(e.target.value)}
                  placeholder="Ex: C:\\Rendus"
                  style={{
                    ...inputBase,
                    width: '100%',
                    maxWidth: '100%',
                    height: 38,
                    paddingRight: 48,
                    borderRadius: 10
                  }}
                />
                <button
                  onClick={chooseFolder}
                  title="Choisir un dossier"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 6,
                    transform: 'translateY(-50%)',
                    width: 36,
                    height: 30,
                    background: '#1e2530',
                    border: '1px solid #26303b',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <NiceCheckbox checked={openRenderWindow} onChange={setOpenRenderWindow} label="Ouvrir la fenêtre de rendu" />
              <NiceCheckbox checked={shutdownOnFinish} onChange={setShutdownOnFinish} label="Éteindre l’ordinateur" />
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={start} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Lancer le rendu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewRender;
