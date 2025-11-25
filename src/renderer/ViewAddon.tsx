import React, { useEffect, useState } from 'react';
import { TableHeader } from './Filter';
import useSort from './useSort';

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { field: activeField, dir: activeDir, toggle } = useSort(null, 'asc');

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

  // header rendered inside this component so we can pass current sort state and toggle

  // ACTIONS REMOVED: enable/disable, install-on-other, reveal, delete
  // We focus only on displaying addons and caching scan results for speed.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      {/* Header for addons list — shows sort icons and handles toggling */}
      <TableHeader variant="addons" activeField={activeField} activeDir={activeDir} onToggle={(f) => toggle(f)} />
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
          if (activeField === 'version') {
            const va = String((a.bl_info && a.bl_info.version) || '')
            const vb = String((b.bl_info && b.bl_info.version) || '')
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
          }
          if (activeField === 'author') {
            const aa = String((a.bl_info && a.bl_info.author) || '').toLowerCase();
            const ab = String((b.bl_info && b.bl_info.author) || '').toLowerCase();
            if (aa < ab) return -1 * dir;
            if (aa > ab) return 1 * dir;
            return 0;
          }
          if (activeField === 'category') {
            const ca = String((a.bl_info && a.bl_info.category) || '').toLowerCase();
            const cb = String((b.bl_info && b.bl_info.category) || '').toLowerCase();
            if (ca < cb) return -1 * dir;
            if (ca > cb) return 1 * dir;
            return 0;
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
          const keyId = a.module || a.path || String(idx);
          const isExpanded = !!expanded[keyId];
          const bl = a.bl_info || {};
          return (
            <React.Fragment key={keyId}>
            <div
              onClick={() => { if (exists) setExpanded(prev => ({ ...prev, [keyId]: !prev[keyId] })); }}
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
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7, display: 'inline-block' }} title={a.path}>{a.path ? a.path : ''}</span>
            </div>
            {/* Col 2: Version badge */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748b', fontSize: 12 }}>
              {bl.version ? <span style={{ background: '#0b1220', color: '#9ccfd8', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{String(bl.version)}</span> : <span style={{ opacity: 0.6 }}>—</span>}
            </div>
            {/* Col 3: Author */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748b', fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={String(bl.author || '')}>
              {bl.author ? <span style={{ opacity: 0.9 }}>{String(bl.author)}</span> : <span style={{ opacity: 0.6 }}>—</span>}
            </div>
            {/* Col 4: Category */}
            <div style={{ color: '#64748b', fontSize: 12 }}>{bl.category ? <span style={{ background: '#0b1220', color: '#d6c9f9', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{String(bl.category)}</span> : <span style={{ opacity: 0.6 }}>—</span>}</div>
            {/* Col 5: Statut + actions */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: 140, justifyContent: 'flex-end', flexShrink: 0 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>{a.enabled ? 'Activé' : 'Désactivé'}</div>
              <button
                onClick={(e) => { e.stopPropagation(); if (a.path) { (window as any).electronAPI?.send?.('reveal-in-folder', { path: a.path }); } }}
                title="Ouvrir le dossier"
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
                  cursor: a.path ? 'pointer' : 'default',
                  opacity: a.path ? 1 : 0.5
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3" />
                </svg>
              </button>
            </div>
            </div>
            {isExpanded && (
            <div style={{ marginTop: 8, marginBottom: 8, padding: 12, background: '#071018', border: '1px solid #17202a', borderRadius: 8 }}>
              {bl.description && (
                <div style={{ color: '#cbd5e1', marginBottom: 8 }}><strong>Description:</strong> <span style={{ color: '#9fb0c6' }}>{bl.description}</span></div>
              )}
              <div style={{ color: '#9fb0c6', fontSize: 13, overflowX: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{JSON.stringify(bl, null, 2)}</pre>
              </div>
            </div>
            )}
            </React.Fragment>
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
