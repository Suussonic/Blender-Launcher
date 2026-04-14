import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineBuild, AiOutlineInbox } from 'react-icons/ai';
import Navbar from './layout/Navbar';
import Sidebar from './layout/Sidebar';
import ViewPages from './features/recent/ViewPages';
import Home from './pages/Home';
import InAppWeb, { InAppWebHandle } from './features/web/InAppWeb';
import ViewRepo, { SimpleRepoRef } from './features/repo/ViewRepo';
import ViewExtensions from './features/extensions/ViewExtensions';
import ViewOfficial from './features/build/ViewOfficial';
import Loading from './shared/ui/Loading';
import SettingsPage from './features/settings/SettingsPage';
import ViewBuildManager, { PendingBuild } from './features/build/ViewBuildManager';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<'home' | 'settings' | 'web' | 'pages'>('home');
  type NavEntry = { page: 'home'|'settings'|'web'|'repo'|'pages'|'extensions'; webUrl?:string; repo?: SimpleRepoRef | null; blender?: BlenderExe | null; extensionQuery?: string | null };
  const [appHistory, setAppHistory] = useState<NavEntry[]>([{ page: 'home' }]);
  const [appIndex, setAppIndex] = useState<number>(0);
  const [webUrl, setWebUrl] = useState<string>('');
  const [webHistory, setWebHistory] = useState<string[]>([]);
  const [webIndex, setWebIndex] = useState<number>(-1);
  const [webCanGo, setWebCanGo] = useState<{ back: boolean; forward: boolean }>({ back: false, forward: false });
  const [webReloadKey, setWebReloadKey] = useState<number>(0);
  const webRef = React.useRef<InAppWebHandle|null>(null);
  const DEFAULT_WEB_HOME = 'https://docs.blender.org/manual/en/latest/';
  const [selectedBlender, setSelectedBlender] = useState<BlenderExe | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error'; } | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<SimpleRepoRef | null>(null);
  const [extensionQuery, setExtensionQuery] = useState<string | null>(null);
  
  // Modal state for official download / clone-build workflow.
  const [showCloneBuildPopup, setShowCloneBuildPopup] = useState(false);

  // Jobs are persisted in config and restored on startup.
  const [pendingBuilds, setPendingBuilds] = useState<PendingBuild[]>([]);
  const [activePendingId, setActivePendingId] = useState<string | null>(null);

  // Restore pending clone jobs so the UI can continue after app restart.
  useEffect(() => {
    (async () => {
      try {
        const saved: any[] = await (window as any).electronAPI?.invoke?.('get-pending-clones') || [];
        if (saved.length > 0) {
          setPendingBuilds((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const restored: PendingBuild[] = saved
              .filter((c: any) => c.id && !existing.has(c.id))
              .map((c: any) => ({
                id: c.id,
                repoName: c.repoName || '',
                repoUrl: c.repoUrl || '',
                branch: c.branch || '',
                clonedPath: c.clonedPath || '',
                status: 'cloned' as const,
                progress: 100,
                currentText: t('status.ready_to_build', 'Prêt à compiler'),
                logLines: [],
              }));
            return [...prev, ...restored];
          });
        }
      } catch { /* ignore */ }
    })();
  }, []);
  
  // Shared bottom progress bar state (clone/download/build).
  const [cloneState, setCloneState] = useState<{ 
    isCloning?: boolean;
    isDownloading?: boolean;
    isBuilding?: boolean;
    jobId?: string;
    startTime?: number;
    progress: number; 
    text: string; 
    repoName?: string;
    version?: string;
  } | null>(null);

  // Local timer for MM:SS display in progress bar.
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!cloneState?.startTime) { setElapsedSec(0); return; }
    setElapsedSec(Math.floor((Date.now() - cloneState.startTime) / 1000));
    const iv = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - (cloneState.startTime || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [cloneState?.startTime]);

  // Official build downloader progress events.
  useEffect(() => {
    const handler = (_: any, data: any) => {
      if (!data) return;
      if (data.event === 'ERROR') {
        setCloneState({
          isDownloading: true,
          progress: data.progress ?? 0,
          text: data.message || t('download.error', 'Erreur de téléchargement'),
          version: cloneState?.version || undefined
        });
        return;
      }
      if (data.event === 'COMPLETE') {
        setCloneState({
          isDownloading: true,
          progress: 100,
          text: t('done', 'Terminé'),
          version: cloneState?.version || undefined
        });
        setTimeout(() => setCloneState(null), 3000);
        if (window.electronAPI?.getBlenders) {
          window.electronAPI.getBlenders().catch(()=>{});
        }
        return;
      }
      if (data.event === 'PROGRESS') {
        setCloneState({
          isDownloading: true,
            progress: typeof data.progress === 'number' ? data.progress : 0,
            text: data.text || t('download.in_progress', 'Téléchargement...'),
            version: cloneState?.version || undefined
        });
      }
    };
    (window as any).electronAPI?.on?.('download-progress', handler);
    return () => (window as any).electronAPI?.off?.('download-progress', handler);
  }, []);

  // Keep sidebar list in sync after installation/clone completion.
  useEffect(() => {
    const handler = async () => {
      if (window.electronAPI?.getBlenders) {
        try { await window.electronAPI.getBlenders(); } catch {}
      }
    };
    (window as any).electronAPI?.on?.('blenders-updated', handler);
    return () => (window as any).electronAPI?.off?.('blenders-updated', handler);
  }, []);

  // Centralized job-state reducer for clone/build jobs.
  useEffect(() => {
    const handler = (_: any, data: any) => {
      const jobId: string | undefined = data?.jobId;
      if (!jobId) return;
      const ev: string = data?.event;
      const logLine: string = (data?.text || data?.message || '').trim();
      const pct: number | undefined = typeof data?.progress === 'number' ? data.progress : undefined;

      setPendingBuilds((prev) => {
        const idx = prev.findIndex((p) => p.id === jobId);

        // Job can be emitted before the entry exists (fresh clone started from modal).
        if (idx < 0) {
          if (ev !== 'START') return prev;
          const newBuild: PendingBuild = {
            id: jobId,
            repoName: data?.repoName || data?.repoUrl || 'Dépôt',
            repoUrl: data?.repoUrl || '',
            branch: data?.branch || '',
            clonedPath: '',
            status: 'cloning',
            progress: 0,
            currentText: logLine || t('clone.in_progress', 'Clonage en cours…'),
            logLines: logLine ? [logLine] : [],
          };
          setCloneState({ isCloning: true, jobId, startTime: Date.now(), progress: 0, text: logLine || t('clone.in_progress', 'Clonage en cours…'), repoName: data?.repoName || data?.repoUrl || 'Dépôt' });
          return [...prev, newBuild];
        }

        const item = prev[idx];
        const newLogs = logLine
          ? [...item.logLines.slice(-499), logLine]
          : item.logLines;
        const progress = pct !== undefined ? pct : item.progress;
        const next = [...prev];
        const isBuilding = item.status === 'building' || (ev === 'START' && (item.status === 'cloned' || item.status === 'error'));
        const isCloning = item.status === 'cloning' || (ev === 'START' && !(item.status === 'cloned' || item.status === 'building' || item.status === 'error'));

        switch (ev) {
          case 'START':
            next[idx] = {
              ...item,
              status: item.status === 'cloned' || item.status === 'building' || item.status === 'error' ? 'building' : 'cloning',
              progress: 0,
              currentText: logLine || (item.status === 'cloned' || item.status === 'building' || item.status === 'error' ? t('compile.in_progress', 'Compilation en cours…') : item.currentText),
              logLines: newLogs,
            };
            break;
          case 'PROGRESS':
          case 'LOG':
            next[idx] = { ...item, progress, currentText: logLine || item.currentText, logLines: newLogs };
            if (isBuilding || isCloning) {
              setCloneState((prev) => prev && prev.jobId === jobId ? { ...prev, progress, text: logLine || prev.text } : prev);
            }
            break;
          case 'DONE':
            if (data?.path) {
              next[idx] = {
                ...item,
                status: 'cloned',
                clonedPath: data.path,
                progress: 100,
                currentText: t('clone.done_click_compile', 'Clone terminé — cliquez pour compiler'),
                logLines: newLogs,
              };
              setCloneState((prev) => prev && prev.jobId === jobId ? null : prev);
            } else if (data?.exe) {
              next[idx] = {
                ...item,
                status: 'done',
                exePath: data.exe,
                progress: 100,
                currentText: t('compile.done', 'Compilation terminée !'),
                logLines: newLogs,
              };
              setCloneState((prev) => prev && prev.jobId === jobId ? null : prev);
              window.electronAPI?.getBlenders?.().catch(() => {});
              setTimeout(() => {
                setPendingBuilds((p) => p.filter((b) => b.id !== jobId));
              }, 8000);
            }
            break;
          case 'ERROR':
            next[idx] = {
              ...item,
              status: 'error',
              errorMsg: data?.message,
              currentText: `${t('error', 'Erreur')}: ${data?.message || t('unknown', 'Inconnue')}`,
              logLines: newLogs,
            };
            setCloneState((prev) => prev && prev.jobId === jobId ? null : prev);
            break;
          default:
            if (logLine) next[idx] = { ...item, logLines: newLogs };
        }
        return next;
      });
    };
    (window as any).electronAPI?.on?.('clone-progress', handler);
    return () => (window as any).electronAPI?.off?.('clone-progress', handler);
  }, []);

  // Trigger compilation for an already-cloned source tree.
  const handleStartBuild = useCallback(async (id: string) => {
    const build = pendingBuilds.find((p) => p.id === id);
    if (!build?.clonedPath) return;
    setPendingBuilds((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'building' as const, progress: 0, logLines: [], currentText: 'Démarrage…' } : p
      )
    );
    setCloneState({ isBuilding: true, jobId: id, startTime: Date.now(), progress: 0, text: t('compile.starting', 'Démarrage de la compilation…'), repoName: build.repoName });
    setActivePendingId(null);
    (window as any).electronAPI?.invoke?.('build-cloned', {
      src: build.clonedPath,
      jobId: id,
      repoName: build.repoName,
    }).catch(() => {});
  }, [pendingBuilds]);

  console.log('[App] Rendu - page:', page, 'selectedBlender:', selectedBlender);

  // Startup splash screen while reading baseline config.
  const [isBootLoading, setIsBootLoading] = useState<boolean>(true);
  const [bootStatus, setBootStatus] = useState<string>(t('prep', 'Préparation…'));

  // Keep selected executable coherent with external updates.
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

  // Last launched executable is used for Discord presence updates.
  const [lastLaunched, setLastLaunched] = useState<BlenderExe | null>(null);
  // Global headless render progress.
  const [renderState, setRenderState] = useState<{ active: boolean; done: number; total: number; label?: string; stats?: string }|null>(null);

  // Load baseline config and optionally trigger a post-boot scan.
  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        setBootStatus(t('boot.loading_general_config', 'Chargement de la configuration générale…'));
        let generalScan = false;
        try {
          const general = await window.electronAPI.invoke('get-general-config');
          generalScan = !!general?.scanOnStartup;
        } catch {}

        setBootStatus(t('boot.loading_recent_files', 'Récupération des fichiers récents…'));
        try { await window.electronAPI.invoke('get-recent-blend-files'); } catch {}

        setBootStatus(t('boot.preparing_interface', 'Préparation de l’interface…'));
        setTimeout(() => setIsBootLoading(false), 250);

        if (generalScan) {
          try { await window.electronAPI.invoke('scan-and-merge-blenders'); } catch {}
        }
      } catch (e) { console.warn('[DiscordUI] load config erreur:', e); }
    };
    load();
  }, []);

  // Refresh Discord presence when a Blender launch is recorded.
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

  // Keep an idle presence when Discord is enabled and nothing is running.
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

  // React to tray actions (navigation + notifications).
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

  // Listen to render progress from main process.
  useEffect(() => {
    const api: any = (window as any).electronAPI;
    if (!api || typeof api.on !== 'function') return;
    const handler = (_: any, payload: any) => {
      const ev = payload?.event;
      if (!ev) return;
      if (ev === 'INIT') {
        const total = parseInt(payload.total || '1', 10) || 1;
        setRenderState({ active: true, done: 0, total, label: t('render.init', 'Initialisation du rendu…') });
      } else if (ev === 'START') {
        setRenderState((prev) => prev ? { ...prev, label: t('render.in_progress', 'Rendu en cours…') } : { active: true, done: 0, total: 1, label: t('render.in_progress', 'Rendu en cours…') });
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
        setRenderState((prev) => prev ? { ...prev, done: prev.total, label: t('done', 'Terminé') } : { active: false, done: 1, total: 1, label: t('done', 'Terminé') });
        setTimeout(() => setRenderState(null), 1200);
      } else if (ev === 'CANCEL' || ev === 'ERROR') {
        setRenderState({ active: false, done: 0, total: 1, label: ev === 'ERROR' ? t('render.error', 'Erreur de rendu') : t('render.cancelled', 'Rendu annulé') });
        setTimeout(() => setRenderState(null), 2000);
      }
    };
    api.on('render-progress', handler);
    return () => {
      try { api.off?.('render-progress', handler); } catch {}
    };
  }, []);

  // Centralized app history so toolbar back/forward stays deterministic.
  const pushAppEntry = (entry: NavEntry) => {
    setAppHistory((prev) => {
      const base = prev.slice(0, appIndex + 1);
      const next = base.concat(entry);
      return next;
    });
    setAppIndex((i) => i + 1);
    setPage(entry.page as any);
    setSelectedRepo(entry.repo || null);
    setSelectedBlender(entry.blender || null);
    if (entry.page === 'web') setWebUrl(entry.webUrl || '');
  };

  const restoreAppEntry = (index: number) => {
    const entry = appHistory[index];
    if (!entry) return;
    setAppIndex(index);
    setPage(entry.page as any);
    setSelectedRepo(entry.repo || null);
    setSelectedBlender(entry.blender || null);
    if (entry.page === 'web') setWebUrl(entry.webUrl || ''); else setWebUrl('');
  };

  const handleSelectBlender = (b: BlenderExe | null) => {
    setSelectedRepo(null);
    if (!b) {
      setSelectedBlender(null);
      return;
    }
    // On single click, navigate to the ViewPages for this blender
    pushAppEntry({ page: 'pages', blender: b });
  };

  const handleHome = () => {
    setSelectedBlender(null);
    setSelectedRepo(null);
    pushAppEntry({ page: 'home' });
  };

  const runWebHistoryScript = (script: string) => {
    try {
      const w = document.querySelector('webview') as any;
      if (w && typeof w.executeJavaScript === 'function') {
        w.executeJavaScript(script);
        return true;
      }
    } catch (e) {
      console.warn('[App] webview script fallback failed', e);
    }
    return false;
  };

  // Web navigation helpers
  const openWeb = (url: string) => {
    if (!url) return;
    pushAppEntry({ page: 'web', webUrl: url });
    setWebHistory((prev) => {
      const base = prev.slice(0, webIndex + 1);
      const next = base.concat(url);
      setWebIndex(next.length - 1);
      return next;
    });
  };
  const canGoBack = webCanGo.back || webIndex > 0;
  const canGoForward = webCanGo.forward || (webIndex >= 0 && webIndex < webHistory.length - 1);
  const goBack = () => {
    if (!canGoBack) return;
    setPage('web');
    if (webRef.current && typeof webRef.current.goBack === 'function') {
      try { webRef.current.goBack(); } catch (e) { console.warn('[App] webRef.goBack failed', e); }
      return;
    }
    if (webIndex > 0) {
      const nextIndex = Math.max(0, webIndex - 1);
      setWebIndex(nextIndex);
      setWebUrl(webHistory[nextIndex]);
    }
    runWebHistoryScript('history.back();');
  };
  const goForward = () => {
    if (!canGoForward) return;
    setPage('web');
    if (webRef.current && typeof webRef.current.goForward === 'function') {
      try { webRef.current.goForward(); } catch (e) { console.warn('[App] webRef.goForward failed', e); }
      return;
    }
    if (webIndex >= 0 && webIndex < webHistory.length - 1) {
      const nextIndex = Math.min(webHistory.length - 1, webIndex + 1);
      setWebIndex(nextIndex);
      setWebUrl(webHistory[nextIndex]);
    }
    runWebHistoryScript('history.forward();');
  };
  const webHome = () => {
    // push app-level entry for web home
    pushAppEntry({ page: 'web', webUrl: DEFAULT_WEB_HOME });
    setWebHistory([DEFAULT_WEB_HOME]);
    setWebIndex(0);
    setWebReloadKey(k=>k+1);
  };
  const clearWebHistory = () => {
    if (!webUrl) { setWebReloadKey(k=>k+1); return; }
    setWebHistory([webUrl]);
    setWebIndex(0);
    setWebReloadKey(k=>k+1);
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
  <Navbar
    onHome={handleHome}
    onSettings={() => pushAppEntry({ page: 'settings' })}
    onSelectRepo={(r)=> { setSelectedRepo(r); setSelectedBlender(null); pushAppEntry({ page: 'repo', repo: r }); }}
    onSearchExtensions={(q)=> { setExtensionQuery(q); setSelectedRepo(null); setSelectedBlender(null); pushAppEntry({ page: 'extensions' }); }}
    onOpenWeb={openWeb}
    onOpenCloneBuild={() => setShowCloneBuildPopup(true)}
    canGoBack={appIndex > 0}
    canGoForward={appIndex < appHistory.length - 1}
    onBack={() => { if (appIndex > 0) restoreAppEntry(appIndex - 1); }}
    onForward={() => { if (appIndex < appHistory.length - 1) restoreAppEntry(appIndex + 1); }}
  />
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
          pendingBuilds={pendingBuilds}
          onSelectPending={(id) => setActivePendingId(id)}
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
            ? <ViewRepo repo={selectedRepo} onBack={()=> setSelectedRepo(null)} onCloneStateChange={setCloneState} />
            : extensionQuery
            ? <ViewExtensions query={extensionQuery} onBack={()=> setExtensionQuery(null)} onOpenWeb={openWeb} />
            : page === 'web'
            ? (
              <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
                {webUrl ? (
                  <InAppWeb
                    ref={webRef}
                    url={webUrl}
                    reloadKey={webReloadKey}
                    onNavigated={(u) => {
                      if (!u) return;
                      setWebUrl(u);
                      setWebHistory((prev) => {
                        const last = prev[webIndex];
                        if (last === u) return prev;
                        const base = prev.slice(0, webIndex + 1);
                        const next = base.concat(u);
                        setWebIndex(next.length - 1);
                        return next;
                      });
                    }}
                    onCanGo={(state) => setWebCanGo({ back: !!state.canGoBack, forward: !!state.canGoForward })}
                  />
                ) : (
                  <div style={{ color: '#94a3b8', padding: 24 }}>{t('no_page', 'Aucune page')}</div>
                )}
              </div>
            )
            : page === 'pages' && selectedBlender
            ? <ViewPages selectedBlender={selectedBlender} onLaunch={(b) => setLastLaunched(b)} />
            : <Home selectedBlender={selectedBlender} onLaunch={(b) => setLastLaunched(b)} onOpenLink={openWeb} />}
        </div>
      </div>
      {/* Bottom clone/download/build progress bar */}
      {cloneState && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '8px 14px', background: '#0b1016', borderTop: '1px solid #1f2937', zIndex: 4000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, cloneState.progress)}%`, height: '100%', background: cloneState.isBuilding ? '#22c55e' : '#3b82f6', transition: 'width .25s ease' }} />
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12, minWidth: 50, textAlign: 'right' }}>
              {Math.min(100, cloneState.progress).toFixed(0)}%
            </div>
            {cloneState.startTime && (
              <div style={{ color: '#94a3b8', fontSize: 11, minWidth: 50, textAlign: 'right' }}>
                {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
              </div>
            )}
            {cloneState.jobId && (
              <button
                title={t('cancel', 'Annuler')}
                onClick={() => {
                  (window as any).electronAPI?.invoke?.('cancel-job', { jobId: cloneState.jobId }).catch(() => {});
                  setCloneState(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>
              {cloneState.isBuilding && <AiOutlineBuild style={{ verticalAlign: 'middle', marginRight: 4 }} />}
              {cloneState.isCloning && <AiOutlineInbox style={{ verticalAlign: 'middle', marginRight: 4 }} />}
              {cloneState.repoName && `${cloneState.repoName}`}
              {cloneState.version && `Blender ${cloneState.version}`}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 500 }}>
              {cloneState.text}
            </div>
          </div>
        </div>
      )}
      {/* Bottom render progress bar */}
      {renderState && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '8px 14px', background: '#0b1016', borderTop: '1px solid #1f2937', zIndex: 4000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round((renderState.done/renderState.total)*100))}%`, height: '100%', background: '#22c55e', transition: 'width .25s ease' }} />
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12, minWidth: 120, textAlign: 'right' }}>
              {renderState.label || t('render.in_progress', 'Rendu en cours…')}
            </div>
          </div>
          {renderState.stats && (
            <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>
              {renderState.stats}
            </div>
          )}
        </div>
      )}
      {/* Clone & Build Popup */}
      <ViewOfficial
        isOpen={showCloneBuildPopup}
        onClose={() => setShowCloneBuildPopup(false)}
        onDownloadStateChange={setCloneState}
      />
      {/* Build Manager popup (opened from a pending sidebar entry). */}
      {activePendingId && (() => {
        const pb = pendingBuilds.find((p) => p.id === activePendingId);
        if (!pb) { setActivePendingId(null); return null; }
        return (
          <ViewBuildManager
            pendingBuild={pb}
            onClose={() => setActivePendingId(null)}
            onStartBuild={handleStartBuild}
            onRemove={(id) => {
              const removed = pendingBuilds.find((p) => p.id === id);
              setPendingBuilds((prev) => prev.filter((p) => p.id !== id));
              setActivePendingId(null);
              // Remove from persisted config
              (window as any).electronAPI?.invoke?.('remove-pending-clone', {
                id,
                clonedPath: removed?.clonedPath,
              }).catch(() => {});
            }}
          />
        );
      })()}
    </div>
  );
};

export default App;
