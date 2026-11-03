import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SLOT_ACTIONS, type LocalActionId } from './localCommandCatalog';

// src/mineradio/local/useLocalControlsStore.ts
// Two distinct shortcuts share one persisted layout across lyric and floating-record controls.
export const DEFAULT_LOCAL_SLOTS: [LocalActionId, LocalActionId] = ['mode', 'like'];
export function normalizeLocalSlots(raw: unknown): [LocalActionId, LocalActionId] {
    const values = Array.isArray(raw) ? raw : [];
    const valid = (value: unknown): value is LocalActionId => SLOT_ACTIONS.some(action => action.id === value);
    const first = valid(values[0]) ? values[0] : DEFAULT_LOCAL_SLOTS[0];
    const second = valid(values[1]) && values[1] !== first ? values[1]
        : SLOT_ACTIONS.find(action => action.id === DEFAULT_LOCAL_SLOTS[1] && action.id !== first)?.id
            ?? SLOT_ACTIONS.find(action => action.id !== first)!.id;
    return [first, second];
}
interface LocalControlsState {
    slots: [LocalActionId, LocalActionId];
    assign: (index: 0 | 1, action: LocalActionId) => void;
    reset: () => void;
}
export const useLocalControlsStore = create<LocalControlsState>()(persist(set => ({
    slots: [...DEFAULT_LOCAL_SLOTS],
    assign: (index, action) => set(state => {
        if (!SLOT_ACTIONS.some(item => item.id === action) || state.slots[index] === action) return state;
        const slots: [LocalActionId, LocalActionId] = [...state.slots];
        if (slots[1 - index] === action) slots[1 - index] = slots[index];
        slots[index] = action;
        return { slots };
    }),
    reset: () => set({ slots: [...DEFAULT_LOCAL_SLOTS] }),
}), { name: 'mineradio-folia-local-controls-v1', partialize: state => ({ slots: state.slots }),
    merge: (saved, current) => ({ ...current, slots: normalizeLocalSlots((saved as { slots?: unknown } | null)?.slots) }) }));
