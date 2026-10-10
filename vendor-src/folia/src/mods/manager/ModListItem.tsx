import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, ChevronDown, CircleCheck, CircleOff, ShieldAlert, ShieldCheck, ShieldQuestion, Square, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '@/types';
import { SettingsToggle } from '../../components/modal/settings/SettingsRow';
import type { ModRuntimeInfo } from '../types';
import { ModSurfaceRenderer } from '../ModSurfaceRenderer';
import type { ModManagerClasses } from './modManagerClasses';

// src/mods/manager/ModListItem.tsx
// One mod as a row of the manager's list card. The row expands in place to show the mod's
// metadata, grants, signature state and its own command surface, so params get the full width.

/*
 * Maps a loader error code onto its localized message. Codes that have no entry
 * (a raw JS message from a mod's own failure) fall through to themselves, and
 * `value` is supplied for the messages that quote the underlying detail.
 */
export const translateModError = (
    t: (key: string, options: Record<string, unknown>) => string,
    error: string | null | undefined,
    fallbackCode: string,
): string => {
    const code = error ?? fallbackCode;
    return t(`mods.errors.${code}`, { value: code, defaultValue: code });
};

/*
 * Everything the trust dialog listed for this mod, as chips: permissions,
 * experimental opt-ins, embeddable origins, and the internals pin.
 */
const describeModGrants = (mod: ModRuntimeInfo): string[] => [
    ...mod.permissions,
    ...(mod.experimental ?? []).map((feature) => `experimental:${feature}`),
    ...(mod.embedOrigins ?? []).map((origin) => `embed:${origin}`),
    ...(mod.folia ? [`internals:${mod.folia}`] : []),
];

/*
 * The signature badge shown in the collapsed row. Unsigned mods get none there
 * (most third-party mods are unsigned, so a badge would be noise); the expanded
 * row explains all three states.
 */
const SignatureBadge: React.FC<{ mod: ModRuntimeInfo; isDaylight: boolean }> = ({ mod, isDaylight }) => {
    const { t } = useTranslation();
    const { status } = mod.signature;
    if (status === 'verified') {
        return (
            <span title={t('mods.signatureVerified')} className={`shrink-0 ${isDaylight ? 'text-emerald-600' : 'text-emerald-300'}`}>
                <ShieldCheck size={14} />
            </span>
        );
    }
    if (status === 'invalid') {
        return (
            <span title={t('mods.signatureInvalid')} className={`shrink-0 ${isDaylight ? 'text-amber-700' : 'text-amber-300'}`}>
                <ShieldAlert size={14} />
            </span>
        );
    }
    return null;
};

