import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/locales/en';
import zhCN from '../i18n/locales/zh-CN';
import { LOCAL_UI_RESOURCES } from './local/locale';

// src/mineradio/local-i18n.ts
// The embedded player inherits Mineradio's language, including on the first render.
let language = 'zh-CN';
try { if (localStorage.getItem('mineradio-ui-language-v1') === 'en') language = 'en'; } catch { /* Storage may be unavailable. */ }

i18n.on('languageChanged', value => { document.documentElement.lang = value; });
void i18n.use(initReactI18next).init({
    lng: language,
    supportedLngs: ['en', 'zh-CN'],
    fallbackLng: 'en',
    resources: {
        en: { translation: en, localPlayer: LOCAL_UI_RESOURCES.en },
        'zh-CN': { translation: zhCN, localPlayer: LOCAL_UI_RESOURCES['zh-CN'] },
    },
    parseMissingKeyHandler: (key, defaultValue) => {
        const fallback = i18n.getResource('zh-CN', 'translation', key);
        return typeof fallback === 'string' ? fallback : defaultValue ?? key;
    },
    interpolation: { escapeValue: false },
});

export default i18n;
