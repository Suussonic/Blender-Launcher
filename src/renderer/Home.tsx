import React, { useRef } from 'react';
import Carousel, { CarouselHandle } from './Carousel';

type BlenderExe = {
  path: string;
  name: string;
  title: string;
  icon: string;
};

interface HomeProps {
  selectedBlender: BlenderExe | null;
  onLaunch?: (b: BlenderExe) => void;
  onOpenLink?: (url: string) => void;
}

const cardBase: React.CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #0f1724, #0b111a)',
  border: '1px solid #21303c',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#cbd5e1',
  fontWeight: 600,
  fontSize: 18
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginTop: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 4px 12px 4px' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#eef2ff' }}>{title}</h2>
    </div>
    {children}
  </div>
);

const Grid: React.FC<{ columns?: number; children: React.ReactNode }> = ({ columns = 3, children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 16
    }}
  >
    {children}
  </div>
);

const linkCard = (label: string, href: string, onOpen?: (url:string)=>void) => (
  <div
    onClick={() => (onOpen ? onOpen(href) : window.open(href, '_blank'))}
    style={{
      ...cardBase,
      height: 120,
      cursor: 'pointer',
      transition: 'transform .12s ease, box-shadow .12s ease',
      boxShadow: '0 0 0 rgba(0,0,0,0)',
      position:'relative',
      paddingLeft: 18,
      paddingRight: 18,
      boxSizing: 'border-box'
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 22px rgba(0,0,0,0.35)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLDivElement).style.transform = 'none';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 rgba(0,0,0,0)';
    }}
  >
    <span style={{ textAlign: 'center', width: '100%', display: 'block' }}>{label}</span>
  </div>
);

const Home: React.FC<HomeProps> = ({ onOpenLink }) => {
  const carouselRef = useRef<CarouselHandle | null>(null);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', padding: '0 16px', boxSizing: 'border-box' }}>
        {/* Hero */}
        <div style={{ width: '100%', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
          <Carousel ref={carouselRef} height={'42vh'} autoplayDelay={3200} loop aspectRatio={16/9}>
            {[
              // Slide 1: YouTube Channel
              <div key="yt" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://www.youtube.com/@BlenderOfficial')}>
                <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/youtube.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
                <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Blender Official sur YouTube</div>
                  <div style={{ opacity: .9 }}>Tutoriels, annonces, nouveautés — apprends Blender avec la chaîne officielle.</div>
                </div>
              </div>,
              // Slide 2: Docs Manual (with background image)
              <div key="manual" style={{ ...cardBase, position: 'relative', overflow:'hidden', padding:0, cursor: 'pointer' }} onClick={() => onOpenLink && onOpenLink('https://docs.blender.org/manual/en/latest/')}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('./public/vignette/documentation.png')", backgroundSize: 'cover', backgroundPosition: 'center', transform: 'scale(1.02)' }} />
                <div style={{ position: 'absolute', inset: 0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Documentation Utilisateur</div>
                  <div style={{ opacity: .9 }}>Le manuel complet et à jour pour toutes les fonctionnalités de Blender.</div>
                </div>
              </div>,
              // Slide 3: API Python
              <div key="api" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://docs.blender.org/api/current/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 50% 10%, rgba(234,179,8,0.18), transparent)' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>API Python</div>
                  <div style={{ opacity: .9 }}>Référence officielle pour les scripts et addons Blender.</div>
                </div>
              </div>,
              // Slide 4: Dev Portal
              <div key="dev" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://developer.blender.org/docs/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 20% 80%, rgba(99,102,241,0.18), transparent)' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Portail Développeurs</div>
                  <div style={{ opacity: .9 }}>Guides techniques, contributions et architecture de Blender.</div>
                </div>
              </div>,
              // Slide 5: Demo files
              <div key="demo" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://www.blender.org/download/demo-files/')}>
                <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/demofile.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
                <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Fichiers Démo</div>
                  <div style={{ opacity: .9 }}>Télécharge des scènes de démonstration officielles pour tester et apprendre.</div>
                </div>
              </div>,
              // Slide 6: Art Gallery
              <div key="gallery" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://download.blender.org/archive/gallery/')}>
                <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/artgallery.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
                <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
                <div style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Galerie d'art</div>
                  <div style={{ opacity: .9 }}>Parcourez une sélection d'images et rendus d'art créés sous Blender.</div>
                </div>
              </div>,
            ]}
          </Carousel>
        </div>

        {/* Sections */}
        <Section title="Apprendre Blender">
          <Grid columns={3}>
            <div onClick={() => onOpenLink && onOpenLink('https://www.youtube.com/@BlenderOfficial')} style={{ ...cardBase, height: 120, cursor: 'pointer', position:'relative', overflow:'hidden', padding:0 }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/youtube.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
              <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
              <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, fontSize:16 }}>Chaîne YouTube officielle</div>
            </div>
            <div onClick={() => onOpenLink && onOpenLink('https://docs.blender.org/manual/en/latest/')} style={{ ...cardBase, height: 120, cursor: 'pointer', position:'relative', overflow:'hidden', padding:0 }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/documentation.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
              <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
              <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, fontSize:16 }}>Documentation Utilisateur</div>
            </div>
            {/* Demo card: background image with iPhone-like blur overlay and title */}
            <div onClick={() => onOpenLink && onOpenLink('https://www.blender.org/download/demo-files/')} style={{ ...cardBase, height: 120, cursor: 'pointer', position:'relative', overflow:'hidden', padding:0 }}>
              {/* background image */}
              <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/demofile.png')", backgroundSize:'cover', backgroundPosition:'center', filter:'none', transform:'scale(1.02)' }} />
              {/* blurred translucent overlay (reduced blur) */}
              <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
              {/* content: text centered vertically */}
              <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, fontSize:16 }}>Fichiers Démo</div>
            </div>
            {/* Galerie d'art: when it wraps to the 2nd row, center it */}
            <div onClick={() => onOpenLink && onOpenLink('https://download.blender.org/archive/gallery/')} style={{ ...cardBase, height: 120, cursor: 'pointer', position:'relative', overflow:'hidden', padding:0, gridColumn: '2' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/artgallery.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
              <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
              <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, fontSize:16 }}>Galerie d'art</div>
            </div>
          </Grid>
        </Section>

        <Section title="Développer avec Blender">
          <Grid columns={3}>
            {linkCard('API Python', 'https://docs.blender.org/api/current/', onOpenLink)}
            {linkCard('Portail Développeurs', 'https://developer.blender.org/docs/', onOpenLink)}
            <div onClick={() => onOpenLink && onOpenLink('https://developer.blender.org')} style={{ ...cardBase, height: 120, cursor: 'pointer', position:'relative', overflow:'hidden', padding:0 }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:"url('./public/vignette/makeblender.png')", backgroundSize:'cover', backgroundPosition:'center', transform:'scale(1.02)' }} />
              <div style={{ position:'absolute', inset:0, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))' }} />
              <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600, fontSize:16 }}>Contribuer au code source</div>
            </div>
          </Grid>
        </Section>

        <Section title="Guides rapides">
          <Grid columns={3}>
            {linkCard('Interface & Navigation', 'https://docs.blender.org/manual/en/latest/interface/index.html', onOpenLink)}
            {linkCard('Modeling', 'https://docs.blender.org/manual/en/latest/modeling/index.html', onOpenLink)}
            {linkCard('Rendering', 'https://docs.blender.org/manual/en/latest/render/index.html', onOpenLink)}
          </Grid>
        </Section>
      </div>
    </div>
  );
};

export default Home;
