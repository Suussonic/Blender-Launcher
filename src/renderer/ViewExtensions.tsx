import * as React from 'react';
import { FiDownload, FiStar } from 'react-icons/fi';

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
  rating?: string;
  downloads?: string;
};

type SortField = 'title' | 'author' | 'type' | 'updated' | 'rating' | 'downloads';
type SortOrder = 'asc' | 'desc';

const parseDownloads = (val: string): number => {
  if (!val) return 0;
  const str = val.trim().toUpperCase();
  const match = str.match(/^([\d.]+)\s*([KM])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2];
  return unit === 'M' ? num * 1000000 : unit === 'K' ? num * 1000 : num;
};

const parseRating = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.replace(/\/.*/, '')) || 0;
};

const extractExtensionData = (card: Element): Extension | null => {
  const mainLink = card.querySelector('a[href*="/add-ons/"]');
  if (!mainLink) return null;
  
  const href = mainLink.getAttribute('href') || '';
  if (!href) return null;
  
  const titleEl = card.querySelector('h3.cards-item-title a, h3.cards-item-title');
  const title = titleEl?.textContent?.trim() || 'Extension';
  
  const img = card.querySelector('.cards-item-thumbnail img');
  let thumb = img?.getAttribute('src') || '';
  if (thumb && !thumb.startsWith('http')) {
    thumb = `https://extensions.blender.org${thumb.startsWith('/') ? '' : '/'}${thumb}`;
  }
  
  const authorLink = card.querySelector('.cards-item-extra ul li a[href*="/author/"], .cards-item-extra ul li a[href*="/team/"]');
  const author = authorLink?.textContent?.trim() || '';
  
  const tagsList = card.querySelectorAll('.cards-item-tags a');
  const tagsArray = Array.from(tagsList).map(t => t.textContent?.trim()).filter(Boolean) as string[];
  const tags = tagsArray.join(', ');
  
  const typeKeywords = ['theme', 'add-on', 'addon', 'script', 'preset'];
  const type = tagsArray.find(tag => typeKeywords.some(k => tag.toLowerCase().includes(k))) || 'Add-on';
  
  const versionEl = card.querySelector('.cards-item-version, .version');
  const version = versionEl?.textContent?.trim() || '';
  
  const dateEl = card.querySelector('.cards-item-date, time');
  const updated = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
  
  const licenseEl = card.querySelector('.cards-item-license, .license');
  const license = licenseEl?.textContent?.trim() || '';
  
  const ratingEl = card.querySelector('.rating-average, [class*="rating"]');
  let rating = '';
  if (ratingEl) {
    const ratingText = ratingEl.textContent?.trim() || '';
    const stars = card.querySelectorAll('.icon-star-full, .fa-star');
    rating = stars.length > 0 ? `${stars.length}/5` : (ratingText.match(/\d/) ? ratingText : '');
  }
  
  const downloadsEl = card.querySelector('.extension-download-count, [class*="download"]');
  let downloads = downloadsEl?.textContent?.trim().match(/[\d.]+[KMk]?/)?.[0] || '';
  if (!downloads) {
    const dlIcon = card.querySelector('.icon-download, .fa-download');
    downloads = dlIcon?.parentElement?.textContent?.trim().match(/[\d.]+[KMk]?/)?.[0] || '';
  }
  
  const full = href.startsWith('http') ? href : `https://extensions.blender.org${href}`;
  return { title, href: full, thumb, author, tags, type, version, updated, license, rating, downloads };
};

