import React, { useMemo } from 'react';
import useSort, { SortDir } from './useSort';

export interface RecentBlendFile {
  path: string;
  name: string;
  exists: boolean;
  size?: number;      // bytes
  mtime?: number;     // modification time (not used for ordering now)
  ctime?: number;     // creation time (or fallback)
  order?: number;     // index in recent-files.txt (0 = plus récent)
}

export type SortField = 'name' | 'ctime' | 'order' | 'size';

interface FilterProps {
  files: RecentBlendFile[];
  onSorted: (sorted: RecentBlendFile[]) => void;
  query?: string; // optional search/find text provided by parent (findbar)
}

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) 170px 170px 110px 140px',
  gap: 12,
  alignItems: 'center',
  padding: '8px 14px',
  background: '#10171d',
  border: '1px solid #1e2530',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  color: '#94a3b8',
  userSelect: 'none'
};

const cellBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const arrow = (active: boolean, dir: SortDir) => {
  if (!active) return null;
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.9}}>
      {dir === 'asc' ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
};

const Filter: React.FC<FilterProps> = ({ files, onSorted, query }) => {
  const { field: sortField, dir: sortDir, toggle } = useSort(null, 'asc');

  const sorted = useMemo(() => {
    if (!sortField) return files; // no sort
    const copy = [...files];
    copy.sort((a, b) => {
      const dirMul = sortDir === 'asc' ? 1 : -1;
      let av: any; let bv: any;
      switch (sortField) {
        case 'name': av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        case 'size': av = a.size || 0; bv = b.size || 0; break;
        case 'order': av = a.order ?? 0; bv = b.order ?? 0; break;
        case 'ctime': av = a.ctime || 0; bv = b.ctime || 0; break;
        default: av = 0; bv = 0; break;
      }
      if (av < bv) return -1 * dirMul;
      if (av > bv) return 1 * dirMul;
      return 0;
    });
    return copy;
  }, [files, sortField, sortDir]);

  // Apply query filtering (findbar) on top of sorted results
  const finalList = useMemo(() => {
    if (!query || !query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(f => {
      const name = (f.name || '').toLowerCase();
      const path = (f.path || '').toLowerCase();
      const meta = ('meta' in f) ? String((f as any).meta || '').toLowerCase() : '';
      return name.includes(q) || path.includes(q) || meta.includes(q);
    });
  }, [sorted, query]);

  React.useEffect(() => { onSorted(finalList); }, [finalList, onSorted]);

  const active = (f: SortField) => sortField === f;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={headerStyle}>
        <div style={{...cellBase, color: active('name') ? '#e2e8f0' : '#94a3b8'}} onClick={() => toggle('name')}>
          <span style={{flexShrink:0}}>Nom</span>{arrow(active('name'), sortDir)}
        </div>
        <div style={{...cellBase, color: active('ctime') ? '#e2e8f0' : '#94a3b8'}} onClick={() => toggle('ctime')}>
          <span>Date de création</span>{arrow(active('ctime'), sortDir)}
        </div>
        <div style={{...cellBase, color: active('order') ? '#e2e8f0' : '#94a3b8'}} onClick={() => toggle('order')}>
          <span>Date d'utilisation</span>{arrow(active('order'), sortDir)}
        </div>
        <div style={{...cellBase, color: active('size') ? '#e2e8f0' : '#94a3b8'}} onClick={() => toggle('size')}>
          <span>Taille</span>{arrow(active('size'), sortDir)}
        </div>
        <div />
      </div>
    </div>
  );
};

export const TableHeader: React.FC<{ activeField?: string | null, activeDir?: SortDir, onToggle?: (f: string) => void, variant?: 'recent' | 'addons' }> = ({ activeField, activeDir = 'asc', onToggle, variant = 'recent' }) => {
  const active = (f: string) => activeField === f;
  if (variant === 'addons') {
    // Use the same 5-column grid as recent files so headers align with rows.
    const addonHeaderStyle: React.CSSProperties = { ...headerStyle, gridTemplateColumns: 'minmax(160px, 1fr) 170px 170px 110px 140px' };
    return (
      <div style={addonHeaderStyle}>
        <div style={{...cellBase, color: active('name') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('name')}>
          <span style={{flexShrink:0}}>Nom</span>{active('name') ? arrow(true, activeDir) : null}
        </div>
        <div style={{...cellBase, color: active('version') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('version')}>
          <span>Version</span>{active('version') ? arrow(true, activeDir) : null}
        </div>
        <div style={{...cellBase, color: active('author') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('author')}>
          <span>Auteur</span>{active('author') ? arrow(true, activeDir) : null}
        </div>
        <div style={{...cellBase, color: active('category') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('category')}>
          <span>Catégorie</span>{active('category') ? arrow(true, activeDir) : null}
        </div>
        <div style={{...cellBase, justifyContent: 'flex-end', color: active('status') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('status')}>
          <span>Statut</span>{active('status') ? arrow(true, activeDir) : null}
        </div>
      </div>
    );
  }
  return (
    <div style={headerStyle}>
      <div style={{...cellBase, color: active('name') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('name')}>
        <span style={{flexShrink:0}}>Nom</span>{active('name') ? arrow(true, activeDir) : null}
      </div>
      <div style={{...cellBase, color: active('ctime') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('ctime')}>
        <span>Date de création</span>{active('ctime') ? arrow(true, activeDir) : null}
      </div>
      <div style={{...cellBase, color: active('order') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('order')}>
        <span>Date d'utilisation</span>{active('order') ? arrow(true, activeDir) : null}
      </div>
      <div style={{...cellBase, color: active('size') ? '#e2e8f0' : '#94a3b8'}} onClick={() => onToggle?.('size')}>
        <span>Taille</span>{active('size') ? arrow(true, activeDir) : null}
      </div>
      <div />
    </div>
  );
};

export default Filter;
