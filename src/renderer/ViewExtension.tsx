import React from 'react';

type Props = {
  url: string;
  onClose: () => void;
};

const ViewExtension: React.FC<Props> = ({ url, onClose }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ width: '90%', height: '90%', background: '#0b1220', borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid #17202a', background: '#071018' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 14 }}>
            ← Fermer
          </button>
          <div style={{ color: '#9fb0c6', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={url}>{url}</div>
          <div style={{ marginLeft: 'auto' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>Ouvrir dans le navigateur</a>
          </div>
        </div>
        <iframe src={url} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} title="Extensions" />
      </div>
    </div>
  );
};

export default ViewExtension;
