import React, { useState, useEffect } from 'react';
import { FiX, FiDownload, FiFolder, FiPackage, FiClock, FiZap } from 'react-icons/fi';

interface BlenderVersion {
  version: string;
  url: string;
  date?: string;
  type: 'stable' | 'patch' | 'daily';
  architecture?: string;
}

interface ViewOfficialProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDownload?: (data: { version: BlenderVersion; targetDir: string }) => void;
  onDownloadStateChange?: (state: { isDownloading: boolean; progress: number; text: string; version?: string; } | null) => void;
}

const ViewOfficial: React.FC<ViewOfficialProps> = ({ isOpen, onClose, onStartDownload, onDownloadStateChange }) => {
  const [versionType, setVersionType] = useState<'stable' | 'patch' | 'daily'>('stable');
  const [versions, setVersions] = useState<BlenderVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BlenderVersion | null>(null);
  const [targetDir, setTargetDir] = useState('');
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate standard Blender installation path
  useEffect(() => {
    if (selectedVersion) {
      // Extract major.minor version for standard path: "4.3.0" -> "4.3"
      const versionMatch = selectedVersion.version.match(/^(\d+\.\d+)/);
      const majorMinor = versionMatch ? versionMatch[1] : selectedVersion.version.split(/[^0-9.]/)[0];
      
      // Generate standard Blender Foundation path
      const standardPath = `C:\\Program Files\\Blender Foundation\\Blender ${majorMinor}`;
      setTargetDir(standardPath);
      
      // Clean version name for folder: "4.3.0" -> "Blender ${majorMinor}"
      setFolderName(`Blender ${majorMinor}`);
      
      console.log(`[ViewOfficial] Auto-generated path for ${selectedVersion.version}: ${standardPath}`);
    }
  }, [selectedVersion]);

  // Progress routing to parent (bottom bar)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (_: any, progressData: any) => {
      console.log('[ViewOfficial] Événement download-progress reçu:', progressData);
      const pct = typeof progressData?.progress === 'number' ? progressData.progress : 0;
      const text = progressData?.text || '';
      console.log('[ViewOfficial] Mise à jour progression:', { pct, text, version: selectedVersion?.version });
      onDownloadStateChange?.({ 
        isDownloading: true, 
        progress: pct, 
        text, 
        version: selectedVersion?.version 
      });
      
      // If download complete, close modal and reset state
      if (progressData?.event === 'COMPLETE') {
        console.log('[ViewOfficial] Téléchargement COMPLET');
        setTimeout(() => {
          console.log('[ViewOfficial] Reset de l\'état de téléchargement');
          onDownloadStateChange?.(null);
          setDownloading(false);
        }, 2000);
      }
    };
    console.log('[ViewOfficial] Installation de l\'écouteur download-progress');
    (window as any).electronAPI?.on?.('download-progress', handler);
    return () => { 
      console.log('[ViewOfficial] Suppression de l\'écouteur download-progress');
      (window as any).electronAPI?.off?.('download-progress', handler); 
    };
  }, [isOpen, selectedVersion, onDownloadStateChange]);

  // Charger les versions disponibles selon le type via fetch backend
  useEffect(() => {
    if (!isOpen) return;
    
    const loadVersions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('[ViewOfficial] Fetching versions for type:', versionType);
        
        if (window.electronAPI && window.electronAPI.invoke) {
          const result = await window.electronAPI.invoke('fetch-blender-versions', versionType);
          
          if (result.success && result.versions) {
            let fetchedVersions: BlenderVersion[] = [];
            
            // Get versions for the current type
            if (result.versions[versionType]) {
              fetchedVersions = result.versions[versionType].map((v: any) => ({
                version: v.version,
                url: v.url,
                type: versionType as 'stable' | 'patch' | 'daily',
                date: v.date,
                architecture: v.architecture
              }));
            }
            
            console.log('[ViewOfficial] Fetched versions:', fetchedVersions.length);
            setVersions(fetchedVersions);
            setSelectedVersion(fetchedVersions[0] || null);
          } else {
            console.error('[ViewOfficial] Fetch failed:', result.error);
            setError(`Impossible de charger les versions: ${result.error}`);
            // Fallback to empty array
            setVersions([]);
          }
        } else {
          setError('API non disponible');
          setVersions([]);
        }
      } catch (e) {
        console.error('[ViewOfficial] Erreur chargement versions:', e);
        setError('Impossible de charger les versions');
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadVersions();
  }, [isOpen, versionType]);



  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.invoke) {
      try {
        const folderPath = await window.electronAPI.invoke('select-output-folder');
        if (folderPath && typeof folderPath === 'string') {
          setTargetDir(folderPath);
          setError(null);
        }
      } catch (e) {
        console.error('[ViewOfficial] Erreur sélection dossier:', e);
        setError('Impossible de sélectionner le dossier');
      }
    }
  };

  const handleDownload = () => {
    console.log('[ViewOfficial] handleDownload appelé');
    console.log('[ViewOfficial] selectedVersion:', selectedVersion);
    console.log('[ViewOfficial] targetDir:', targetDir);
    console.log('[ViewOfficial] folderName:', folderName);
    
    if (!selectedVersion) {
      console.warn('[ViewOfficial] Pas de version sélectionnée');
      setError('Veuillez sélectionner une version');
      return;
    }
    if (!targetDir.trim()) {
      console.warn('[ViewOfficial] Pas de dossier de destination');
      setError('Veuillez sélectionner un dossier de destination');
      return;
    }
    if (!folderName.trim()) {
      console.warn('[ViewOfficial] Nom de dossier invalide');
      setError('Nom de dossier invalide');
      return;
    }
    
    console.log('[ViewOfficial] Validation OK, début du téléchargement');
    setDownloading(true);
    
    // Notify parent that download started
    onDownloadStateChange?.({ 
      isDownloading: true, 
      progress: 0, 
      text: 'Préparation du téléchargement...', 
      version: selectedVersion.version 
    });
    
    const payload = {
      version: selectedVersion.version,
      url: selectedVersion.url,
      type: selectedVersion.type,
      targetPath: targetDir.trim(),
      folderName: folderName.trim(),
    };
    
    console.log('[ViewOfficial] Appel IPC download-official-blender avec payload:', payload);
    
    // Invoke backend to download and install
    if (window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('download-official-blender', payload).then((result: any) => {
        console.log('[ViewOfficial] Téléchargement résultat:', result);
        if (!result?.success) {
          console.error('[ViewOfficial] Téléchargement échoué:', result?.error);
          setError(result?.error || 'Échec du téléchargement');
          setDownloading(false);
          onDownloadStateChange?.(null);
        }
      }).catch((e: any) => {
        console.error('[ViewOfficial] Erreur téléchargement:', e);
        setError('Échec du téléchargement');
        setDownloading(false);
        onDownloadStateChange?.(null);
      });
    } else {
      console.error('[ViewOfficial] electronAPI non disponible');
    }
    
    if (onStartDownload) {
      onStartDownload({ version: selectedVersion, targetDir: targetDir.trim() });
    }
    
    // Close modal immediately, progress shown in bottom bar
    onClose();
  };

  if (!isOpen) {
    console.log('[ViewOfficial] Popup fermée, rendu null');
    return null;
  }
  
  console.log('[ViewOfficial] Rendu popup, état:', { 
    versionType, 
    versionsCount: versions.length, 
    selectedVersion, 
    targetDir, 
    folderName,
    loading,
    downloading 
  });

  const versionTypeLabels = {
    stable: { icon: FiPackage, label: 'Stable Releases', color: '#3b82f6' },
    patch: { icon: FiZap, label: 'Patch Builds', color: '#f59e0b' },
    daily: { icon: FiZap, label: 'Daily Builds', color: '#ef4444' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 560,
          maxWidth: '92vw',
          background: '#1F2328',
          border: '1px solid #30363d',
          borderRadius: 24,
          padding: '40px 36px 36px',
          boxShadow: '0 12px 36px -8px rgba(0,0,0,0.7), 0 6px 18px -6px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          title="Fermer"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'transparent',
            border: 'none',
            color: '#d1d5db',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#262c33';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <FiX size={20} />
        </button>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 24px 0',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: '#f1f5f9',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Télécharger Blender Officiel
        </h2>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Version Type Tabs */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: 10,
                letterSpacing: 0.3,
              }}
            >
              Type de version
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Première ligne : Stable Releases (pleine largeur) */}
              <button
                onClick={() => setVersionType('stable')}
                style={{
                  width: '100%',
                  background: versionType === 'stable' ? versionTypeLabels.stable.color : '#1a1f26',
                  border: `1px solid ${versionType === 'stable' ? versionTypeLabels.stable.color : '#30363d'}`,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                  boxShadow: versionType === 'stable' ? `0 0 12px ${versionTypeLabels.stable.color}40` : 'none',
                }}
                onMouseOver={(e) => {
                  if (versionType !== 'stable') {
                    e.currentTarget.style.background = '#242a32';
                    e.currentTarget.style.borderColor = '#3d4650';
                  }
                }}
                onMouseOut={(e) => {
                  if (versionType !== 'stable') {
                    e.currentTarget.style.background = '#1a1f26';
                    e.currentTarget.style.borderColor = '#30363d';
                  }
                }}
              >
                <FiPackage size={14} />
                <span style={{ fontSize: 11, letterSpacing: 0.3 }}>{versionTypeLabels.stable.label}</span>
              </button>

              {/* Deuxième ligne : Patch et Daily côte à côte */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['patch', 'daily'] as const).map((type) => {
                  const TypeIcon = versionTypeLabels[type].icon;
                  const isActive = versionType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setVersionType(type)}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        background: isActive ? versionTypeLabels[type].color : '#1a1f26',
                        border: `1px solid ${isActive ? versionTypeLabels[type].color : '#30363d'}`,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                        boxShadow: isActive ? `0 0 12px ${versionTypeLabels[type].color}40` : 'none',
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#242a32';
                          e.currentTarget.style.borderColor = '#3d4650';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#1a1f26';
                          e.currentTarget.style.borderColor = '#30363d';
                        }
                      }}
                    >
                      <TypeIcon size={14} />
                      <span style={{ fontSize: 11, letterSpacing: 0.3 }}>{versionTypeLabels[type].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Version Selection */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              Version
            </label>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Chargement des versions...
              </div>
            ) : versions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Aucune version disponible
              </div>
            ) : (
              <div style={{ 
                maxHeight: 180, 
                overflowY: 'auto', 
                border: '1px solid #30363d', 
                borderRadius: 12, 
                background: '#0f1419',
              }}>
                {versions.map((v, idx) => {
                  const isSelected = selectedVersion?.version === v.version;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedVersion(v);
                        setError(null);
                      }}
                      style={{
                        padding: '12px 14px',
                        background: isSelected ? '#1e3a5f' : 'transparent',
                        borderBottom: idx < versions.length - 1 ? '1px solid #21262d' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#161b22';
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>
                            {v.version}
                          </span>
                          {v.architecture && versionType === 'daily' && (
                            <span style={{ 
                              fontSize: 10, 
                              color: '#64748b', 
                              background: '#1e293b', 
                              padding: '2px 6px', 
                              borderRadius: 4,
                              fontWeight: 600
                            }}>
                              {v.architecture}
                            </span>
                          )}
                        </div>
                        {v.date && (
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#94a3b8' }}>
                            <span>{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', opacity: 0.95 }}>{new Date(v.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target Directory */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              Dossier parent
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={targetDir}
                onChange={(e) => {
                  setTargetDir(e.target.value);
                  setError(null);
                }}
                placeholder="Sélectionnez un dossier..."
                readOnly
                style={{
                  flex: 1,
                  background: '#0f1419',
                  border: '1px solid #30363d',
                  color: '#e2e8f0',
                  fontSize: 14,
                  padding: '11px 14px',
                  borderRadius: 12,
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onClick={handleSelectFolder}
              />
              <button
                onClick={handleSelectFolder}
                style={{
                  background: '#374151',
                  border: '1px solid #3d4650',
                  color: '#fff',
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#475569';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#374151';
                }}
              >
                <FiFolder size={20} />
              </button>
            </div>
          </div>

          {/* Folder Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              Nom du dossier
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError(null);
              }}
              placeholder="blender-4.3.0"
              style={{
                width: '100%',
                background: '#0f1419',
                border: '1px solid #30363d',
                color: '#e2e8f0',
                fontSize: 14,
                padding: '11px 14px',
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3d4650';
                e.currentTarget.style.background = '#0d1117';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#30363d';
                e.currentTarget.style.background = '#0f1419';
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                color: '#ef4444',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: '#262c33',
                border: '1px solid #30363d',
                color: '#d1d5db',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.4,
                padding: '12px 0',
                borderRadius: 14,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#2d3541';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#262c33';
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                border: '1px solid #3b82f6',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.4,
                padding: '12px 0',
                borderRadius: 14,
                cursor: 'pointer',
                boxShadow: '0 4px 14px -6px rgba(37, 99, 235, 0.5)',
                transition: 'background 0.2s, transform 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, #1d4ed8, #2563eb)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, #2563eb, #3b82f6)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <FiDownload size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
              Télécharger et installer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewOfficial;
