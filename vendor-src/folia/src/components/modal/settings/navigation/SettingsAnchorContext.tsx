import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createSettingsAnchorStore, type SettingsAnchor as SettingsAnchorEntry, type SettingsAnchorStore } from './settingsAnchorStore';
// src/components/modal/settings/navigation/SettingsAnchorContext.tsx
// Lets a settings subview declare its sections where they render, so the sidebar table of contents
// follows conditional and late-arriving sections without a second hand-maintained list.

const SettingsAnchorContext = createContext<SettingsAnchorStore | null>(null);

const EMPTY_ANCHORS: SettingsAnchorEntry[] = [];
const NOOP_SUBSCRIBE = () => () => {};
const EMPTY_SNAPSHOT = () => EMPTY_ANCHORS;

/**
 * Creates the registry.
 *
 * The owner holds it rather than the provider, because the sidebar reads the anchors while the
 * content column fills them in — both have to sit inside the same provider.
 */
export const useSettingsAnchorStore = (): SettingsAnchorStore => useMemo(() => createSettingsAnchorStore(), []);

export const SettingsAnchorProvider: React.FC<{ store: SettingsAnchorStore; children: React.ReactNode }> = ({ store, children }) => (
    <SettingsAnchorContext.Provider value={store}>{children}</SettingsAnchorContext.Provider>
);

/** Sections registered in `store`, in document order. */
export const useSettingsAnchorList = (store: SettingsAnchorStore | null): SettingsAnchorEntry[] => useSyncExternalStore(
    store ? store.subscribe : NOOP_SUBSCRIBE,
    store ? store.getSnapshot : EMPTY_SNAPSHOT,
    EMPTY_SNAPSHOT,
);

/** Same list, for components rendered inside the provider. */
export const useSettingsAnchors = (): SettingsAnchorEntry[] => useSettingsAnchorList(useContext(SettingsAnchorContext));

type SettingsAnchorProps = {
    anchorId: string;
    /** Shown in the sidebar table of contents. */
    label: string;
    className?: string;
    children: React.ReactNode;
};

/**
 * A settings section that publishes itself to the sidebar table of contents.
 *
 * Renders the same `<section>` the subviews used before, so swapping one in is not a visual change.
 * Registration is keyed on the element rather than the id, because StrictMode replays the mount as
 * register/unregister/register and an id-keyed teardown would drop the surviving registration.
 */
export const SettingsAnchor: React.FC<SettingsAnchorProps> = ({ anchorId, label, className, children }) => {
    const nodeRef = useRef<HTMLElement | null>(null);
    const store = useContext(SettingsAnchorContext);

    useLayoutEffect(() => {
        const node = nodeRef.current;
        if (!store || !node) {
            return;
        }

        return store.register({ id: anchorId, label, node });
    }, [store, anchorId, label]);

    return (
        <section ref={nodeRef} id={`settings-${anchorId}`} data-settings-anchor={anchorId} className={className}>
            {children}
        </section>
    );
};

export default SettingsAnchor;
