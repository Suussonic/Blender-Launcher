// Gestionnaire Discord Rich Presence
// Ce module encapsule la logique de connexion et mise à jour de la presence Discord.
// Il est volontairement en JS simple pour compatibilité immediate.

const fs = require('fs');
const path = require('path');
let RPC; // lazy require discord-rpc (evite crash si module absent)

class DiscordRPCManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.client = null;
    this.ready = false;
    this.currentActivity = null;
    this.connecting = false;
    this.lastStartTimestamp = null;
    this.reconnectTimer = null;
  }

  loadConfig() {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      return cfg.discord || null;
    } catch (e) {
      console.warn('[DiscordRPC] Impossible de charger la config:', e);
      return null;
    }
  }

  saveConfig(partial) {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const cfg = JSON.parse(raw || '{}');
      cfg.discord = { ...(cfg.discord || {}), ...partial };
      fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), 'utf-8');
      return cfg.discord;
    } catch (e) {
      console.error('[DiscordRPC] Echec sauvegarde config:', e);
      return null;
    }
  }

  ensureLoadedLib() {
    if (!RPC) {
      try {
        RPC = require('discord-rpc');
      } catch (e) {
        console.error('[DiscordRPC] Module discord-rpc introuvable. Installez-le via npm install discord-rpc');
        return false;
      }
    }
    return true;
  }

  async init(force = false) {
    if (!this.ensureLoadedLib()) return;
    const cfg = this.loadConfig();
    if (!cfg || !cfg.enabled) {
      this.dispose();
      return;
    }
    if (!cfg.appId || cfg.appId === '0000000000000000000') {
      console.warn('[DiscordRPC] appId placeholder. Presence inactive.');
      return;
    }
    if (this.client && !force) return; // deja init

    if (this.client) this.dispose();

    this.client = new RPC.Client({ transport: 'ipc' });
    this.ready = false;
    this.connecting = true;

    this.client.on('ready', () => {
      console.log('[DiscordRPC] Connecté à Discord');
      this.ready = true;
      this.connecting = false;
      if (this.currentActivity) {
        this.setActivity(this.currentActivity);
      }
    });

    this.client.on('disconnected', () => {
      console.warn('[DiscordRPC] Déconnecté');
      this.ready = false;
      this.scheduleReconnect();
    });

    this.client.on('error', (err) => {
      console.error('[DiscordRPC] Erreur client:', err);
      this.ready = false;
      this.scheduleReconnect();
    });

    try {
      await this.client.login({ clientId: cfg.appId });
    } catch (e) {
      console.error('[DiscordRPC] Echec login:', e.message || e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[DiscordRPC] Tentative de reconnexion...');
      this.init(true);
    }, 15_000);
  }

  dispose() {
    try { if (this.reconnectTimer) clearTimeout(this.reconnectTimer); } catch {}
    this.reconnectTimer = null;
    if (this.client) {
      // Eviter les promesses rejetées si la connexion n'a jamais été établie
      try {
        if (this.ready && this.client.clearActivity) {
          const maybePromise = this.client.clearActivity();
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.catch(()=>{});
          }
        }
      } catch {}
      try {
        const maybe = this.client.destroy?.();
        if (maybe && typeof maybe.then === 'function') {
          maybe.catch(()=>{});
        }
      } catch {}
    }
    this.client = null;
    this.ready = false;
  }

  computeActivity(params) {
    const cfg = this.loadConfig();
    if (!cfg || !cfg.enabled) return null;
  const { blenderTitle, fileName, version, imageHint } = params;
    // Construction intelligente pour éviter doublons
    // Cas souhaité:
    //  - Si fichier: details = NomFichier, state = TitreBuild (si activé)
    //  - Si pas de fichier: details = TitreBuild (ou 'Blender'), state = undefined
    let details;
    let state;
    if (cfg.showFile && fileName) {
      // Retirer extension .blend si présente
      let base = fileName;
      if (typeof base === 'string' && base.toLowerCase().endsWith('.blend')) {
        base = base.slice(0, -6);
      }
      details = base; // ligne principale = fichier sans extension
      if (cfg.showTitle && blenderTitle) state = blenderTitle; // deuxième ligne = build
    } else {
      // Pas de fichier -> on ne met qu'une seule ligne (titre ou défaut)
      details = (cfg.showTitle && blenderTitle) ? blenderTitle : 'Blender Launcher';
      state = undefined; // évite duplication
    }

    // Image grande : tenter une clé versionnée si l'utilisateur a ajouté des assets (ex: blender_41)
    let largeImageKey = 'blender';
    if (version) {
      const norm = String(version).replace(/[^0-9a-z]/gi, '').replace(/\./g,'');
      if (norm) {
        largeImageKey = `blender_${norm}`; // ex: 41 -> blender_41
      }
    }
    if (imageHint && typeof imageHint === 'string') {
      largeImageKey = imageHint; // override manuel possible
    }

    const activity = { details, largeImageKey, largeImageText: blenderTitle || 'Blender' };
    if (state) activity.state = state;
    // Suppression de l'affichage du temps (option retirée). Pas de startTimestamp désormais.
    this.lastStartTimestamp = null;
    return activity;
  }

  setActivity(activityParams) {
    const cfg = this.loadConfig();
    if (!cfg || !cfg.enabled) return;
    const act = this.computeActivity(activityParams);
    this.currentActivity = activityParams;
    if (!act) return;
    if (!this.client || !this.ready) {
      // sera appliqué une fois ready
      return;
    }
    try {
      this.client.setActivity(act);
    } catch (e) {
      console.error('[DiscordRPC] setActivity erreur:', e);
    }
  }
}

module.exports = { DiscordRPCManager };
