import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ViewPages from './ViewPages';
import ViewRepo, { SimpleRepoRef } from './ViewRepo';

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
  const [selectedRepo, setSelectedRepo] = useState<SimpleRepoRef | null>(null);

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
        }
        setTimeout(()=> setToast(null), 2500);
      });
    }
  }, [selectedBlender]);

  // Page paramètres
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordShowFile, setDiscordShowFile] = useState(true);
  const [discordShowTitleOpt, setDiscordShowTitleOpt] = useState(true);
  // Suppression de l'option d'affichage du temps (toujours désactivé maintenant)
  const [discordShowTime] = useState(false);
  const [lastLaunched, setLastLaunched] = useState<BlenderExe | null>(null);

  // Charger la config discord au montage
  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        const cfg = await window.electronAPI.invoke('get-discord-config');
        if (cfg) {
          setDiscordEnabled(!!cfg.enabled);
          setDiscordShowFile(cfg.showFile !== false);
            setDiscordShowTitleOpt(cfg.showTitle !== false);
          // On force showTime à false désormais (suppression de l'option)
          // setDiscordShowTime(false);
        }
      } catch (e) { console.warn('[DiscordUI] load config erreur:', e); }
    };
    load();
  }, []);

  // Persister la config discord sur changement
  useEffect(() => {
    const save = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        await window.electronAPI.invoke('update-discord-config', {
          enabled: discordEnabled,
          showFile: discordShowFile,
          showTitle: discordShowTitleOpt,
          showTime: false
        });
      } catch (e) { console.warn('[DiscordUI] save config erreur:', e); }
    };
    // debounce simple
    const h = setTimeout(save, 400);
    return () => clearTimeout(h);
  }, [discordEnabled, discordShowFile, discordShowTitleOpt]);

  // Mise a jour presence a chaque launch (si enabled)
  useEffect(() => {
    if (!discordEnabled || !lastLaunched) return;
    const api = window.electronAPI; // capture
    if (!api || typeof api.invoke !== 'function') return;
    (async () => {
      try {
        await api.invoke('update-discord-presence', {
          blenderTitle: lastLaunched.title || lastLaunched.name,
          fileName: null
        });
      } catch (e) {
        console.warn('[DiscordUI] maj presence launch erreur:', e);
      }
    })();
  }, [discordEnabled, lastLaunched]);

  // Presence idle quand activé mais aucun Blender encore lancé
  useEffect(() => {
    if (!discordEnabled || lastLaunched) return; // seulement si activé et rien lancé
    const api = window.electronAPI;
    if (!api?.invoke) return;
    (async () => {
      try {
        await api.invoke('update-discord-presence', {
          blenderTitle: null,
          fileName: null
        });
      } catch (e) {
        console.warn('[DiscordUI] idle presence erreur:', e);
      }
    })();
  }, [discordEnabled, lastLaunched]);

  const SettingsPage = () => {
    return (
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
        gap: 48
      }}>
        {/* Section Affichage / Langue */}
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>{t('display')}</h2>
          <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', alignItems: 'center', gap: 24 }}>
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

        {/* Section Discord (style identique titre + ligne) */}
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>Discord</h2>
          <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={discordEnabled} onChange={e => setDiscordEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>Afficher l'activité</span>
              {lastLaunched && (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <img src={lastLaunched.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')} alt="icon" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  {lastLaunched.title || lastLaunched.name}
                </span>
              )}
            </label>
            {/* Texte explicatif supprimé selon demande utilisateur */}
            {discordEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={discordShowFile} onChange={e => setDiscordShowFile(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14 }}>Nom du fichier</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={discordShowTitleOpt} onChange={e => setDiscordShowTitleOpt(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14 }}>Titre du build</span>
                </label>
                {/* Option temps écoulé et texte final supprimés */}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Page d'accueil
  const HomePage = () => <ViewPages selectedBlender={selectedBlender} onLaunch={(b) => setLastLaunched(b)} />;

  // Gestion centralisée de la sélection d'un Blender :
  // - Si on est dans la page settings, bascule automatiquement sur home pour afficher la vue de l'app.
  const handleSelectBlender = (b: BlenderExe | null) => {
    setSelectedRepo(null);
    setSelectedBlender(b);
    if (b && page === 'settings') setPage('home');
  };

  // Clic sur Home : on revient sur page d'accueil réelle (donc on efface la sélection)
  const handleHome = () => {
    setSelectedBlender(null);
    setSelectedRepo(null);
    setPage('home');
  };

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
  <Navbar onHome={handleHome} onSettings={() => setPage('settings')} onSelectRepo={(r)=> { setSelectedRepo(r); setSelectedBlender(null); setPage('home'); }} />
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
          onSelectBlender={handleSelectBlender}
          selectedBlender={selectedBlender}
        />
        <div style={{ flex: 1, display: 'flex' }}>
          {page === 'settings' ? <SettingsPage /> : selectedRepo ? <ViewRepo repo={selectedRepo} onBack={()=> setSelectedRepo(null)} /> : <HomePage />}
        </div>
      </div>
    </div>
  );
};

export default App;
