import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveLucideIcon } from '../../../utils/lucideIconResolver';
import { LYRICS_ICON_LIMIT, WORD_COLOR_LIMIT, type WordColorEntry } from './themeParkDraft';

// src/components/modal/theme-park/ThemeParkContentPanel.tsx
// Content tab: the emotion word colors and the lucide lyric icons an AI theme carries. Both
// describe the song rather than the light/dark surface, so edits here apply to both sides.

type ThemeParkContentPanelProps = {
    wordColors: WordColorEntry[];
    lyricsIcons: string[];
    accentColor: string;
    onWordColorsChange: (next: WordColorEntry[]) => void;
    onLyricsIconsChange: (next: string[]) => void;
};

const ThemeParkContentPanel: React.FC<ThemeParkContentPanelProps> = ({
    wordColors,
    lyricsIcons,
    accentColor,
    onWordColorsChange,
    onLyricsIconsChange,
}) => {
    const { t } = useTranslation();
    const [iconDraft, setIconDraft] = useState('');
    const [iconError, setIconError] = useState<string | null>(null);

    const updateWordColor = (index: number, patch: Partial<WordColorEntry>) => {
        onWordColorsChange(wordColors.map((entry, entryIndex) => (
            entryIndex === index ? { ...entry, ...patch } : entry
        )));
    };

    const handleAddIcon = () => {
        const name = iconDraft.trim();
        if (!name) {
            return;
        }
        if (!resolveLucideIcon(name)) {
            setIconError(t('theme.lyricsIconUnknown'));
            return;
        }
        if (lyricsIcons.includes(name)) {
            setIconDraft('');
            return;
        }

        onLyricsIconsChange([...lyricsIcons, name]);
        setIconDraft('');
        setIconError(null);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3 rounded-[24px] border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t('theme.wordColors')}
                        </div>
                        <div className="mt-1 text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            {t('theme.wordColorsDesc')}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onWordColorsChange([...wordColors, { word: '', color: accentColor }])}
                        disabled={wordColors.length >= WORD_COLOR_LIMIT}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        <Plus size={13} />
                        <span>{t('theme.addWordColor')}</span>
                    </button>
                </div>

                {wordColors.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                        {t('theme.wordColorsEmpty')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {wordColors.map((entry, index) => (
                            <div key={`word-color-${index}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                                <input
                                    type="color"
                                    value={entry.color}
                                    onChange={(event) => updateWordColor(index, { color: event.target.value })}
                                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0"
                                    aria-label={t('theme.wordColorSwatch')}
                                />
                                <input
                                    type="text"
                                    value={entry.word}
                                    onChange={(event) => updateWordColor(index, { word: event.target.value })}
                                    placeholder={t('theme.wordColorWordPlaceholder')}
                                    className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm outline-none"
                                    style={{ color: 'var(--text-primary)' }}
                                    spellCheck={false}
                                />
                                <span className="shrink-0 font-mono text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                    {entry.color.toUpperCase()}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onWordColorsChange(wordColors.filter((_, entryIndex) => entryIndex !== index))}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                                    style={{ color: 'var(--text-secondary)' }}
                                    aria-label={t('theme.removeEntry')}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/10 p-4">
                <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('theme.lyricsIcons')}
                    </div>
                    <div className="mt-1 text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                        {t('theme.lyricsIconsDesc')}
                    </div>
                </div>

                {lyricsIcons.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {lyricsIcons.map(iconName => {
                            const Icon = resolveLucideIcon(iconName);

                            return (
                                <span
                                    key={iconName}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1.5 text-xs"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {Icon ? <Icon size={13} /> : null}
                                    <span>{iconName}</span>
                                    <button
                                        type="button"
                                        onClick={() => onLyricsIconsChange(lyricsIcons.filter(name => name !== iconName))}
                                        className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                                        aria-label={t('theme.removeEntry')}
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={iconDraft}
                        onChange={(event) => {
                            setIconDraft(event.target.value);
                            setIconError(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddIcon();
                            }
                        }}
                        placeholder={t('theme.lyricsIconPlaceholder')}
                        disabled={lyricsIcons.length >= LYRICS_ICON_LIMIT}
                        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition-colors focus:border-white/20 disabled:opacity-40"
                        style={{ color: 'var(--text-primary)' }}
                        spellCheck={false}
                    />
                    <button
                        type="button"
                        onClick={handleAddIcon}
                        disabled={lyricsIcons.length >= LYRICS_ICON_LIMIT}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        <Plus size={13} />
                        <span>{t('theme.addLyricsIcon')}</span>
                    </button>
                </div>

                {iconError && (
                    <div className="text-xs" style={{ color: '#f87171' }}>{iconError}</div>
                )}
            </div>
        </div>
    );
};

export default ThemeParkContentPanel;
