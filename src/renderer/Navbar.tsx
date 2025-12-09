import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FiHome, FiDownload, FiSettings, FiMinus, FiMaximize2, FiX, FiGithub, FiFolder, FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';


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

// Modal d'import GitHub (inline pour limiter la dispersion)
interface GitHubImportModalProps { value:string; onChange:(v:string)=>void; onClose:()=>void; onValidate:(url:string)=>{ok?:boolean; error?:string}; }

const GitHubImportModal: React.FC<GitHubImportModalProps> = ({ value, onChange, onClose, onValidate }) => {
  const [error,setError] = React.useState<string|null>(null);
  const canSubmit = value.trim()!=='';

  const submit = () => {
    if(!canSubmit) return;
    const r = onValidate(value.trim());
    if(r?.error) setError(r.error);
  };

  return (
    <div style={{
      position:'fixed',
      top:0,
      left:0,
      width:'100vw',
      height:'100vh',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      background:'rgba(0,0,0,0.55)'
    }}
      onClick={onClose}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        position:'relative',
        width:420,
        maxWidth:'90vw',
        padding:'36px 34px 34px',
        background:'#1F2328',
        border:'1px solid #30363d',
        borderRadius:24,
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        boxShadow:'0 8px 28px -8px rgba(0,0,0,0.55), 0 4px 14px -6px rgba(0,0,0,0.45)',
        animation:'modalPop .28s cubic-bezier(.4,.12,.25,1)'
      }}>
        <button onClick={onClose} title='Fermer' style={{
          position:'absolute',
          top:10,
          right:10,
          background:'transparent',
          border:'none',
          color:'#d1d5db',
          width:34,
          height:34,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          borderRadius:10,
          cursor:'pointer'
        }}
          onMouseOver={e=>{ e.currentTarget.style.background='#262c33'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; }}
        >
          <FiX size={18} />
        </button>
        <h3 style={{
          margin:0,
          fontSize:15,
          fontWeight:600,
          letterSpacing:.6,
          color:'#f1f5f9',
          textTransform:'uppercase'
        }}>Importer un dépôt GitHub</h3>
        <div style={{width:'100%', marginTop:18, display:'flex', justifyContent:'center'}}>
          <input
            type='text'
            autoFocus
            value={value}
            placeholder='ex: https://github.com/blender/blender'
            onChange={e=>{ setError(null); onChange(e.target.value); }}
            onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape') onClose(); }}
            style={{
              width:'90%',
              background:'#0f1419',
              border:'1px solid '+(error?'#b91c1c':'#30363d'),
              color:'#e2e8f0',
              fontSize:15,
              padding:'12px 14px',
              borderRadius:14,
              outline:'none',
              boxShadow: error? '0 0 0 1px #b91c1c' : '0 2px 4px rgba(0,0,0,0.25)',
              transition:'border-color .18s, background .18s, box-shadow .18s'
            }}
            onFocus={e=>{ e.currentTarget.style.borderColor= error? '#b91c1c':'#3d4650'; }}
            onBlur={e=>{ e.currentTarget.style.borderColor= error? '#b91c1c':'#30363d'; }}
          />
        </div>
        {error && <div style={{color:'#ef4444', fontSize:12, fontWeight:500, marginTop:6}}>{error}</div>}
        <button onClick={submit} disabled={!canSubmit} style={{
          marginTop:24,
          minWidth:170,
          background: canSubmit ? 'linear-gradient(90deg,#334155,#475569)' : '#2a3138',
          border:'1px solid #3a454f',
          color:'#fff',
          fontSize:14,
          fontWeight:600,
          letterSpacing:.5,
          padding:'11px 0',
          borderRadius:14,
          cursor: canSubmit ? 'pointer':'not-allowed',
          boxShadow: canSubmit ? '0 4px 14px -6px rgba(0,0,0,0.55)' : 'none',
          transition:'background .22s, transform .15s'
        }}
          onMouseOver={e=>{ if(canSubmit) e.currentTarget.style.background='linear-gradient(90deg,#3b4a5a,#526174)'; }}
          onMouseOut={e=>{ if(canSubmit) e.currentTarget.style.background='linear-gradient(90deg,#334155,#475569)'; }}
        >Valider</button>
      </div>
    </div>
  );
};


