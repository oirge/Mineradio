// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';

const dictionary = vi.hoisted(() => ({
    load: vi.fn(async () => ({ default: { sampleLabel: '中文' } })),
}));

vi.mock('../../../src/mineradio/local-language', () => ({
    readLocalLanguage: () => 'zh-CN',
    loadLocalTranslations: dictionary.load,
}));

import i18n, { localI18nReady, syncLocalLanguage } from '../../../src/mineradio/local-i18n';

it('keeps the latest setting when an earlier language finishes loading', async () => {
    await localI18nReady;
    let finishEnglish = () => {};
    dictionary.load.mockReturnValueOnce(new Promise(resolve => {
        finishEnglish = () => resolve({ default: { sampleLabel: 'English' } });
    }));
    const changed = vi.fn();
    i18n.on('languageChanged', changed);

    syncLocalLanguage('en');
    expect(i18n.language).toBe('zh-CN');
    syncLocalLanguage('zh-CN');
    const englishLoaded = i18n.loadLanguages('en');
    finishEnglish();
    await englishLoaded;

    expect(i18n.t('sampleLabel')).toBe('中文');
    expect(changed).not.toHaveBeenCalledWith('en');
    syncLocalLanguage('en');
    expect(i18n.t('sampleLabel')).toBe('English');
    expect(document.documentElement.lang).toBe('en');
    expect(dictionary.load).toHaveBeenCalledTimes(2);
    i18n.off('languageChanged', changed);
});
