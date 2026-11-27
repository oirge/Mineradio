// Load only the chosen language from the embedded player's own build.
export function readLocalLanguage(): 'en' | 'zh-CN' {
    try {
        if (localStorage.getItem('mineradio-ui-language-v1') === 'en') return 'en';
    } catch { /* Storage may be unavailable. */ }
    return 'zh-CN';
}

export function loadLocalTranslations(language: string) {
    return language === 'en' ? import('../i18n/locales/en') : import('../i18n/locales/zh-CN');
}
