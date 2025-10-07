import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ViewPages from './ViewPages';
import ViewRepo, { SimpleRepoRef } from './ViewRepo';
import Loading from './Loading';

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

  // Écran de chargement au démarrage
  const [isBootLoading, setIsBootLoading] = useState<boolean>(true);
  const [bootStatus, setBootStatus] = useState<string>('Préparation…');

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
  const [discordAvailable, setDiscordAvailable] = useState<boolean | null>(null);
  // Suppression de l'option d'affichage du temps (toujours désactivé maintenant)
  const [discordShowTime] = useState(false);
  const [lastLaunched, setLastLaunched] = useState<BlenderExe | null>(null);
  // Steam
  const [steamEnabled, setSteamEnabled] = useState(false);
  const [steamAvailable, setSteamAvailable] = useState<boolean | null>(null);
  // General settings
  const [scanOnStartup, setScanOnStartup] = useState<boolean>(false);
  const [exitOnClose, setExitOnClose] = useState<boolean>(false);
  // Render progress bar (global)
  const [renderState, setRenderState] = useState<{ active: boolean; done: number; total: number; label?: string; stats?: string }|null>(null);

  // Charger la config + checks au montage avec progress texte
  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        setBootStatus('Chargement de la configuration Discord…');
        const cfg = await window.electronAPI.invoke('get-discord-config');
        if (cfg) {
          setDiscordEnabled(!!cfg.enabled);
          setDiscordShowFile(cfg.showFile !== false);
            setDiscordShowTitleOpt(cfg.showTitle !== false);
          // On force showTime à false désormais (suppression de l'option)
          // setDiscordShowTime(false);
        }
        try {
          setBootStatus('Vérification de la disponibilité Discord…');
          const avail = await window.electronAPI.invoke('get-discord-availability');
          setDiscordAvailable(!!avail?.available);
          if (!avail?.available) setDiscordEnabled(false);
        } catch {}
        // General config
        setBootStatus('Chargement de la configuration générale…');
        let generalScan = false;
        try {
          const general = await window.electronAPI.invoke('get-general-config');
          generalScan = !!general?.scanOnStartup;
          setExitOnClose(!!general?.exitOnClose);
          setScanOnStartup(generalScan);
        } catch {}

        setBootStatus('Chargement de la configuration Steam…');
        const steamCfg = await window.electronAPI.invoke('get-steam-config');
        if (steamCfg) setSteamEnabled(!!steamCfg.enabled);
        try {
          setBootStatus('Vérification de la disponibilité Steam…');
          const avail = await window.electronAPI.invoke('get-steam-availability');
          setSteamAvailable(!!avail?.available);
          if (!avail?.available) setSteamEnabled(false);
        } catch {}
        // Scanner le système pour trouver les Blender installés et les fusionner dans config (conditionnel)
        if (generalScan) {
          setBootStatus('Scan des installations Blender…');
          try { await window.electronAPI.invoke('scan-and-merge-blenders'); } catch {}
        }

  // Précharger la liste des fichiers récents (pour affichage rapide)
        setBootStatus('Récupération des fichiers récents…');
        try { await window.electronAPI.invoke('get-recent-blend-files'); } catch {}

        // Finaliser
        setBootStatus('Préparation de l’interface…');
        setTimeout(() => setIsBootLoading(false), 250);
      } catch (e) { console.warn('[DiscordUI] load config erreur:', e); }
    };
    load();
  }, []);

  // Persister la config discord/steam sur changement
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
        await window.electronAPI.invoke('update-steam-config', { enabled: steamEnabled });
      } catch (e) { console.warn('[DiscordUI] save config erreur:', e); }
    };
    // debounce simple
    const h = setTimeout(save, 400);
    return () => clearTimeout(h);
  }, [discordEnabled, discordShowFile, discordShowTitleOpt, steamEnabled]);

  // Persister la config générale
  useEffect(() => {
    const saveGeneral = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        await window.electronAPI.invoke('update-general-config', { scanOnStartup, exitOnClose });
      } catch (e) { console.warn('[GeneralUI] save config erreur:', e); }
    };
    const h = setTimeout(saveGeneral, 300);
    return () => clearTimeout(h);
  }, [scanOnStartup, exitOnClose]);

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
    const [scanning, setScanning] = useState(false);
    const [scanMsg, setScanMsg] = useState<string | null>(null);

    const runScanNow = async () => {
      if (!window.electronAPI?.invoke || scanning) return;
      setScanning(true);
      setScanMsg(null);
      try {
        const res = await window.electronAPI.invoke('scan-and-merge-blenders');
        if (res?.success) {
          const msg = `Scan terminé: ${res.added || 0} ajouté(s). Total: ${res.total ?? 'n/a'}`;
          setScanMsg(msg);
          setToast({ msg, type: 'info' });
          setTimeout(() => setToast(null), 2500);
        } else {
          const msg = `Échec du scan${res?.error ? `: ${res.error}` : ''}`;
          setScanMsg(msg);
          setToast({ msg, type: 'error' });
          setTimeout(() => setToast(null), 3000);
        }
      } catch (e:any) {
        const msg = `Erreur pendant le scan: ${e?.message || e}`;
        setScanMsg(msg);
        setToast({ msg, type: 'error' });
        setTimeout(() => setToast(null), 3000);
      } finally {
        setScanning(false);
      }
    };

    return (
      <div className="hide-scrollbar" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100%',
        paddingTop: 60,
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        paddingBottom: renderState ? 'calc(30vh + 48px)' : 'calc(24vh + 40px)',
        gap: 48
      }}>
        {/* Section Général */}
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>Général</h2>
          <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
          <div style={{ width: '100%', maxWidth: 520 }}>
            {/* 1) Scanner au démarrage */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={scanOnStartup} onChange={e => setScanOnStartup(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>Scanner au démarrage</span>
            </label>
            <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
              Lance automatiquement un scan des installations Blender au lancement.
            </div>
            {/* 2) Bouton Scanner maintenant (placé entre les deux cases) */}
            <div style={{ height: 14 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 4px 0' }}>
              <button
                onClick={runScanNow}
                disabled={scanning}
                style={{
                  padding: '10px 16px',
                  background: scanning ? '#2a3138' : '#2563eb',
                  border: '1px solid #1e3a8a',
                  color: '#fff',
                  borderRadius: 8,
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
                title="Scanner immédiatement vos installations Blender"
              >
                {scanning ? 'Scan en cours…' : 'Scanner maintenant'}
              </button>
              {scanMsg && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{scanMsg}</span>
              )}
            </div>
            <div style={{ height: 14 }} />

            {/* 3) Quitter à la fermeture de la fenêtre */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={exitOnClose}
                onChange={async e => {
                  const v = e.target.checked;
                  setExitOnClose(v);
                  // Persist immediately to avoid race when user clicks the X right away
                  try { await window.electronAPI?.invoke?.('update-general-config', { exitOnClose: v }); } catch {}
                }}
                style={{ width: 20, height: 20 }}
              />
              <span style={{ fontSize: 16, fontWeight: 500 }}>Quitter l’application à la fermeture</span>
            </label>
            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              Si désactivé, la fenêtre sera masquée dans la zone de notification.
            </div>
            
          </div>
        </div>

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
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: discordAvailable === false ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: discordAvailable === false ? 0.6 : 1 }}>
              <input type="checkbox" checked={discordEnabled} disabled={discordAvailable === false} onChange={e => setDiscordEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>Afficher l'activité</span>
              {lastLaunched && (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <img src={lastLaunched.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')} alt="icon" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  {lastLaunched.title || lastLaunched.name}
                </span>
              )}
            </label>
            {discordAvailable === false && (
              <div style={{ marginTop: 8, color: '#ef4444', fontSize: 13 }}>
                Discord Rich Presence indisponible (Discord non installé ou configuration invalide).
              </div>
            )}
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

        {/* Section Steam */}
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>Steam</h2>
          <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
          <div style={{ width: '100%', maxWidth: 520 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: steamAvailable === false ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: steamAvailable === false ? 0.6 : 1 }}>
              <input type="checkbox" checked={steamEnabled} disabled={steamAvailable === false} onChange={e => setSteamEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>Lancer via Steam</span>
              {lastLaunched && (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <img src={lastLaunched.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')} alt="icon" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  {lastLaunched.title || lastLaunched.name}
                </span>
              )}
            </label>
            {steamAvailable === false && (
              <div style={{ marginTop: 8, color: '#ef4444', fontSize: 13 }}>
                La version de Blender via Steam est introuvable. Installez Blender dans Steam pour activer cette option.
              </div>
            )}
          </div>
        </div>
        {/* Spacer to ensure bottom controls are always visible above fixed bars/devtools */}
        <div style={{ height: renderState ? '20vh' : '16vh' }} />
      </div>
    );
  };

  // Page d'accueil
  const HomePage = () => <ViewPages selectedBlender={selectedBlender} onLaunch={(b) => setLastLaunched(b)} />;

  // Listen to tray navigation/toast events
  useEffect(() => {
    const api: any = (window as any).electronAPI;
    if (!api || typeof api.on !== 'function') return;
    const toHome = () => {
      setSelectedBlender(null);
      setSelectedRepo(null);
      setPage('home');
    };
    const toSettings = () => setPage('settings');
    const onToast = (_evt: any, payload: any) => {
      if (!payload) return;
      setToast({ msg: String(payload.text || payload.msg || ''), type: (payload.type === 'error' ? 'error' : 'info') });
      setTimeout(() => setToast(null), 2500);
    };
    api.on('navigate-home', toHome);
    api.on('open-settings', toSettings);
    api.on('toast', onToast as any);
    return () => {
      try { api.off?.('navigate-home', toHome); api.off?.('open-settings', toSettings); api.off?.('toast', onToast as any); } catch {}
    };
  }, []);

  // Listen to progress events from main
  useEffect(() => {
    const api: any = (window as any).electronAPI;
    if (!api || typeof api.on !== 'function') return;
    const handler = (_: any, payload: any) => {
      const ev = payload?.event;
      if (!ev) return;
      if (ev === 'INIT') {
        const total = parseInt(payload.total || '1', 10) || 1;
        setRenderState({ active: true, done: 0, total, label: 'Initialisation du rendu…' });
      } else if (ev === 'START') {
        setRenderState((prev) => prev ? { ...prev, label: 'Rendu en cours…' } : { active: true, done: 0, total: 1, label: 'Rendu en cours…' });
      } else if (ev === 'FRAME_DONE') {
        const done = Math.max(0, parseInt(payload.done || '0', 10));
        const total = Math.max(1, parseInt(payload.total || '1', 10));
        const current = Math.min(done, total);
        setRenderState({ active: true, done, total, label: `Frame ${current}/${total}` });
      } else if (ev === 'STATS') {
        const raw = String(payload?.text || payload?.msg || payload?.raw || '').trim();
        const pretty = raw ? raw.replace(/_/g, ' ') : '';
        setRenderState((prev) => prev ? { ...prev, stats: pretty } : prev);
      } else if (ev === 'DONE' || ev === 'EXIT') {
        setRenderState((prev) => prev ? { ...prev, done: prev.total, label: 'Terminé' } : { active: false, done: 1, total: 1, label: 'Terminé' });
        // Hide after short delay
        setTimeout(() => setRenderState(null), 1200);
      } else if (ev === 'CANCEL' || ev === 'ERROR') {
        setRenderState({ active: false, done: 0, total: 1, label: ev === 'ERROR' ? 'Erreur de rendu' : 'Rendu annulé' });
        setTimeout(() => setRenderState(null), 2000);
      }
    };
    api.on('render-progress', handler);
    return () => {
      try { api.off?.('render-progress', handler); } catch {}
    };
  }, []);

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

  if (isBootLoading) {
    return <Loading status={bootStatus} />;
  }

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
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {page === 'settings' ? <SettingsPage /> : selectedRepo ? <ViewRepo repo={selectedRepo} onBack={()=> setSelectedRepo(null)} /> : <HomePage />}
        </div>
      </div>
      {/* Bottom render progress bar */}
      {renderState && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '8px 14px', background: '#0b1016', borderTop: '1px solid #1f2937', zIndex: 4000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round((renderState.done/renderState.total)*100))}%`, height: '100%', background: '#22c55e', transition: 'width .25s ease' }} />
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12, minWidth: 120, textAlign: 'right' }}>
              {renderState.label || 'Rendu en cours…'}
            </div>
          </div>
          {renderState.stats && (
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>
              {renderState.stats}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
