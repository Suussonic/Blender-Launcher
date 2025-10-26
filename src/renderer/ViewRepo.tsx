import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import './markdown.css';
import { loadRepoCache, saveRepoCache, needsMeta, needsReadme, needsLicense, needsExtra } from './githubCache';
import ViewClone from './ViewClone';

export interface SimpleRepoRef { name: string; link: string; }
interface ViewRepoProps { 
  repo: SimpleRepoRef; 
  onBack?: () => void; 
  onCloneStateChange?: (state: { isCloning: boolean; progress: number; text: string; repoName?: string; } | null) => void;
}

interface RepoMeta { full_name:string; description:string; owner:{ avatar_url:string; login:string }; stargazers_count:number; forks_count:number; html_url:string; watchers_count?:number; subscribers_count?:number; }

const ViewRepo: React.FC<ViewRepoProps> = ({ repo, onCloneStateChange }) => {
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [readmeHtml, setReadmeHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenseHtml, setLicenseHtml] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'readme' | 'license'>('readme');
  const [extraStats, setExtraStats] = useState<{ branches:number; commits:number; tags:number } | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const m = repo.link.match(/github.com\/(.+?)\/(.+?)(?:$|\?|#|\/)/i);
        if(!m) throw new Error('Lien GitHub invalide');
        const owner = m[1]; const name = m[2];
        const full = owner+"/"+name;

        const cache = loadRepoCache(full);
        if (cache) {
          if (cache.meta) setMeta(cache.meta);
          if (cache.readmeHtml) setReadmeHtml(cache.readmeHtml);
            if (cache.licenseHtml) setLicenseHtml(cache.licenseHtml);
          if (cache.extraStats) setExtraStats(cache.extraStats);
          // If everything fresh, we can early exit updating loading state later
          if (!needsMeta(cache) && !needsReadme(cache) && !needsLicense(cache) && !needsExtra(cache)) {
            setLoading(false);
            return;
          }
        }

        // Prepare fetch promises conditionally
        const tasks: Promise<void>[] = [];

        if (!cache || needsMeta(cache)) {
          tasks.push((async()=>{
            const resp = await fetch(`https://api.github.com/repos/${owner}/${name}`);
            if (!resp.ok) throw new Error('Impossible de charger les métadonnées');
            const js = await resp.json();
            if(cancelled) return; setMeta(js); saveRepoCache(full,{ meta:js, tsMeta:Date.now() });
          })());
        }

        if (!cache || needsExtra(cache)) {
          tasks.push((async()=>{
            try {
              const [branchesRes, commitsRes, tagsRes] = await Promise.all([
                fetch(`https://api.github.com/repos/${owner}/${name}/branches?per_page=1`),
                fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=1`),
                fetch(`https://api.github.com/repos/${owner}/${name}/tags?per_page=1`)
              ]);
              const parseTotal = (res:Response) => {
                const link = res.headers.get('Link');
                if (link) { const m2 = link.match(/&page=(\d+)>; rel="last"/); if (m2) return parseInt(m2[1]); }
                return res.ok ? 1 : 0;
              };
              const stats = { branches:parseTotal(branchesRes), commits:parseTotal(commitsRes), tags:parseTotal(tagsRes)};
              if(!cancelled){ setExtraStats(stats); saveRepoCache(full,{ extraStats:stats, tsExtra:Date.now() }); }
            } catch {}
          })());
        }

        if (!cache || needsReadme(cache)) {
          tasks.push((async()=>{
            try {
              const readmeResp = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/README.md`);
              if (readmeResp.ok) {
                const md = await readmeResp.text();
                const html = await marked.parse(md);
                if(!cancelled){ setReadmeHtml(html as string); saveRepoCache(full,{ readmeHtml: html as string, tsReadme:Date.now() }); }
              } else {
                const apiReadme = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`);
                if (apiReadme.ok) {
                  const jr:any = await apiReadme.json();
                  if (jr.content) {
                    const decoded = atob(jr.content.replace(/\n/g,''));
                    const html = await marked.parse(decoded);
                    if(!cancelled){ setReadmeHtml(html as string); saveRepoCache(full,{ readmeHtml: html as string, tsReadme:Date.now() }); }
                  }
                }
              }
            } catch {}
          })());
        }

        if (!cache || needsLicense(cache)) {
          tasks.push((async()=>{
            try {
              const candidates = ['LICENSE','LICENSE.txt','LICENSE.md','COPYING','COPYING.txt','COPYING.md'];
              let found='';
              for (const file of candidates) {
                if (found) break;
                try {
                  const resp = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/${file}`);
                  if (resp.ok) { found = await resp.text(); break; }
                } catch {}
              }
              if(!found){
                try {
                  const apiLic = await fetch(`https://api.github.com/repos/${owner}/${name}/license`);
                  if (apiLic.ok) {
                    const jr:any = await apiLic.json();
                    if (jr?.content) found = atob(jr.content.replace(/\n/g,''));
                  }
                } catch {}
              }
              if(found && !cancelled){
                const licHtml = await marked.parse('```\n'+found+'\n```');
                setLicenseHtml(licHtml as string); saveRepoCache(full,{ licenseHtml: licHtml as string, tsLicense:Date.now() });
              }
            } catch {}
          })());
        }

        await Promise.all(tasks);
      } catch(e:any){
        if(!cancelled) setError(e.message || 'Erreur inconnue');
      } finally {
        if(!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [repo.link]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#0F1419', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:28, padding:'20px 32px 0 32px', background:'#0F1419' }}>
        {meta && <img src={meta.owner.avatar_url} alt="avatar" style={{ width:84, height:84, borderRadius:'50%', flexShrink:0, boxShadow:'0 0 0 2px #1e242a' }} />}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
          <h1 style={{ fontSize:34, fontWeight:700, margin:0, color:'#fff', wordBreak:'break-word' }}>{ meta?.full_name || repo.link.split('/').slice(-2).join('/') }</h1>
          <p style={{ fontSize:14, color:'#94a3b8', margin:0, lineHeight:1.5 }}>{ meta?.description || 'Aucune description.' }</p>
          {meta && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:18, fontSize:12, color:'#94a3b8', alignItems:'center' }}>
              <span>★ {meta.stargazers_count}</span>
              <span>⑂ {meta.forks_count}</span>
              <span>👁 {meta.subscribers_count ?? meta.watchers_count ?? 0}</span>
              {extraStats && <span>Branches {extraStats.branches}</span>}
              {extraStats && <span>Commits ~{extraStats.commits}</span>}
              {extraStats && <span>Tags {extraStats.tags}</span>}
              <a href={meta.html_url} style={{ color:'#38bdf8', textDecoration:'none' }} onMouseOver={e=>e.currentTarget.style.textDecoration='underline'} onMouseOut={e=>e.currentTarget.style.textDecoration='none'}>GitHub</a>
              <button
                onClick={() => setShowCloneModal(true)}
                style={{
                  background: '#16a34a',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#15803d'}
                onMouseOut={e => e.currentTarget.style.background = '#16a34a'}
                title="Cloner ce dépôt"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Installer
              </button>
              <div style={{ display:'flex', marginLeft:'auto', gap:0, border:'1px solid #2f3740', borderRadius:8, overflow:'hidden', background:'#161c22' }}>
                {['readme','license'].map(tab=> (
                  <button key={tab} onClick={()=> setActiveTab(tab as any)}
                    style={{
                      background: activeTab===tab ? '#1e2730' : 'transparent',
                      color: activeTab===tab ? '#f1f5f9' : '#94a3b8',
                      border:'none',
                      padding:'6px 14px',
                      fontSize:12,
                      fontWeight:600,
                      cursor:'pointer',
                      letterSpacing:0.5,
                      transition:'background 0.15s, color 0.15s'
                    }}
                    onMouseOver={e=>{ if(activeTab!==tab) e.currentTarget.style.background='#1b2229'; }}
                    onMouseOut={e=>{ if(activeTab!==tab) e.currentTarget.style.background='transparent'; }}
                  >{tab==='readme'?'README':'LICENSE'}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ height:1, background:'#202830', marginTop:18 }} />
      <div className="hide-scrollbar" style={{ flex:1, overflowY:'auto', padding:'24px 32px 48px 32px', color:'#e2e8f0' }}>
        {loading && <div style={{ color:'#94a3b8' }}>Chargement…</div>}
        {error && <div style={{ color:'#ef4444' }}>Erreur : {error}</div>}
        {!loading && !error && activeTab==='readme' && (
          <div style={{ maxWidth:900 }}
            className='markdown-body'
            // NOTE: README vient de dépôts GitHub connus (liste blanche). Pour du contenu arbitraire, ajouter une étape de sanitation.
            dangerouslySetInnerHTML={{ __html: readmeHtml }} />
        )}
        {!loading && !error && activeTab==='license' && (
          <div style={{ maxWidth:900, fontSize:13 }} dangerouslySetInnerHTML={{ __html: licenseHtml || '<em>Aucune licence trouvée.</em>' }} />
        )}
      </div>
      
      {/* Clone Modal */}
      <ViewClone
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        repoName={meta?.full_name?.split('/')[1] || repo.link.split('/').slice(-1)[0]}
        repoUrl={repo.link}
        owner={meta?.owner?.login || repo.link.split('/').slice(-2)[0]}
        onCloneStateChange={onCloneStateChange}
      />
    </div>
  );
};

export default ViewRepo;
