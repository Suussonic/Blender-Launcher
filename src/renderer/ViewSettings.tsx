import React, { useState, useEffect } from 'react';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface ViewSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBlender: BlenderExe;
  onSave: (updatedBlender: BlenderExe) => void;
}

const ViewSettings: React.FC<ViewSettingsProps> = ({ isOpen, onClose, selectedBlender, onSave }) => {
  const [title, setTitle] = useState(selectedBlender.title || selectedBlender.name);
  const [isRelocating, setIsRelocating] = useState(false);

  // Mettre à jour le titre quand selectedBlender change
  useEffect(() => {
    setTitle(selectedBlender.title || selectedBlender.name);
  }, [selectedBlender]);

  if (!isOpen) {
    console.log('[ViewSettings] Popup fermée (isOpen=false)');
    return null;
  }

  console.log('[ViewSettings] Rendu de la popup - isOpen:', isOpen, 'selectedBlender:', selectedBlender);

  const handleSave = () => {
    console.log('[ViewSettings] *** DEBUT handleSave ***');
    const trimmedTitle = title.trim() || selectedBlender.name;
    const updatedBlender = {
      ...selectedBlender,
      title: trimmedTitle
    };
    console.log('[ViewSettings] Titre original:', selectedBlender.title);
    console.log('[ViewSettings] Nouveau titre saisi:', title);
    console.log('[ViewSettings] Titre après trim:', trimmedTitle);
    console.log('[ViewSettings] Objet complet à sauvegarder:', updatedBlender);
    console.log('[ViewSettings] Appel de onSave...');
    
    onSave(updatedBlender);
    console.log('[ViewSettings] onSave appelé, fermeture de la popup...');
    onClose();
    console.log('[ViewSettings] *** FIN handleSave ***');
  };

  const handleRelocate = () => {
    setIsRelocating(true);
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('change-executable', selectedBlender.path);
    }
    setIsRelocating(false);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleOverlayClick}
    >
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: '32px',
        minWidth: '400px',
        maxWidth: '500px',
        border: '1px solid #333',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* En-tête */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '16px',
        }}>
          <img
            src={selectedBlender.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
            alt="icon"
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 8,
              background: 'transparent',
              flexShrink: 0,
            }}
            draggable={false}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 600,
              margin: 0,
              color: '#fff',
            }}>
              Paramètres de l'exécutable
            </h2>
            <p style={{
              fontSize: 12,
              color: '#888',
              margin: '4px 0 0 0',
              wordBreak: 'break-all',
            }}>
              {selectedBlender.path}
            </p>
          </div>
        </div>

        {/* Champ titre */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            color: '#ddd',
            marginBottom: '8px',
          }}>
            Titre
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={selectedBlender.name}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
              height: '44px',
            }}
            onFocus={(e) => e.target.style.borderColor = '#666'}
            onBlur={(e) => e.target.style.borderColor = '#444'}
          />
        </div>

        {/* Section relocalisation */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            color: '#ddd',
            marginBottom: '8px',
          }}>
            Emplacement
          </label>
          <button
            onClick={handleRelocate}
            disabled={isRelocating}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#374151',
              border: '1px solid #4b5563',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              cursor: isRelocating ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxSizing: 'border-box',
              height: '44px',
            }}
            onMouseOver={(e) => {
              if (!isRelocating) e.currentTarget.style.backgroundColor = '#4b5563';
            }}
            onMouseOut={(e) => {
              if (!isRelocating) e.currentTarget.style.backgroundColor = '#374151';
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/>
              <path d="M8 21v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/>
              <path d="M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/>
            </svg>
            {isRelocating ? 'Relocalisation...' : 'Changer l\'emplacement'}
          </button>
        </div>

        {/* Boutons d'action */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              border: '1px solid #666',
              borderRadius: 8,
              color: '#ccc',
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#333';
              e.currentTarget.style.borderColor = '#777';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#666';
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              backgroundColor: '#22c55e',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewSettings;