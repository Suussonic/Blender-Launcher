import React, { useEffect, useMemo, useState } from 'react';

interface ViewInstallProps {
  isOpen: boolean;
  onClose: () => void;
}

type Channel = 'stable' | 'daily' | 'experimental';

const label = {
  stable: 'Stable',
  daily: 'Daily',
  experimental: 'Experimental',
} as const;

const ViewInstall: React.FC<ViewInstallProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'download' | 'compile'>('download');
  const [channel, setChannel] = useState<Channel>('stable');
  const [version, setVersion] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (_: any, payload: { progress?: number; text?: string }) => {
      if (typeof payload?.progress === 'number') setProgress(Math.max(0, Math.min(100, Math.floor(payload.progress))));
      if (payload?.text) setProgressText(payload.text);
    };
    (window as any).electronAPI?.on?.('install-progress', handler);
    return () => {
      (window as any).electronAPI?.off?.('install-progress', handler);
    };
  }, [isOpen]);

  const canInstall = useMemo(() => {
    if (mode === 'download') return !!target && channel !== undefined;
    return false; // compile flow not yet available in this build
  }, [mode, target, channel]);

  const chooseFolder = async () => {
    try {
      const result = await (window as any).electronAPI?.invoke?.('select-output-folder');
      if (typeof result === 'string' && result.trim()) setTarget(result);
    } catch (e) {
      console.warn('[ViewInstall] select-output-folder failed:', e);
    }
  };

  const startInstall = async () => {
    if (!canInstall || installing) return;
    setInstalling(true);
    setError(null);
    setProgress(0);
    setProgressText('Préparation…');
    try {
      if (mode === 'download') {
        const res = await (window as any).electronAPI?.invoke?.('install-from-download', {
          channel,
          version: version?.trim() || undefined,
          target: target,
        });
        if (!res || !res.success) throw new Error(res?.error || 'Installation échouée');
        setProgress(100);
        setProgressText('Installation terminée');
        setTimeout(() => onClose(), 600);
      } else {
        const res = await (window as any).electronAPI?.invoke?.('build-from-source', {});
        if (!res || !res.success) throw new Error(res?.error || 'Compilation échouée');
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setInstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 640, maxWidth: '94vw', background: '#0b1220', borderRadius: 12, padding: 20, color: '#e6eef6', border: '1px solid #1f2a3a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Installer un build Blender</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9fb0c2', cursor: 'pointer' }} title="Fermer">✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {([
            { id: 'download', label: 'Télécharger' },
            { id: 'compile', label: 'Compiler (avancé)' }
          ] as Array<{ id: 'download' | 'compile'; label: string }>).map((opt) => (
            <button key={opt.id} onClick={() => setMode(opt.id as any)} style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #253446',
              background: mode === opt.id ? '#132034' : '#0f1827',
              color: '#e6eef6', cursor: 'pointer', fontWeight: 600
            }}>{opt.label}</button>
          ))}
        </div>

        {mode === 'download' && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 6, color: '#9fb0c2' }}>Canal</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['stable','daily','experimental'] as Channel[]).map(c => (
                  <button key={c} onClick={() => setChannel(c)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #253446', background: channel === c ? '#132034' : '#0f1827', color: '#e6eef6', cursor: 'pointer' }}>{label[c]}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, marginBottom: 6, color: '#9fb0c2' }}>Version (optionnel)</div>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="ex: 4.1 ou 4.1.1" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6' }} />
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <div style={{ fontSize: 13, marginBottom: 6, color: '#9fb0c2' }}>Dossier d’installation</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Ex: D:\\Blenders" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6' }} />
                <button onClick={chooseFolder} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6', cursor: 'pointer' }}>Parcourir…</button>
              </div>
            </div>
          </div>
        )}

        {mode === 'compile' && (
          <div style={{ marginTop: 14, color: '#9fb0c2' }}>
            Le flux de compilation depuis les sources est plus long et nécessite des prérequis (Git, Python, CMake, Ninja, MSVC). Il sera ajouté ici avec un suivi détaillé.
          </div>
        )}

        {(installing || progress > 0 || progressText || error) && (
          <div style={{ marginTop: 14 }}>
            {progressText && <div style={{ color: '#9fb0c2', marginBottom: 6 }}>{progressText}</div>}
            {(installing || progress > 0) && (
              <div style={{ height: 8, background: '#102033', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#1f7aeb', transition: 'width .2s ease' }} />
              </div>
            )}
            {error && (
              <div style={{ marginTop: 8, background: '#2b1010', color: '#fecaca', padding: 8, borderRadius: 8 }}>Erreur: {error}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={installing} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #253446', background: '#0f1827', color: '#e6eef6' }}>Fermer</button>
          <button onClick={startInstall} disabled={!canInstall || installing} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: canInstall ? '#1f7aeb' : '#1b2a44', color: '#fff', cursor: canInstall ? 'pointer' : 'not-allowed' }}>Installer</button>
        </div>
      </div>
    </div>
  );
};

export default ViewInstall;
