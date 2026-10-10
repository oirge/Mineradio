import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Download, Loader2, X } from 'lucide-react';

// src/components/command-palette/surfaces/LyricExportSurfaceParts.tsx
// Presentational pieces of the batch lyric export page: section headings, the multi-select option
// cards, the LRC-only extra chips, a plain toggle row and the pinned action bar. The page itself
// (LyricExportSurfaceView) keeps the options and the run; these only draw.

/** Colours derived once from the theme and day/night mode, shared by every piece. */
export type LyricExportTone = {
    accent: string;
    idleBorder: string;
    selectedTint: string;
    isDaylight: boolean;
};

export const createLyricExportTone = (accent: string, isDaylight: boolean): LyricExportTone => ({
    accent,
    idleBorder: isDaylight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)',
    selectedTint: isDaylight ? `${accent}12` : `${accent}18`,
    isDaylight,
});

export const SectionHeading: React.FC<{ icon: LucideIcon; label: string }> = ({ icon: Icon, label }) => (
    <h3
        className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-50"
        style={{ color: 'var(--text-secondary)' }}
    >
        <Icon size={13} /> {label}
    </h3>
);

/** A multi-select card: icon and title on top, one line of explanation, a check in the corner. */
export const OptionCard: React.FC<{
    tone: LyricExportTone;
    icon: LucideIcon;
    label: string;
    description: string;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}> = ({ tone, icon: Icon, label, description, selected, disabled, onClick }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={selected}
        className="relative flex flex-col gap-1.5 rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-60"
        style={selected
            ? { borderColor: tone.accent, boxShadow: `inset 0 0 0 1px ${tone.accent}`, backgroundColor: tone.selectedTint }
            : { borderColor: tone.idleBorder }}
    >
        <span className="flex items-center gap-2 pr-6">
            <Icon size={15} className={selected ? '' : 'opacity-50'} style={selected ? { color: tone.accent } : undefined} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
        </span>
        <span className="text-[11px] leading-snug opacity-50" style={{ color: 'var(--text-secondary)' }}>{description}</span>
        <span
            className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full border transition-colors"
            style={selected ? { backgroundColor: tone.accent, borderColor: tone.accent } : { borderColor: tone.idleBorder }}
        >
            {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </span>
    </button>
);

/** A small checkbox chip for the LRC-only extras. */
export const ExtraChip: React.FC<{
    tone: LyricExportTone;
    label: string;
    hint: string;
    checked: boolean;
    disabled: boolean;
    onClick: () => void;
}> = ({ tone, label, hint, checked, disabled, onClick }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={checked}
        title={hint}
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60"
        style={checked ? { borderColor: tone.accent, backgroundColor: tone.selectedTint } : { borderColor: tone.idleBorder }}
    >
        <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border"
            style={checked ? { backgroundColor: tone.accent, borderColor: tone.accent } : { borderColor: tone.idleBorder }}
        >
            {checked && <Check size={10} className="text-white" strokeWidth={3} />}
        </span>
        <span style={{ color: 'var(--text-primary)' }}>{label}</span>
    </button>
);

/** One setting row with a title, a line of explanation and a switch, in a settings card. */
export const ToggleCard: React.FC<{
    tone: LyricExportTone;
    cardClass: string;
    toggleOffBackgroundClass: string;
    label: string;
    description: string;
    active: boolean;
    disabled: boolean;
    onToggle: () => void;
}> = ({ tone, cardClass, toggleOffBackgroundClass, label, description, active, disabled, onToggle }) => (
    <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${cardClass}`}>
        <div className="min-w-0 space-y-1">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
            <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>{description}</div>
        </div>
        <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className={`h-6 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${!active ? toggleOffBackgroundClass : ''}`}
            style={{ backgroundColor: active ? tone.accent : undefined }}
            aria-pressed={active}
            aria-label={label}
        >
            <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
    </div>
);

/** The action bar pinned below the scroll area: status on the left, Export or Cancel on the right. */
export const RunBar: React.FC<{
    tone: LyricExportTone;
    statusText: string;
    isRunning: boolean;
    canStart: boolean;
    startLabel: string;
    cancelLabel: string;
    onStart: () => void;
    onCancel: () => void;
}> = ({ tone, statusText, isRunning, canStart, startLabel, cancelLabel, onStart, onCancel }) => (
    <div data-ponder-lyric-export-run className="shrink-0 border-t px-4 py-3" style={{ borderColor: tone.idleBorder }}>
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-4">
            <div className="min-w-0 text-xs opacity-60" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
                {statusText}
            </div>
            {isRunning ? (
                <button
                    type="button"
                    onClick={onCancel}
                    // Picked from the app's own day/night mode: Tailwind's `dark:` follows the OS,
                    // which disagrees with the app whenever the two are set differently.
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        tone.isDaylight ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/20'
                    }`}
                >
                    <Loader2 size={14} className="animate-spin" />
                    <X size={14} />
                    {cancelLabel}
                </button>
            ) : (
                <button
                    type="button"
                    disabled={!canStart}
                    onClick={onStart}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: tone.accent }}
                >
                    <Download size={14} />
                    {startLabel}
                </button>
            )}
        </div>
    </div>
);
