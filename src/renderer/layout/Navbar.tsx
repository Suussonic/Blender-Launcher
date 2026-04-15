import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FiHome, FiDownload, FiSettings, FiMinus, FiMaximize2, FiX, FiGithub, FiFolder, FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { AiOutlineInbox, AiOutlineStar, AiOutlineDownload } from 'react-icons/ai';


const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-inverse)',
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
  color: 'var(--text-inverse)',
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

// Inline GitHub import modal.
interface GitHubImportModalProps { value:string; onChange:(v:string)=>void; onClose:()=>void; onValidate:(url:string)=>{ok?:boolean; error?:string}; }

const GitHubImportModal: React.FC<GitHubImportModalProps> = ({ value, onChange, onClose, onValidate }) => {
  const { t } = useTranslation();
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
      background:'var(--shadow-color)'
    }}
      onClick={onClose}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        position:'relative',
        width:420,
        maxWidth:'90vw',
        padding:'36px 34px 34px',
        background:'var(--bg-card)',
        border:'1px solid var(--border-color)',
        borderRadius:24,
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        boxShadow:'0 8px 28px -8px var(--shadow-color), 0 4px 14px -6px var(--shadow-soft)',
        animation:'modalPop .28s cubic-bezier(.4,.12,.25,1)'
      }}>
        <button onClick={onClose} title={t('close', 'Fermer')} style={{
          position:'absolute',
          top:10,
          right:10,
          background:'transparent',
          border:'none',
          color:'var(--text-primary)',
          width:34,
          height:34,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          borderRadius:10,
          cursor:'pointer'
        }}
          onMouseOver={e=>{ e.currentTarget.style.background='var(--bg-card-hover)'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; }}
        >
          <FiX size={18} />
        </button>
        <h3 style={{
          margin:0,
          fontSize:15,
          fontWeight:600,
          letterSpacing:.6,
          color:'var(--text-primary)',
          textTransform:'uppercase'
        }}>{t('import.github_repo', 'Importer un dépôt GitHub')}</h3>
        <div style={{width:'100%', marginTop:18, display:'flex', justifyContent:'center'}}>
          <input
            type='text'
            autoFocus
            value={value}
            placeholder={t('import.github_placeholder', 'ex: https://github.com/blender/blender')}
            onChange={e=>{ setError(null); onChange(e.target.value); }}
            onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape') onClose(); }}
            style={{
              width:'90%',
              background:'var(--bg-card)',
              border:'1px solid '+(error?'var(--danger)':'var(--border-color)'),
              color:'var(--text-primary)',
              fontSize:15,
              padding:'12px 14px',
              borderRadius:14,
              outline:'none',
              boxShadow: error? '0 0 0 1px var(--danger)' : '0 2px 4px var(--shadow-soft)',
              transition:'border-color .18s, background .18s, box-shadow .18s'
            }}
            onFocus={e=>{ e.currentTarget.style.borderColor= error? 'var(--danger)':'var(--border-strong)'; }}
            onBlur={e=>{ e.currentTarget.style.borderColor= error? 'var(--danger)':'var(--border-color)'; }}
          />
        </div>
        {error && <div style={{color:'var(--danger)', fontSize:12, fontWeight:500, marginTop:6}}>{error}</div>}
        <button onClick={submit} disabled={!canSubmit} style={{
          marginTop:24,
          minWidth:170,
          background: canSubmit ? 'linear-gradient(90deg,var(--bg-muted),var(--text-tertiary))' : 'var(--bg-surface-2)',
          border:'1px solid var(--border-strong)',
          color:'var(--text-inverse)',
          fontSize:14,
          fontWeight:600,
          letterSpacing:.5,
          padding:'11px 0',
          borderRadius:14,
          cursor: canSubmit ? 'pointer':'not-allowed',
          boxShadow: canSubmit ? '0 4px 14px -6px var(--shadow-color)' : 'none',
          transition:'background .22s, transform .15s'
        }}
          onMouseOver={e=>{ if(canSubmit) e.currentTarget.style.background='linear-gradient(90deg,var(--bg-card-hover),var(--text-secondary))'; }}
          onMouseOut={e=>{ if(canSubmit) e.currentTarget.style.background='linear-gradient(90deg,var(--bg-muted),var(--text-tertiary))'; }}
        >{t('validate', 'Valider')}</button>
      </div>
    </div>
  );
};


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
};

