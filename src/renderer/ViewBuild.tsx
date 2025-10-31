import React, { useState } from 'react';

interface ViewBuildProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: (success: boolean) => void;
  missingTools?: string[];
}

const friendlyName = (key: string) => {
  switch (key) {
    case 'git': return 'Git';
    case 'python': return 'Python';
    case 'cmake': return 'CMake';
    case 'ninja': return 'Ninja';
    case 'svn': return 'Subversion (SVN)';
    case 'vs':
    case 'vs2019-build-tools':
    case 'vs2022-build-tools':
    case 'msvc':
      return 'Visual Studio Build Tools';
    default:
      return key;
  }
};

const ViewBuild: React.FC<ViewBuildProps> = ({ isOpen, onClose, onInstalled, missingTools }) => {
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    setLog('');
    try {
      const res = await window.electronAPI?.invoke('install-build-tools', { tools: missingTools });
      if (res) {
        const success = !!res.success;
        setLog(String(res.log || res.message || 'Installation terminée.'));
        if (!success) setError(String(res.error || `Exit code ${res.exitCode || 'unknown'}`));
        onInstalled?.(success);
      } else {
        setError('Aucune réponse du processus d\'installation');
        onInstalled?.(false);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      onInstalled?.(false);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}}>
      <div style={{width: 640, maxWidth: '94vw', background: '#0b1220', borderRadius: 12, padding: 20, color: '#e6eef6'}}>
        <h3 style={{marginTop:0}}>Outils de build manquants</h3>
        {Array.isArray(missingTools) && missingTools.length > 0 ? (
          <div>
            <p style={{color:'#a8b6c7', marginBottom: 8}}>
              Les outils suivants sont absents de votre machine :
            </p>
            <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom: 12}}>
              {missingTools.map((t) => (
                <span key={t} style={{
                  display:'inline-flex',
                  alignItems:'center',
                  padding:'4px 8px',
                  background:'#111b2b',
                  border:'1px solid #1e293b',
                  borderRadius: 999,
                  color:'#cbd5e1',
                  fontSize:12
                }}>{friendlyName(t)}</span>
              ))}
            </div>
            <p style={{color:'#a8b6c7'}}>
              Voulez-vous que Blender Launcher tente de les installer automatiquement via winget ?
            </p>
          </div>
        ) : (
          <p style={{color:'#a8b6c7'}}>Pour compiler Blender localement vous avez besoin d'un ensemble d'outils (Git, Python, CMake, Ninja, Visual Studio Build Tools). Voulez-vous que Blender Launcher tente une installation automatique (winget) ?</p>
        )}

        <div style={{marginTop:12, display:'flex', gap:8}}>
          <button onClick={onClose} disabled={installing} style={{padding:'8px 12px', borderRadius:8, background:'#19232b', color:'#cbd5e1', border:'none'}}>Annuler</button>
          <button onClick={handleInstall} disabled={installing} style={{padding:'8px 12px', borderRadius:8, background:'#1f7aeb', color:'#fff', border:'none'}}>{installing ? 'Installation...' : 'Installer automatiquement'}</button>
        </div>

        {installing && (
          <div style={{marginTop:12, fontSize:13, color:'#93c5fd'}}>L'installation est en cours — ceci peut prendre plusieurs minutes. Consultez le journal ci-dessous.</div>
        )}

        {error && (
          <div style={{marginTop:12, background:'#2b1010', padding:12, borderRadius:8, color:'#fecaca'}}>
            <strong>Erreur:</strong> {error}
          </div>
        )}

        {log && (
          <pre style={{marginTop:12, maxHeight:240, overflow:'auto', background:'#06121a', padding:12, borderRadius:8, color:'#cbd5e1'}}>{log}</pre>
        )}
      </div>
    </div>
  );
};

export default ViewBuild;
