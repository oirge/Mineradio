import React, { useMemo } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import type {
    TemperaLayerImage,
    TemperaLayerImageAlign,
    TemperaLayerImageVerticalAlign,
} from '../../../types';
import { hashTemperaSeed } from './temperaRandom';
import { resolveTemperaImagePlacement } from './temperaImageLayer';
import { TemperaRangeControl } from './TemperaSettingsControls';
import type { TemperaDialogTokens } from './temperaDialogTokens';

// src/components/visualizer/tempera/TemperaImagePlacementEditor.tsx
// Edits one image through the same seeded placement calculation used by the Pixi runtime.
// Colors arrive as the dialog's tokens: this renders inside a portal on document.body, where
// the shell's --text-* vars do not resolve - see temperaDialogTokens.
const checkerBackground = (tint: string) => ({
    backgroundImage:
        'linear-gradient(45deg, ' + tint + ' 25%, transparent 25%),'
        + 'linear-gradient(-45deg, ' + tint + ' 25%, transparent 25%),'
        + 'linear-gradient(45deg, transparent 75%, ' + tint + ' 75%),'
        + 'linear-gradient(-45deg, transparent 75%, ' + tint + ' 75%)',
    backgroundSize: '14px 14px',
    backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
});

const HORIZONTAL_POSITIONS: Exclude<TemperaLayerImageAlign, 'free'>[] = ['left', 'center', 'right'];
const VERTICAL_POSITIONS: Exclude<TemperaLayerImageVerticalAlign, 'free'>[] = ['top', 'center', 'bottom'];

interface TemperaImagePlacementEditorProps {
    image: TemperaLayerImage;
    thumbnail?: string;
    t: TFunction;
    tokens: TemperaDialogTokens;
    rangeInputClass: string;
    onPatch: (id: string, next: Partial<TemperaLayerImage>) => void;
    onRemove: (id: string) => void;
}

interface ModeButtonProps {
    active: boolean;
    label: string;
    tokens: TemperaDialogTokens;
    onClick: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ active, label, tokens, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="rounded-full border px-3 py-1.5 text-xs transition-colors"
        style={{
            borderColor: active ? tokens.textPrimary : tokens.line,
            color: tokens.textPrimary,
            opacity: active ? 1 : 0.55,
        }}
    >
        {label}
    </button>
);

const TemperaImagePlacementEditor: React.FC<TemperaImagePlacementEditorProps> = ({
    image,
    thumbnail,
    t,
    tokens,
    rangeInputClass,
    onPatch,
    onRemove,
}) => {
    const placement = useMemo(
        () => resolveTemperaImagePlacement(image, hashTemperaSeed(`settings:${image.id}`)),
        [image],
    );
    const horizontalLabels: Record<Exclude<TemperaLayerImageAlign, 'free'>, string> = {
        left: t('options.temperaLayerAlignLeft'),
        center: t('options.temperaLayerAlignCenter'),
        right: t('options.temperaLayerAlignRight'),
    };
    const verticalLabels: Record<Exclude<TemperaLayerImageVerticalAlign, 'free'>, string> = {
        top: t('options.temperaLayerAlignTop'),
        center: t('options.temperaLayerAlignMiddle'),
        bottom: t('options.temperaLayerAlignBottom'),
    };

    return (
        <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor: tokens.line }}>
            <div
                className="relative w-full overflow-hidden rounded-xl border"
                style={{
                    ...checkerBackground(tokens.checkerTint),
                    borderColor: tokens.line,
                    aspectRatio: '16 / 9',
                }}
            >
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={image.name}
                        className="pointer-events-none absolute w-auto max-w-none object-contain"
                        style={{
                            height: `${placement.scale * 100}%`,
                            left: `${placement.x * 100}%`,
                            top: `${placement.y * 100}%`,
                            transform: `translate(-50%, -50%) rotate(${placement.rotation}rad) scaleX(${placement.flip ? -1 : 1})`,
                            opacity: placement.opacity,
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ImagePlus size={18} className="opacity-30" style={{ color: tokens.textSecondary }} />
                    </div>
                )}

                <div className="absolute inset-0 z-10 grid grid-cols-3 grid-rows-3">
                    {VERTICAL_POSITIONS.flatMap(verticalAlign => HORIZONTAL_POSITIONS.map(align => {
                        const active = image.align === align && image.verticalAlign === verticalAlign;
                        const label = t('options.temperaLayerAlignPosition', {
                            vertical: verticalLabels[verticalAlign],
                            horizontal: horizontalLabels[align],
                        });
                        return (
                            <button
                                key={`${verticalAlign}-${align}`}
                                type="button"
                                onClick={() => onPatch(image.id, { align, verticalAlign })}
                                aria-label={label}
                                aria-pressed={active}
                                title={label}
                                className={`group flex items-center justify-center border transition-colors ${tokens.hoverSurfaceClass}`}
                                style={{ borderColor: tokens.gridLine }}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full border transition-all group-hover:scale-125"
                                    style={{
                                        borderColor: active ? tokens.accent : tokens.markerBorder,
                                        backgroundColor: active ? tokens.accent : tokens.markerFill,
                                        boxShadow: active ? tokens.markerHalo : undefined,
                                    }}
                                />
                            </button>
                        );
                    }))}
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    className={`absolute right-2 top-2 z-20 rounded-full border p-1.5 backdrop-blur-sm transition-colors ${tokens.overlayButtonClass}`}
                    aria-label={t('options.temperaRemoveLayerImage')}
                    style={{ color: tokens.textPrimary, borderColor: tokens.line }}
                >
                    <Trash2 size={13} />
                </button>
            </div>

            <div className="space-y-2">
                <span className="block break-all text-xs leading-snug opacity-70" style={{ color: tokens.textPrimary }}>
                    {image.name}
                </span>
                <p className="text-xs opacity-50" style={{ color: tokens.textSecondary }}>
                    {t('options.temperaLayerAlignGridHint')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    <ModeButton
                        label={t('options.temperaLayerAlignVerticalRandom')}
                        tokens={tokens}
                        active={image.verticalAlign === 'free' && image.align !== 'free'}
                        onClick={() => onPatch(image.id, {
                            align: image.align === 'free' ? 'center' : image.align,
                            verticalAlign: 'free',
                        })}
                    />
                    <ModeButton
                        label={t('options.temperaLayerAlignHorizontalRandom')}
                        tokens={tokens}
                        active={image.align === 'free' && image.verticalAlign !== 'free'}
                        onClick={() => onPatch(image.id, {
                            align: 'free',
                            verticalAlign: image.verticalAlign === 'free' ? 'center' : image.verticalAlign,
                        })}
                    />
                    <ModeButton
                        label={t('options.temperaLayerAlignFree')}
                        tokens={tokens}
                        active={image.align === 'free' && image.verticalAlign === 'free'}
                        onClick={() => onPatch(image.id, { align: 'free', verticalAlign: 'free' })}
                    />
                </div>
            </div>

            <TemperaRangeControl
                label={t('options.temperaLayerImageScale')}
                value={image.scale}
                min={0.05}
                max={2}
                step={0.01}
                rangeInputClass={rangeInputClass}
                onChange={scale => onPatch(image.id, { scale })}
            />
            <TemperaRangeControl
                label={t('options.temperaLayerImageOpacity')}
                value={image.opacity}
                min={0}
                max={1}
                step={0.01}
                rangeInputClass={rangeInputClass}
                onChange={opacity => onPatch(image.id, { opacity })}
            />
        </div>
    );
};

export default React.memo(TemperaImagePlacementEditor);
