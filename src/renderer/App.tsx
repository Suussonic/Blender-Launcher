import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ViewPages from './ViewPages';
import Home from './Home';
import ViewRepo, { SimpleRepoRef } from './ViewRepo';
import Loading from './Loading';
import SettingsPage from './SettingsPage';

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

  // Last launched blender (for Discord presence & display)
  const [lastLaunched, setLastLaunched] = useState<BlenderExe | null>(null);
  // Render progress bar (global)
  const [renderState, setRenderState] = useState<{ active: boolean; done: number; total: number; label?: string; stats?: string }|null>(null);

  // Charger la config minimale au démarrage (général/steam/discord availability) et pré-scan si demandé
  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        // General config
        setBootStatus('Chargement de la configuration générale…');
        let generalScan = false;
        try {
          const general = await window.electronAPI.invoke('get-general-config');
          generalScan = !!general?.scanOnStartup;
        } catch {}

        // Précharger la liste des fichiers récents (pour affichage rapide)
        setBootStatus('Récupération des fichiers récents…');
        try { await window.electronAPI.invoke('get-recent-blend-files'); } catch {}

        // Finaliser
        setBootStatus('Préparation de l’interface…');
        setTimeout(() => setIsBootLoading(false), 250);

        // Scanner le système (conditionnel) après l'affichage initial pour réactivité
        if (generalScan) {
          try { await window.electronAPI.invoke('scan-and-merge-blenders'); } catch {}
        }
      } catch (e) { console.warn('[DiscordUI] load config erreur:', e); }
    };
    load();
  }, []);

  // Mise a jour presence a chaque launch (si enabled)
  useEffect(() => {
    if (!lastLaunched) return;
    const api = window.electronAPI; // capture
    if (!api || typeof api.invoke !== 'function') return;
    (async () => {
      try {
        const cfg = await api.invoke('get-discord-config');
        if (!cfg?.enabled) return;
        await api.invoke('update-discord-presence', {
          blenderTitle: lastLaunched.title || lastLaunched.name,
          fileName: null
        });
      } catch (e) {
        console.warn('[DiscordUI] maj presence launch erreur:', e);
      }
    })();
  }, [lastLaunched]);

  // Presence idle quand activé mais aucun Blender encore lancé
  useEffect(() => {
    if (lastLaunched) return; // idle only when nothing launched
    const api = window.electronAPI;
    if (!api?.invoke) return;
    (async () => {
      try {
        const cfg = await api.invoke('get-discord-config');
        if (!cfg?.enabled) return;
        await api.invoke('update-discord-presence', { blenderTitle: null, fileName: null });
      } catch (e) {
        console.warn('[DiscordUI] idle presence erreur:', e);
      }
    })();
  }, [lastLaunched]);

  // settings page moved to dedicated component

  // Page d'accueil (externalisée dans Home.tsx)

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
          {page === 'settings'
            ? (
              <SettingsPage
                lastLaunched={lastLaunched}
                renderActive={!!renderState}
                notify={(msg, type) => {
                  setToast({ msg, type });
                  setTimeout(() => setToast(null), 2500);
                }}
              />
            )
            : selectedRepo
            ? <ViewRepo repo={selectedRepo} onBack={()=> setSelectedRepo(null)} />
            : <Home selectedBlender={selectedBlender} onLaunch={(b) => setLastLaunched(b)} />}
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
