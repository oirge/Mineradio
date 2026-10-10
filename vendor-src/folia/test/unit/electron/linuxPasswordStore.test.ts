import { describe, expect, it } from 'vitest';

// test/unit/electron/linuxPasswordStore.test.ts

const { resolveLinuxPasswordStore } = require('../../../electron/linuxPasswordStore.cjs') as {
    resolveLinuxPasswordStore: (options?: {
        platform?: string;
        env?: Record<string, string | undefined>;
        argv?: string[];
    }) => string | null;
};

const resolve = (
    env: Record<string, string | undefined>,
    argv: string[] = [],
    platform = 'linux',
) => resolveLinuxPasswordStore({ platform, env, argv });

describe('resolveLinuxPasswordStore', () => {
    it('selects libsecret for desktops Chromium does not recognise', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland' })).toBe('gnome-libsecret');
        expect(resolve({ XDG_CURRENT_DESKTOP: 'sway' })).toBe('gnome-libsecret');
        expect(resolve({})).toBe('gnome-libsecret');
    });

    it('leaves KDE sessions on Chromium detection so kwallet keeps its credentials', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'KDE' })).toBeNull();
        expect(resolve({ XDG_CURRENT_DESKTOP: 'kde' })).toBeNull();
        expect(resolve({ XDG_CURRENT_DESKTOP: 'plasma:KDE' })).toBeNull();
    });

    it('keeps forcing libsecret for GNOME-family desktops that already resolve there', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' })).toBe('gnome-libsecret');
    });

    it('never overrides an explicit launch flag', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland' }, ['folia', '--password-store=basic'])).toBeNull();
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland' }, ['folia', '--password-store', 'kwallet'])).toBeNull();
    });

    it('honours a supported FOLIA_PASSWORD_STORE override and ignores unknown values', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland', FOLIA_PASSWORD_STORE: 'kwallet6' })).toBe('kwallet6');
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland', FOLIA_PASSWORD_STORE: 'auto' })).toBeNull();
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland', FOLIA_PASSWORD_STORE: 'nonsense' })).toBeNull();
    });

    it('does nothing off Linux', () => {
        expect(resolve({ XDG_CURRENT_DESKTOP: 'Hyprland' }, [], 'darwin')).toBeNull();
        expect(resolve({}, [], 'win32')).toBeNull();
    });
});
