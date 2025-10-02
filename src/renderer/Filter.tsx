import React, { useState, useMemo } from 'react';

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
export type SortDir = 'asc' | 'desc';

interface FilterProps {
  files: RecentBlendFile[];
  onSorted: (sorted: RecentBlendFile[]) => void;
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

const Filter: React.FC<FilterProps> = ({ files, onSorted }) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggle = (field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev; // same field toggled
      } else {
        setSortDir('asc');
        return field;
      }
    });
  };

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
      }
      if (av < bv) return -1 * dirMul;
      if (av > bv) return 1 * dirMul;
      return 0;
    });
    return copy;
  }, [files, sortField, sortDir]);

  React.useEffect(() => { onSorted(sorted); }, [sorted, onSorted]);

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
          <span>Poids</span>{arrow(active('size'), sortDir)}
        </div>
        <div />
      </div>
    </div>
  );
};

export default Filter;
