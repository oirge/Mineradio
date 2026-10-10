import React from 'react';
import { useTranslation } from 'react-i18next';
import ThemedDialog from './ThemedDialog';

// src/components/shared/ConfirmDialog.tsx

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'primary' | 'danger';
    isDaylight?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

// 渲染应用内统一样式的确认弹窗
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    description,
    confirmText,
    cancelText,
    confirmVariant = 'primary',
    isDaylight = false,
    onConfirm,
    onClose,
}) => {
    const { t } = useTranslation();

    const cancelClass = isDaylight
        ? 'bg-zinc-100/80 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white';

    const confirmClass = confirmVariant === 'danger'
        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
        : isDaylight
            ? 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg shadow-zinc-900/20'
            : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-lg shadow-white/20';

    const defaultConfirmLabel = t('status.confirm') !== 'status.confirm' ? t('status.confirm') : t('ui.confirm');
    const defaultCancelLabel = t('status.cancel') !== 'status.cancel' ? t('status.cancel') : t('ui.cancel');

    return (
        <ThemedDialog
            isOpen={isOpen}
            onClose={onClose}
            isDaylight={isDaylight}
            title={title}
            description={typeof description === 'string' ? description : undefined}
            footer={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${cancelClass}`}
                    >
                        {cancelText || defaultCancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm();
                        }}
                        className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${confirmClass}`}
                    >
                        {confirmText || defaultConfirmLabel}
                    </button>
                </>
            )}
        >
            {typeof description !== 'string' && description}
        </ThemedDialog>
    );
};

export default ConfirmDialog;
