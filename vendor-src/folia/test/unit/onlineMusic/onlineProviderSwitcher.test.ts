// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// test/unit/onlineMusic/onlineProviderSwitcher.test.ts
// The home switcher's row for a provider without accounts (a Folium mod source): it says no sign-in
// is needed instead of offering a QR scan, and picking it closes the menu like a signed-in provider.

vi.hoisted(() => {
    // jsdom 环境下 node 自带的 localStorage 占位没有 getItem，i18n 初始化会直接抛。
    const entries = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (key: string) => (entries.has(key) ? entries.get(key)! : null),
            setItem: (key: string, value: string) => { entries.set(key, String(value)); },
            removeItem: (key: string) => { entries.delete(key); },
            clear: () => { entries.clear(); },
            key: (index: number) => Array.from(entries.keys())[index] ?? null,
            get length() { return entries.size; },
        },
        configurable: true,
        writable: true,
    });
});

vi.mock('react-i18next', async importOriginal => ({
    ...(await importOriginal<typeof import('react-i18next')>()),
    useTranslation: () => ({ t: (key: string) => key }),
}));

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import OnlineProviderSwitcher from '@/library/suites/grid/account/OnlineProviderSwitcher';
import type { ProviderAccountSummary } from '@/types/onlineMusic';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const netease: ProviderAccountSummary = {
    providerId: 'netease',
    displayName: 'NetEase Cloud Music',
    shortName: '网易云',
    availability: { configured: true },
    requiresAccount: true,
    status: 'anonymous',
    user: null,
    collections: [],
};

const modSource: ProviderAccountSummary = {
    providerId: 'folium.mod-a.source',
    displayName: 'Mod Source',
    shortName: 'Mod',
    availability: { configured: true },
    requiresAccount: false,
    status: 'unknown',
    user: null,
    collections: [],
    hydration: 'loading',
};

let root: Root | null = null;

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.replaceChildren();
});

const renderOpenSwitcher = (onSelect: (provider: ProviderAccountSummary) => void) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(React.createElement(OnlineProviderSwitcher, {
        providers: [netease, modSource],
        activeProviderId: 'netease',
        isDaylight: false,
        onSelect,
        onLogout: () => {},
        onBackToPlayer: () => {},
    })));
    const toggle = host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    act(() => toggle.click());
    const row = (shortName: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
        .find(button => button.textContent?.includes(shortName))!;
    return { toggle, row };
};

describe('online provider switcher', () => {
    it('shows a mod source as needing no sign-in, without the login icon', () => {
        const { row } = renderOpenSwitcher(() => {});

        expect(row('Mod').textContent).toContain('home.providerNoAccount');
        expect(row('Mod').querySelector('.lucide-log-in')).toBeNull();
        // The NetEase row, signed out, still offers the scan.
        expect(row('网易云').textContent).toContain('home.providerNotLoggedIn');
    });

    it('selects a mod source and closes the menu', () => {
        const onSelect = vi.fn();
        const { toggle, row } = renderOpenSwitcher(onSelect);

        act(() => row('Mod').click());

        expect(onSelect).toHaveBeenCalledWith(modSource);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('gives a mod source a letter badge rather than a person icon', () => {
        const { row } = renderOpenSwitcher(() => {});
        const badge = row('Mod').querySelector('[aria-label="Mod Source"]')!;

        expect(badge.textContent).toBe('M');
        expect(badge.querySelector('svg')).toBeNull();
    });
});
