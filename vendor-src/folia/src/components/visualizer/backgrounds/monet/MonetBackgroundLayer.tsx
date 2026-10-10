import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DEFAULT_MONET_BACKGROUND_TUNING, type MonetBackgroundImage, type MonetBackgroundTuning, type Theme } from '../../../../types';
import { colorWithAlpha } from '../../colorMix';
import { getMonetBackgroundCacheKey, resolveMonetBackgroundDataUrl, checkCanvasFilterSupport } from '../../monet/monetBackgroundPipeline';
import { buildMonetDriftTrack } from './monetBackgroundDrift';
import { useReducedMotionFor } from '../../../../hooks/useReducedMotionFor';

// src/components/visualizer/backgrounds/monet/MonetBackgroundLayer.tsx
// Shared shell-level Monet image background with debounced bitmap post-processing.
interface MonetBackgroundLayerProps {
    coverUrl?: string | null;
    monetBackgroundImage?: MonetBackgroundImage | null;
    theme: Theme;
    isDaylight?: boolean;
    tuning?: MonetBackgroundTuning;
    transparentBackground?: boolean;
    staticMode?: boolean;
}

const PIPELINE_DEBOUNCE_MS = 180;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Plays the noise-driven drift track on `ref` for as long as it stays enabled. The keyframes are
 * handed to the Web Animations API rather than written per frame, so playback stays on the
 * compositor and costs no main-thread work once started.
 */
const useMonetBackgroundDrift = (
    ref: React.RefObject<HTMLDivElement | null>,
    enabled: boolean,
    strength: number,
    reducedMotion: boolean,
) => {
    useEffect(() => {
        const element = ref.current;
        if (!element || !enabled || strength <= 0 || typeof element.animate !== 'function') {
            return;
        }

        if (reducedMotion) return;

        const track = buildMonetDriftTrack(strength);
        const animation = element.animate(track.keyframes, {
            duration: track.durationMs,
            iterations: Infinity,
            easing: 'linear',
        });

        return () => animation.cancel();
    }, [enabled, ref, strength, reducedMotion]);
};

const resolveSourceUrl = (
    coverUrl: string | null | undefined,
    monetBackgroundImage: MonetBackgroundImage | null | undefined,
    tuning: MonetBackgroundTuning,
) => (
    tuning.backgroundSource === 'uploaded-global'
        ? monetBackgroundImage?.url ?? coverUrl ?? null
        : coverUrl ?? monetBackgroundImage?.url ?? null
);

