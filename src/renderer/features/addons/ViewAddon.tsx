import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableHeader } from '../recent/Filter';
import useSort from '../../shared/hooks/useSort';

type BlenderExe = { path: string } | null;

type Props = {
  selectedBlender: BlenderExe;
  query?: string;
};

const ViewAddon: React.FC<Props> = ({ selectedBlender, query }) => {
  const { t } = useTranslation();
  const [addons, setAddons] = useState<Array<any>>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsError, setAddonsError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastProbeStdout, setLastProbeStdout] = useState<string | null>(null);
  const [lastProbeStderr, setLastProbeStderr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { field: activeField, dir: activeDir, toggle } = useSort(null, 'asc');

  const loadAddons = async () => {
    if (!selectedBlender) return;
    console.log('[addons-ui] loadAddons:start', { exePath: selectedBlender.path });
    setAddonsLoading(true); setAddonsError(null);
    try {
      const api: any = (window as any).electronAPI;
      if (api?.getAddons) {
        const res = await api.getAddons(selectedBlender.path);
        console.log('[addons-ui] loadAddons:api.getAddons result', {
          success: !!res?.success,
          count: Array.isArray(res?.addons) ? res.addons.length : null,
          error: res?.error || null
        });
        if (res?.stdout) setLastProbeStdout(res.stdout);
        if (res?.stderr) setLastProbeStderr(res.stderr);
        if (res?.success && Array.isArray(res.addons)) { setAddons(res.addons); setErrors({}); setAddonsLoading(false); return; }
      } else if (api?.invoke) {
        const res = await api.invoke('get-addons', selectedBlender.path);
        console.log('[addons-ui] loadAddons:api.invoke(get-addons) result', {
          success: !!res?.success,
          count: Array.isArray(res?.addons) ? res.addons.length : null,
          error: res?.error || null
        });
        if (res?.stdout) setLastProbeStdout(res.stdout);
        if (res?.stderr) setLastProbeStderr(res.stderr);
        if (res?.success && Array.isArray(res.addons)) { setAddons(res.addons); setErrors({}); setAddonsLoading(false); return; }
      }
      if (api?.scanAddonsFs) {
        const fsres = await api.scanAddonsFs({ exePath: selectedBlender.path });
        console.log('[addons-ui] loadAddons:scanAddonsFs fallback', {
          success: !!fsres?.success,
          count: Array.isArray(fsres?.addons) ? fsres.addons.length : null,
          error: fsres?.error || null
        });
        if (fsres?.success) setAddons(fsres.addons || []);
        else setAddonsError(fsres?.error || t('addons.scan_failed', 'Scan failed'));
      } else if (api?.invoke) {
        const fsres = await api.invoke('scan-addons-fs', { exePath: selectedBlender.path });
        console.log('[addons-ui] loadAddons:invoke(scan-addons-fs) fallback', {
          success: !!fsres?.success,
          count: Array.isArray(fsres?.addons) ? fsres.addons.length : null,
          error: fsres?.error || null
        });
        if (fsres?.success) setAddons(fsres.addons || []);
        else setAddonsError(fsres?.error || t('addons.scan_failed', 'Scan failed'));
      }
    } catch (e:any) {
      console.error('[addons-ui] loadAddons:error', e);
      setAddonsError(e?.message || String(e));
    }
    console.log('[addons-ui] loadAddons:end', { exePath: selectedBlender.path });
    setAddonsLoading(false);
  };

  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const setAddonEnabled = async (moduleName: string, enable: boolean) => {
    if (!selectedBlender || !moduleName) return;
    try {
      console.log('[addons-ui] toggle:start', {
        exePath: selectedBlender.path,
        module: moduleName,
        action: enable ? 'enable' : 'disable'
      });
      setUpdating(prev => ({ ...prev, [moduleName]: true }));
      const api: any = (window as any).electronAPI;
      let res: any = null;
      if (api?.enableAddon) {
        res = await api.enableAddon({ exePath: selectedBlender.path, module: moduleName, enable });
      } else if (api?.invoke) {
        res = await api.invoke('enable-addon', { exePath: selectedBlender.path, module: moduleName, enable });
      }
      console.log('[addons-ui] toggle:result', {
        exePath: selectedBlender.path,
        module: moduleName,
        action: enable ? 'enable' : 'disable',
        success: !!res?.success,
        error: res?.error || null
      });
      const message = (res?.success === false && (res.error || res.stderr || res.stdout)) ? String(res.error || res.stderr || res.stdout) : null;
      setErrors(prev => ({ ...prev, [moduleName]: message }));
      await loadAddons();
      console.log('[addons-ui] toggle:after-reload', {
        exePath: selectedBlender.path,
        module: moduleName,
        action: enable ? 'enable' : 'disable'
      });
      return res;
    } catch (e) {
      console.error('enable-addon error', e);
      setErrors(prev => ({ ...prev, [moduleName]: String(e) }));
    } finally {
      setUpdating(prev => ({ ...prev, [moduleName]: false }));
    }
  };

  useEffect(() => { if (selectedBlender) loadAddons(); }, [selectedBlender?.path]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
      <TableHeader variant="addons" activeField={activeField} activeDir={activeDir} onToggle={(f) => toggle(f)} />
      {addonsLoading && <div style={{ color: 'var(--text-secondary)' }}>{t('addons.scanning', 'Scanning...')}</div>}
      {addonsError && <div style={{ color: 'var(--text-danger)' }}>{t('addons.error_prefix', 'Error:')} {addonsError}</div>}
      {!addonsLoading && addons.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>{t('addons.none_detected', 'No add-on detected')}</div>}
      
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
          const prefEnabled = !!a.enabled;
          const loaded = !!a.loaded;
          const mixedState = prefEnabled !== loaded;
          const effectiveEnabled = prefEnabled || loaded;
          const createdStr = '';
          const usedStr = '';
          const sizeStr = '';
          const exists = !!a.path;
          const keyId = a.module || a.path || String(idx);
          const isExpanded = !!expanded[keyId];
          const bl = a.bl_info || {};
          const errMsg = a.module ? (errors[a.module] ?? undefined) : undefined;
          return (
            <React.Fragment key={keyId}>
            <div
              onClick={() => { if (exists) setExpanded(prev => ({ ...prev, [keyId]: !prev[keyId] })); }}
              role={exists ? 'button' : undefined}
              tabIndex={exists ? 0 : -1}
              onKeyDown={(e) => { if (exists && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); } }}
              style={{
                background: 'var(--bg-surface-1)',
                border: '1px solid var(--bg-surface-2)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: 'minmax(160px, 1fr) 170px 170px 110px 140px',
                gap: 12,
                alignItems: 'center',
                position: 'relative',
                opacity: exists ? 1 : 0.55,
                cursor: exists ? 'default' : 'default',
                transition: 'background 0.15s, border-color 0.15s',
                minWidth: 0
              }}
              onMouseOver={e => { if (exists) { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }
              }
              onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface-1)'; e.currentTarget.style.borderColor = 'var(--bg-surface-2)'; }}
            >
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              {bl.version ? <span style={{ background: 'var(--chip-info-bg)', color: 'var(--chip-info-text)', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{String(bl.version)}</span> : <span style={{ opacity: 0.6 }}>—</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-tertiary)', fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={String(bl.author || '')}>
              {bl.author ? <span style={{ opacity: 0.9 }}>{String(bl.author)}</span> : <span style={{ opacity: 0.6 }}>—</span>}
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{bl.category ? <span style={{ background: 'var(--chip-info-bg)', color: 'var(--chip-alt-text)', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{String(bl.category)}</span> : <span style={{ opacity: 0.6 }}>—</span>}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: 140, justifyContent: 'flex-end', flexShrink: 0 }}>
              <div style={{ marginRight: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); if (a.module && !updating[a.module]) setAddonEnabled(a.module, !effectiveEnabled); }}
                  disabled={!a.module || !!updating[a.module]}
                  title={mixedState
                    ? `${t('addons.pref_state', 'Preference')}: ${prefEnabled ? t('addons.enabled', 'Enabled') : t('addons.disabled', 'Disabled')} | ${t('addons.loaded_state', 'Loaded')}: ${loaded ? t('addons.enabled', 'Enabled') : t('addons.disabled', 'Disabled')}`
                    : (effectiveEnabled ? t('addons.disable', 'Disable') : t('addons.enable', 'Enable'))}
                  style={{
                    background: mixedState
                      ? 'color-mix(in srgb, var(--warning, #f59e0b) 16%, var(--bg-card))'
                      : (effectiveEnabled ? 'color-mix(in srgb, var(--success) 22%, var(--bg-card))' : 'var(--bg-card)'),
                    border: mixedState
                      ? '1px solid color-mix(in srgb, var(--warning, #f59e0b) 45%, var(--border-color))'
                      : (effectiveEnabled ? '1px solid color-mix(in srgb, var(--success) 45%, var(--border-color))' : '1px solid var(--border-color)'),
                    color: mixedState ? 'var(--warning, #f59e0b)' : (effectiveEnabled ? 'var(--text-success)' : 'var(--text-secondary)'),
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: a.module && !updating[a.module] ? 'pointer' : 'default'
                  }}
                >
                  {updating[a.module]
                    ? '...'
                    : (mixedState
                      ? t('addons.mixed_state', 'Mixed state')
                      : (effectiveEnabled ? t('addons.enabled', 'Enabled') : t('addons.disabled', 'Disabled')))}
                </button>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); if (a.path) { (window as any).electronAPI?.send?.('reveal-in-folder', { path: a.path }); } }}
                title={t('addons.open_folder', 'Open folder')}
                style={{
                  background: 'var(--bg-surface-2)',
                  border: 'none',
                  color: 'var(--text-secondary)',
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
            {errMsg && (
              <div style={{ color: 'var(--text-danger)', fontSize: 12, marginTop: 6, gridColumn: '1 / -1' }} title={errMsg}>
                {errMsg.split('\n').slice(0,3).join(' ')}{errMsg.split('\n').length > 3 ? '…' : ''}
              </div>
            )}
            {mixedState && (
              <div style={{ color: 'var(--warning, #f59e0b)', fontSize: 12, marginTop: 6, gridColumn: '1 / -1' }}>
                {t('addons.mixed_state_hint', 'Etat mixte detecte: preference et session Blender differente. Ferme/reouvre Blender pour resynchroniser l affichage.')}
              </div>
            )}
            </div>
            {isExpanded && (
            <div style={{ marginTop: 8, marginBottom: 8, padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-muted)', borderRadius: 8 }}>
              {bl.description && (
                <div style={{ color: 'var(--text-primary)', marginBottom: 8 }}><strong>{t('addons.description', 'Description')}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{bl.description}</span></div>
              )}
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, overflowX: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{JSON.stringify(bl, null, 2)}</pre>
              </div>
            </div>
            )}
            </React.Fragment>
          );
        })}
      {debugOpen && (
        <div style={{ marginTop: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-muted)', padding: 12, borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{t('addons.debug_output', 'Debug output')}</h4>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
            <strong>{t('addons.stdout', 'Stdout')}:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-success)', background: 'transparent', marginTop: 6 }}>{lastProbeStdout || t('addons.empty', '(empty)')}</pre>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            <strong>{t('addons.stderr', 'Stderr')}:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-danger)', background: 'transparent', marginTop: 6 }}>{lastProbeStderr || t('addons.empty', '(empty)')}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewAddon;

