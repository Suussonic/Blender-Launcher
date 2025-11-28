import React, { useEffect, useState } from 'react';

type Item = { title: string; href: string; thumb?: string; author?: string; tags?: string[] };

const ViewExtensionsResults: React.FC<{ query: string; onClose: () => void }> = ({ query, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const api: any = (window as any).electronAPI;
        let res: any = null;
        if (api?.searchExtensions) res = await api.searchExtensions(query);
        else if (api?.invoke) res = await api.invoke('extensions-search', query);
        const html = res?.html || '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const cards: Item[] = [];
        // Look for elements that represent addon cards
        const anchors = Array.from(doc.querySelectorAll('a'));
        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          if (!href.includes('/addon/')) continue;
          let title = '';
          const h = a.querySelector('h3') || a.querySelector('.card-title') || a.querySelector('.title');
          if (h && h.textContent) title = h.textContent.trim();
          if (!title) title = a.textContent ? a.textContent.trim().split('\n')[0].trim() : '';
          const img = a.querySelector('img');
          const thumb = img ? (img.getAttribute('src') || '') : '';
          let author = '';
          const au = a.querySelector('.author') || a.querySelector('.card-author') || a.querySelector('.meta .author');
          if (au && au.textContent) author = au.textContent.trim();
          const tagsEls = Array.from(a.querySelectorAll('.tag, .tags li, .meta .tag'));
          const tags = tagsEls.map(t => (t.textContent || '').trim()).filter(Boolean);
          const full = href.startsWith('http') ? href : ('https://extensions.blender.org' + href);
          if (!cards.find(x => x.href === full)) cards.push({ title: title || full, href: full, thumb, author, tags });
          if (cards.length >= 40) break;
        }
        if (!cancelled) setItems(cards);
      } catch (e: any) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, zIndex: 1500 }}>
      <div style={{ width: '92%', height: '88%', background: '#0b1220', borderRadius: 10, overflow: 'auto', padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>&larr; Fermer</button>
          <h2 style={{ margin: 0, color: '#e6eef8' }}>{loading ? 'Recherche…' : `${items.length} résultats pour "${query}"`}</h2>
          <div style={{ marginLeft: 'auto' }}>
            <a href={`https://extensions.blender.org/search/?q=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Ouvrir sur extensions.blender.org</a>
          </div>
        </div>
        {error && <div style={{ color: '#f87171' }}>Erreur: {error}</div>}
        {!loading && items.length === 0 && <div style={{ color: '#94a3b8' }}>Aucun résultat trouvé.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: '#0f1720', borderRadius: 8, overflow: 'hidden', border: '1px solid #17202a', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 120, background: '#0b0f12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {it.thumb ? <img src={it.thumb} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} alt="thumb" /> : <div style={{ color: '#64748b' }}>No image</div>}
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#e6eef8', fontWeight: 700, fontSize: 15 }}>{it.title}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{it.author || ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{(it.tags || []).slice(0,3).map((t, idx) => (<span key={idx} style={{ background: '#071018', color: '#c7f9d4', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>{t}</span>))}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { try { if ((window as any).electronAPI?.openExternal) (window as any).electronAPI.openExternal(it.href); else window.open(it.href, '_blank'); } catch { try { window.open(it.href, '_blank'); } catch {} } }} style={{ background: '#172a3a', border: 'none', color: '#cbd5e1', padding: '6px 10px', borderRadius: 6 }}>Ouvrir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ViewExtensionsResults;