/* One line in the expanded row saying what the signature state means. */
const SignatureNotice: React.FC<{ mod: ModRuntimeInfo; isDaylight: boolean; classes: ModManagerClasses }> = ({ mod, isDaylight, classes }) => {
    const { t } = useTranslation();
    const { status, reason, keyId, keyLabel } = mod.signature;
    if (status === 'verified') {
        return (
            <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${classes.success}`}>
                <ShieldCheck size={14} className="mt-px shrink-0" />
                <span>
                    <span className="font-medium">{t('mods.signatureVerified')}</span>
                    {' · '}
                    {t('mods.signatureVerifiedDetail', { key: keyLabel ? `${keyLabel}, ${keyId}` : keyId })}
                </span>
            </div>
        );
    }
    if (status === 'invalid') {
        const reasonText = t(`mods.signatureReasons.${reason ?? 'malformed'}`, { defaultValue: reason ?? '' });
        return (
            <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${classes.warning}`}>
                <ShieldAlert size={14} className="mt-px shrink-0" />
                <span>
                    <span className="font-medium">{t('mods.signatureInvalid')}</span>
                    {' · '}
                    {t('mods.signatureInvalidDetail', { reason: reasonText })}
                </span>
            </div>
        );
    }
    return (
        <div
            className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${isDaylight ? 'bg-black/[0.04]' : 'bg-white/5'}`}
            style={{ color: 'var(--text-secondary)' }}
        >
            <ShieldQuestion size={14} className="mt-px shrink-0" />
            <span>
                <span className="font-medium">{t('mods.signatureUnsigned')}</span>
                {' · '}
                {t('mods.signatureUnsignedDetail')}
            </span>
        </div>
    );
};

const StatusIcon: React.FC<{ status: string; isDaylight: boolean }> = ({ status, isDaylight }) => {
    if (status === 'loaded') return <CircleCheck size={15} className={`${isDaylight ? 'text-emerald-600' : 'text-emerald-300'} shrink-0`} />;
    if (status === 'disabled') return <CircleOff size={15} className={`${isDaylight ? 'text-zinc-400' : 'text-white/35'} shrink-0`} />;
    return <TriangleAlert size={15} className={`${isDaylight ? 'text-red-600' : 'text-red-300'} shrink-0`} />;
};

type ModListItemProps = {
    mod: ModRuntimeInfo;
    expanded: boolean;
    selected: boolean;
    selectionMode: boolean;
    isLast: boolean;
    isDaylight: boolean;
    theme: Theme;
    classes: ModManagerClasses;
    onToggleExpand: () => void;
    onToggleEnabled: () => void;
    onToggleSelected: () => void;
};

export const ModListItem: React.FC<ModListItemProps> = ({
    mod, expanded, selected, selectionMode, isLast, isDaylight, theme, classes, onToggleExpand, onToggleEnabled, onToggleSelected,
}) => {
    const { t } = useTranslation();
    const grants = describeModGrants(mod);
    const meta = [mod.id, `v${mod.version ?? '-'}`, mod.author].filter(Boolean).join(' · ');

    const activate = () => {
        if (selectionMode) {
            onToggleSelected();
            return;
        }
        onToggleExpand();
    };

    return (
        <div className={isLast ? '' : `border-b ${classes.divider}`}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={activate}
                onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate();
                    }
                }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                    expanded ? classes.expandedRow : classes.rowHover
                } ${selected ? classes.expandedRow : ''}`}
            >
                {selectionMode ? (
                    <span className={`shrink-0 ${selected ? '' : classes.muted}`} style={selected ? { color: 'var(--text-primary)' } : undefined}>
                        {selected ? <CheckSquare size={15} /> : <Square size={15} />}
                    </span>
                ) : (
                    <StatusIcon status={mod.status} isDaylight={isDaylight} />
                )}
                <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</span>
                        <SignatureBadge mod={mod} isDaylight={isDaylight} />
                    </div>
                    <div className="text-[11px] opacity-50 truncate" style={{ color: 'var(--text-secondary)' }}>{meta}</div>
                </div>
                <div onClick={(event) => event.stopPropagation()} className="shrink-0">
                    <SettingsToggle
                        checked={mod.enabled}
                        onChange={onToggleEnabled}
                        offClass={classes.toggleOff}
                        onColor={theme.secondaryColor}
                        ariaLabel={mod.enabled ? t('mods.enabled') : t('mods.disabled')}
                    />
                </div>
                <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`shrink-0 ${classes.muted} ${selectionMode ? 'invisible' : ''}`}
                >
                    <ChevronDown size={15} />
                </motion.span>
            </div>

            <AnimatePresence initial={false}>
                {expanded ? (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                        className="overflow-hidden"
                    >
                        <div className={`px-4 pb-4 pt-3 flex flex-col gap-3 border-t text-left ${classes.divider} ${classes.expandedRow}`}>
                            {mod.description ? (
                                <div className="text-xs leading-relaxed opacity-75" style={{ color: 'var(--text-primary)' }}>{mod.description}</div>
                            ) : null}
                            {grants.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {grants.map((grant) => (
                                        <span
                                            key={grant}
                                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] opacity-70 ${classes.chip}`}
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            {grant}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            <SignatureNotice mod={mod} isDaylight={isDaylight} classes={classes} />
                            {mod.devSource ? (
                                <div className="text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>{t('mods.devSourceHint')}</div>
                            ) : null}
                            {mod.trustStale ? (
                                <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${classes.warning}`}>
                                    <TriangleAlert size={14} className="mt-px shrink-0" />
                                    <span>{t('mods.trustRevoked')}</span>
                                </div>
                            ) : null}
                            {mod.error ? (
                                <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${classes.danger}`}>
                                    <TriangleAlert size={14} className="mt-px shrink-0" />
                                    <span className="break-all">{translateModError(t, mod.error, 'unknown')}</span>
                                </div>
                            ) : null}

                            {mod.status === 'loaded' ? (
                                <ModSurfaceRenderer modId={mod.id} theme={theme} isDaylight={isDaylight} />
                            ) : (
                                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                    {mod.enabled ? t('mods.notLoaded') : t('mods.modDisabledHint')}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
};

export default ModListItem;
