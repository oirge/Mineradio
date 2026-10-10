import { useHomeCardPositionStore } from '../stores/useHomeCardPositionStore';
import { useHomeLayoutSettingsStore } from '../stores/useHomeLayoutSettingsStore';

// src/hooks/useHomeCardPosition.ts
// Restores each home section by card identity, falling back to a bounded index after removal.

export const useHomeCardPosition = (
    scope: string | undefined,
    items: readonly { id: string | number }[],
    legacyIndex: number,
    onLegacyIndexChange: (index: number) => void,
    isLoading: boolean,
) => {
    const enabled = useHomeLayoutSettingsStore(state => state.rememberHomeCardPosition);
    const position = useHomeCardPositionStore(state => scope ? state.positions[scope] : undefined);
    const remembering = enabled && Boolean(scope);
    const matchingIndex = position ? items.findIndex(item => String(item.id) === position.id) : -1;
    const focusedIndex = remembering
        ? matchingIndex >= 0 ? matchingIndex : Math.min(position?.index ?? 0, Math.max(0, items.length - 1))
        : legacyIndex;

    const onFocusedIndexChange = (index: number) => {
        const item = items[index];
        // Empty/loading renders must never overwrite a bookmark before its data arrives.
        if (remembering && scope && item && !isLoading) {
            useHomeCardPositionStore.getState().remember(scope, { id: String(item.id), index });
        }
        onLegacyIndexChange(index);
    };

    return { focusedIndex, onFocusedIndexChange };
};
