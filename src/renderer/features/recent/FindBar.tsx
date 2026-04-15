import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rightSlot?: React.ReactNode;
};

const FindBar: React.FC<Props> = ({ value, onChange, placeholder, rightSlot }) => {
  const { t } = useTranslation();
  return (
    <div style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--chip-info-bg)', border: '1px solid var(--bg-muted)', padding: '6px 10px', borderRadius: 10, flex: 1, minWidth: 0, maxWidth: 900 }}>
        {/* Magnifying glass icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          aria-label={t('find.aria_label', 'Search')}
          placeholder={placeholder || t('find.placeholder', 'Search...')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            width: '100%'
          }}
        />
      </div>
      {rightSlot}
    </div>
  );
};

export default FindBar;


