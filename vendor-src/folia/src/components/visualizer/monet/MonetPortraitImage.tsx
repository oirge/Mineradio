import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    MONET_PORTRAIT_FADE_MS,
    pushMonetPortraitLayer,
    settleMonetPortraitLayers,
    type MonetPortraitLayer,
} from './monetPortraitCrossfade';

// src/components/visualizer/monet/MonetPortraitImage.tsx

type MonetPortraitImageProps = {
    src?: string | null;
    /** Crossfade length in milliseconds. */
    fadeMs?: number;
};

/**
 * Hands the cover over in place instead of replacing it.
 *
 * The frame used to swap the image node the moment a new URL arrived, so it stood empty for as
 * long as that URL took to reach the screen - the flash at a track change, and a long one whenever
 * the cover resolved from the network rather than the cache. Here the URL is decoded off-screen
 * first and only then stacked over the cover already showing, which means the frame is never empty
 * and a URL that never decodes at all (a revoked blob, the failure this component was originally
 * written for) leaves the previous cover up rather than punching a hole.
 */
const MonetPortraitImage: React.FC<MonetPortraitImageProps> = ({ src, fadeMs = MONET_PORTRAIT_FADE_MS }) => {
    const [layers, setLayers] = useState<MonetPortraitLayer[]>([]);
    const layerKeyRef = useRef(0);

    useEffect(() => {
        if (!src) {
            return undefined;
        }
        let cancelled = false;
        const stack = () => {
            if (cancelled) return;
            layerKeyRef.current += 1;
            const key = `monet-portrait-${layerKeyRef.current}`;
            setLayers(current => pushMonetPortraitLayer(current, src, key));
        };

        // Decoded on a detached element so the frame keeps showing the old cover until this one can
        // be painted whole. The rendered <img> below then hits the same decoded entry.
        const loader = new Image();
        loader.decoding = 'async';
        loader.src = src;
        if (typeof loader.decode === 'function') {
            // A rejection is a cover that cannot be shown - a dead blob URL, a 404, a truncated
            // body. Swallowed on purpose: the stack is left as it is, which keeps the cover that is
            // already on screen rather than fading to an empty frame.
            loader.decode().then(stack, () => {});
        } else {
            loader.onload = stack;
        }

        return () => {
            cancelled = true;
        };
    }, [src]);

    // Armed against the top layer only. A cover that arrives mid-fade pushes a new top and re-arms
    // this, so the whole stack is dropped in one go once that last cover is opaque - no layer is
    // ever removed while something below it is still visible through it.
    const settlingKey = layers.length > 1 ? layers[layers.length - 1].key : null;
    useEffect(() => {
        if (!settlingKey) {
            return undefined;
        }
        const timer = window.setTimeout(
            () => setLayers(current => settleMonetPortraitLayers(current, settlingKey)),
            fadeMs,
        );
        return () => window.clearTimeout(timer);
    }, [fadeMs, settlingKey]);

    // A song with no cover at all fades the stack out and keeps it, so the next cover has something
    // to fade in over instead of appearing against the bare frame.
    const targetOpacity = src ? 1 : 0;

    return (
        <div className="relative h-full w-full">
            {layers.map(layer => (
                <motion.img
                    key={layer.key}
                    src={layer.src}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: targetOpacity }}
                    transition={{ duration: fadeMs / 1000, ease: 'easeInOut' }}
                    decoding="async"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    data-monet-portrait-image
                />
            ))}
        </div>
    );
};

export default MonetPortraitImage;
