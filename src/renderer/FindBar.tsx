import React from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

const FindBar: React.FC<Props> = ({ value, onChange, placeholder }) => {
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
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#d1d5db',
            fontSize: 14,
            width: '100%'
          }}
        />
      </div>
    </div>
  );
};

export default FindBar;
