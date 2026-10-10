import React, { useEffect, useState } from 'react';
import type { Theme } from '../../types';
import { normalizeFontFamilyStack } from '../../utils/fontStacks';

// src/components/visualizer/FontFallbackStackControl.tsx
// Edits an ordered CSS font-family fallback list while keeping normalization in the shared font utility.
interface FontFallbackStackControlProps {
    label: string;
    value: string[];
    onChange?: (families: string[]) => void;
    theme: Theme;
    placeholder?: string;
}

const parseDraftFontFamilies = (draft: string) => normalizeFontFamilyStack(draft.split(/[,\n]/));

const areFontStacksEqual = (left: string[], right: string[]) => (
    left.length === right.length && left.every((family, index) => family === right[index])
);

const FontFallbackStackControl: React.FC<FontFallbackStackControlProps> = ({
    label,
    value,
    onChange,
    theme,
    placeholder,
}) => {
    const [draft, setDraft] = useState(value.join(', '));

    useEffect(() => {
        setDraft(value.join(', '));
    }, [value]);

    const commitDraft = () => {
        const next = parseDraftFontFamilies(draft);
        setDraft(next.join(', '));
        if (!areFontStacksEqual(next, value)) {
            onChange?.(next);
        }
    };

    return (
        <label className="flex flex-col gap-2">
            <span className="text-sm" style={{ color: theme.primaryColor }}>
                {label}
            </span>
            <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                rows={2}
                placeholder={placeholder}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors focus:border-white/25"
                style={{
                    color: theme.primaryColor,
                    caretColor: theme.accentColor,
                }}
            />
        </label>
    );
};

export default FontFallbackStackControl;
