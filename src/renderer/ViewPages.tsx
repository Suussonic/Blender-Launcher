import React from 'react';
import { useTranslation } from 'react-i18next';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface ViewPagesProps {
  selectedBlender: BlenderExe | null;
}

const ViewPages: React.FC<ViewPagesProps> = ({ selectedBlender }) => {
  const { t } = useTranslation();

  const handleLaunch = () => {
    if (selectedBlender && window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('launch-blender', selectedBlender.path);
    }
  };

  const handleChangeExecutable = () => {
    if (selectedBlender && window.electronAPI && window.electronAPI.send) {
      // Envoyer l'ancien chemin pour permettre la mise à jour
      window.electronAPI.send('change-executable', selectedBlender.path);
    }
  };

  // Si un Blender est sélectionné, affiche sa page dédiée
  if (selectedBlender) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
        padding: '32px',
        background: '#0F1419',
      }}>
        {/* Section haute avec icône, titre, adresse et boutons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '32px',
        }}>
          {/* Icône */}
          <img
            src={selectedBlender.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
            alt="icon"
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 12,
              background: 'transparent',
              flexShrink: 0,
            }}
            draggable={false}
          />
          
          {/* Titre et adresse */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              margin: '0 0 8px 0',
              color: '#fff',
              wordBreak: 'break-word',
            }}>
              {selectedBlender.title || selectedBlender.name}
            </h1>
            <p style={{
              fontSize: 14,
              color: '#888',
              margin: '0 0 16px 0',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}>
              {selectedBlender.path}
            </p>
          </div>

          {/* Boutons à droite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Bouton Lancer */}
            <button
              onClick={handleLaunch}
              style={{
                background: '#22c55e',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
              onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
            >
              Lancer
            </button>

            {/* Bouton engrenage */}
            <button
              onClick={handleChangeExecutable}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#9ca3af',
                fontSize: 16,
                padding: '8px',
                cursor: 'pointer',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              title="Changer l'exécutable"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Barre de séparation */}
        <div style={{
          width: '100%',
          height: '2px',
          background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)',
          marginBottom: '32px',
          borderRadius: '1px',
        }} />

        {/* Section basse (pour plus tard) */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: 16,
        }}>
          <p>Section à développer...</p>
        </div>
      </div>
    );
  }

  // Sinon, affiche la homepage par défaut
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      overflow: 'auto',
    }}>
      <h1 style={{ fontWeight: 700, fontSize: 48, marginBottom: 16 }}>{t('title')}</h1>
      <p style={{ fontSize: 20, opacity: 0.8, marginBottom: 32 }}>
        {t('subtitle')}
      </p>
    </div>
  );
};

export default ViewPages;
