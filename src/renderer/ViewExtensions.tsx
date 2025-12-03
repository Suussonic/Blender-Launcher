import * as React from 'react';

interface ViewExtensionsProps {
  query: string;
  onBack: () => void;
}

const ViewExtensions: React.FC<ViewExtensionsProps> = ({ query, onBack }) => {
  const [extensions, setExtensions] = React.useState<{title:string;href:string;thumb?:string;author?:string;tags?:string}[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) return;
    console.log('[ViewExtensions] Recherche pour:', query);
    setLoading(true);
    const fetchData = async () => {
      try {
        const api: any = (window as any).electronAPI;
        if (!api) {
          console.error('[ViewExtensions] electronAPI non disponible');
          setLoading(false);
          return;
        }
        console.log('[ViewExtensions] Appel API extensions-search...');
        const res = await (api.searchExtensions ? api.searchExtensions(query) : api.invoke('extensions-search', query));
        console.log('[ViewExtensions] Réponse reçue:', res);
        const html = res?.html || '';
        console.log('[ViewExtensions] HTML length:', html.length);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const items: {title:string;href:string;thumb?:string;author?:string;tags?:string}[] = [];
        const cardItems = Array.from(doc.querySelectorAll('.cards-item'));
        console.log('[ViewExtensions] Cards trouvées:', cardItems.length);
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
          const tagsList = card.querySelectorAll('.cards-item-tags a');
          const tags = Array.from(tagsList).map(t => t.textContent?.trim() || '').filter(Boolean).join(', ');
          const full = href.startsWith('http') ? href : ('https://extensions.blender.org' + href);
          items.push({ title, href: full, thumb, author, tags });
        }
        console.log('[ViewExtensions] Extensions parsées:', items.length);
        setExtensions(items);
      } catch (e) {
        console.error('[ViewExtensions] Erreur recherche extensions:', e);
        setExtensions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [query]);

  const openExtension = (url: string) => {
    try {
      const api: any = (window as any).electronAPI;
      if (api?.openExternal) api.openExternal(url);
      else window.open(url, '_blank');
    } catch {}
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#1a1d24', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'20px 32px', borderBottom:'1px solid #2a3036', display:'flex', alignItems:'center', gap:16 }}>
        <button onClick={onBack} style={{ background:'#2a3036', border:'none', color:'#fff', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:500 }}>
          ← Retour
        </button>
        <h2 style={{ fontSize:20, fontWeight:600, margin:0 }}>Extensions Blender : "{query}"</h2>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>
        {loading && <div style={{ color:'#94a3b8', fontSize:15 }}>Chargement...</div>}
        {!loading && extensions.length === 0 && (
          <div style={{ color:'#94a3b8', fontSize:15 }}>Aucune extension trouvée pour "{query}"</div>
        )}
        {!loading && extensions.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20 }}>
            {extensions.map((ext, i) => (
              <div key={i} onClick={() => openExtension(ext.href)} style={{ 
                background:'#23272F', 
                border:'1px solid #2a3036', 
                borderRadius:12, 
                overflow:'hidden', 
                cursor:'pointer',
                transition:'all 0.2s',
                display:'flex',
                flexDirection:'column'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#3c4652'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#2a3036'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                {/* Thumbnail */}
                {ext.thumb ? (
                  <img src={ext.thumb} alt={ext.title} style={{ width:'100%', height:160, objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', height:160, background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>📦</div>
                )}
                {/* Info */}
                <div style={{ padding:16, flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  <h3 style={{ fontSize:16, fontWeight:600, margin:0, color:'#fff' }}>{ext.title}</h3>
                  {ext.author && <div style={{ fontSize:13, color:'#94a3b8' }}>Par {ext.author}</div>}
                  {ext.tags && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{ext.tags}</div>}
                  <button style={{ 
                    marginTop:'auto', 
                    padding:'8px 16px', 
                    background:'#2563eb', 
                    border:'none', 
                    borderRadius:6, 
                    color:'#fff', 
                    fontSize:13, 
                    fontWeight:500, 
                    cursor:'pointer',
                    transition:'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#1d4ed8'}
                  onMouseOut={e => e.currentTarget.style.background = '#2563eb'}
                  onClick={(e) => { e.stopPropagation(); openExtension(ext.href); }}>
                    Voir sur extensions.blender.org
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewExtensions;
