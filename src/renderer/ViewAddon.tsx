import React, { useEffect, useState } from 'react';
import { TableHeader } from './Filter';

type BlenderExe = { path: string } | null;

type Props = {
  selectedBlender: BlenderExe;
  query?: string;
};

const ViewAddon: React.FC<Props> = ({ selectedBlender, query }) => {
  const [addons, setAddons] = useState<Array<any>>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsError, setAddonsError] = useState<string | null>(null);
  // query will be provided by parent FindBar to keep the same control
  // const [addonQuery, setAddonQuery] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastProbeStdout, setLastProbeStdout] = useState<string | null>(null);
  const [lastProbeStderr, setLastProbeStderr] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [activeDir, setActiveDir] = useState<'asc'|'desc'>('asc');

  const loadAddons = async () => {
    if (!selectedBlender) return;
    setAddonsLoading(true); setAddonsError(null);
    try {
      const api: any = (window as any).electronAPI;
      if (api?.getAddons) {
        const res = await api.getAddons(selectedBlender.path);
        if (res?.stdout) setLastProbeStdout(res.stdout);
        if (res?.stderr) setLastProbeStderr(res.stderr);
        if (res?.success && Array.isArray(res.addons)) { setAddons(res.addons); setAddonsLoading(false); return; }
      } else if (api?.invoke) {
        const res = await api.invoke('get-addons', selectedBlender.path);
        if (res?.stdout) setLastProbeStdout(res.stdout);
        if (res?.stderr) setLastProbeStderr(res.stderr);
        if (res?.success && Array.isArray(res.addons)) { setAddons(res.addons); setAddonsLoading(false); return; }
      }
      // Fallback
      if (api?.scanAddonsFs) {
        const fsres = await api.scanAddonsFs({ exePath: selectedBlender.path });
        if (fsres?.success) setAddons(fsres.addons || []);
        else setAddonsError(fsres?.error || 'Scan échoué');
      } else if (api?.invoke) {
        const fsres = await api.invoke('scan-addons-fs', { exePath: selectedBlender.path });
        if (fsres?.success) setAddons(fsres.addons || []);
        else setAddonsError(fsres?.error || 'Scan échoué');
      }
    } catch (e:any) { setAddonsError(e?.message || String(e)); }
    setAddonsLoading(false);
  };

  useEffect(() => { if (selectedBlender) loadAddons(); }, [selectedBlender?.path]);

  useEffect(() => {
    const handler = (e: any) => {
      const field = e?.detail?.field;
      if (!field) return;
      setActiveField((prev) => {
        if (prev === field) {
          setActiveDir(d => d === 'asc' ? 'desc' : 'asc');
          return prev;
        }
        setActiveDir('asc');
        return field;
      });
    };
    window.addEventListener('blender-launcher-addon-sort', handler as EventListener);
    return () => window.removeEventListener('blender-launcher-addon-sort', handler as EventListener);
  }, []);

  // ACTIONS REMOVED: enable/disable, install-on-other, reveal, delete
  // We focus only on displaying addons and caching scan results for speed.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {addonsLoading && <div style={{ color: '#94a3b8' }}>Scan en cours...</div>}
      {addonsError && <div style={{ color: '#f87171' }}>Erreur: {addonsError}</div>}
      {!addonsLoading && addons.length === 0 && <div style={{ color: '#64748b' }}>Aucun add‑on détecté</div>}
      
        {addons.slice().sort((a,b) => {
          if (!activeField) return 0;
          const dir = activeDir === 'asc' ? 1 : -1;
          if (activeField === 'name') {
            const na = (a.name||a.module||'').toLowerCase();
            const nb = (b.name||b.module||'').toLowerCase();
            if (na < nb) return -1 * dir;
            if (na > nb) return 1 * dir;
            return 0;
          }
          if (activeField === 'status') {
            const sa = a.enabled ? 1 : 0;
            const sb = b.enabled ? 1 : 0;
            return (sa - sb) * dir;
          }
          return 0;
        }).filter(a => {
          if (!query || !query.trim()) return true;
          const q = query.trim().toLowerCase();
          return ((a.name||'') + ' ' + (a.module||'') + ' ' + (a.path||'')).toLowerCase().includes(q);
        }).map((a, idx) => {
          // adapt to the same grid as recent files: 5 columns
          const createdStr = '';
          const usedStr = '';
          const sizeStr = '';
          const exists = !!a.path;
          return (
            <div
              key={a.path || a.module || idx}
              role={exists ? 'button' : undefined}
              tabIndex={exists ? 0 : -1}
              onKeyDown={(e) => { if (exists && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); } }}
              style={{
                background: '#131a20',
                border: '1px solid #1e2530',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'grid',
                // match recent files spacing (5 columns) so header alignment is identical
                gridTemplateColumns: 'minmax(160px, 1fr) 170px 170px 110px 140px',
                gap: 12,
                alignItems: 'center',
                position: 'relative',
                opacity: exists ? 1 : 0.55,
                cursor: exists ? 'default' : 'default',
                transition: 'background 0.15s, border-color 0.15s',
                minWidth: 0
              }}
              onMouseOver={e => { if (exists) { e.currentTarget.style.background = '#182129'; e.currentTarget.style.borderColor = '#26303b'; } }
              }
              onMouseOut={e => { e.currentTarget.style.background = '#131a20'; e.currentTarget.style.borderColor = '#1e2530'; }}
            >
              {/* Col 1: Nom + meta + chemin */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={a.path || a.module}
              >
                {a.name || a.module}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#64748b', fontSize: 12 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85, display: 'inline-block', direction: 'rtl', textAlign: 'left' }} title={a.path}>{a.module} · {a.path ? a.path : ''}</span>
              </div>
            </div>
            {/* Col 2: Statut (Activé / Désactivé) - center under header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', fontSize: 12 }}>
              <div style={{ height: 6 }} />
              <div>{a.enabled ? 'Activé' : 'Désactivé'}</div>
            </div>
            {/* Col 3 & 4: empty placeholders to match spacing */}
            <div />
            <div />
            {/* Col 5: placeholder for alignment (no duplicate status) */}
            <div style={{ width: 140 }} />
            </div>
          );
        })}
      {/* Action popups removed - view-only mode */}
      {debugOpen && (
        <div style={{ marginTop: 12, background: '#071018', border: '1px solid #17202a', padding: 12, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#e6eef8' }}>Debug output</h4>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
            <strong>Stdout:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#c7f9d4', background: 'transparent', marginTop: 6 }}>{lastProbeStdout || '(empty)'}</pre>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            <strong>Stderr:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#f9c7c7', background: 'transparent', marginTop: 6 }}>{lastProbeStderr || '(empty)'}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewAddon;
