import React from 'react';

type Props = {
  status?: string;
};

const Loading: React.FC<Props> = ({ status }) => {
  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #1c2230 0%, #11151c 100%)',
      color: '#e7edf5',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      userSelect: 'none'
    }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
  <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 18px auto' }}>
          {/* Spinner ring */}
          <div style={{
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'conic-gradient(#6ee7ff 0deg, #3b82f6 90deg, rgba(255,255,255,0.15) 90deg, rgba(255,255,255,0.15) 360deg)',
            mask: 'radial-gradient(circle 86px at 50% 50%, transparent 98%, black 100%)',
            WebkitMask: 'radial-gradient(circle 86px at 50% 50%, transparent 98%, black 100%)',
            animation: 'spin 1.2s linear infinite'
          }} />
          {/* Logo centré */}
          <img
            src={require('../../public/logo/png/Blender-Launcher-128x128.png')}
            alt="Logo"
            style={{ width: 104, height: 104, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: 14 }}
            draggable={false}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 15, color: '#cdd6e3', letterSpacing: 0.2 }}>
          {status || 'Initialisation en cours…'}
        </div>
      </div>
      <style>
        {`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}
      </style>
    </div>
  );
};

export default Loading;
