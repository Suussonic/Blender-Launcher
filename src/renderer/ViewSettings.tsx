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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  {/* Section relocalisation + suppression (espacement uniformisé à 24px) */}
  <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'linear-gradient(135deg,#5a1d1d,#912626)',
                border: '1px solid #672c2c',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'filter 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxSizing: 'border-box',
                height: 44,
              }}
              onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1.0)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Supprimer
            </button>
          </div>
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
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: '#1f242b',
              border: '1px solid #2f343b',
              borderRadius: 14,
              width: 380,
              maxWidth: '90%',
              padding: '28px 28px 24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 18px 48px -12px rgba(0,0,0,0.55)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#fff' }}>Confirmer la suppression</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#cbd5e1' }}>
              Êtes-vous sûr de vouloir supprimer cet exécutable ? Cette action retirera seulement l'entrée de la liste (le fichier sur le disque n'est pas effacé).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  border: '1px solid #475569',
                  color: '#e2e8f0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#334155'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (window.electronAPI && window.electronAPI.send) {
                    console.log('[ViewSettings] Envoi suppression via send(delete-executable)');
                    window.electronAPI.send('delete-executable', { path: selectedBlender.path });
                  } else {
                    console.warn('[ViewSettings] electronAPI.send indisponible');
                  }
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                style={{
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                  border: '1px solid #991b1b',
                  color: '#fff',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
                onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1.0)'; }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSettings;