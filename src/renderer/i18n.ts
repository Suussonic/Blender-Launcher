import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';

const storedLang = (() => {
  try {
    const v = window.localStorage.getItem('bl-language');
    return v === 'en' || v === 'fr' ? v : null;
  } catch {
    return null;
  }
})();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: storedLang || 'fr',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
