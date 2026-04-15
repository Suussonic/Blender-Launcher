import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineSetting,
  AiOutlineSync,
  AiOutlineTool,
  AiOutlineBulb,
  AiOutlineCopy,
  AiOutlineCheck,
  AiOutlineClose,
  AiOutlineReload,
  AiOutlineDownload,
  AiOutlineCaretRight,
  AiOutlineWarning,
  AiOutlineUp,
  AiOutlineDown,
  AiOutlineClockCircle,
  AiOutlineHourglass,
  AiOutlineDelete,
  AiOutlineExport,
} from 'react-icons/ai';

export type PendingBuildStatus = 'cloning' | 'cloned' | 'building' | 'done' | 'error';

export interface PendingBuild {
  id: string;
  repoName: string;
  repoUrl: string;
  branch: string;
  clonedPath: string;
  status: PendingBuildStatus;
  progress: number;
  currentText: string;
  logLines: string[];
  errorMsg?: string;
  exePath?: string;
}

interface ViewBuildManagerProps {
  pendingBuild: PendingBuild;
  onClose: () => void;
  onStartBuild: (id: string) => void;
  onRemove: (id: string) => void;
}

const TOOL_INFO: Record<string, { label: string; desc: string; winget: string; url: string; hint?: string }> = {
  git: {
    label: 'Git',
    desc: 'Contrôle de version (pour cloner le code source)',
    winget: 'winget install --id Git.Git -e --source winget',
    url: 'https://git-scm.com/download/win',
    hint: 'Cochez "Add Git to your PATH" lors de l\'installation.',
  },
  cmake: {
    label: 'CMake',
    desc: 'Générateur de fichiers de build',
    winget: 'winget install --id Kitware.CMake -e --source winget',
    url: 'https://cmake.org/download/',
    hint: 'Cochez "Add CMake to the system PATH for all users" lors de l\'installation.',
  },
  msvc: {
    label: 'Visual Studio 2022 C++',
    desc: 'Compilateur MSVC requis',
    winget:
      'winget install --id Microsoft.VisualStudio.2022.Community -e --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"',
    url: 'https://visualstudio.microsoft.com/downloads/',
    hint: 'Cochez "Développement Desktop en C++" lors de l\'installation. (Version Community = gratuite)',
  },
  pwsh: {
    label: 'PowerShell 7 (pwsh)',
    desc: 'Requis par plusieurs règles de build Blender/forks',
    winget: 'winget install --id Microsoft.PowerShell -e --source winget',
    url: 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows',
    hint: 'Après installation, relancez l\'application pour recharger le PATH.',
  },
  svn: {
    label: 'SlikSVN (svn.exe)',
    desc: 'Requis pour certains builds Goo Engine',
    winget: 'winget install --id Slik.Subversion -e --source winget',
    url: 'https://sliksvn.com/download/',
    hint: 'Installez SlikSVN puis relancez la vérification.',
  },
};

