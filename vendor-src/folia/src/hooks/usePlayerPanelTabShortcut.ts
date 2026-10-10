import { useEffect } from 'react';
import type { PanelTab } from '../components/UnifiedPanel';
import { hasBlockingWindow } from '../utils/keyboardTargets';

// src/hooks/usePlayerPanelTabShortcut.ts
// Cycles through the tabs that are currently available in the open player panel.

type UsePlayerPanelTabShortcutParams = {
    isOpen: boolean;
    currentTab: PanelTab;
    availableTabs: PanelTab[];
    onTabChange: (tab: PanelTab) => void;
};

export const resolveCycledPanelTab = (
    currentTab: PanelTab,
    availableTabs: PanelTab[],
    direction: 1 | -1,
): PanelTab | null => {
    if (availableTabs.length === 0) {
        return null;
    }

    const currentIndex = availableTabs.indexOf(currentTab);
    if (currentIndex < 0) {
        return direction === 1 ? availableTabs[0] : availableTabs[availableTabs.length - 1];
    }

    return availableTabs[(currentIndex + direction + availableTabs.length) % availableTabs.length];
};

export const usePlayerPanelTabShortcut = ({
    isOpen,
    currentTab,
    availableTabs,
    onTabChange,
}: UsePlayerPanelTabShortcutParams) => {
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key !== 'Tab'
                || event.ctrlKey
                || event.altKey
                || event.metaKey
                || event.repeat
                || hasBlockingWindow()
            ) {
                return;
            }

            const nextTab = resolveCycledPanelTab(currentTab, availableTabs, event.shiftKey ? -1 : 1);
            if (!nextTab) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            onTabChange(nextTab);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [availableTabs, currentTab, isOpen, onTabChange]);
};
