import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMobileMotion } from '../../hooks/useMobileMotion';

// src/mineradio/local/useLocalFocusMotion.ts
// The existing host chrome measures before React commits and animates the same stage afterwards.
export function useLocalFocusMotion() {
    const { mobile } = useMobileMotion();
    const [focus, updateFocus] = useState(false);
    const requested = useRef(false);
    const committed = useRef(false);
    const pending = useRef(false);
    const setFocus = useCallback((value: boolean) => {
        if (requested.current === value) return;
        requested.current = value;
        if (mobile) {
            pending.current = true;
            document.dispatchEvent(new CustomEvent('mineradio-mobile-focus-before', { detail: { focus: value } }));
        }
        updateFocus(value);
        // Opposite requests in one event can leave React with its original state.
        // Complete that measurement immediately because there will be no layout change to commit.
        if (pending.current && value === committed.current) {
            pending.current = false;
            document.dispatchEvent(new CustomEvent('mineradio-mobile-focus-after', { detail: { focus: value } }));
        }
    }, [mobile]);
    useLayoutEffect(() => {
        committed.current = focus;
        if (!pending.current) return;
        pending.current = false;
        document.dispatchEvent(new CustomEvent('mineradio-mobile-focus-after', { detail: { focus } }));
    });
    return [focus, setFocus] as const;
}