const ViewExtensions: React.FC<ViewExtensionsProps> = ({ query, onBack, onOpenWeb }) => {
  const [extensions, setExtensions] = React.useState<Extension[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  const [sortField, setSortField] = React.useState<SortField>('title');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('asc');
  const [filterAuthor, setFilterAuthor] = React.useState<string>('all');
  const [searchFilter, setSearchFilter] = React.useState<string>('');

  React.useEffect(() => {
    if (!query.trim()) return;
    
    setLoading(true);
    const fetchData = async () => {
      try {
        const api: any = (window as any).electronAPI;
        if (!api) {
          setLoading(false);
          return;
        }
        
        const res = await (api.searchExtensions?.(query) ?? api.invoke('extensions-search', query));
        const html = res?.html || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const cardItems = doc.querySelectorAll('.cards-item');
        
        const items: Extension[] = [];
        for (const card of cardItems) {
          const ext = extractExtensionData(card);
          if (ext) items.push(ext);
        }
        
        setExtensions(items);
      } catch (e) {
        setExtensions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [query]);

  const filteredExtensions = React.useMemo(() => {
    let filtered = extensions;
    
    if (filterAuthor !== 'all') {
      filtered = filtered.filter(ext => ext.author === filterAuthor);
    }
    
    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(ext => 
        ext.title.toLowerCase().includes(search) || 
        ext.author?.toLowerCase().includes(search) ||
        ext.tags?.toLowerCase().includes(search)
      );
    }
    
    const sorted = [...filtered].sort((a, b) => {
      const valA: any = a[sortField] || '';
      const valB: any = b[sortField] || '';
      
      let comparison = 0;
      
      if (sortField === 'updated') {
        comparison = (new Date(valA).getTime() || 0) - (new Date(valB).getTime() || 0);
      } else if (sortField === 'rating') {
        comparison = parseRating(valA) - parseRating(valB);
      } else if (sortField === 'downloads') {
        comparison = parseDownloads(valA) - parseDownloads(valB);
      } else {
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        comparison = strA < strB ? -1 : strA > strB ? 1 : 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [extensions, sortField, sortOrder, filterAuthor, searchFilter]);

  const uniqueAuthors = React.useMemo(() => 
    Array.from(new Set(extensions.map(e => e.author).filter(Boolean))).sort(),
    [extensions]
  );

  const handleSort = React.useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const openExtension = React.useCallback((url: string) => {
    if (onOpenWeb) {
      onBack();
      onOpenWeb(url);
    } else {
      const api: any = (window as any).electronAPI;
      api?.openExternal?.(url) ?? window.open(url, '_blank');
    }
  }, [onOpenWeb, onBack]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#1a1d24', overflow:'hidden' }}>
      <style>{`.extension-card:hover { border-color: #3c4652 !important; transform: translateY(-4px); }`}</style>
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
            <button
              onClick={() => handleSort('rating')}
              style={{
                background: sortField === 'rating' ? '#2563eb' : '#23272F',
                border:'1px solid #2a3036',
                color:'#fff',
                fontSize:12,
                padding:'6px 12px',
                borderRadius:6,
                cursor:'pointer',
                fontWeight:500
              }}
            >
              Note {sortField === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('downloads')}
              style={{
                background: sortField === 'downloads' ? '#2563eb' : '#23272F',
                border:'1px solid #2a3036',
                color:'#fff',
                fontSize:12,
                padding:'6px 12px',
                borderRadius:6,
                cursor:'pointer',
                fontWeight:500
              }}
            >
              Téléchargements {sortField === 'downloads' && (sortOrder === 'asc' ? '↑' : '↓')}
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
              <div 
                key={ext.href} 
                onClick={() => openExtension(ext.href)} 
                className="extension-card"
                style={{ 
                  background:'#23272F', 
                  border:'1px solid #2a3036', 
                  borderRadius:12, 
                  overflow:'hidden', 
                  cursor:'pointer',
                  transition:'all 0.2s',
                  display:'flex',
                  flexDirection:'column'
                }}
              >
                {ext.thumb ? (
                  <img src={ext.thumb} alt={ext.title} style={{ width:'100%', height:160, objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', height:160, background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>📦</div>
                )}
                <div style={{ padding:16, flex:1, display:'flex', flexDirection:'column', gap:6, position:'relative' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:0.5 }}>ADD-ON</div>
                  <h3 style={{ fontSize:16, fontWeight:600, margin:0, color:'#fff', lineHeight:1.3 }}>{ext.title}</h3>
                  {ext.author && <div style={{ fontSize:13, color:'#94a3b8' }}>{ext.author}</div>}
                  
                  {ext.tags && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
                      {ext.tags.split(',').map((tag, idx) => (
                        <span key={idx} style={{ 
                          fontSize:11, 
                          color:'#94a3b8', 
                          background:'rgba(55, 65, 81, 0.5)', 
                          border:'1px solid #374151',
                          padding:'4px 10px', 
                          borderRadius:6,
                          fontWeight:400
                        }}>
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ marginTop:'auto', paddingTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    {ext.rating && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#fbbf24' }}>
                        <FiStar size={13} fill="#fbbf24" />
                        <span style={{ fontWeight:600 }}>{ext.rating}</span>
                      </div>
                    )}
                    {ext.downloads && (
                      <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b' }}>
                        <FiDownload size={13} />
                        <span>{ext.downloads}</span>
                      </div>
                    )}
                  </div>
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