const ViewBuildManager: React.FC<ViewBuildManagerProps> = ({
  pendingBuild,
  onClose,
  onStartBuild,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Record<string, boolean | undefined>>({});
  const [checkingTools, setCheckingTools] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [copiedTool, setCopiedTool] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { id, repoName, branch, clonedPath, status, progress, currentText, logLines, errorMsg } = pendingBuild;
  const isGooBuild = [repoName, pendingBuild.repoUrl, clonedPath]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes('goo-engine'));
  const toolOrder: string[] = isGooBuild
    ? ['git', 'cmake', 'msvc', 'pwsh', 'svn']
    : ['git', 'cmake', 'msvc', 'pwsh'];

  const isCloning = status === 'cloning';
  const isCloned = status === 'cloned';
  const isBuilding = status === 'building';
  const isDone = status === 'done';
  const isError = status === 'error';

  // Start/stop elapsed timer when building
  useEffect(() => {
    if (isBuilding) {
      if (!startTime) setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - (startTime || Date.now()));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isDone || isError) setStartTime(null);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isBuilding, isDone, isError, startTime]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines.length, showLogs]);

  const checkTools = useCallback(async () => {
    setCheckingTools(true);
    try {
      const res = await (window as any).electronAPI?.invoke?.('check-build-tools', { includeSvn: isGooBuild });
      if (res?.success) setTools(res.tools || {});
    } finally {
      setCheckingTools(false);
    }
  }, [isGooBuild]);

  useEffect(() => {
    if (isCloned) void checkTools();
  }, [isCloned, checkTools]);

  const handleInstallTools = async () => {
    setInstalling(true);
    try {
      const missing = Object.entries(tools)
        .filter(([, v]) => v === false)
        .map(([k]) => k);
      await (window as any).electronAPI?.invoke?.('install-build-tools', { tools: missing });
      await checkTools();
    } finally {
      setInstalling(false);
    }
  };

  const handleCopy = (toolKey: string, cmd: string) => {
    try { navigator.clipboard.writeText(cmd); } catch {}
    setCopiedTool(toolKey);
    setTimeout(() => setCopiedTool(null), 1800);
  };

  const handleOpenUrl = (url: string) => {
    try {
      (window as any).electronAPI?.invoke?.('open-external-url', url);
    } catch {}
  };

  const missingTools = Object.entries(tools).filter(([, v]) => v === false).map(([k]) => k);
  const allToolsOk = Object.keys(tools).length > 0 && missingTools.length === 0;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const eta = (() => {
    if (!startTime || progress <= 2 || progress >= 100) return null;
    const elapsed = Date.now() - startTime;
    const total = elapsed / (progress / 100);
    const remaining = total - elapsed;
    return remaining > 5000 ? formatTime(remaining) : null;
  })();

  // ---- Visual styles matching project theme ----
  const barColor = isError ? 'var(--danger)' : isDone ? 'var(--success)' : 'var(--accent)';

  const statusIcon = isDone
    ? <AiOutlineCheckCircle style={{ color: 'var(--success)', fontSize: 18, verticalAlign: 'middle' }} />
    : isError
    ? <AiOutlineCloseCircle style={{ color: 'var(--danger)', fontSize: 18, verticalAlign: 'middle' }} />
    : isBuilding
    ? <AiOutlineSetting style={{ color: 'var(--accent-hover)', fontSize: 18, verticalAlign: 'middle', animation: 'spin 2s linear infinite' }} />
    : isCloning
    ? <AiOutlineSync style={{ color: 'var(--accent-hover)', fontSize: 18, verticalAlign: 'middle', animation: 'spin 1.5s linear infinite' }} />
    : <AiOutlineTool style={{ color: 'var(--text-secondary)', fontSize: 18, verticalAlign: 'middle' }} />;
  const statusTitle = isDone
    ? t('compile.done', 'Compilation terminée')
    : isError
    ? t('error', 'Erreur')
    : isBuilding
    ? t('compile.in_progress', 'Compilation en cours…')
    : isCloning
    ? t('clone.in_progress', 'Clonage en cours…')
    : t('compile.blender', 'Compiler Blender');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--shadow-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-soft)',
          borderRadius: 16,
          width: 660,
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 56px var(--shadow-color)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', fontWeight: 600 }}>
              {statusIcon} {statusTitle}
            </h3>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{repoName}</strong>
              {branch && <> &nbsp;·&nbsp; <span style={{ color: 'var(--text-tertiary)' }}>{branch}</span></>}
              {clonedPath && (
                <>
                  &nbsp;·&nbsp;
                  <code style={{ fontSize: 10, color: 'var(--bg-muted)', background: 'var(--bg-surface-3)', padding: '1px 4px', borderRadius: 4 }}>
                    {clonedPath}
                  </code>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            title={t('close', 'Fermer')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: 1,
              padding: '0 2px',
              flexShrink: 0,
            }}
          >
            <AiOutlineClose />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            flex: 1,
          }}
          className="hide-scrollbar"
        >
          {/* ── Clone progress bar (while cloning) ── */}
          {isCloning && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{currentText || t('clone.in_progress', 'Clonage en cours…')}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{Math.round(progress)}%</span>
              </div>
              <div
                style={{
                  height: 7,
                  background: 'var(--bg-muted)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, progress)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width .3s ease',
                    borderRadius: 999,
                  }}
                />
              </div>
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('clone.help_after_done', 'Le clonage est en cours. Une fois terminé, vous pourrez lancer la compilation.')}
              </p>
            </div>
          )}

          {/* ── Tool check section (when cloned and not yet building) ── */}
          {isCloned && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('build.required_tools', 'Outils de build requis')}
                </span>
                <button
                  onClick={checkTools}
                  disabled={checkingTools}
                  style={{
                    padding: '5px 12px',
                    background: 'transparent',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 7,
                    color: 'var(--text-secondary)',
                    cursor: checkingTools ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    opacity: checkingTools ? 0.6 : 1,
                  }}
                >
                  {checkingTools
                    ? <><AiOutlineReload style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 4 }} /> {t('checking', 'Vérification…')}</>
                    : <><AiOutlineReload style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('recheck', 'Re-vérifier')}</>}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {toolOrder.map((key) => {
                  const info = TOOL_INFO[key];
                  const ok = tools[key];
                  const isMissing = ok === false;
                  return (
                    <div
                      key={key}
                      style={{
                        background: 'var(--bg-surface-1)',
                        border: `1.5px solid ${ok === true ? 'color-mix(in srgb, var(--success) 32%, var(--bg-card))' : isMissing ? 'color-mix(in srgb, var(--danger) 32%, var(--bg-card))' : 'var(--border-soft)'}`,
                        borderRadius: 10,
                        padding: '10px 13px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background:
                              ok === true ? 'var(--success)' : isMissing ? 'var(--danger)' : 'var(--text-tertiary)',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {info.label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>
                          {ok === true
                            ? <><AiOutlineCheck style={{ color: 'var(--success)', verticalAlign: 'middle', marginRight: 2 }} /> installé</>
                            : isMissing
                            ? <><AiOutlineClose style={{ color: 'var(--danger)', verticalAlign: 'middle', marginRight: 2 }} /> manquant</>
                            : '?'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{info.desc}</div>
                      {isMissing && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                          {info.hint && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-warning)',
                                background: 'color-mix(in srgb, var(--text-warning) 16%, var(--bg-card))',
                                border: '1px solid color-mix(in srgb, var(--text-warning) 34%, var(--bg-card))',
                                borderRadius: 5,
                                padding: '4px 7px',
                                lineHeight: 1.4,
                              }}
                            >
                              <AiOutlineBulb style={{ color: 'var(--text-warning)', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }} /> {info.hint}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <code
                              style={{
                                flex: 1,
                                fontSize: 10,
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface-3)',
                                borderRadius: 5,
                                padding: '3px 6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              }}
                              title={info.winget}
                            >
                              {info.winget}
                            </code>
                            <button
                              onClick={() => handleCopy(key, info.winget)}
                              title={t('copy_winget_command', 'Copier la commande winget')}
                              style={{
                                padding: '3px 8px',
                                background: 'var(--bg-muted)',
                                border: '1px solid var(--border-soft)',
                                borderRadius: 5,
                                color: copiedTool === key ? 'var(--success)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: 11,
                                flexShrink: 0,
                              }}
                            >
                              {copiedTool === key ? <AiOutlineCheck /> : <AiOutlineCopy />}
                            </button>
                          </div>
                          <button
                            onClick={() => handleOpenUrl(info.url)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              fontSize: 11,
                              color: 'var(--accent-hover)',
                              textAlign: 'left',
                            }}
                          >
                            <AiOutlineExport style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('install_manually', 'Installer manuellement')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {missingTools.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={handleInstallTools}
                    disabled={installing || checkingTools}
                    style={{
                      padding: '9px 18px',
                      background: installing ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-card))' : 'var(--accent)',
                      border: 'none',
                      borderRadius: 8,
                      color: 'var(--text-inverse)',
                      cursor: installing ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: installing ? 0.7 : 1,
                    }}
                  >
                    {installing
                      ? <><AiOutlineDownload style={{ verticalAlign: 'middle', marginRight: 4, animation: 'spin 1.5s linear infinite' }} /> {t('install.in_progress', 'Installation en cours…')}</>
                      : <><AiOutlineDownload style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('install.auto_with_count', `Installer automatiquement (${missingTools.length} outil${missingTools.length > 1 ? 's' : ''})`)}</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Build progress (while building, done, or error) ── */}
          {(isBuilding || isDone || isError) && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {currentText || t('in_progress', 'En cours…')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {isBuilding && `${Math.round(progress)}%`}
                  {isDone && '100%'}
                </span>
              </div>
              <div
                style={{ height: 8, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: `${Math.min(100, progress)}%`,
                    height: '100%',
                    background: barColor,
                    transition: 'width .35s ease',
                    borderRadius: 999,
                  }}
                />
              </div>
              {isBuilding && startTime && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 7,
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span><AiOutlineClockCircle style={{ verticalAlign: 'middle', marginRight: 4 }} /> Écoulé : {formatTime(elapsedMs)}</span>
                  {eta && <span><AiOutlineHourglass style={{ verticalAlign: 'middle', marginRight: 4 }} /> Restant estimé : ~{eta}</span>}
                </div>
              )}
            </div>
          )}

          {/* ── Log toggle + panel ── */}
          {(isBuilding || isDone || isError) && (
            <div>
              <button
                onClick={() => setShowLogs((v) => !v)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 7,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: showLogs ? 8 : 0,
                }}
              >
                <span style={{ fontSize: 10 }}>{showLogs ? <AiOutlineUp /> : <AiOutlineDown />}</span>
                <span>{showLogs ? t('hide_logs', 'Masquer les logs') : t('show_logs', 'Afficher les logs')}</span>
              </button>
              {showLogs && (
                <div
                  className="hide-scrollbar"
                  style={{
                    background: 'var(--bg-surface-3)',
                    border: '1px solid var(--bg-muted)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    maxHeight: 220,
                    overflowY: 'auto',
                    fontFamily: 'Consolas, monospace',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.65,
                  }}
                >
                  {logLines.length === 0 ? (
                    <span style={{ color: 'var(--bg-muted)' }}>{t('no_logs', 'Aucun log…')}</span>
                  ) : (
                    logLines.map((l, i) => (
                      <div
                        key={i}
                        style={{
                          color: l.toLowerCase().includes('error') || l.includes('ERREUR')
                            ? 'var(--text-danger)'
                            : l.includes('DONE') || l.toLowerCase().includes('terminé')
                            ? 'var(--text-success)'
                            : l.startsWith('BL_CLONE:PROGRESS') || l.startsWith('BL_CLONE:START')
                            ? 'var(--accent-hover)'
                            : 'var(--text-tertiary)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {l}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}

          {/* ── Success banner ── */}
          {isDone && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--success) 18%, var(--bg-card))',
                border: '1px solid color-mix(in srgb, var(--success) 32%, var(--bg-card))',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 13,
                color: 'var(--text-success)',
              }}
            >
              <AiOutlineCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {t('compile.success_banner', 'Blender compilé avec succès ! L\'exécutable a été ajouté à votre liste d\'applications.')}
            </div>
          )}

          {/* ── Error banner ── */}
          {isError && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--danger) 18%, var(--bg-card))',
                border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--bg-card))',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 13,
                color: 'var(--text-danger)',
                lineHeight: 1.55,
              }}
            >
              <AiOutlineCloseCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {errorMsg || t('compile.error_banner', 'Erreur lors de la compilation')}
              <br />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t('logs.more_details', 'Consultez les logs pour plus de détails.')}
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '13px 22px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          {/* Delete button (only when not building) */}
          {!isBuilding && !isCloning && (
            <button
              onClick={() => { onRemove(id); onClose(); }}
              style={{
                marginRight: 'auto',
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--bg-card))',
                borderRadius: 8,
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: 13,
                opacity: 0.75,
              }}
              title={t('remove_from_list', 'Retirer de la liste')}
            >
              <AiOutlineDelete style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('delete', 'Supprimer')}
            </button>
          )}

          {/* Start build button */}
          {isCloned && (
            <button
              onClick={() => onStartBuild(id)}
              disabled={!allToolsOk || checkingTools || installing}
              style={{
                padding: '9px 20px',
                background: allToolsOk && !checkingTools && !installing ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 22%, var(--bg-card))',
                border: 'none',
                borderRadius: 8,
                color: 'var(--text-inverse)',
                cursor: allToolsOk && !checkingTools && !installing ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 600,
                opacity: allToolsOk && !checkingTools && !installing ? 1 : 0.5,
              }}
            >
              {checkingTools
                ? <><AiOutlineReload style={{ verticalAlign: 'middle', marginRight: 4, animation: 'spin 1s linear infinite' }} /> {t('checking', 'Vérification…')}</>
                : allToolsOk
                ? <><AiOutlineCaretRight style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('compile.start', 'Démarrer la compilation')}</>
                : <><AiOutlineWarning style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('missing_tools_count', `Outils manquants (${missingTools.length})`)}</>}
            </button>
          )}

          {/* Retry button on error */}
          {isError && isCloned && (
            <button
              onClick={() => onStartBuild(id)}
              style={{
                padding: '9px 18px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: 'var(--text-inverse)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <AiOutlineReload style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('retry', 'Réessayer')}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {isBuilding ? t('close_build_continues', 'Fermer (build continue)') : isDone ? <><AiOutlineCheck style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('close', 'Fermer')}</> : t('close', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewBuildManager;



