import { useState, useEffect } from 'react';

/**
 * Creates a locally fast-updating state that debounces synchronization to a parent.
 * This prevents heavy top-level re-renders from interrupting smooth scroll animations
 * when the user rapidly navigates through a grid.
 */
export function useDebouncedFocusSync(
    propValue: number,
    onChange: (val: number) => void,
    delayMs = 400
) {
    const [localValue, setLocalValue] = useState(propValue);

    // Sync from props if the parent changes it externally (e.g., initial load, restored state)
    useEffect(() => {
        setLocalValue(propValue);
    }, [propValue]);

    // Debounced sync to parent
    useEffect(() => {
        if (localValue === propValue) return;

        const timeout = setTimeout(() => {
            onChange(localValue);
        }, delayMs);

        return () => clearTimeout(timeout);
    }, [localValue, propValue, onChange, delayMs]);

    return [localValue, setLocalValue] as const;
}
