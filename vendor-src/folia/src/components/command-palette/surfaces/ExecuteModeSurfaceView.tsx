import React from 'react';
import { CircleSlash, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import { getCommandTitle } from '../commandText';
import type { CommandPaletteCommand } from '../types';

// src/components/command-palette/surfaces/ExecuteModeSurfaceView.tsx
// Cheat sheet for execute mode: every shortcut still reachable from the current buffer, so the
// mode teaches itself instead of relying on documentation.

type ExecuteModeSurfaceViewProps = {
    buffer: string;
    candidates: CommandPaletteCommand[];
    isDaylight: boolean;
    isInvalid: boolean;
    theme: Theme;
};

const ExecuteModeSurfaceView: React.FC<ExecuteModeSurfaceViewProps> = ({
    buffer,
    candidates,
    isDaylight,
    isInvalid,
    theme,
}) => {
    const { t } = useTranslation();

    if (isInvalid) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center opacity-60">
                <CircleSlash size={26} />
                <div className="text-sm">
                    {t('commandPalette.executeMode.unknown', 'No command uses "{{keys}}"').replace('{{keys}}', buffer)}
                </div>
                <div className="text-xs opacity-70">
                    {t('commandPalette.executeMode.unknownHint', 'Press Esc to clear and try another key')}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium opacity-60">
                <Keyboard size={14} />
                <span>{t('commandPalette.executeMode.title', 'Execute mode')}</span>
                <span className="ml-auto tabular-nums opacity-60">{candidates.length}</span>
            </div>
            {candidates.map(command => (
                <div
                    key={command.id}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${isDaylight ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
                >
                    <span
                        className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border px-2 font-mono text-xs"
                        style={{
                            borderColor: isDaylight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)',
                            color: theme.accentColor,
                        }}
                    >
                        {command.executeShortcut}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{getCommandTitle(command, t)}</span>
                </div>
            ))}
        </div>
    );
};

export default ExecuteModeSurfaceView;
