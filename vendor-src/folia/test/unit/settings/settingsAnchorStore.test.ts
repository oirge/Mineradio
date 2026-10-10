import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsAnchorStore, type AnchorNode } from '../../../src/components/modal/settings/navigation/settingsAnchorStore';

// test/unit/settings/settingsAnchorStore.test.ts
// The sidebar table of contents reads this store through useSyncExternalStore, so the two things
// that matter are document ordering (sections register whenever their effects happen to run) and
// snapshot identity (a fresh array on every read renders forever).

const DOCUMENT_POSITION_FOLLOWING = 4;

/** Stand-in for a DOM node whose document order is just its index in `order`. */
const makeNodes = (count: number): AnchorNode[] => {
    const nodes: AnchorNode[] = [];
    for (let index = 0; index < count; index += 1) {
        nodes.push({
            compareDocumentPosition: (other: AnchorNode) => (
                nodes.indexOf(other) > index ? DOCUMENT_POSITION_FOLLOWING : 2
            ),
        });
    }
    return nodes;
};

describe('settingsAnchorStore', () => {
    let store: ReturnType<typeof createSettingsAnchorStore>;
    let nodes: AnchorNode[];

    beforeEach(() => {
        store = createSettingsAnchorStore();
        nodes = makeNodes(4);
    });

    it('sorts by document position regardless of registration order', () => {
        store.register({ id: 'third', label: 'Third', node: nodes[2] });
        store.register({ id: 'first', label: 'First', node: nodes[0] });
        store.register({ id: 'second', label: 'Second', node: nodes[1] });

        expect(store.getSnapshot().map(anchor => anchor.id)).toEqual(['first', 'second', 'third']);
    });

    it('slots a late arrival into its document position rather than the end', () => {
        store.register({ id: 'a', label: 'A', node: nodes[0] });
        store.register({ id: 'c', label: 'C', node: nodes[2] });
        store.register({ id: 'b', label: 'B', node: nodes[1] });

        expect(store.getSnapshot().map(anchor => anchor.id)).toEqual(['a', 'b', 'c']);
    });

    it('returns the same snapshot reference when the sequence has not changed', () => {
        store.register({ id: 'a', label: 'A', node: nodes[0] });
        const first = store.getSnapshot();

        expect(store.getSnapshot()).toBe(first);
    });

    it('removes an anchor when its registration is disposed', () => {
        store.register({ id: 'a', label: 'A', node: nodes[0] });
        const disposeB = store.register({ id: 'b', label: 'B', node: nodes[1] });

        disposeB();

        expect(store.getSnapshot().map(anchor => anchor.id)).toEqual(['a']);
    });

    it('survives the StrictMode register/unregister/register replay', () => {
        const first = store.register({ id: 'a', label: 'A', node: nodes[0] });
        first();
        store.register({ id: 'a', label: 'A', node: nodes[0] });

        // Disposing by id would have dropped the live registration here.
        expect(store.getSnapshot().map(anchor => anchor.id)).toEqual(['a']);
    });

    it('notifies subscribers only when the sequence actually changes', () => {
        const listener = vi.fn();
        store.subscribe(listener);

        store.register({ id: 'a', label: 'A', node: nodes[0] });
        expect(listener).toHaveBeenCalledTimes(1);

        store.register({ id: 'b', label: 'B', node: nodes[1] });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('reports a relabelled anchor as a change', () => {
        const dispose = store.register({ id: 'a', label: 'A', node: nodes[0] });
        const before = store.getSnapshot();

        // A language switch re-runs the registration effect with a new label.
        dispose();
        store.register({ id: 'a', label: 'Renamed', node: nodes[0] });

        expect(store.getSnapshot()).not.toBe(before);
        expect(store.getSnapshot().map(anchor => anchor.label)).toEqual(['Renamed']);
    });
});
