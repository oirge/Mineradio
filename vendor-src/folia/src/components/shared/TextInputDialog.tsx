import React from 'react';
import { useTranslation } from 'react-i18next';
import ThemedDialog from './ThemedDialog';

interface TextInputDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    confirmLabel?: string;
    initialValue?: string;
    isDaylight?: boolean;
    onClose: () => void;
    onConfirm: (value: string) => Promise<void> | void;
}

const TextInputDialog: React.FC<TextInputDialogProps> = ({
    isOpen,
    title,
    description,
    placeholder,
    confirmLabel,
    initialValue = '',
    isDaylight = false,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation();
    const [value, setValue] = React.useState(initialValue);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setIsSubmitting(false);
        }
    }, [initialValue, isOpen]);

    const inputClass = isDaylight
        ? 'bg-black/[0.04] border-black/10 text-zinc-900 placeholder:text-zinc-400'
        : 'bg-white/[0.06] border-white/10 text-white placeholder:text-white/30';
    const cancelClass = isDaylight
        ? 'bg-zinc-100/80 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white';

    const handleConfirm = async () => {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return;
        }

        try {
            setIsSubmitting(true);
            await onConfirm(trimmedValue);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ThemedDialog
            isOpen={isOpen}
            onClose={onClose}
            isDaylight={isDaylight}
            title={title}
            description={description}
            footer={(
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${cancelClass}`}
                    >
                        {t('localMusic.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting || !value.trim()}
                        className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {confirmLabel || t('localMusic.save')}
                    </button>
                </>
            )}
        >
            <input
                autoFocus
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleConfirm();
                    }
                }}
                placeholder={placeholder}
                className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors focus:border-sky-400 ${inputClass}`}
            />
        </ThemedDialog>
    );
};

export default TextInputDialog;
