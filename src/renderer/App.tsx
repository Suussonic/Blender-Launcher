import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ViewPages from './ViewPages';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<'home' | 'settings'>('home');
  const [selectedBlender, setSelectedBlender] = useState<BlenderExe | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error'; } | null>(null);

  console.log('[App] Rendu - page:', page, 'selectedBlender:', selectedBlender);

  // Écouter les changements de config pour mettre à jour la sélection
  useEffect(() => {
    const handleConfigUpdate = async () => {
      if (selectedBlender && window.electronAPI && window.electronAPI.getBlenders) {
        try {
          const list = await window.electronAPI.getBlenders();
          const updated = list.find((b: BlenderExe) => b.path === selectedBlender.path || b.name === selectedBlender.name);
          if (updated) {
            setSelectedBlender(updated);
          } else {
            setSelectedBlender(null);
          }
        } catch (e) {
          console.error('[App] Erreur lors de la mise à jour de la sélection:', e);
        }
      }
    };

    const handleExecutableUpdated = async (_event: any, payload: any) => {
      if (!payload?.newExecutable) return;
      // Si l'exécutable mis à jour correspond à celui sélectionné (par ancien chemin ou titre préservé), mettre à jour immédiatement
      if (selectedBlender && (payload.oldPath === selectedBlender.path || payload.newExecutable.title === selectedBlender.title)) {
        setSelectedBlender(payload.newExecutable);
      }
    };

    const handleExecutableDeleted = (payload: any) => {
      if (selectedBlender && payload?.path === selectedBlender.path) {
        setSelectedBlender(null);
      }
    };

    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('config-updated', handleConfigUpdate);
      window.electronAPI.on('executable-updated', handleExecutableUpdated);
      window.electronAPI.on('executable-deleted', handleExecutableDeleted);
      window.electronAPI.on('delete-executable-result', (payload: any) => {
        if (!payload) return;
        if (payload.success) {
          setToast({ msg: 'Exécutable supprimé', type: 'info' });
        } else {
          setToast({ msg: 'Suppression impossible', type: 'error' });
        }
        setTimeout(()=> setToast(null), 2500);
      });
    }
  }, [selectedBlender]);

  // Page paramètres
  const SettingsPage = () => (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingTop: 60,
      width: '100%',
      overflow: 'auto',
    }}>
      <h2 style={{ fontWeight: 700, fontSize: 32, marginBottom: 8 }}>{t('display')}</h2>
      <div style={{ width: '100%', maxWidth: 480, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ fontSize: 20, fontWeight: 500 }}>{t('change_language')} :</span>
        <select
          value={i18n.language}
          onChange={e => i18n.changeLanguage(e.target.value)}
          style={{
            fontSize: 18,
            padding: '6px 18px',
            borderRadius: 8,
            border: '1px solid #23272F',
            background: '#181A20',
            color: '#fff',
            outline: 'none',
            marginLeft: 8
          }}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );

  // Page d'accueil
  const HomePage = () => <ViewPages selectedBlender={selectedBlender} />;

  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      background: 'linear-gradient(135deg, #23272F 0%, #181A20 100%)',
      color: '#fff',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      overflow: 'hidden',
    }}>
      <Navbar onHome={() => setPage('home')} onSettings={() => setPage('settings')} />
      {toast && (
        <div style={{
          position: 'fixed',
          top: 70,
          right: 24,
          background: toast.type === 'error' ? '#dc2626' : '#2563eb',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
          zIndex: 5000,
          transition: 'opacity .2s'
        }}>
          {toast.msg}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingTop: 56, boxSizing: 'border-box', overflow: 'hidden' }}>
        <Sidebar 
          onSelectBlender={setSelectedBlender}
          selectedBlender={selectedBlender}
        />
        {page === 'settings' ? <SettingsPage /> : <HomePage />}
      </div>
    </div>
  );
};

export default App;
