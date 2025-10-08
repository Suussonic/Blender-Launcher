import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

type Props = {
  lastLaunched: BlenderExe | null;
  renderActive: boolean;
  notify: (msg: string, type: 'info' | 'error') => void;
};

const SettingsPage: React.FC<Props> = ({ lastLaunched, renderActive, notify }) => {
  const { t, i18n } = useTranslation();

  // Discord
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordShowFile, setDiscordShowFile] = useState(true);
  const [discordShowTitleOpt, setDiscordShowTitleOpt] = useState(true);
  const [discordAvailable, setDiscordAvailable] = useState<boolean | null>(null);
  // Steam
  const [steamEnabled, setSteamEnabled] = useState(false);
  const [steamAvailable, setSteamAvailable] = useState<boolean | null>(null);
  // General
  const [scanOnStartup, setScanOnStartup] = useState<boolean>(false);
  const [exitOnClose, setExitOnClose] = useState<boolean>(false);

  // Local scan button state
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      try {
        // Discord
        const cfg = await window.electronAPI?.invoke?.('get-discord-config');
        if (cfg) {
          setDiscordEnabled(!!cfg.enabled);
          setDiscordShowFile(cfg.showFile !== false);
          setDiscordShowTitleOpt(cfg.showTitle !== false);
        }
        try {
          const avail = await window.electronAPI?.invoke?.('get-discord-availability');
          setDiscordAvailable(!!avail?.available);
          if (!avail?.available) setDiscordEnabled(false);
        } catch {}

        // General
        try {
          const general = await window.electronAPI?.invoke?.('get-general-config');
          setScanOnStartup(!!general?.scanOnStartup);
          setExitOnClose(!!general?.exitOnClose);
        } catch {}

        // Steam
        const steamCfg = await window.electronAPI?.invoke?.('get-steam-config');
        if (steamCfg) setSteamEnabled(!!steamCfg.enabled);
        try {
          const avail = await window.electronAPI?.invoke?.('get-steam-availability');
          setSteamAvailable(!!avail?.available);
          if (!avail?.available) setSteamEnabled(false);
        } catch {}
      } catch (e) {
        console.warn('[SettingsPage] load settings error:', e);
      }
    };
    load();
  }, []);

  // Persist Discord/Steam settings
  useEffect(() => {
    const save = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        await window.electronAPI.invoke('update-discord-config', {
          enabled: discordEnabled,
          showFile: discordShowFile,
          showTitle: discordShowTitleOpt,
          showTime: false,
        });
        await window.electronAPI.invoke('update-steam-config', { enabled: steamEnabled });
      } catch (e) {
        console.warn('[SettingsPage] save config error:', e);
      }
    };
    const h = setTimeout(save, 400);
    return () => clearTimeout(h);
  }, [discordEnabled, discordShowFile, discordShowTitleOpt, steamEnabled]);

  // Persist general settings
  useEffect(() => {
    const saveGeneral = async () => {
      if (!window.electronAPI?.invoke) return;
      try {
        await window.electronAPI.invoke('update-general-config', { scanOnStartup, exitOnClose });
      } catch (e) {
        console.warn('[SettingsPage] save general error:', e);
      }
    };
    const h = setTimeout(saveGeneral, 300);
    return () => clearTimeout(h);
  }, [scanOnStartup, exitOnClose]);

  const runScanNow = async () => {
    if (!window.electronAPI?.invoke || scanning) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await window.electronAPI.invoke('scan-and-merge-blenders');
      if (res?.success) {
        const msg = `Scan terminé: ${res.added || 0} ajouté(s). Total: ${res.total ?? 'n/a'}`;
        setScanMsg(msg);
        notify(msg, 'info');
      } else {
        const msg = `Échec du scan${res?.error ? `: ${res.error}` : ''}`;
        setScanMsg(msg);
        notify(msg, 'error');
      }
    } catch (e: any) {
      const msg = `Erreur pendant le scan: ${e?.message || e}`;
      setScanMsg(msg);
      notify(msg, 'error');
    } finally {
      setScanning(false);
      setTimeout(() => setScanMsg(null), 3000);
    }
  };

  return (
    <div
      className="hide-scrollbar"
      style={{
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
        paddingBottom: renderActive ? 'calc(30vh + 48px)' : 'calc(24vh + 40px)',
        gap: 48,
      }}
    >
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
                fontWeight: 600,
              }}
              title="Scanner immédiatement vos installations Blender"
            >
              {scanning ? 'Scan en cours…' : 'Scanner maintenant'}
            </button>
            {scanMsg && <span style={{ fontSize: 12, color: '#94a3b8' }}>{scanMsg}</span>}
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
                try {
                  await window.electronAPI?.invoke?.('update-general-config', { exitOnClose: v });
                } catch {}
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
              marginLeft: 8,
            }}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Section Discord */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>Discord</h2>
        <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: discordAvailable === false ? 'not-allowed' : 'pointer',
              userSelect: 'none',
              opacity: discordAvailable === false ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={discordEnabled}
              disabled={discordAvailable === false}
              onChange={e => setDiscordEnabled(e.target.checked)}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontSize: 16, fontWeight: 500 }}>Afficher l'activité</span>
            {lastLaunched && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                <img
                  src={lastLaunched.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
                  alt="icon"
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                />
                {lastLaunched.title || lastLaunched.name}
              </span>
            )}
          </label>
          {discordAvailable === false && (
            <div style={{ marginTop: 8, color: '#ef4444', fontSize: 13 }}>
              Discord Rich Presence indisponible (Discord non installé ou configuration invalide).
            </div>
          )}
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
            </div>
          )}
        </div>
      </div>

      {/* Section Steam */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontWeight: 700, fontSize: 32, margin: '0 0 8px 0' }}>Steam</h2>
        <div style={{ width: '100%', maxWidth: 520, borderBottom: '2px solid #23272F', margin: '24px 0 32px 0' }} />
        <div style={{ width: '100%', maxWidth: 520 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: steamAvailable === false ? 'not-allowed' : 'pointer',
              userSelect: 'none',
              opacity: steamAvailable === false ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={steamEnabled}
              disabled={steamAvailable === false}
              onChange={e => setSteamEnabled(e.target.checked)}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontSize: 16, fontWeight: 500 }}>Lancer via Steam</span>
            {lastLaunched && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                <img
                  src={lastLaunched.icon || require('../../public/logo/png/Blender-Launcher-64x64.png')}
                  alt="icon"
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                />
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

      {/* Spacer */}
      <div style={{ height: renderActive ? '20vh' : '16vh' }} />
    </div>
  );
};

export default SettingsPage;
