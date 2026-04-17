import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ModalCloseButton from '../../shared/components/ModalCloseButton';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

type InstallState = 'idle' | 'installing' | 'done' | 'error';

type PerBlenderState = {
  state: InstallState;
  error?: string;
  module?: string;
};

type Props = {
  downloadUrl: string;
  extensionTitle: string;
  pageUrl: string;
  onClose: () => void;
};

const InstallExtensionModal: React.FC<Props> = ({ downloadUrl, extensionTitle, pageUrl, onClose }) => {
  const { t } = useTranslation();
  const [blenders, setBlenders] = useState<BlenderExe[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, PerBlenderState>>({});

  useEffect(() => {
    (async () => {
      try {
        const list: BlenderExe[] = await (window as any).electronAPI?.getBlenders?.() ?? [];
        setBlenders(list);
      } catch {
        setBlenders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const install = async (blender: BlenderExe) => {
    const key = blender.path;
    setStatus(prev => ({ ...prev, [key]: { state: 'installing' } }));
    try {
      const result = await (window as any).electronAPI?.invoke?.(
        'install-extension-from-url',
        { blenderExePath: blender.path, downloadUrl, extensionTitle }
      );
      if (result?.success) {
        setStatus(prev => ({ ...prev, [key]: { state: 'done', module: result.module } }));
      } else {
        setStatus(prev => ({ ...prev, [key]: { state: 'error', error: result?.error || 'Échec inconnu' } }));
      }
    } catch (e) {
      setStatus(prev => ({ ...prev, [key]: { state: 'error', error: String(e) } }));
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--bg-muted)',
    borderRadius: 12,
    padding: '24px 28px',
    minWidth: 420,
    maxWidth: 560,
    width: '100%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    position: 'relative',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={cardStyle}>
        <ModalCloseButton
          onClick={onClose}
          title={t('close', 'Fermer')}
        />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            {t('extensions.install_modal.label', 'Installer l\'extension')}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {extensionTitle || t('extensions.install_modal.unknown', 'Extension inconnue')}
          </div>
          {pageUrl && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-all' }}>
              {pageUrl}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {t('extensions.install_modal.pick_blender', 'Choisissez une instance Blender pour installer et activer cette extension :')}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '12px 0' }}>
              {t('loading', 'Chargement…')}
            </div>
          )}

          {!loading && blenders.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '12px 0' }}>
              {t('extensions.install_modal.no_blenders', 'Aucune instance Blender enregistrée.')}
            </div>
          )}

          {blenders.map((b) => {
            const s = status[b.path];
            const isInstalling = s?.state === 'installing';
            const isDone      = s?.state === 'done';
            const isError     = s?.state === 'error';

            return (
              <div
                key={b.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--bg-surface-2, var(--bg-card))',
                  border: '1px solid var(--bg-muted)',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                {b.icon && (
                  <img
                    src={b.icon}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.title || b.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.path}
                  </div>
                  {isError && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2, wordBreak: 'break-word' }}>
                      {s.error}
                    </div>
                  )}
                  {isDone && (
                    <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                      {t('extensions.install_modal.installed', 'Installé et activé')}
                      {s.module ? ` (${s.module})` : ''}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => install(b)}
                  disabled={isInstalling || isDone}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: isInstalling || isDone ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    background: isDone
                      ? 'var(--success)'
                      : isError
                      ? 'var(--accent)'
                      : 'var(--accent)',
                    color: 'var(--text-inverse, #fff)',
                    opacity: isInstalling ? 0.6 : 1,
                    minWidth: 90,
                  }}
                >
                  {isInstalling
                    ? t('extensions.install_modal.installing', 'Installation…')
                    : isDone
                    ? t('extensions.install_modal.done', 'Installé ✓')
                    : isError
                    ? t('extensions.install_modal.retry', 'Réessayer')
                    : t('extensions.install_modal.install', 'Installer')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InstallExtensionModal;
