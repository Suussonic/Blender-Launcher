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

const linkCard = (label: string, href: string, onOpen?: (url:string)=>void, thumb?: string) => (
  <div
    onClick={() => (onOpen ? onOpen(href) : window.open(href, '_blank'))}
    style={{
      ...cardBase,
      height: 120,
      cursor: 'pointer',
      transition: 'transform .12s ease, box-shadow .12s ease',
      boxShadow: '0 0 0 rgba(0,0,0,0)',
      position:'relative',
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
    {/* thumbnail */}
    {thumb && (
      <img
        src={thumb}
        alt="thumb"
        style={{ position:'absolute', left:14, top:14, width:32, height:32, borderRadius:6, opacity:.9, objectFit:'cover', background:'#0b111a' }}
        loading="lazy"
      />
    )}
    <span style={{ paddingLeft: thumb ? 60 : 0 }}>{label}</span>
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
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 20% 20%, rgba(37,99,235,0.18), transparent)' }} />
                <img src="./public/logo/png/Blender-Launcher-256x256.png" alt="yt" style={{ position:'absolute', right:16, bottom:16, width:56, height:56, opacity:.2, filter:'grayscale(40%)' }} />
                <img src="./public/thumbs/youtube.svg" alt="yt-thumb" style={{ position:'absolute', left:16, bottom:16, width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Blender Official sur YouTube</div>
                  <div style={{ opacity: .9 }}>Tutoriels, annonces, nouveautés — apprends Blender avec la chaîne officielle.</div>
                </div>
              </div>,
              // Slide 2: Docs Manual
              <div key="manual" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://docs.blender.org/manual/en/latest/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 80% 20%, rgba(16,185,129,0.18), transparent)' }} />
                <img src="./public/logo/png/Blender-Launcher-256x256.png" alt="manual" style={{ position:'absolute', right:16, bottom:16, width:56, height:56, opacity:.2, filter:'grayscale(40%)' }} />
                <img src="./public/thumbs/docs.svg" alt="manual-thumb" style={{ position:'absolute', left:16, bottom:16, width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Documentation Utilisateur</div>
                  <div style={{ opacity: .9 }}>Le manuel complet et à jour pour toutes les fonctionnalités de Blender.</div>
                </div>
              </div>,
              // Slide 3: API Python
              <div key="api" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://docs.blender.org/api/current/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 50% 10%, rgba(234,179,8,0.18), transparent)' }} />
                <img src="./public/logo/png/Blender-Launcher-256x256.png" alt="api" style={{ position:'absolute', right:16, bottom:16, width:56, height:56, opacity:.2, filter:'grayscale(40%)' }} />
                <img src="./public/thumbs/docs.svg" alt="api-thumb" style={{ position:'absolute', left:16, bottom:16, width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>API Python</div>
                  <div style={{ opacity: .9 }}>Référence officielle pour les scripts et addons Blender.</div>
                </div>
              </div>,
              // Slide 4: Dev Portal
              <div key="dev" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://developer.blender.org/docs/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 20% 80%, rgba(99,102,241,0.18), transparent)' }} />
                <img src="./public/logo/png/Blender-Launcher-256x256.png" alt="dev" style={{ position:'absolute', right:16, bottom:16, width:56, height:56, opacity:.2, filter:'grayscale(40%)' }} />
                <img src="./public/thumbs/dev.svg" alt="dev-thumb" style={{ position:'absolute', left:16, bottom:16, width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Portail Développeurs</div>
                  <div style={{ opacity: .9 }}>Guides techniques, contributions et architecture de Blender.</div>
                </div>
              </div>,
              // Slide 5: Demo files
              <div key="demo" style={{ ...cardBase, position: 'relative', overflow:'hidden' }} onClick={() => onOpenLink && onOpenLink('https://www.blender.org/download/demo-files/')}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 80% 80%, rgba(244,63,94,0.16), transparent)' }} />
                <img src="./public/logo/png/Blender-Launcher-256x256.png" alt="demo" style={{ position:'absolute', right:16, bottom:16, width:56, height:56, opacity:.2, filter:'grayscale(40%)' }} />
                <img src="./public/thumbs/blender.svg" alt="demo-thumb" style={{ position:'absolute', left:16, bottom:16, width:40, height:40, borderRadius:10, objectFit:'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Fichiers Démo</div>
                  <div style={{ opacity: .9 }}>Télécharge des scènes de démonstration officielles pour tester et apprendre.</div>
                </div>
              </div>
            ]}
          </Carousel>
        </div>

        {/* Sections */}
        <Section title="Apprendre Blender">
          <Grid columns={3}>
            {linkCard('Chaîne YouTube officielle', 'https://www.youtube.com/@BlenderOfficial', onOpenLink, './public/thumbs/youtube.svg')}
            {linkCard('Documentation Utilisateur', 'https://docs.blender.org/manual/en/latest/', onOpenLink, './public/thumbs/docs.svg')}
            {linkCard('Fichiers Démo', 'https://www.blender.org/download/demo-files/', onOpenLink, './public/thumbs/blender.svg')}
          </Grid>
        </Section>

        <Section title="Développer avec Blender">
          <Grid columns={3}>
            {linkCard('API Python', 'https://docs.blender.org/api/current/', onOpenLink, './public/thumbs/docs.svg')}
            {linkCard('Portail Développeurs', 'https://developer.blender.org/docs/', onOpenLink, './public/thumbs/dev.svg')}
            {linkCard('Contribuer au code source', 'https://developer.blender.org', onOpenLink, './public/thumbs/dev.svg')}
          </Grid>
        </Section>

        <Section title="Guides rapides">
          <Grid columns={3}>
            {linkCard('Interface & Navigation', 'https://docs.blender.org/manual/en/latest/interface/index.html', onOpenLink, './public/thumbs/docs.svg')}
            {linkCard('Modeling', 'https://docs.blender.org/manual/en/latest/modeling/index.html', onOpenLink, './public/thumbs/docs.svg')}
            {linkCard('Rendering', 'https://docs.blender.org/manual/en/latest/render/index.html', onOpenLink, './public/thumbs/docs.svg')}
          </Grid>
        </Section>
      </div>
    </div>
  );
};

export default Home;
