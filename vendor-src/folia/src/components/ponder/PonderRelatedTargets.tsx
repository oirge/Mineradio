import React from 'react';
import { ArrowRight, Component } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePonderStore } from '../../stores/usePonderStore';
import type { PonderTargetDefinition } from '../../types/ponder';
import { findPonderTarget } from './ponderRegistry';

// src/components/ponder/PonderRelatedTargets.tsx

type PonderRelatedTargetsProps = {
    target: PonderTargetDefinition;
    accent: string;
    isDaylight: boolean;
};

const PonderRelatedTargets: React.FC<PonderRelatedTargetsProps> = ({ target, accent, isDaylight }) => {
    const { t } = useTranslation();
    const relatedTargets = (target.relatedTargetIds ?? [])
        .map(findPonderTarget)
        .filter((candidate): candidate is PonderTargetDefinition => Boolean(candidate?.isAvailable?.() ?? candidate));

    if (!target.relatedTargetIds) {
        return null;
    }

    return (
        <aside
            data-testid="ponder-related-targets"
            className={`absolute right-5 top-16 z-20 w-56 rounded-2xl border p-3 backdrop-blur-md ${
                isDaylight ? 'border-black/10 bg-white/75' : 'border-white/10 bg-zinc-900/75'
            }`}
        >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-60">
                <Component size={14} aria-hidden="true" />
                {t('ponder.componentsOnPage')}
            </div>
            {relatedTargets.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {relatedTargets.map(candidate => (
                        <button
                            key={candidate.id}
                            type="button"
                            onClick={() => usePonderStore.getState().openPonder(candidate.id)}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/10"
                        >
                            <span>{t(candidate.titleKey)}</span>
                            <ArrowRight size={13} style={{ color: accent }} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-xs opacity-50">{t('ponder.noComponentsOnPage')}</p>
            )}
        </aside>
    );
};

export default PonderRelatedTargets;
