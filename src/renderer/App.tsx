
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ViewPages from './ViewPages';

type BlenderExe = {
  path: string;
  name: string;
  icon: string;
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<'home' | 'settings'>('home');
  const [selectedBlender, setSelectedBlender] = useState<BlenderExe | null>(null);

  // Écouter les changements de config pour mettre à jour la sélection
  useEffect(() => {
    const handleConfigUpdate = async () => {
      if (selectedBlender && window.electronAPI && window.electronAPI.getBlenders) {
        try {
          const list = await window.electronAPI.getBlenders();
          // Chercher l'exécutable mis à jour par son ancien chemin ou nom
          const updated = list.find((b: BlenderExe) => 
            b.name === selectedBlender.name || b.path === selectedBlender.path
          );
          if (updated) {
            setSelectedBlender(updated);
          } else {
            // Si l'exécutable n'existe plus, déselectionner
            setSelectedBlender(null);
          }
        } catch (e) {
          console.error('[App] Erreur lors de la mise à jour de la sélection:', e);
        }
      }
    };

    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('config-updated', handleConfigUpdate);
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
