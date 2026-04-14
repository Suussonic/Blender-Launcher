import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Carousel, { CarouselHandle } from '../shared/ui/Carousel';

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

type HomeLink = {
  key: string;
  url: string;
  image: string;
  titleKey: string;
  titleFallback: string;
  descKey?: string;
  descFallback?: string;
};

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

const backgroundLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  transform: 'scale(1.02)'
};

const overlayLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.38))'
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

const HomeCard: React.FC<{
  link: HomeLink;
  title: string;
  description?: string;
  height?: number;
  centerInSecondRow?: boolean;
  onOpen?: (url: string) => void;
}> = ({ link, title, description, height, centerInSecondRow, onOpen }) => (
  <div
    onClick={() => onOpen?.(link.url)}
    style={{
      ...cardBase,
      height: height || '100%',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
      padding: 0,
      gridColumn: centerInSecondRow ? '2' : undefined
    }}
  >
    <div style={{ ...backgroundLayer, backgroundImage: `url('${link.image}')` }} />
    <div style={overlayLayer} />
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: 16,
        textAlign: 'center',
        padding: description ? '0 20px' : '0 12px'
      }}
    >
      <div style={{ fontSize: description ? 22 : 16, marginBottom: description ? 8 : 0 }}>{title}</div>
      {description && <div style={{ opacity: 0.9, fontSize: 15 }}>{description}</div>}
    </div>
  </div>
);

const Home: React.FC<HomeProps> = ({ onOpenLink }) => {
  const { t } = useTranslation();
  const carouselRef = useRef<CarouselHandle | null>(null);

  const docsLink: HomeLink = {
    key: 'docs',
    url: 'https://docs.blender.org/manual/en/latest/',
    image: './public/vignette/documentation.png',
    titleKey: 'home.docs.title',
    titleFallback: 'Documentation Utilisateur',
    descKey: 'home.docs.desc',
    descFallback: 'Le manuel complet et à jour pour toutes les fonctionnalités de Blender.'
  };

  const links: Record<string, HomeLink> = {
    docs: docsLink,
    youtube: {
      key: 'youtube',
      url: 'https://www.youtube.com/@BlenderOfficial',
      image: './public/vignette/youtube.png',
      titleKey: 'home.youtube.title',
      titleFallback: 'Blender Official sur YouTube',
      descKey: 'home.youtube.desc',
      descFallback: 'Tutoriels, annonces, nouveautés - apprends Blender avec la chaîne officielle.'
    },
    contrib: {
      key: 'contrib',
      url: 'https://developer.blender.org',
      image: './public/vignette/makeblender.png',
      titleKey: 'home.contrib.title',
      titleFallback: 'Contribuer au code source',
      descKey: 'home.contrib.desc',
      descFallback: 'Guides, rapports et contributions pour développer Blender.'
    },
    api: {
      key: 'api',
      url: 'https://docs.blender.org/api/current/',
      image: './public/vignette/apipython.png',
      titleKey: 'home.api.title',
      titleFallback: 'API Python',
      descKey: 'home.api.desc',
      descFallback: 'Référence officielle pour les scripts et addons Blender.'
    },
    devPortal: {
      key: 'devPortal',
      url: 'https://developer.blender.org/docs/',
      image: './public/vignette/portaildev.png',
      titleKey: 'home.dev_portal.title',
      titleFallback: 'Portail Développeurs',
      descKey: 'home.dev_portal.desc',
      descFallback: 'Guides techniques, contributions et architecture de Blender.'
    },
    demo: {
      key: 'demo',
      url: 'https://www.blender.org/download/demo-files/',
      image: './public/vignette/demofile.png',
      titleKey: 'home.demo.title',
      titleFallback: 'Fichiers Démo',
      descKey: 'home.demo.desc',
      descFallback: 'Télécharge des scènes de démonstration officielles pour tester et apprendre.'
    },
    gallery: {
      key: 'gallery',
      url: 'https://download.blender.org/archive/gallery/',
      image: './public/vignette/artgallery.png',
      titleKey: 'home.gallery.title',
      titleFallback: 'Galerie d\'art',
      descKey: 'home.gallery.desc',
      descFallback: 'Parcourez une sélection d\'images et rendus d\'art créés sous Blender.'
    }
  };

  const heroOrder = [links.docs, links.youtube, links.contrib, links.api, links.devPortal, links.demo, links.gallery];
  const learnOrder = [links.youtube, links.docs, links.demo, links.gallery];
  const developOrder = [links.api, links.devPortal, links.contrib];

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', padding: '0 16px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
          <Carousel ref={carouselRef} height={'42vh'} autoplayDelay={3200} loop aspectRatio={16 / 9}>
            {heroOrder.map((link) => (
              <HomeCard
                key={link.key}
                link={link}
                title={t(link.titleKey, link.titleFallback)}
                description={link.descKey ? t(link.descKey, link.descFallback || '') : undefined}
                onOpen={onOpenLink}
              />
            ))}
          </Carousel>
        </div>

        <Section title={t('home.section.learn', 'Apprendre Blender')}>
          <Grid columns={3}>
            {learnOrder.map((link, idx) => (
              <HomeCard
                key={link.key}
                link={link}
                title={t(link.titleKey, link.titleFallback)}
                height={120}
                centerInSecondRow={link.key === 'gallery' && idx === learnOrder.length - 1}
                onOpen={onOpenLink}
              />
            ))}
          </Grid>
        </Section>

        <Section title={t('home.section.develop', 'Développer avec Blender')}>
          <Grid columns={3}>
            {developOrder.map((link) => (
              <HomeCard
                key={link.key}
                link={link}
                title={t(link.titleKey, link.titleFallback)}
                height={120}
                onOpen={onOpenLink}
              />
            ))}
          </Grid>
        </Section>
      </div>
    </div>
  );
};

export default Home;
