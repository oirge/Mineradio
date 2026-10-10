import { useEffect, useState } from 'react';

// src/hooks/useFontsEpoch.ts
// Signals when web fonts finish loading so measured-text layout can be recomputed.

/**
 * Returns a counter that increments every time the document finishes loading web fonts.
 *
 * Canvas text measurement (`measureText`, and pretext on top of it) silently falls back to another
 * face while a web font is still in flight, and the metrics can be ~16% off — enough to change where
 * a lyric line wraps. Measurement caches are keyed by the font *string*, which is identical before
 * and after the load, so a stale measurement would otherwise survive for the whole session.
 *
 * Take this as a dependency wherever measured text drives layout, and clear the matching caches when
 * it changes. `loadingdone` is observed as well as `ready`, so fonts pulled in later — a theme switch
 * or a user-uploaded lyric font — invalidate the measurements too.
 */
export const useFontsEpoch = (): number => {
    const [epoch, setEpoch] = useState(0);

    useEffect(() => {
        const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
        if (!fonts) {
            return;
        }

        let mounted = true;
        // `ready` also settles for the batch that raised `loadingdone`, so let the event win and keep
        // the promise as the fallback for a batch that finished before this effect subscribed.
        let loadingDoneSeen = false;
        const bump = () => {
            if (mounted) {
                setEpoch(value => value + 1);
            }
        };
        const handleLoadingDone = () => {
            loadingDoneSeen = true;
            bump();
        };

        fonts.addEventListener?.('loadingdone', handleLoadingDone);
        // Nothing measured after this point can be stale when every face is already resolved.
        if (fonts.status !== 'loaded') {
            fonts.ready?.then(() => {
                if (!loadingDoneSeen) {
                    bump();
                }
            }).catch(() => undefined);
        }

        return () => {
            mounted = false;
            fonts.removeEventListener?.('loadingdone', handleLoadingDone);
        };
    }, []);

    return epoch;
};

export default useFontsEpoch;
