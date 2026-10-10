import React from 'react';
import { Command } from 'lucide-react';
import type { RowComponentProps } from 'react-window';
import type { Theme } from '../../types';
import type { CommandPaletteCommand } from './types';
import { getCommandDescription, getCommandTitle } from './commandText';

// src/components/command-palette/CommandPaletteAllCommandsRow.tsx
// 「全部命令」浏览列表的一行。从 CommandPalette.tsx 里原样抽出来的，为了让整份列表能走
// react-window——行高必须是常量，所以这里显式写死 ALL_COMMANDS_ROW_HEIGHT，而不是让内容撑开。

/**
 * 与匹配行同高：padding 12 + 36px 图标圆盘 + padding 12。
 * 显式写在行样式上，行高就不会和 react-window 的 rowHeight 漂移。
 */
export const ALL_COMMANDS_ROW_HEIGHT = 60;

export type AllCommandsRowProps = {
    commands: CommandPaletteCommand[];
    groupLabelKey: Record<string, string>;
    isDaylight: boolean;
    itemIdleBg: string;
    theme: Theme;
    t: (key: string, options?: any) => string;
    onPick: (command: CommandPaletteCommand) => void;
};

const CommandPaletteAllCommandsRow = ({
    index,
    style,
    commands,
    groupLabelKey,
    isDaylight,
    itemIdleBg,
    theme,
    t,
    onPick,
}: RowComponentProps<AllCommandsRowProps>): React.ReactElement | null => {
    const command = commands[index];
    if (!command) {
        return null;
    }

    const groupLabel = t(groupLabelKey[command.group] || 'commandPalette.groupOther') || command.group;
    const Icon = command.icon ?? Command;

    return (
        <div style={style}>
            <button
                type="button"
                onClick={() => onPick(command)}
                style={{ height: ALL_COMMANDS_ROW_HEIGHT }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors ${itemIdleBg}`}
            >
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                    style={{
                        borderColor: isDaylight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)',
                        color: theme.accentColor,
                    }}
                >
                    <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{getCommandTitle(command, t)}</span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] opacity-50">{groupLabel}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs opacity-50">{getCommandDescription(command, t)}</div>
                </div>
            </button>
        </div>
    );
};

export default CommandPaletteAllCommandsRow;
