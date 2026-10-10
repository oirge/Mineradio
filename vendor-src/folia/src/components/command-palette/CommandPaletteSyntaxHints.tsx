import React from 'react';
import type { Theme } from '../../types';
import type { SyntaxSuggestion } from './syntax/suggest';

// src/components/command-palette/CommandPaletteSyntaxHints.tsx
// The `--` completion strip, shown for any command that declares a `syntax`.
//
// This is deliberately generic rather than per-command. The queue command used to build and render
// its own flag list inside its surface, which meant the sleep timer — which has flags too — simply
// rejected `--on` with an error and never told anyone the flag existed. Anything that declares
// flags now documents itself the moment the user types `--`.

type CommandPaletteSyntaxHintsProps = {
    suggestions: SyntaxSuggestion[];
    activeIndex: number;
    onAccept: (suggestion: SyntaxSuggestion) => void;
    onHover: (index: number) => void;
    isDaylight: boolean;
    theme: Theme;
    t: (key: string, options?: { defaultValue?: string }) => string;
};

const CommandPaletteSyntaxHints: React.FC<CommandPaletteSyntaxHintsProps> = ({
    suggestions,
    activeIndex,
    onAccept,
    onHover,
    isDaylight,
    theme,
    t,
}) => {
    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="mb-2 shrink-0" data-testid="command-palette-syntax-hints">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-40">
                {t('commandPalette.syntax.hint', { defaultValue: 'Options' })}
            </div>
            <div className="grid gap-0.5">
                {suggestions.map((suggestion, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={suggestion.id}
                            type="button"
                            data-syntax-flag={suggestion.flag}
                            data-syntax-active={isActive ? 'true' : undefined}
                            onClick={() => onAccept(suggestion)}
                            onMouseMove={() => onHover(index)}
                            className={`flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                                isActive
                                    ? (isDaylight ? 'bg-black/[0.06]' : 'bg-white/[0.10]')
                                    : (isDaylight ? 'hover:bg-black/[0.04]' : 'hover:bg-white/[0.06]')
                            }`}
                        >
                            <span
                                className="shrink-0 font-mono text-[11px] font-semibold"
                                style={isActive ? { color: theme.accentColor } : undefined}
                            >
                                {`--${suggestion.flag}`}
                            </span>
                            {suggestion.descriptionKey && (
                                <span className="min-w-0 flex-1 truncate text-[11px] opacity-60">
                                    {t(suggestion.descriptionKey, { defaultValue: suggestion.descriptionFallback ?? '' })}
                                </span>
                            )}
                            {suggestion.aliases && suggestion.aliases.length > 0 && (
                                <span className="shrink-0 font-mono text-[10px] opacity-35">
                                    {suggestion.aliases.map(alias => `--${alias}`).join(' ')}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CommandPaletteSyntaxHints;
