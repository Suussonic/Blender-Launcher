import React from 'react';
import { useTranslation } from 'react-i18next';

type BlenderExe = {
  path: string;
  name: string;
  icon: string;
};

interface ViewPagesProps {
  selectedBlender: BlenderExe | null;
}

const ViewPages: React.FC<ViewPagesProps> = ({ selectedBlender }) => {
  const { t } = useTranslation();

  // Si un Blender est sélectionné, affiche sa page dédiée avec un style similaire à la homepage
  if (selectedBlender) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        overflow: 'auto',
      }}>
        <h1 style={{ fontWeight: 700, fontSize: 48, marginBottom: 16 }}>
          {selectedBlender.name}
        </h1>
        <p style={{ fontSize: 20, opacity: 0.8, marginBottom: 32 }}>
          Application Blender sélectionnée
        </p>
      </div>
    );
  }

  // Sinon, affiche la homepage par défaut
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      overflow: 'auto',
    }}>
      <h1 style={{ fontWeight: 700, fontSize: 48, marginBottom: 16 }}>{t('title')}</h1>
      <p style={{ fontSize: 20, opacity: 0.8, marginBottom: 32 }}>
        {t('subtitle')}
      </p>
    </div>
  );
};

export default ViewPages;
