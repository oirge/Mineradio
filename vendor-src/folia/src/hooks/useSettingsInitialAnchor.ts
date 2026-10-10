import { useEffect, useRef } from 'react';
import type { SettingsAnchor } from '../components/modal/settings/navigation/settingsAnchorStore';
import type { SettingsModalState } from '../stores/useSettingsModalStore';

// src/hooks/useSettingsInitialAnchor.ts
// Lands the settings dialog on a section rather than at the top of its page.
//
// The scroll cannot happen when the request arrives: <SettingsAnchor> registers in a layout effect,
// so the target does not exist until the requested subview has mounted and rendered. Waiting for it
// to appear in the registry is the only signal that it is safe to scroll — and it is also what makes
// this work for the sections that render conditionally.

export const useSettingsInitialAnchor = (
    initialAnchor: SettingsModalState['initialAnchor'],
    anchors: SettingsAnchor[],
    scrollToAnchor: (anchorId: string) => void,
) => {
    // Keyed on the request's seq, not its id: asking for the same section twice has to scroll twice,
    // and a re-render that merely re-registers the anchors must not scroll at all.
    const servedSeqRef = useRef<number | null>(null);

    useEffect(() => {
        if (!initialAnchor) {
            servedSeqRef.current = null;
            return;
        }
        if (servedSeqRef.current === initialAnchor.seq) {
            return;
        }
        if (!anchors.some(anchor => anchor.id === initialAnchor.id)) {
            return;
        }

        servedSeqRef.current = initialAnchor.seq;
        scrollToAnchor(initialAnchor.id);
    }, [anchors, initialAnchor, scrollToAnchor]);
};
