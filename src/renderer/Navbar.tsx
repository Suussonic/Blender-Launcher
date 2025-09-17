import * as React from 'react';
import { FiHome, FiFolder, FiSettings, FiMinus, FiMaximize2, FiX } from 'react-icons/fi';


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
  return (
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
      {/* Bouton dossier */}
      <button style={iconBtnStyle} className="no-drag" title="Ouvrir un dossier">
        <FiFolder size={22} />
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
  );
};

export default Navbar;
