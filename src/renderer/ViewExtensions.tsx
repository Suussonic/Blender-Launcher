import * as React from 'react';

interface ViewExtensionsProps {
  query: string;
  onBack: () => void;
  onOpenWeb?: (url: string) => void;
}

type Extension = {
  title: string;
  href: string;
  thumb?: string;
  author?: string;
  tags?: string;
  type?: string;
  license?: string;
  version?: string;
  updated?: string;
};

type SortField = 'title' | 'author' | 'type' | 'updated';
type SortOrder = 'asc' | 'desc';

const ViewExtensions: React.FC<ViewExtensionsProps> = ({ query, onBack, onOpenWeb }) => {
  const [extensions, setExtensions] = React.useState<Extension[]>([]);
  const [filteredExtensions, setFilteredExtensions] = React.useState<Extension[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Filter & Sort states
  const [sortField, setSortField] = React.useState<SortField>('title');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('asc');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filterAuthor, setFilterAuthor] = React.useState<string>('all');
  const [searchFilter, setSearchFilter] = React.useState<string>('');

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
        const items: Extension[] = [];
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
          const tagsArray = Array.from(tagsList).map(t => t.textContent?.trim() || '').filter(Boolean);
          const tags = tagsArray.join(', ');
          
          // Extract type from tags (common categories: Add-on, Theme, etc.)
          let type = 'Add-on';
          const typeKeywords = ['theme', 'add-on', 'addon', 'script', 'preset'];
          for (const tag of tagsArray) {
            const lower = tag.toLowerCase();
            if (typeKeywords.some(k => lower.includes(k))) {
              type = tag;
              break;
            }
          }
          
          // Try to extract version and update date from card
          const versionEl = card.querySelector('.cards-item-version, .version');
          const version = versionEl?.textContent?.trim() || '';
          
          const dateEl = card.querySelector('.cards-item-date, time');
          const updated = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          
          const licenseEl = card.querySelector('.cards-item-license, .license');
          const license = licenseEl?.textContent?.trim() || '';
          
          const full = href.startsWith('http') ? href : ('https://extensions.blender.org' + href);
          items.push({ title, href: full, thumb, author, tags, type, version, updated, license });
        }
        console.log('[ViewExtensions] Extensions parsées:', items.length);
        setExtensions(items);
        setFilteredExtensions(items);
      } catch (e) {
        console.error('[ViewExtensions] Erreur recherche extensions:', e);
        setExtensions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [query]);

  // Apply filters and sorting
  React.useEffect(() => {
    let filtered = [...extensions];
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(ext => ext.type?.toLowerCase().includes(filterType.toLowerCase()));
    }
    
    // Filter by author
    if (filterAuthor !== 'all') {
      filtered = filtered.filter(ext => ext.author === filterAuthor);
    }
    
    // Filter by search text
    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(ext => 
        ext.title.toLowerCase().includes(search) || 
        ext.author?.toLowerCase().includes(search) ||
        ext.tags?.toLowerCase().includes(search)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';
      
      if (sortField === 'updated') {
        // Try to parse dates
        const dateA = new Date(valA).getTime() || 0;
        const dateB = new Date(valB).getTime() || 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      // String comparison
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredExtensions(filtered);
  }, [extensions, sortField, sortOrder, filterType, filterAuthor, searchFilter]);

  // Get unique types and authors
  const uniqueTypes = React.useMemo(() => {
    const types = new Set(extensions.map(e => e.type).filter(Boolean));
    return Array.from(types).sort();
  }, [extensions]);

  const uniqueAuthors = React.useMemo(() => {
    const authors = new Set(extensions.map(e => e.author).filter(Boolean));
    return Array.from(authors).sort();
  }, [extensions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const openExtension = (url: string) => {
    console.log('[ViewExtensions] Opening extension:', url);
    console.log('[ViewExtensions] onOpenWeb defined?', !!onOpenWeb);
    if (onOpenWeb) {
      console.log('[ViewExtensions] Calling onOpenWeb with:', url);
      onBack(); // Close ViewExtensions first
      onOpenWeb(url);
    } else {
      console.log('[ViewExtensions] Using external browser');
      try {
        const api: any = (window as any).electronAPI;
        if (api?.openExternal) api.openExternal(url);
        else window.open(url, '_blank');
      } catch (e) {
        console.error('[ViewExtensions] Error opening external:', e);
      }
    }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#1a1d24', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'20px 32px', borderBottom:'1px solid #2a3036' }}>
        <h2 style={{ fontSize:20, fontWeight:600, margin:0, marginBottom:16 }}>Extensions Blender : "{query}"</h2>
        
        {/* Filters and Sort */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          {/* Search filter */}
          <input
            type="text"
            placeholder="Filtrer par nom ou auteur"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            style={{
              flex:'1 1 220px',
              minWidth:220,
              background:'#23272F',
              border:'1px solid #2a3036',
              color:'#fff',
              fontSize:13,
              padding:'7px 12px',
              borderRadius:6,
              outline:'none'
            }}
          />
          
          {/* Author filter */}
          <select
            value={filterAuthor}
            onChange={e => setFilterAuthor(e.target.value)}
            style={{
              background:'#23272F',
              border:'1px solid #2a3036',
              color:'#fff',
              fontSize:13,
              padding:'7px 12px',
              borderRadius:6,
              outline:'none',
              cursor:'pointer',
              maxWidth:180
            }}
          >
            <option value="all">Tous les auteurs</option>
            {uniqueAuthors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          
          {/* Sort buttons */}
          <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
            <button
              onClick={() => handleSort('title')}
              style={{
                background: sortField === 'title' ? '#2563eb' : '#23272F',
                border:'1px solid #2a3036',
                color:'#fff',
                fontSize:12,
                padding:'6px 12px',
                borderRadius:6,
                cursor:'pointer',
                fontWeight:500
              }}
            >
              Nom {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('author')}
              style={{
                background: sortField === 'author' ? '#2563eb' : '#23272F',
                border:'1px solid #2a3036',
                color:'#fff',
                fontSize:12,
                padding:'6px 12px',
                borderRadius:6,
                cursor:'pointer',
                fontWeight:500
              }}
            >
              Auteur {sortField === 'author' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
        
        {/* Results count */}
        <div style={{ marginTop:12, fontSize:13, color:'#64748b' }}>
          {filteredExtensions.length} résultat{filteredExtensions.length > 1 ? 's' : ''} 
          {filteredExtensions.length !== extensions.length && ` sur ${extensions.length}`}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>
        {loading && <div style={{ color:'#94a3b8', fontSize:15 }}>Chargement...</div>}
        {!loading && extensions.length === 0 && (
          <div style={{ color:'#94a3b8', fontSize:15 }}>Aucune extension trouvée pour "{query}"</div>
        )}
        {!loading && filteredExtensions.length === 0 && extensions.length > 0 && (
          <div style={{ color:'#94a3b8', fontSize:15 }}>Aucune extension ne correspond aux filtres sélectionnés</div>
        )}
        {!loading && filteredExtensions.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20 }}>
            {filteredExtensions.map((ext, i) => (
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
