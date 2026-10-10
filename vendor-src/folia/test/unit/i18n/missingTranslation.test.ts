import { describe, expect, it } from 'vitest';
import { resolveMissingTranslation } from '../../../src/i18n/missingTranslation';
import { resolvePlayerControlSlot } from '../../../src/components/floating-player/playerControlSlotActions';
import en from '../../../src/i18n/locales/en';
import zhCN from '../../../src/i18n/locales/zh-CN';

// test/unit/i18n/missingTranslation.test.ts
// Verifies the missing-key fallback order used by the global i18n configuration.

describe('missing translation fallback', () => {
    const fallbacks = { 'known.key': '中文兜底' };

    it('prefers the bundled Chinese fallback', () => {
        expect(resolveMissingTranslation(fallbacks, 'known.key', 'Runtime default')).toBe('中文兜底');
    });

    it('uses the runtime default before exposing the translation key', () => {
        expect(resolveMissingTranslation(fallbacks, 'dynamic.key', 'Runtime default')).toBe('Runtime default');
        expect(resolveMissingTranslation(fallbacks, 'dynamic.key')).toBe('dynamic.key');
    });
});

describe('local library entity translations', () => {
    const entityKeys = [
        'entityInfo',
        'entityDisplayName',
        'mergeEntity',
        'splitEntity',
        'selectEntity',
        'newEntityName',
        'entityEditorHint',
        'entityNameHint',
        'metadataSuggestions',
        'entityMergeHint',
        'searchEntity',
        'noEntityMatches',
        'entitySplitHint',
        'searchEntitySongs',
        'noEntitySongs',
        'selectedSongCount',
        'entityMemberCount',
        'entitySaved',
        'entityMerged',
        'entitySplitDone',
        'entityOperationFailed',
        'mergeIntoCurrent',
        'chooseSongsToSplit',
        'backToEntityEditing',
        'splitSelectedAction',
    ] as const;

    it.each(entityKeys)('defines localMusic.%s in both locales', key => {
        expect(en.localMusic[key]).toBeTruthy();
        expect(zhCN.localMusic[key]).toBeTruthy();
    });

    it.each([
        'entityInfo',
        'mergeEntity',
        'splitEntity',
        'selectEntity',
        'newEntityName',
        'entityEditorHint',
        'entityMergeHint',
        'searchEntity',
        'noEntityMatches',
        'entitySplitHint',
        'entityMerged',
        'entitySplitDone',
        'mergeIntoCurrent',
        'splitSelectedAction',
    ] as const)('uses a contextual kind label in localMusic.%s', key => {
        expect(en.localMusic[key]).toContain('{{kind}}');
        expect(zhCN.localMusic[key]).toContain('{{kind}}');
    });
});

describe('player and playlist controls translations', () => {
    it('defines playlist.play in both locales', () => {
        expect((en.playlist as Record<string, string>).play).toBe('Play');
        expect((zhCN.playlist as Record<string, string>).play).toBe('播放');
    });

    const playerControlKeys = [
        'play',
        'pause',
        'like',
        'unlike',
        'loopOff',
        'loopAll',
        'loopOne',
    ] as const;

    it.each(playerControlKeys)('defines player.%s in both locales', key => {
        expect((en.player as Record<string, string>)[key]).toBeTruthy();
        expect((zhCN.player as Record<string, string>)[key]).toBeTruthy();
    });

    it('defines ui.generateAITheme as 生成AI主题 / Generate AI Theme', () => {
        expect(en.ui.generateAITheme).toBe('Generate AI Theme');
        expect(zhCN.ui.generateAITheme).toBe('生成AI主题');
    });
});

describe('player control slot loop action resolution', () => {
    it.each([
        ['off', 'player.loopOff'],
        ['all', 'player.loopAll'],
        ['one', 'player.loopOne'],
    ] as const)('resolves loop slot labelKey for loopMode=%s', (loopMode, expectedKey) => {
        const slot = resolvePlayerControlSlot('loop', {
            loopMode,
            onToggleLoop: () => {},
            canPrev: true,
            canNext: true,
            onPrev: () => {},
            onNext: () => {},
            onShuffle: () => {},
            canShuffle: true,
            onLike: () => {},
            isLiked: false,
            likeDisabled: false,
            onToggleTimeline: () => {},
            hasLyrics: true,
            invokeCommandById: () => {},
            canInvokeCommandById: () => true,
        });
        expect(slot.labelKey).toBe(expectedKey);
    });
});