// Ajout des props pour navigation
type NavbarProps = {
  onHome?: () => void;
  onSettings?: () => void;
  onSelectRepo?: (repo:{ name:string; link:string }) => void;
  onSearchExtensions?: (query: string) => void;
  onOpenWeb?: (url: string) => void;
  onOpenCloneBuild?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  isOnWebPage?: boolean;
  onWebHome?: () => void;
  onClearWebHistory?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ onHome, onSettings, onSelectRepo, onSearchExtensions, onOpenWeb, onOpenCloneBuild, canGoBack, canGoForward, onBack, onForward, isOnWebPage, onWebHome, onClearWebHistory }) => {
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

  // Search state (repos + extensions)
  const [searchQuery, setSearchQuery] = React.useState('');
  const [repoList, setRepoList] = React.useState<{ name:string; link:string; avatar?:string }[]>([]);
  const [extensionResults, setExtensionResults] = React.useState<{title:string;href:string;thumb?:string;author?:string;rating?:string;downloads?:string}[]>([]);
  const [loadingExtensions, setLoadingExtensions] = React.useState(false);
  
  React.useEffect(()=>{
    try {
      const data = require('./locales/link.json');
      if (data?.repository) {
        // Derive avatar URL without hitting API (pattern github.com/<user>.png) to save rate limit.
        const enriched = data.repository.map((r:any)=>{
          const ownerMatch = r.link.match(/github.com\/([^/]+)/);
            const owner = ownerMatch? ownerMatch[1]:'';
            return { ...r, avatar: owner ? `https://github.com/${owner}.png?size=64` : undefined };
        });
        setRepoList(enriched);
      }
    } catch(e){ console.warn('Chargement link.json échoué', e); }
  },[]);
  
  // Search extensions dynamically as user types
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setExtensionResults([]);
      setLoadingExtensions(false);
      return;
    }
    setLoadingExtensions(true);
    const timeout = setTimeout(async () => {
      try {
        const api: any = (window as any).electronAPI;
        if (!api) { setLoadingExtensions(false); return; }
        const res = await (api.searchExtensions ? api.searchExtensions(searchQuery) : api.invoke('extensions-search', searchQuery));
        const html = res?.html || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const items: {title:string;href:string;thumb?:string;author?:string;rating?:string;downloads?:string}[] = [];
        const cardItems = Array.from(doc.querySelectorAll('.cards-item'));
        for (const card of cardItems) {
          const mainLink = card.querySelector('a[href*="/add-ons/"]');
          if (!mainLink) continue;
          const href = mainLink.getAttribute('href') || '';
          if (!href) continue;
          const titleEl = card.querySelector('h3.cards-item-title a, h3.cards-item-title');
          const title = titleEl?.textContent?.trim() || 'Extension';
          const img = card.querySelector('.cards-item-thumbnail img');
          let thumb = img ? (img.getAttribute('src') || '') : '';
          // Make thumbnail URL absolute
          if (thumb && !thumb.startsWith('http')) {
            thumb = thumb.startsWith('/') ? `https://extensions.blender.org${thumb}` : `https://extensions.blender.org/${thumb}`;
          }
          const authorLink = card.querySelector('.cards-item-extra ul li a[href*="/author/"], .cards-item-extra ul li a[href*="/team/"]');
          const author = authorLink?.textContent?.trim() || '';
          
          // Extract rating
          const ratingEl = card.querySelector('.rating-average, [class*="rating"]');
          let rating = '';
          if (ratingEl) {
            const ratingText = ratingEl.textContent?.trim() || '';
            const stars = card.querySelectorAll('.icon-star-full, .fa-star');
            if (stars.length > 0) {
              rating = `${stars.length}/5`;
            } else if (ratingText.match(/\d/)) {
              rating = ratingText;
            }
          }
          
          // Extract downloads
          const downloadsEl = card.querySelector('.extension-download-count, [class*="download"]');
          let downloads = '';
          if (downloadsEl) {
            const text = downloadsEl.textContent?.trim() || '';
            const match = text.match(/[\d.]+[KMk]?/);
            if (match) downloads = match[0];
          }
          if (!downloads) {
            const dlIcon = card.querySelector('.icon-download, .fa-download');
            if (dlIcon) {
              const parent = dlIcon.parentElement;
              const text = parent?.textContent?.trim() || '';
              const match = text.match(/[\d.]+[KMk]?/);
              if (match) downloads = match[0];
            }
          }
          
          const full = href.startsWith('http') ? href : ('https://extensions.blender.org' + href);
          if (!items.find(x => x.href === full)) items.push({ title, href: full, thumb, author, rating, downloads });
          if (items.length >= 8) break;
        }
        setExtensionResults(items);
      } catch (e) {
        setExtensionResults([]);
      } finally {
        setLoadingExtensions(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

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
          {/* Back/Forward */}
          <div style={{ display:'flex', gap:6 }} className="no-drag">
            <button
              style={{ ...iconBtnStyle, width:34, height:34, opacity: canGoBack ? 1 : 0.4 }}
              title="Précédent"
              disabled={!canGoBack}
              onClick={() => { if (canGoBack && onBack) onBack(); }}
            >
              <FiChevronLeft size={18} />
            </button>
            <button
              style={{ ...iconBtnStyle, width:34, height:34, opacity: canGoForward ? 1 : 0.4 }}
              title="Suivant"
              disabled={!canGoForward}
              onClick={() => { if (canGoForward && onForward) onForward(); }}
            >
              <FiChevronRight size={18} />
            </button>
          </div>
          {/* removed web quick controls per user request */}
        </div>
  <div style={{ position:'relative', flex:1, margin:'0 24px', minWidth:260, display:'flex', gap:8 }} className="no-drag">
          <input
            type="text"
            placeholder="Rechercher builds et extensions..."
            value={searchQuery}
            onChange={e=> setSearchQuery(e.target.value)}
            onKeyDown={e=> { 
              if(e.key === 'Escape') setSearchQuery('');
              if(e.key === 'Enter' && searchQuery.trim() && onSearchExtensions) {
                onSearchExtensions(searchQuery.trim());
                setSearchQuery('');
              }
            }}
            style={{
              flex:1,
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
          {searchQuery && (
            <div style={{ position:'absolute', top:40, left:0, right:0, background:'#1f242b', border:'1px solid #2a3036', borderRadius:12, padding:8, display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto', zIndex:500 }}>
              {/* Custom Builds Section */}
              {repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:0.5, padding:'4px 8px' }}>Custom Builds</div>
                  {repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(r=> (
                    <div key={r.link} onClick={()=>{ setSearchQuery(''); onSelectRepo && onSelectRepo(r); }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'#232a31', border:'1px solid #2a3036', borderRadius:8, cursor:'pointer', fontSize:14, color:'#fff' }}
                      onMouseOver={e=>{ e.currentTarget.style.background='#2b333b'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='#232a31'; }}>
                        {r.avatar ? <img src={r.avatar} style={{ width:26, height:26, borderRadius:'50%', display:'block' }} /> : <span style={{ width:26, height:26, borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{r.name.charAt(0)}</span>}
                        <span style={{ fontWeight:500 }}>{r.name}</span>
                    </div>
                  ))}
                </>
              )}
              
              {/* Extensions Section */}
              {(loadingExtensions || extensionResults.length > 0) && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:0.5, padding:'4px 8px', marginTop: repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? 4 : 0 }}>Extensions</div>
                  {loadingExtensions && <div style={{ fontSize:12, color:'#94a3b8', padding:'4px 8px' }}>Chargement...</div>}
                  {!loadingExtensions && extensionResults.map((ext, i) => (
                    <div key={i} onClick={()=>{ 
                      setSearchQuery('');
                      if(onOpenWeb) {
                        onOpenWeb(ext.href);
                      } else {
                        try { 
                          if((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(ext.href); 
                          else window.open(ext.href, '_blank'); 
                        } catch {} 
                      }
                    }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'#232a31', border:'1px solid #2a3036', borderRadius:8, cursor:'pointer', fontSize:14, color:'#fff' }}
                      onMouseOver={e=>{ e.currentTarget.style.background='#2b333b'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='#232a31'; }}>
                        {ext.thumb ? <img src={ext.thumb} style={{ width:40, height:26, borderRadius:4, objectFit:'cover' }} alt="" /> : <span style={{ width:40, height:26, borderRadius:4, background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>📦</span>}
                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
                          <span style={{ fontWeight:500, fontSize:13 }}>{ext.title}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {ext.author && <span style={{ fontSize:11, color:'#94a3b8' }}>{ext.author}</span>}
                            {ext.rating && (
                              <span style={{ fontSize:10, color:'#fbbf24', display:'flex', alignItems:'center', gap:2 }}>
                                ⭐ {ext.rating}
                              </span>
                            )}
                            {ext.downloads && (
                              <span style={{ fontSize:10, color:'#64748b', display:'flex', alignItems:'center', gap:2 }}>
                                ⬇ {ext.downloads}
                              </span>
                            )}
                          </div>
                        </div>
                    </div>
                  ))}
                </>
              )}
              
              {/* No Results */}
              {!loadingExtensions && repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length===0 && extensionResults.length===0 && (
                <div style={{ fontSize:12, color:'#94a3b8', padding:'4px 8px' }}>Aucun résultat</div>
              )}
              
              {/* Press Enter hint */}
              {searchQuery.trim() && (
                <div style={{ fontSize:11, color:'#64748b', padding:'6px 8px', borderTop:'1px solid #2a3036', marginTop:4, textAlign:'center' }}>
                  Appuyez sur <strong style={{ color:'#94a3b8' }}>Entrée</strong> pour voir tous les résultats sur extensions.blender.org
                </div>
              )}
            </div>
          )}
        </div>
        {/* Bouton + (Clone & Build) */}
        <button style={iconBtnStyle} className="no-drag" title="Clone & Build" onClick={onOpenCloneBuild}>
          <FiPlus size={22} />
        </button>
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
            <GitHubImportModal
              value={githubUrl}
              onChange={setGithubUrl}
              onClose={() => { setShowImport(false); setImportMode('main'); setGithubUrl(''); }}
              onValidate={(url) => {
                // Validation + extraction owner/name
                const match = url.trim().match(/https?:\/\/github.com\/(?:#!\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.+)?$/);
                if (!match) return { error: 'Lien GitHub invalide' };
                const owner = match[1];
                const name = match[2];
                if (onSelectRepo) onSelectRepo({ name: `${owner}/${name}`, link: `https://github.com/${owner}/${name}` });
                setShowImport(false);
                setImportMode('main');
                setGithubUrl('');
                return { ok:true };
              }}
            />
          )}
        </div>
      )}
    </>
  );
};

export default Navbar;