const MonetBackgroundLayer: React.FC<MonetBackgroundLayerProps> = ({
    coverUrl,
    monetBackgroundImage,
    theme,
    isDaylight = false,
    tuning = DEFAULT_MONET_BACKGROUND_TUNING,
    transparentBackground = false,
    staticMode = false,
}) => {
    const [pipelineUrl, setPipelineUrl] = useState<string | null>(null);
    const sourceUrl = resolveSourceUrl(coverUrl, monetBackgroundImage, tuning);

    const fallbackGradient = useMemo(
        () => `linear-gradient(135deg, ${colorWithAlpha(theme.accentColor, 0.22)}, ${colorWithAlpha(theme.backgroundColor, 0.96)} 50%, ${colorWithAlpha(theme.primaryColor, 0.18)})`,
        [theme],
    );
    const readabilityGradient = useMemo(
        () => `linear-gradient(90deg, ${colorWithAlpha(theme.backgroundColor, 0.18)} 0%, ${colorWithAlpha(theme.backgroundColor, 0.32)} 34%, ${colorWithAlpha(theme.backgroundColor, 0.66)} 70%, ${colorWithAlpha(theme.backgroundColor, 0.82)} 100%)`,
        [theme],
    );
    const backgroundCacheKey = useMemo(
        () => getMonetBackgroundCacheKey({
            coverUrl,
            monetBackgroundImage,
            theme,
            tuning,
        }),
        [coverUrl, monetBackgroundImage, theme, tuning],
    );

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | undefined;

        if (!sourceUrl || transparentBackground) {
            setPipelineUrl(null);
            return () => {
                cancelled = true;
            };
        }

        timeoutId = window.setTimeout(() => {
            void resolveMonetBackgroundDataUrl({
                coverUrl,
                monetBackgroundImage,
                theme,
                tuning,
            }).then(url => {
                if (!cancelled) {
                    setPipelineUrl(current => (current === url ? current : url));
                }
            });
        }, PIPELINE_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [backgroundCacheKey, sourceUrl, transparentBackground]);

    const driftRef = useRef<HTMLDivElement | null>(null);
    const driftStrength = clamp(tuning.backgroundDriftStrength ?? 0, 0, 1);
    const driftEnabled = Boolean(tuning.backgroundDriftEnabled) && !staticMode && driftStrength > 0;
    const reduceBackgroundMotion = useReducedMotionFor('monetBackground');
    useMonetBackgroundDrift(driftRef, driftEnabled, driftStrength, reduceBackgroundMotion);
    // Only promote the layer while it actually moves; an idle drift wrapper stays a plain div.
    const driftStyle = useMemo<React.CSSProperties | undefined>(
        () => (driftEnabled ? { willChange: 'transform' } : undefined),
        [driftEnabled],
    );

    const isCanvasFilterSupported = useMemo(() => checkCanvasFilterSupport(), []);
    const blurValue = !isCanvasFilterSupported ? tuning.backgroundBlurPx : 0;

    const blurStyle = useMemo<React.CSSProperties>(() => {
        if (blurValue <= 0) return {};
        return {
            filter: `blur(${blurValue}px)`,
            WebkitFilter: `blur(${blurValue}px)`,
            transform: 'scale(1.1) translateZ(0)',
        };
    }, [blurValue]);

    if (transparentBackground) {
        return null;
    }

    const resolvedBackgroundImage = pipelineUrl
        ? `url(${pipelineUrl})`
        : sourceUrl
            ? `linear-gradient(135deg, ${colorWithAlpha(theme.accentColor, 0.2)}, ${colorWithAlpha(theme.backgroundColor, 0.78)}), url(${sourceUrl})`
            : fallbackGradient;

    if (tuning.backgroundLayout === 'full-overlay') {
        return (
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div ref={driftRef} className="absolute inset-0" style={driftStyle}>
                    <AnimatePresence initial={false}>
                        <motion.div
                            key={pipelineUrl || sourceUrl || 'fallback'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                            className="absolute inset-0"
                            style={{
                                backgroundColor: theme.backgroundColor,
                                backgroundImage: resolvedBackgroundImage,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                ...blurStyle,
                            }}
                        />
                    </AnimatePresence>
                </div>
                <div
                    className="absolute inset-0"
                    style={{ background: readabilityGradient }}
                />
            </div>
        );
    }

    const baseImageOpacity = isDaylight ? 0.7 : 0.3;
    const imageOpacity = baseImageOpacity + clamp(tuning.backgroundOverlayOpacity, 0, 1) * 0.16;
    const imagePositionX = clamp(50 + tuning.backgroundHalfPaneOffsetX, 10, 90);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden">
            <div
                className="absolute inset-0"
                style={{
                    backgroundColor: theme.backgroundColor,
                    backgroundImage: fallbackGradient,
                }}
            />
            <AnimatePresence initial={false}>
                {pipelineUrl || sourceUrl ? (
                    <div
                        className="absolute inset-y-0 left-0 w-[72%] sm:w-[68%] lg:w-[60%] overflow-hidden"
                        style={{
                            WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)',
                            maskImage: 'linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 48%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0) 100%)',
                        }}
                    >
                        <div ref={driftRef} className="absolute inset-0" style={driftStyle}>
                            <motion.div
                                key={pipelineUrl || sourceUrl || 'fallback'}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: imageOpacity }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8, ease: 'easeInOut' }}
                                className="absolute inset-0"
                                style={{
                                    backgroundImage: resolvedBackgroundImage,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: 'cover',
                                    backgroundPosition: `${imagePositionX}% center`,
                                    ...blurStyle,
                                }}
                            />
                        </div>
                    </div>
                ) : null}
            </AnimatePresence>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(90deg, ${colorWithAlpha(theme.backgroundColor, 0.14)} 0%, ${colorWithAlpha(theme.backgroundColor, 0.28)} 28%, ${colorWithAlpha(theme.backgroundColor, 0.62)} 64%, ${colorWithAlpha(theme.backgroundColor, 0.86)} 100%)`,
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `radial-gradient(circle at 18% 34%, ${colorWithAlpha(theme.accentColor, 0.18)}, transparent 36%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />
            <div
                className="absolute inset-0"
                style={{ background: readabilityGradient }}
            />
        </div>
    );
};

export default MonetBackgroundLayer;
