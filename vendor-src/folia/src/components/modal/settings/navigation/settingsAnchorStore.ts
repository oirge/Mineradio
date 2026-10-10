// src/components/modal/settings/navigation/settingsAnchorStore.ts
// Registry the settings subviews publish their sections into, so the sidebar can build a table of
// contents for whichever sections actually rendered.

/** The part of a DOM node this store needs, kept narrow so tests can register plain stubs. */
export interface AnchorNode {
    compareDocumentPosition(other: AnchorNode): number;
}

export interface SettingsAnchor {
    id: string;
    label: string;
    node: AnchorNode;
}

export interface SettingsAnchorStore {
    register(anchor: SettingsAnchor): () => void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): SettingsAnchor[];
    reset(): void;
}

// Node.DOCUMENT_POSITION_FOLLOWING, spelled out so this module stays usable without a DOM.
const DOCUMENT_POSITION_FOLLOWING = 4;

const isSameSequence = (a: SettingsAnchor[], b: SettingsAnchor[]): boolean => (
    a.length === b.length && a.every((anchor, index) => anchor.id === b[index].id && anchor.label === b[index].label)
);

/**
 * Creates an anchor registry.
 *
 * Sections register on mount in whatever order React runs their effects, and conditional ones
 * appear later once their async status lands, so the registry sorts by document position instead
 * of trusting registration order. `getSnapshot` returns the previous array whenever the resulting
 * sequence is unchanged — `useSyncExternalStore` re-renders forever on a fresh reference.
 */
export const createSettingsAnchorStore = (): SettingsAnchorStore => {
    const entries = new Set<SettingsAnchor>();
    const listeners = new Set<() => void>();
    let snapshot: SettingsAnchor[] = [];

    const rebuild = () => {
        const next = [...entries].sort((a, b) => (
            a.node.compareDocumentPosition(b.node) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        ));

        if (isSameSequence(snapshot, next)) {
            return;
        }

        snapshot = next;
        listeners.forEach(listener => listener());
    };

    return {
        register(anchor) {
            entries.add(anchor);
            rebuild();
            // Unregister by entry identity: StrictMode replays mount as register/unregister/register,
            // and deleting by id would let the first teardown drop the second registration.
            return () => {
                entries.delete(anchor);
                rebuild();
            };
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => snapshot,
        reset() {
            entries.clear();
            snapshot = [];
        },
    };
};