const Navbar: React.FC<NavbarProps> = ({ onHome, onSettings, onSelectRepo, onSearchExtensions, onOpenWeb, onOpenCloneBuild, canGoBack, canGoForward, onBack, onForward }) => {
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
  const [showImport, setShowImport] = React.useState(false);
  const [importMode, setImportMode] = React.useState<'main' | 'github'>('main');
  const [githubUrl, setGithubUrl] = React.useState('');

  const [searchQuery, setSearchQuery] = React.useState('');
  const [repoList, setRepoList] = React.useState<{ name:string; link:string; avatar?:string }[]>([]);
  const [extensionResults, setExtensionResults] = React.useState<{title:string;href:string;thumb?:string;author?:string;rating?:string;downloads?:string}[]>([]);
  const [loadingExtensions, setLoadingExtensions] = React.useState(false);
  
  React.useEffect(()=>{
    try {
      const data = require('../locales/link.json');
      if (data?.repository) {
        const enriched = data.repository.map((r:any)=>{
          const ownerMatch = r.link.match(/github.com\/([^/]+)/);
            const owner = ownerMatch? ownerMatch[1]:'';
            return { ...r, avatar: owner ? `https://github.com/${owner}.png?size=64` : undefined };
        });
        setRepoList(enriched);
      }
    } catch(e){ console.warn('Chargement link.json échoué', e); }
  },[]);
  
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
        if (!api) { 
          setLoadingExtensions(false); 
          return; 
        }
        
        const res = await (api.searchExtensions?.(searchQuery) ?? api.invoke('extensions-search', searchQuery));
        const html = res?.html || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const cardItems = doc.querySelectorAll('.cards-item');
        
        const items: {title:string;href:string;thumb?:string;author?:string;rating?:string;downloads?:string}[] = [];
        const seenHrefs = new Set<string>();
        
        for (const card of cardItems) {
          if (items.length >= 8) break;
          
          const mainLink = card.querySelector('a[href*="/add-ons/"], a[href*="/themes/"]');
          const href = mainLink?.getAttribute('href');
          if (!href) continue;
          
          const full = href.startsWith('http') ? href : `https://extensions.blender.org${href}`;
          if (seenHrefs.has(full)) continue;
          seenHrefs.add(full);
          
          const titleEl = card.querySelector('h3.cards-item-title a, h3.cards-item-title');
          const title = titleEl?.textContent?.trim() || 'Extension';
          
          const img = card.querySelector('.cards-item-thumbnail img');
          let thumb = img?.getAttribute('src') || '';
          if (thumb && !thumb.startsWith('http')) {
            thumb = `https://extensions.blender.org${thumb.startsWith('/') ? '' : '/'}${thumb}`;
          }
          
          const authorLink = card.querySelector('.cards-item-extra ul li a[href*="/author/"], .cards-item-extra ul li a[href*="/team/"]');
          const author = authorLink?.textContent?.trim() || '';
          
          const ratingEl = card.querySelector('.rating-average, [class*="rating"]');
          let rating = '';
          if (ratingEl) {
            const stars = card.querySelectorAll('.icon-star-full, .fa-star');
            rating = stars.length > 0 ? `${stars.length}/5` : (ratingEl.textContent?.trim().match(/\d/) ? ratingEl.textContent.trim() : '');
          }
          
          const downloadsEl = card.querySelector('.extension-download-count, [class*="download"]');
          let downloads = downloadsEl?.textContent?.trim().match(/[\d.]+[KMk]?/)?.[0] || '';
          if (!downloads) {
            const dlIcon = card.querySelector('.icon-download, .fa-download');
            downloads = dlIcon?.parentElement?.textContent?.trim().match(/[\d.]+[KMk]?/)?.[0] || '';
          }
          
          items.push({ title, href: full, thumb, author, rating, downloads });
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
          background: 'var(--bg-primary, var(--bg-primary))',
          boxShadow: '0 2px 8px var(--shadow-soft)',
          padding: 0,
          gap: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 200,
          borderTopLeftRadius: 0,
          transition: 'background 0.3s',
          borderTopRightRadius: 0,
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:16, marginRight:20, flexShrink:0 }} className='no-drag'>
          <img src={"./public/logo/png/Blender-Launcher-512x512.png"} alt="Logo" style={{ width:32, height:32 }} />
          <span style={{ fontWeight:700, fontSize:22, color:'var(--text-inverse)', letterSpacing:1, whiteSpace:'nowrap' }}>Blender Launcher</span>
          <button style={{ ...iconBtnStyle, width:38, height:38 }} title={t('home', 'Accueil')} onClick={onHome}>
            <FiHome size={22} />
          </button>
          <div style={{ display:'flex', gap:6 }} className="no-drag">
            <button
              style={{ ...iconBtnStyle, width:34, height:34, opacity: canGoBack ? 1 : 0.4 }}
              title={t('previous', 'Précédent')}
              disabled={!canGoBack}
              onClick={() => { if (canGoBack && onBack) onBack(); }}
            >
              <FiChevronLeft size={18} />
            </button>
            <button
              style={{ ...iconBtnStyle, width:34, height:34, opacity: canGoForward ? 1 : 0.4 }}
              title={t('next', 'Suivant')}
              disabled={!canGoForward}
              onClick={() => { if (canGoForward && onForward) onForward(); }}
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        </div>
  <div style={{ position:'relative', flex:1, margin:'0 24px', minWidth:260, display:'flex', gap:8 }} className="no-drag">
          <input
            type="text"
            placeholder={t('search.builds_extensions', 'Rechercher builds et extensions...')}
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
              border:'1px solid var(--bg-card)',
              background:'var(--bg-card)',
              color:'var(--text-inverse)',
              fontSize:15,
              padding:'0 18px',
              outline:'none',
              transition:'border-color .15s, background .15s'
            }}
            onFocus={e=>{ e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='var(--bg-card-hover)'; }}
            onBlur={e=>{ e.currentTarget.style.borderColor='var(--bg-card)'; e.currentTarget.style.background='var(--bg-card)'; }}
          />
          {searchQuery && (
            <div style={{ position:'absolute', top:40, left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:12, padding:8, display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto', zIndex:500 }}>
              {repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:0.5, padding:'4px 8px' }}>{t('custom_builds', 'Custom Builds')}</div>
                  {repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(r=> (
                    <div key={r.link} onClick={()=>{ setSearchQuery(''); onSelectRepo && onSelectRepo(r); }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'var(--bg-surface-1)', border:'1px solid var(--border-color)', borderRadius:8, cursor:'pointer', fontSize:14, color:'var(--text-inverse)' }}
                      onMouseOver={e=>{ e.currentTarget.style.background='var(--bg-card-hover)'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='var(--bg-surface-1)'; }}>
                        {r.avatar ? <img src={r.avatar} style={{ width:26, height:26, borderRadius:'50%', display:'block' }} /> : <span style={{ width:26, height:26, borderRadius:'50%', background:'var(--bg-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{r.name.charAt(0)}</span>}
                        <span style={{ fontWeight:500 }}>{r.name}</span>
                    </div>
                  ))}
                </>
              )}
              
              {(loadingExtensions || extensionResults.length > 0) && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:0.5, padding:'4px 8px', marginTop: repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? 4 : 0 }}>{t('extensions', 'Extensions')}</div>
                  {loadingExtensions && <div style={{ fontSize:12, color:'var(--text-secondary)', padding:'4px 8px' }}>{t('loading', 'Chargement...')}</div>}
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
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'var(--bg-surface-1)', border:'1px solid var(--border-color)', borderRadius:8, cursor:'pointer', fontSize:14, color:'var(--text-inverse)' }}
                      onMouseOver={e=>{ e.currentTarget.style.background='var(--bg-card-hover)'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='var(--bg-surface-1)'; }}>
                        {ext.thumb ? <img src={ext.thumb} style={{ width:40, height:26, borderRadius:4, objectFit:'cover' }} alt="" /> : <span style={{ width:40, height:26, borderRadius:4, background:'var(--bg-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'var(--text-secondary)' }}><AiOutlineInbox /></span>}
                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
                          <span style={{ fontWeight:500, fontSize:13 }}>{ext.title}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            {ext.author && <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{ext.author}</span>}
                            {ext.rating && (
                              <span style={{ fontSize:10, color:'var(--text-warning)', display:'flex', alignItems:'center', gap:2 }}>
                                <AiOutlineStar style={{ verticalAlign:'middle', marginRight:2 }} /> {ext.rating}
                              </span>
                            )}
                            {ext.downloads && (
                              <span style={{ fontSize:10, color:'var(--text-tertiary)', display:'flex', alignItems:'center', gap:2 }}>
                                <AiOutlineDownload style={{ verticalAlign:'middle', marginRight:2 }} /> {ext.downloads}
                              </span>
                            )}
                          </div>
                        </div>
                    </div>
                  ))}
                </>
              )}
              
              {!loadingExtensions && repoList.filter(r=> r.name.toLowerCase().includes(searchQuery.toLowerCase())).length===0 && extensionResults.length===0 && (
                <div style={{ fontSize:12, color:'var(--text-secondary)', padding:'4px 8px' }}>{t('no_result', 'Aucun résultat')}</div>
              )}
              
              {searchQuery.trim() && (
                <div style={{ fontSize:11, color:'var(--text-tertiary)', padding:'6px 8px', borderTop:'1px solid var(--border-color)', marginTop:4, textAlign:'center' }}>
                  {t('press_enter_for_all_results', 'Appuyez sur')} <strong style={{ color:'var(--text-secondary)' }}>{t('enter', 'Entrée')}</strong> {t('to_see_all_results_extensions', 'pour voir tous les résultats sur extensions.blender.org')}
                </div>
              )}
            </div>
          )}
        </div>
        <button style={iconBtnStyle} className="no-drag" title={t('clone_build', 'Clone & Build')} onClick={onOpenCloneBuild}>
          <FiPlus size={22} />
        </button>
        <button style={iconBtnStyle} className="no-drag" title={t('import', 'Importer')} onClick={() => setShowImport(true)}>
          <FiDownload size={22} />
        </button>
        <button style={iconBtnStyle} className="no-drag" title={t('settings', 'Paramètres')} onClick={onSettings}>
          <FiSettings size={22} />
        </button>
        <div style={{ width: 1, height: 32, background: 'var(--bg-card)', margin: '0 8px 0 16px' }} />
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', height: 56 }}>
          <button
            style={{ ...windowBtnStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            className="no-drag"
            title={t('window.minimize', 'Minimiser')}
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
            title={t('window.maximize', 'Plein écran')}
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.send('maximize-window');
              }
            }}
          >
            <FiMaximize2 size={18} />
          </button>

          <button
            style={{ ...windowBtnStyle, color: 'var(--text-danger)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, display: 'flex', marginRight: 10 }}
            className="no-drag"
            title={t('close', 'Fermer')}
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
      {showImport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'var(--shadow-soft)',
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
          {importMode === 'main' && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 24,
              boxShadow: '0 4px 32px var(--shadow-soft)',
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
                  background: 'var(--bg-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  borderRight: '2px solid var(--border-color)',
                  outline: 'none',
                  height: '100%',
                }}
                title={t('import.from_github', 'Importer depuis GitHub')}
                onClick={() => setImportMode('github')}
              >
                <FiGithub size={80} />
                <span style={{ marginTop: 24, fontSize: 24, fontWeight: 600 }}>GitHub</span>
              </button>
              <button
                style={{
                  flex: 1,
                  background: 'var(--bg-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
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
                title={t('import.from_folder', 'Importer depuis un dossier')}
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
                  color: 'var(--text-inverse)',
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
                title={t('close', 'Fermer')}
              >
                <FiX size={28} />
              </button>
            </div>
          )}
          {importMode === 'github' && (
            <GitHubImportModal
              value={githubUrl}
              onChange={setGithubUrl}
              onClose={() => { setShowImport(false); setImportMode('main'); setGithubUrl(''); }}
              onValidate={(url) => {
                const match = url.trim().match(/https?:\/\/github.com\/(?:#!\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.+)?$/);
                if (!match) return { error: t('import.invalid_github_link', 'Lien GitHub invalide') };
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




