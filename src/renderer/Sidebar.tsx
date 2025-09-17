import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type BlenderExe = {
  path: string;
  name: string;
  icon: string;
};


const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const [blenders, setBlenders] = useState<BlenderExe[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handler pour recevoir le chemin du fichier sélectionné
    if (window.electronAPI && window.electronAPI.on) {
      console.log('[Sidebar] Enregistrement du listener selected-blender-folder');
      window.electronAPI.on('selected-blender-folder', (event: any, payload: any) => {
        // payload = { filePath, iconPath }
        const filePath = payload?.filePath;
        const iconPath = payload?.iconPath;
        console.log('[Sidebar] Event selected-blender-folder reçu, filePath =', filePath, 'iconPath =', iconPath);
        if (!filePath) {
          console.log('[Sidebar] Aucun chemin reçu');
          return;
        }
        try {
          const parts = filePath.split(/[\\/]/);
          const exeName = parts[parts.length - 1];
          setBlenders(list => {
            const exists = list.some(b => b.path === filePath);
            if (exists) {
              setError('Ce fichier est déjà importé !');
              return list;
            }
            return [
              ...list,
              {
                path: filePath,
                name: exeName,
                icon: iconPath || '',
              },
            ];
          });
        } catch (e) {
          console.error('[Sidebar] Erreur lors du traitement du chemin :', e);
        }
      });
    } else {
      console.log('[Sidebar] electronAPI.on non disponible');
    }
  }, []);


  // Efface l’erreur après 2,5s
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Double-clic pour lancer Blender
  const handleDoubleClick = (exe: BlenderExe) => {
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('launch-blender', exe.path);
    }
  };

  // Log pour debug du rendu
  console.log('[Sidebar] Render, blenders =', blenders);
  return (
    <div style={{
      width: 220,
      background: '#181A20',
      borderRight: '1.5px solid #23272F',
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 99,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Popup erreur */}
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: 'absolute',
            top: 24,
            left: 16,
            right: 16,
            background: '#ef4444',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 10,
            boxShadow: '0 2px 12px #ef444488',
            padding: '14px 18px',
            textAlign: 'center',
            zIndex: 999,
            cursor: 'pointer',
            animation: 'fadeIn 0.2s',
          }}
        >
          {error}
        </div>
      )}
      {/* Titre Mes applications (affiché seulement si au moins une version) */}
      {blenders.length > 0 && (
        <div style={{ width: '100%', padding: '24px 0 8px 0', textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.5, opacity: 0.95 }}>
          {t('my_apps')}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: blenders.length === 0 ? 'center' : 'flex-start', alignItems: 'center' }}>
        {blenders.length === 0 ? (
          <span style={{ color: '#888', fontSize: 16, opacity: 0.7, textAlign: 'center', marginTop: 0 }}>{t('no_app')}</span>
        ) : (
          blenders.map((b, i) => (
            <div
              key={b.path + i}
              style={{
                padding: '8px 18px 8px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.2s',
                color: '#fff',
                fontWeight: 500,
                fontSize: 16,
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: 180,
              }}
              onDoubleClick={() => handleDoubleClick(b)}
              title={b.path}
            >
              <img
                src={b.icon ? b.icon : require('../../public/logo/png/Blender-Launcher-64x64.png')}
                alt="icon"
                style={{ width: 36, height: 36, borderRadius: 7, marginRight: 2, background: 'transparent' }}
                draggable={false}
              />
              {b.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
