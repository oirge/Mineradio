import { describe, expect, it } from 'vitest';
import { resolveCycledPanelTab } from '../../../src/hooks/usePlayerPanelTabShortcut';

// test/unit/player-panel/panelTabShortcut.test.ts
// Covers forward, reverse, wraparound, and stale-tab recovery for panel keyboard navigation.

const tabs = ['cover', 'controls', 'queue', 'account'] as const;

describe('player panel tab shortcut', () => {
    it('cycles forward and wraps to the first tab', () => {
        expect(resolveCycledPanelTab('controls', [...tabs], 1)).toBe('queue');
        expect(resolveCycledPanelTab('account', [...tabs], 1)).toBe('cover');
    });

    it('cycles backward and wraps to the last tab', () => {
        expect(resolveCycledPanelTab('queue', [...tabs], -1)).toBe('controls');
        expect(resolveCycledPanelTab('cover', [...tabs], -1)).toBe('account');
    });

    it('recovers when a source-specific current tab is no longer available', () => {
        expect(resolveCycledPanelTab('local', [...tabs], 1)).toBe('cover');
        expect(resolveCycledPanelTab('local', [...tabs], -1)).toBe('account');
    });

    it('returns null when there are no available tabs', () => {
        expect(resolveCycledPanelTab('cover', [], 1)).toBeNull();
    });
});
