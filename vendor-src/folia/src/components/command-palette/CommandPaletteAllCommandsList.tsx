import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { List } from 'react-window';
import type { Theme } from '../../types';
import type { CommandPaletteCommand } from './types';
import CommandPaletteAllCommandsRow, { ALL_COMMANDS_ROW_HEIGHT } from './CommandPaletteAllCommandsRow';

// src/components/command-palette/CommandPaletteAllCommandsList.tsx
// 「全部命令」浏览列表，虚拟化版本。
//
// 高度策略（这是整份改动的硬约束，别改）：这个组件**不测量任何东西**。它靠 h-full 从
// CommandPalette.tsx 那个 h-[min(496px,50vh)] 的固定盒子把高度继承下来，List 再拿
// height:'100%'。和 CommandPaletteQueueList 用的是同一条链路。绝不引入 ResizeObserver /
// AutoSizer / getBoundingClientRect——命令面板同时是携带 UI 的命令的画布，尺寸一旦随内容变，
// 那些 surface 的布局契约就废了。test/ui/commandPaletteSizing.spec.ts 守这一条。

type CommandPaletteAllCommandsListProps = {
    commands: CommandPaletteCommand[];
    groupLabelKey: Record<string, string>;
    isDaylight: boolean;
    itemIdleBg: string;
    theme: Theme;
    t: (key: string, options?: any) => string;
    onBack: () => void;
    onPick: (command: CommandPaletteCommand) => void;
};

const CommandPaletteAllCommandsList: React.FC<CommandPaletteAllCommandsListProps> = ({
    commands,
    groupLabelKey,
    isDaylight,
    itemIdleBg,
    theme,
    t,
    onBack,
    onPick,
}) => {
    // 一个 memo，避免 125 行各自重建闭包。
    const rowProps = useMemo(() => ({
        commands,
        groupLabelKey,
        isDaylight,
        itemIdleBg,
        theme,
        t,
        onPick,
    }), [commands, groupLabelKey, isDaylight, itemIdleBg, theme, t, onPick]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium opacity-60">
                <button
                    type="button"
                    onClick={onBack}
                    className={`rounded-full p-1 transition-colors ${isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                    aria-label={t('commandPalette.backToSearch') || 'Back to search'}
                >
                    <ArrowLeft size={14} />
                </button>
                <span>{t('commandPalette.allCommands') || 'All commands'}</span>
                <span className="ml-auto tabular-nums opacity-60">{commands.length}</span>
            </div>
            <div className="min-h-0 flex-1">
                <List
                    rowCount={commands.length}
                    rowHeight={ALL_COMMANDS_ROW_HEIGHT}
                    rowComponent={CommandPaletteAllCommandsRow}
                    rowProps={rowProps}
                    overscanCount={2}
                    className="custom-scrollbar"
                    style={{ height: '100%', width: '100%' }}
                />
            </div>
        </div>
    );
};

export default CommandPaletteAllCommandsList;
