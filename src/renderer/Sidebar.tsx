import React from 'react';

const blenderList = [
  { id: 1, name: 'Blender 4.1', icon: './public/logo/png/Blender-Launcher-64x64.png' },
  { id: 2, name: 'Blender 4.0', icon: './public/logo/png/Blender-Launcher-64x64.png' },
  { id: 3, name: 'Blender 3.6', icon: './public/logo/png/Blender-Launcher-64x64.png' },
];

const Sidebar: React.FC = () => {
  return (
    <div style={{
      width: 220,
      background: '#181A20',
      borderRight: '1.5px solid #23272F',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 16,
      zIndex: 99,
    }}>
      <div style={{ fontWeight: 700, color: '#fff', fontSize: 18, marginBottom: 24, paddingLeft: 24 }}>
        <span style={{ opacity: 0.7, fontSize: 14, fontWeight: 400 }}>Mes applications</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {blenderList.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 24px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.2s', color: '#fff', fontWeight: 500, fontSize: 16, userSelect: 'none' }}>
            <img src={b.icon} alt="blender" style={{ width: 24, height: 24 }} />
            {b.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
