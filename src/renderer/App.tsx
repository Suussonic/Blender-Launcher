import React from 'react';
import { useTranslation } from 'react-i18next';

import Navbar from './Navbar';
import Sidebar from './Sidebar';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: undefined };


const App: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      background: 'linear-gradient(135deg, #23272F 0%, #181A20 100%)',
      color: '#fff',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      overflow: 'hidden',
    }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingTop: 56, boxSizing: 'border-box', overflow: 'hidden' }}>
        <Sidebar />
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
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fff',
  fontSize: 18,
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: 'pointer',
  marginLeft: 2,
  marginRight: 2,
  transition: 'background 0.2s',
  outline: 'none',
};

export default App;
