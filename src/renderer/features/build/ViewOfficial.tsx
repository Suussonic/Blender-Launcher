import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [versionType, setVersionType] = useState<'stable' | 'patch' | 'daily'>('stable');
  const [versions, setVersions] = useState<BlenderVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BlenderVersion | null>(null);
  const [targetDir, setTargetDir] = useState('');
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedVersion) {
      const versionMatch = selectedVersion.version.match(/^(\d+\.\d+)/);
      const majorMinor = versionMatch ? versionMatch[1] : selectedVersion.version.split(/[^0-9.]/)[0];

      const standardPath = `C:\\Program Files\\Blender Foundation\\Blender ${majorMinor}`;
      setTargetDir(standardPath);

      setFolderName(`Blender ${majorMinor}`);

    }
  }, [selectedVersion]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (_: any, progressData: any) => {
      const pct = typeof progressData?.progress === 'number' ? progressData.progress : 0;
      const text = progressData?.text || '';
      onDownloadStateChange?.({ 
        isDownloading: true, 
        progress: pct, 
        text, 
        version: selectedVersion?.version 
      });
      
      if (progressData?.event === 'COMPLETE') {
        setTimeout(() => {
          onDownloadStateChange?.(null);
          setDownloading(false);
        }, 2000);
      }
    };
    (window as any).electronAPI?.on?.('download-progress', handler);
    return () => { 
      (window as any).electronAPI?.off?.('download-progress', handler); 
    };
  }, [isOpen, selectedVersion, onDownloadStateChange]);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadVersions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (window.electronAPI && window.electronAPI.invoke) {
          const result = await window.electronAPI.invoke('fetch-blender-versions', versionType);
          
          if (result.success && result.versions) {
            let fetchedVersions: BlenderVersion[] = [];
            
            if (result.versions[versionType]) {
              fetchedVersions = result.versions[versionType].map((v: any) => ({
                version: v.version,
                url: v.url,
                type: versionType as 'stable' | 'patch' | 'daily',
                date: v.date,
                architecture: v.architecture
              }));
            }
            
            setVersions(fetchedVersions);
            setSelectedVersion(fetchedVersions[0] || null);
          } else {
            setError(`${t('official.load_versions_failed', 'Impossible de charger les versions')}: ${result.error}`);
            setVersions([]);
          }
        } else {
          setError(t('api.unavailable', 'API non disponible'));
          setVersions([]);
        }
      } catch (e) {
        setError(t('official.load_versions_failed', 'Impossible de charger les versions'));
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
        setError(t('official.select_folder_failed', 'Impossible de sélectionner le dossier'));
      }
    }
  };

  const handleDownload = () => {
    if (!selectedVersion) {
      setError(t('official.select_version_required', 'Veuillez sélectionner une version'));
      return;
    }
    if (!targetDir.trim()) {
      setError(t('official.select_destination_required', 'Veuillez sélectionner un dossier de destination'));
      return;
    }
    if (!folderName.trim()) {
      setError(t('official.invalid_folder_name', 'Nom de dossier invalide'));
      return;
    }

    setDownloading(true);
    
    onDownloadStateChange?.({ 
      isDownloading: true, 
      progress: 0, 
      text: t('official.preparing_download', 'Préparation du téléchargement...'), 
      version: selectedVersion.version 
    });
    
    const payload = {
      version: selectedVersion.version,
      url: selectedVersion.url,
      type: selectedVersion.type,
      targetPath: targetDir.trim(),
      folderName: folderName.trim(),
    };
    
    if (window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('download-official-blender', payload).then((result: any) => {
        if (!result?.success) {
          setError(result?.error || t('download.failed', 'Échec du téléchargement'));
          setDownloading(false);
          onDownloadStateChange?.(null);
        }
      }).catch((e: any) => {
        setError(t('download.failed', 'Échec du téléchargement'));
        setDownloading(false);
        onDownloadStateChange?.(null);
      });
    }
    
    if (onStartDownload) {
      onStartDownload({ version: selectedVersion, targetDir: targetDir.trim() });
    }
    
    onClose();
  };

  if (!isOpen) return null;

  const versionTypeLabels = {
    stable: { icon: FiPackage, label: 'Stable Releases', color: 'var(--accent-hover)' },
    patch: { icon: FiZap, label: 'Patch Builds', color: 'var(--text-warning)' },
    daily: { icon: FiZap, label: 'Daily Builds', color: 'var(--danger)' },
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
        background: 'var(--shadow-color)',
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
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 24,
          padding: '40px 36px 36px',
          boxShadow: '0 12px 36px -8px var(--shadow-color), 0 6px 18px -6px var(--shadow-soft)',
        }}
      >
        <button
          onClick={onClose}
          title={t('close', 'Fermer')}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
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
            e.currentTarget.style.background = 'var(--bg-card-hover)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <FiX size={20} />
        </button>

        <h2
          style={{
            margin: '0 0 24px 0',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {t('official.download_title', 'Télécharger Blender Officiel')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 10,
                letterSpacing: 0.3,
              }}
            >
              {t('official.version_type', 'Type de version')}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setVersionType('stable')}
                style={{
                  width: '100%',
                  background: versionType === 'stable' ? versionTypeLabels.stable.color : 'var(--bg-surface-2)',
                  border: `1px solid ${versionType === 'stable' ? versionTypeLabels.stable.color : 'var(--border-color)'}`,
                  color: 'var(--text-inverse)',
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
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                  }
                }}
                onMouseOut={(e) => {
                  if (versionType !== 'stable') {
                    e.currentTarget.style.background = 'var(--bg-surface-2)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
              >
                <FiPackage size={14} />
                <span style={{ fontSize: 11, letterSpacing: 0.3 }}>{versionTypeLabels.stable.label}</span>
              </button>

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
                        background: isActive ? versionTypeLabels[type].color : 'var(--bg-surface-2)',
                        border: `1px solid ${isActive ? versionTypeLabels[type].color : 'var(--border-color)'}`,
                        color: 'var(--text-inverse)',
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
                          e.currentTarget.style.background = 'var(--bg-card-hover)';
                          e.currentTarget.style.borderColor = 'var(--border-strong)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--bg-surface-2)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
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

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              Version
            </label>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                {t('official.loading_versions', 'Chargement des versions...')}
              </div>
            ) : versions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                {t('official.no_versions', 'Aucune version disponible')}
              </div>
            ) : (
              <div style={{ 
                maxHeight: 180, 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: 12, 
                background: 'var(--bg-card)',
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
                        background: isSelected ? 'color-mix(in srgb, var(--accent) 36%, var(--bg-card))' : 'transparent',
                        borderBottom: idx < versions.length - 1 ? '1px solid var(--border-color)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-1)';
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            {v.version}
                          </span>
                          {v.architecture && versionType === 'daily' && (
                            <span style={{ 
                              fontSize: 10, 
                              color: 'var(--text-tertiary)', 
                              background: 'var(--bg-surface-2)', 
                              padding: '2px 6px', 
                              borderRadius: 4,
                              fontWeight: 600
                            }}>
                              {v.architecture}
                            </span>
                          )}
                        </div>
                        {v.date && (() => {
                          const dt = new Date(v.date as string);
                          if (isNaN(dt.getTime())) {
                            return <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{String(v.date)}</span>;
                          }
                          return (
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                              <span>{dt.toLocaleDateString('fr-FR')}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.95 }}>{dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              {t('official.parent_folder', 'Dossier parent')}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={targetDir}
                onChange={(e) => {
                  setTargetDir(e.target.value);
                  setError(null);
                }}
                placeholder={t('select_folder_path_short', 'Sélectionnez un dossier...')}
                readOnly
                style={{
                  flex: 1,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
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
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-inverse)',
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
                  e.currentTarget.style.background = 'var(--text-tertiary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--bg-muted)';
                }}
              >
                <FiFolder size={20} />
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
                letterSpacing: 0.3,
              }}
            >
              {t('official.folder_name', 'Nom du dossier')}
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
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 14,
                padding: '11px 14px',
                borderRadius: 12,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.background = 'var(--bg-surface-3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            />
          </div>

          {error && (
            <div
              style={{
                color: 'var(--danger)',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.4,
                padding: '12px 0',
                borderRadius: 14,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
              }}
            >
              {t('cancel', 'Annuler')}
            </button>
            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                border: '1px solid var(--accent-hover)',
                color: 'var(--text-inverse)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.4,
                padding: '12px 0',
                borderRadius: 14,
                cursor: 'pointer',
                boxShadow: '0 4px 14px -6px color-mix(in srgb, var(--accent) 40%, transparent)',
                transition: 'background 0.2s, transform 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, var(--accent-hover), var(--accent))';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(90deg, var(--accent), var(--accent-hover))';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <FiDownload size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
              {t('official.download_install', 'Télécharger et installer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewOfficial;




