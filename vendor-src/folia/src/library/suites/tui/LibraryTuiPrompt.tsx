import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// src/library/suites/tui/LibraryTuiPrompt.tsx
// TUI 的行内提示：一行等宽文字，贴在列表下方。改名是一个输入框（Enter 提交、Esc 取消），
// 删除集合是一句确认（Enter 确认、Esc 取消，也可以点两个按钮）。按键在这里处理并截住，
// 不会落到 TUI 的列表按键或命令面板上；进行中时禁用，结果由调用方决定是否关掉。
// 首页的目录也用它：通用的文本输入（kind: 'text'，例如新建歌单的名字）与确认（kind: 'confirm'，例如从曲库删除
// 选中的、移除导入根），id 写进 data-tui-prompt。

export type LibraryTuiPromptRequest =
    | { kind: 'rename'; initialValue: string }
    | { kind: 'confirm-delete'; message: string }
    | { kind: 'text'; id: string; label: string; initialValue?: string }
    | { kind: 'confirm'; id: string; message: string };

const isTextPrompt = (request: LibraryTuiPromptRequest): request is Extract<LibraryTuiPromptRequest, { kind: 'rename' | 'text' }> => (
    request.kind === 'rename' || request.kind === 'text'
);

/** data-tui-prompt 的值：集合视图沿用 rename / confirm-delete，首页的提示用调用方给的 id。 */
const promptIdOf = (request: LibraryTuiPromptRequest) => (
    request.kind === 'text' || request.kind === 'confirm' ? request.id : request.kind
);

type LibraryTuiPromptProps = {
    request: LibraryTuiPromptRequest;
    pending: boolean;
    accentColor: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
};

const LibraryTuiPrompt: React.FC<LibraryTuiPromptProps> = ({ request, pending, accentColor, onSubmit, onCancel }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(isTextPrompt(request) ? request.initialValue ?? '' : '');
    const textPrompt = isTextPrompt(request);
    const inputRef = useRef<HTMLInputElement>(null);
    const confirmRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (textPrompt) {
            inputRef.current?.focus();
            inputRef.current?.select();
        } else {
            confirmRef.current?.focus();
        }
    }, [textPrompt]);

    // Enter / Escape 归提示本身：截住冒泡，window 上的 TUI 按键与命令面板都看不到。
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        } else if (event.key === 'Enter') {
            event.stopPropagation();
            // 焦点在按钮上时让按钮自己响应（Enter 在「取消」上就是取消）。
            if (event.target instanceof HTMLButtonElement) return;
            event.preventDefault();
            if (!pending && !event.repeat) onSubmit(value);
        }
    };

    if (isTextPrompt(request)) {
        const inputId = `library-tui-${promptIdOf(request)}`;
        const label = request.kind === 'text' ? request.label : t('libraryTui.renamePrompt');
        return (
            <div
                data-tui-prompt={promptIdOf(request)}
                className="flex shrink-0 items-center gap-2 border-t border-current/15 px-4 py-1.5 text-[13px]"
            >
                <label htmlFor={inputId} style={{ color: accentColor }}>{`${label}>`}</label>
                <input
                    id={inputId}
                    ref={inputRef}
                    value={value}
                    disabled={pending}
                    onChange={event => setValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent font-mono outline-none disabled:opacity-50"
                    style={{ color: 'var(--text-primary)', caretColor: accentColor }}
                />
                <span className="shrink-0 opacity-50">{t('libraryTui.promptHint')}</span>
            </div>
        );
    }

    return (
        <div
            ref={confirmRef}
            role="alertdialog"
            aria-label={request.message}
            tabIndex={-1}
            data-tui-prompt={promptIdOf(request)}
            onKeyDown={handleKeyDown}
            className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-current/15 px-4 py-1.5 text-[13px] outline-none"
        >
            <span className="text-red-500">{request.message}</span>
            <button type="button" disabled={pending} onClick={() => onSubmit('')} className="text-red-500 hover:underline disabled:opacity-40">
                {`[${t('libraryTui.confirm')}]`}
            </button>
            <button type="button" onClick={onCancel} className="opacity-70 hover:opacity-100">
                {`[${t('libraryTui.cancel')}]`}
            </button>
            <span className="opacity-50">{t('libraryTui.promptHint')}</span>
        </div>
    );
};

export default LibraryTuiPrompt;
