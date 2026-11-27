import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LOCAL_UI_RESOURCES } from './local/locale';
import { loadLocalTranslations, readLocalLanguage } from './local-language';

// src/mineradio/local-i18n.ts
// The embedded player inherits Mineradio's language, including on the first render.
const localTranslations: BackendModule = {
    type: 'backend',
    init() {},
    read(language, _namespace, callback) {
        void loadLocalTranslations(language).then(
            ({ default: translations }) => callback(null, translations),
            error => callback(error, false),
        );
    },
};

let requestedLanguage = readLocalLanguage();
i18n.on('languageChanged', value => { document.documentElement.lang = value; });
export const localI18nReady = i18n.use(localTranslations).use(initReactI18next).init({
    lng: requestedLanguage,
    supportedLngs: ['en', 'zh-CN'],
    // Each locale includes any missing strings from the other at build time.
    fallbackLng: false,
    partialBundledLanguages: true,
    ns: ['translation', 'localPlayer'],
    resources: {
        en: { localPlayer: LOCAL_UI_RESOURCES.en },
        'zh-CN': { localPlayer: LOCAL_UI_RESOURCES['zh-CN'] },
    },
    interpolation: { escapeValue: false },
});

export function syncLocalLanguage(language: typeof requestedLanguage | undefined) {
    if (!language || language === requestedLanguage) return;
    // The displayed language can lag behind while a new dictionary loads.
    requestedLanguage = language;
    void i18n.changeLanguage(language);
}

export default i18n;
