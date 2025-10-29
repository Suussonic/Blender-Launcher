import React, { useState, useEffect } from 'react';
import ViewBuild from './ViewBuild';

interface ViewCloneProps {
  isOpen: boolean;
  onClose: () => void;
  repoName: string;
  repoUrl: string;
  owner: string;
  onCloneStateChange?: (state: { isCloning: boolean; progress: number; text: string; repoName?: string; } | null) => void;
}

const ViewClone: React.FC<ViewCloneProps> = ({ isOpen, onClose, repoName, repoUrl, owner, onCloneStateChange }) => {
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [targetLocation, setTargetLocation] = useState('');
  const [folderName, setFolderName] = useState('');
    const [branches, setBranches] = useState<string[]>(['main']);
    const [showBuildModal, setShowBuildModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches from GitHub API
  useEffect(() => {
    if (!isOpen || !owner || !repoName) return;
    
    const loadBranches = async () => {
      setLoading(true);
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches`);
        if (response.ok) {
          const branchData = await response.json();
          const branchNames = branchData.map((b: any) => b.name);
          setBranches(branchNames);
          // Set default branch (usually main or master)
          if (branchNames.includes('main')) {
            setSelectedBranch('main');
          } else if (branchNames.includes('master')) {
            setSelectedBranch('master');
          } else if (branchNames.length > 0) {
            setSelectedBranch(branchNames[0]);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des branches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, [isOpen, owner, repoName]);

  // Update folder name when repo name or branch changes
  useEffect(() => {
    if (repoName && selectedBranch) {
      setFolderName(`${repoName}-${selectedBranch}`);
    }
  }, [repoName, selectedBranch]);

  // Listen to real-time clone progress events from main process
  useEffect(() => {
    if (!isOpen) return;
    const handler = (_: any, progressData: { progress: number; text: string }) => {
      onCloneStateChange?.({
        isCloning: true,
        progress: progressData.progress,
        text: progressData.text,
        repoName: `${owner}/${repoName}`
      });
    };
    if (window.electronAPI?.on) {
      window.electronAPI.on('clone-progress', handler);
    }
    return () => {
      if (window.electronAPI?.off) window.electronAPI.off('clone-progress', handler);
    };
  }, [isOpen, owner, repoName, onCloneStateChange]);

  const handleSelectFolder = () => {
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('select-output-folder')
        .then((result: any) => {
          console.log('Résultat sélection dossier:', result);
          if (result && typeof result === 'string' && result.trim() !== '') {
            setTargetLocation(result);
          }
        })
        .catch((error: any) => {
          console.error('Erreur lors de la sélection du dossier:', error);
        });
    } else if ((window as any).electronAPI?.send) {
      // Fallback avec send si invoke n'est pas disponible
      (window as any).electronAPI.send('open-folder-dialog');
      // Écouter la réponse
      if ((window as any).electronAPI?.on) {
        const handler = (_: any, payload: any) => {
          if (payload?.path) {
            setTargetLocation(payload.path);
            (window as any).electronAPI?.off('selected-blender-folder', handler);
          }
        };
        (window as any).electronAPI.on('selected-blender-folder', handler);
      }
    }
  };

  const handleClone = async () => {
    if (!targetLocation || !folderName.trim()) return;
    
    // Before cloning, ensure build tools are present in Roaming
    try {
      const check = await window.electronAPI?.invoke('check-build-tools');
      if (check && check.present) {
        // proceed
      } else {
        // Open build install modal
        setShowBuildModal(true);
        return;
      }
    } catch (e) {
      // If check fails, still open the modal to offer installation
      setShowBuildModal(true);
      return;
    }

    // Do the actual clone flow in a helper so we can call it after installing build tools
    const doClone = async () => {
      setCloning(true);
      setError(null);

      // Notify parent component that cloning started
      onCloneStateChange?.({
        isCloning: true,
        progress: 0,
        text: 'Clonage en cours...',
        repoName: `${owner}/${repoName}`
      });

      try {
        console.log('Début du clonage avec:', {
          url: repoUrl,
          branch: selectedBranch,
          targetPath: targetLocation,
          folderName: folderName.trim()
        });

        const result = await window.electronAPI?.invoke('clone-repository', {
          url: repoUrl,
          branch: selectedBranch,
          targetPath: targetLocation,
          folderName: folderName.trim()
        });

        console.log('Résultat du clonage:', result);

        if (result?.success) {
          onCloneStateChange?.({
            isCloning: false,
            progress: 100,
            text: 'Clonage terminé avec succès !',
            repoName: `${owner}/${repoName}`
          });

          // Garder le succès visible pendant 2 secondes
          setTimeout(() => {
            onCloneStateChange?.(null);
          }, 2000);

          setCloning(false);
          setError(null);
        } else {
          throw new Error(result?.error || 'Erreur lors du clonage');
        }
      } catch (error) {
        console.error('Erreur lors du clonage:', error);
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        setError(errorMsg);

        onCloneStateChange?.({
          isCloning: false,
          progress: 0,
          text: `Erreur: ${errorMsg}`,
          repoName: `${owner}/${repoName}`
        });

        setCloning(false);

        // Clear error state after delay
        setTimeout(() => {
          onCloneStateChange?.(null);
        }, 5000);
      }
    };

    await doClone();
  };

  const onBuildInstalled = async (success: boolean) => {
    setShowBuildModal(false);
    if (success) {
      // Retry clone now that build tools are marked installed
      try { await handleClone(); } catch {}
    }
  };
  

  const getFolderName = () => {
    return folderName || `${repoName}-${selectedBranch}`;
  };

  if (!isOpen) return null;

  return (
    <>
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#11181f',
        border: '1px solid #24303a',
        borderRadius: 16,
        width: 520,
        maxWidth: '90vw',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px -4px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1f2932',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>
            Cloner le dépôt
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4
            }}
            title="Fermer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            <strong style={{ color: '#e2e8f0' }}>{owner}/{repoName}</strong>
          </div>

          {/* Branch selection */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
              Branche à cloner
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1a232b',
                border: '1px solid #24303a',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            >
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            {loading && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Chargement des branches...
              </div>
            )}
          </div>

          {/* Target location */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
              Emplacement de destination
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="Sélectionnez un dossier ou tapez le chemin..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: '#1a232b',
                  border: '1px solid #24303a',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleSelectFolder}
                style={{
                  padding: '10px 12px',
                  background: '#1e2530',
                  border: '1px solid #24303a',
                  borderRadius: 8,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Sélectionner un dossier"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3"/>
                  <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Folder name preview */}
          {targetLocation && (
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                Nom du dossier créé
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1a232b',
                  border: '1px solid #24303a',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
                placeholder="Nom du dossier..."
              />
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #1f2932',
            borderBottom: '1px solid #1f2932',
            background: '#1a0f0f'
          }}>
            <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>
              ❌ Erreur de clonage
            </div>
            <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #1f2932',
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClone}
            disabled={!targetLocation || !folderName.trim() || cloning}
            style={{
              padding: '8px 16px',
              background: (!targetLocation || !folderName.trim() || cloning) ? '#1a232b' : (error ? '#dc2626' : '#2563eb'),
              border: 'none',
              borderRadius: 8,
              color: (!targetLocation || !folderName.trim() || cloning) ? '#64748b' : '#fff',
              cursor: (!targetLocation || !folderName.trim() || cloning) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {cloning ? 'Clonage...' : (error ? 'Réessayer' : 'Cloner')}
          </button>
        </div>
      </div>
    </div>
    <ViewBuild isOpen={showBuildModal} onClose={() => setShowBuildModal(false)} onInstalled={onBuildInstalled} />
    </>
  );
};

export default ViewClone;