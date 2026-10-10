import { useMemo, useRef } from 'react';

// src/hooks/useStableCallbacks.ts
//
// Gives a hook's event-time callbacks a permanent identity while still dispatching to the current
// render's implementation.
//
// The alternative - a useCallback per function with a hand-written dependency list - does not scale
// past a hook this size and fails open: one missed dependency is a stale closure that no test
// catches. It also does not actually solve the problem here, because a useCallback whose deps
// include another unstable callback is itself unstable, and that cascade is what keeps every
// build*Model memo from ever holding.
//
// Only for callbacks invoked from events, effects, or async work - never for a function whose
// result is read during render on the assumption that a changed identity means a changed value.
//
// The latest implementations are captured during render, NOT in an effect. An effect would leave a
// window between commit and the effect running where the wrapper still dispatches to the previous
// render's closure, which is precisely the race the note at useAutomixDecks.ts:399 describes.

type AnyFunction = (...args: never[]) => unknown;

export const useStableCallbacks = <T extends Record<string, AnyFunction>>(callbacks: T): T => {
    const latest = useRef(callbacks);
    latest.current = callbacks;

    // Keyed off the first render's shape: a hook's returned callback set is fixed, and rebuilding
    // the wrappers would defeat the whole point.
    return useMemo(() => {
        const stable = {} as Record<string, AnyFunction>;
        for (const key of Object.keys(callbacks)) {
            stable[key] = ((...args: never[]) => latest.current[key](...args)) as AnyFunction;
        }
        return stable as T;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

// Same guarantee applied to a whole hook return: values pass through untouched and every entry
// that is a function on the first render gets a permanent identity. Use this when a hook returns a
// mixed surface and listing its callbacks by hand would just be a second place to keep in sync.
export const useStableActionSurface = <T extends Record<string, unknown>>(source: T): T => {
    const latest = useRef(source);
    latest.current = source;

    const wrappers = useMemo(() => {
        const stable: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(source)) {
            if (typeof value === 'function') {
                stable[key] = (...args: unknown[]) => (
                    (latest.current[key] as (...callArgs: unknown[]) => unknown)(...args)
                );
            }
        }
        return stable;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { ...source, ...wrappers } as T;
};
