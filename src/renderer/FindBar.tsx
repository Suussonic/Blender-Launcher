import React from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  scope?: string;
  onScopeChange?: (s: string) => void;
  onSubmit?: (value: string) => void;
};

const FindBar: React.FC<Props> = ({ value, onChange, placeholder, scope = 'all', onScopeChange, onSubmit }) => {
  return (
    <div style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0b1220', border: '1px solid #1f2937', padding: '8px 10px', borderRadius: 10, width: '100%', maxWidth: 1060 }}>
        {/* Magnifying glass icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          aria-label="Recherche"
          placeholder={placeholder || 'Rechercher...'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              try {
                if (scope === 'extensions') {
                  const url = `https://extensions.blender.org/search/?q=${encodeURIComponent(value)}`;
                  if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
                  else window.open(url, '_blank');
                  return;
                }
              } catch (err) { /* ignore open errors */ }
              onSubmit && onSubmit(value);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#d1d5db',
            fontSize: 14,
            width: '100%'
          }}
        />
        <button
          onClick={(e) => { e.preventDefault(); try {
              if (scope === 'extensions') {
                const url = `https://extensions.blender.org/search/?q=${encodeURIComponent(value)}`;
                if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(url);
                else window.open(url, '_blank');
                return;
              }
            } catch (err) { /* ignore */ }
            onSubmit && onSubmit(value);
          }}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 6 }}
          title="Rechercher"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        {/* Scope select */}
        <select value={scope} onChange={(e) => onScopeChange && onScopeChange(e.target.value)}
          style={{ marginLeft: 8, background: 'transparent', border: '1px solid #22303a', color: '#cbd5e1', padding: '6px 8px', borderRadius: 6 }}>
          <option value="all">Tous</option>
          <option value="github">GitHub</option>
          <option value="extensions">Extensions (extensions.blender.org)</option>
        </select>
      </div>
    </div>
  );
};

export default FindBar;
