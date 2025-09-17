import * as React from 'react';
import { FiHome, FiDownload, FiSettings, FiMinus, FiMaximize2, FiX, FiGithub, FiFolder } from 'react-icons/fi';


const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fff',
  fontSize: 22,
  width: 40,
  height: 40,
  borderRadius: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
  outline: 'none'
};

const windowBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fff',
  fontSize: 18,
  width: 40,
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.2s',
  outline: 'none',
  borderRadius: 0
};


// Ajout des props pour navigation
type NavbarProps = {
  onHome?: () => void;
  onSettings?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ onHome, onSettings }) => {
  const navbarRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (navbarRef.current) {
      // @ts-ignore
      navbarRef.current.style['-webkit-app-region'] = 'drag';
      navbarRef.current.querySelectorAll('.no-drag').forEach((el) => {
        // @ts-ignore
        (el as HTMLElement).style['-webkit-app-region'] = 'no-drag';
      });
    }
  }, []);
  // Popup import state
  const [showImport, setShowImport] = React.useState(false);
  const [importMode, setImportMode] = React.useState<'main' | 'github'>('main');
  const [githubUrl, setGithubUrl] = React.useState('');

  return (
    <>
      <div
        ref={navbarRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 56,
          background: '#181A20',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          padding: 0,
          gap: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 200,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        <img src={"./public/logo/png/Blender-Launcher-512x512.png"} alt="Logo" className="logo" style={{ width: 32, height: 32, marginLeft: 16, marginRight: 12 }} />
        <span style={{ fontWeight: 700, fontSize: 22, color: '#fff', marginRight: 24, letterSpacing: 1 }}>Blender Launcher</span>
        <button style={iconBtnStyle} className="no-drag" title="Accueil" onClick={onHome}>
          <FiHome size={22} />
        </button>
        <input
          type="text"
          placeholder="Rechercher"
          style={{
            flex: 1,
            minWidth: 120,
            margin: '0 24px 0 0',
            height: 36,
            borderRadius: 18,
            border: 'none',
            background: '#23272F',
            color: '#fff',
            fontSize: 16,
            padding: '0 20px',
            outline: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}
          disabled
        />
        {/* Bouton import */}
        <button style={iconBtnStyle} className="no-drag" title="Importer" onClick={() => setShowImport(true)}>
          <FiDownload size={22} />
        </button>
        {/* Bouton paramètres (engrenage) */}
        <button style={iconBtnStyle} className="no-drag" title="Paramètres" onClick={onSettings}>
          <FiSettings size={22} />
        </button>
        {/* Séparateur vertical */}
        <div style={{ width: 1, height: 32, background: '#23272F', margin: '0 8px 0 16px' }} />
        {/* Boutons fenêtre */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', height: 56 }}>
          <button
            style={{ ...windowBtnStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            className="no-drag"
            title="Minimiser"
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.send('minimize-window');
              }
            }}
          >
            <FiMinus size={18} />
          </button>
          <button
            style={{ ...windowBtnStyle, borderRadius: 0 }}
            className="no-drag"
            title="Plein écran"
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.send('maximize-window');
              }
            }}
          >
            <FiMaximize2 size={18} />
          </button>

          <button
            style={{ ...windowBtnStyle, color: '#f87171', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, display: 'flex', marginRight: 10 }}
            className="no-drag"
            title="Fermer"
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.send('close-window');
              }
            }}
          >
            <FiX size={20} />
          </button>
        </div>
      </div>
      {/* Popup Import */}
      {showImport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.35)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => {
            setShowImport(false);
            setImportMode('main');
          }}
        >
          {/* Mode principal : choix GitHub ou Dossier */}
          {importMode === 'main' && (
            <div style={{
              background: '#23272F',
              borderRadius: 24,
              boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
              width: '70vw',
              height: '60vh',
              minWidth: 480,
              minHeight: 320,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  flex: 1,
                  background: '#181A20',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  borderRight: '2px solid #23272F',
                  outline: 'none',
                  height: '100%',
                }}
                title="Importer depuis GitHub"
                onClick={() => setImportMode('github')}
              >
                <FiGithub size={80} />
                <span style={{ marginTop: 24, fontSize: 24, fontWeight: 600 }}>GitHub</span>
              </button>
              <button
                style={{
                  flex: 1,
                  background: '#181A20',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  outline: 'none',
                  height: '100%',
                }}
                title="Importer depuis un dossier"
                onClick={() => {
                  if (window.electronAPI && window.electronAPI.send) {
                    window.electronAPI.send('open-folder-dialog');
                  }
                  setShowImport(false);
                  setImportMode('main');
                }}
              >
                <FiFolder size={80} />
                <span style={{ marginTop: 24, fontSize: 24, fontWeight: 600 }}>Dossier</span>
              </button>
              <button
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 28,
                  cursor: 'pointer',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
                onClick={() => {
                  setShowImport(false);
                  setImportMode('main');
                }}
                title="Fermer"
              >
                <FiX size={28} />
              </button>
            </div>
          )}
          {/* Mode GitHub : barre de recherche */}
          {importMode === 'github' && (
            <div style={{
              background: '#23272F',
              borderRadius: 24,
              boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
              width: '420px',
              minWidth: 320,
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '40px 32px 32px 32px',
              gap: 24,
            }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <input
                  type="text"
                  placeholder="Collez un lien GitHub..."
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: 20,
                    padding: '14px 22px',
                    borderRadius: 12,
                    border: '1.5px solid #23272F',
                    background: '#181A20',
                    color: '#fff',
                    outline: 'none',
                    marginBottom: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                  }}
                  autoFocus
                />
                <button
                  style={{
                    background: githubUrl.trim() ? '#3b82f6' : '#334155',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 20,
                    fontWeight: 600,
                    padding: '12px 0',
                    width: '100%',
                    cursor: githubUrl.trim() ? 'pointer' : 'not-allowed',
                    marginTop: 0,
                    transition: 'background 0.2s',
                    boxShadow: githubUrl.trim() ? '0 2px 8px #3b82f655' : 'none',
                  }}
                  onClick={() => {
                    // Ici tu peux gérer l'import GitHub avec githubUrl
                    setShowImport(false);
                    setImportMode('main');
                    setGithubUrl('');
                  }}
                  disabled={!githubUrl.trim()}
                >Valider</button>
              </div>
              <button
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 28,
                  cursor: 'pointer',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
                onClick={() => {
                  setShowImport(false);
                  setImportMode('main');
                  setGithubUrl('');
                }}
                title="Fermer"
              >
                <FiX size={28} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Navbar;
