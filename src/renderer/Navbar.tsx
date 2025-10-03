import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
  onSelectRepo?: (repo:{ name:string; link:string }) => void;
};

const Navbar: React.FC<NavbarProps> = ({ onHome, onSettings, onSelectRepo }) => {
  const { t } = useTranslation();
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

  // Repo search state
  const [repoQuery, setRepoQuery] = React.useState('');
  const [repoList, setRepoList] = React.useState<{ name:string; link:string; avatar?:string }[]>([]);
  React.useEffect(()=>{
    try {
      const data = require('./locales/link.json');
      if (data?.repository) {
        setRepoList(data.repository);
        // prefetch avatars
        data.repository.forEach((r:any)=>{
          const m = r.link.match(/github.com\/(.+?)\//); if(m){
            fetch(`https://api.github.com/users/${m[1]}`).then(res=>res.json()).then(j=>{
              setRepoList(prev=> prev.map(p=> p.link===r.link ? { ...p, avatar:j.avatar_url }:p));
            }).catch(()=>{});
          }
        });
      }
    } catch(e){ console.warn('Chargement link.json échoué', e); }
  },[]);

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
        <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:16, marginRight:20, flexShrink:0 }} className='no-drag'>
          <img src={"./public/logo/png/Blender-Launcher-512x512.png"} alt="Logo" style={{ width:32, height:32 }} />
          <span style={{ fontWeight:700, fontSize:22, color:'#fff', letterSpacing:1, whiteSpace:'nowrap' }}>Blender Launcher</span>
          <button style={{ ...iconBtnStyle, width:38, height:38 }} title="Accueil" onClick={onHome}>
            <FiHome size={22} />
          </button>
        </div>
  <div style={{ position:'relative', flex:1, margin:'0 24px', minWidth:260, display:'flex' }} className="no-drag">
          <input
            type="text"
            placeholder="Rechercher un repository..."
            value={repoQuery}
            onChange={e=> setRepoQuery(e.target.value)}
            style={{
              width:'100%',
              height:36,
              borderRadius:18,
              border:'1px solid #23272F',
              background:'#23272F',
              color:'#fff',
              fontSize:15,
              padding:'0 18px',
              outline:'none',
              transition:'border-color .15s, background .15s'
            }}
            onFocus={e=>{ e.currentTarget.style.borderColor='#3c4652'; e.currentTarget.style.background='#262d34'; }}
            onBlur={e=>{ e.currentTarget.style.borderColor='#23272F'; e.currentTarget.style.background='#23272F'; }}
          />
          {repoQuery && (
            <div style={{ position:'absolute', top:40, left:0, right:0, background:'#1f242b', border:'1px solid #2a3036', borderRadius:12, padding:8, display:'flex', flexDirection:'column', gap:6, maxHeight:300, overflowY:'auto', zIndex:500 }}>
              {repoList.filter(r=> r.name.toLowerCase().includes(repoQuery.toLowerCase())).map(r=> (
                <div key={r.link} onClick={()=>{ setRepoQuery(''); onSelectRepo && onSelectRepo(r); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'#232a31', border:'1px solid #2a3036', borderRadius:8, cursor:'pointer', fontSize:14, color:'#fff' }}
                  onMouseOver={e=>{ e.currentTarget.style.background='#2b333b'; }}
                  onMouseOut={e=>{ e.currentTarget.style.background='#232a31'; }}>
                    {r.avatar ? <img src={r.avatar} style={{ width:26, height:26, borderRadius:'50%', display:'block' }} /> : <span style={{ width:26, height:26, borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{r.name.charAt(0)}</span>}
                    <span style={{ fontWeight:500 }}>{r.name}</span>
                </div>
              ))}
              {repoList.filter(r=> r.name.toLowerCase().includes(repoQuery.toLowerCase())).length===0 && (
                <div style={{ fontSize:12, color:'#94a3b8', padding:'4px 2px' }}>Aucun résultat</div>
              )}
            </div>
          )}
        </div>
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
                <span style={{ marginTop: 24, fontSize: 24, fontWeight: 600 }}>{t('folder')}</span>
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
