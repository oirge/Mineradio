import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/navidrome/navidromeServerPreset.test.ts
// Docker 预置凭据的优先级：手动配置 > 预置；清除过就不再自动套用；预置配置跟随服务端更新。

const PRESET = { configured: true, serverUrl: 'http://nas:4533/', username: 'family', password: 'pw1' };

const createStorage = () => {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, String(value)); },
        removeItem: (key: string) => { data.delete(key); },
        clear: () => data.clear(),
    };
};

const loadModules = async () => {
    vi.resetModules();
    const service = await import('@/services/navidromeService');
    const preset = await import('@/services/navidromeServerPreset');
    return { service, preset };
};

const stubPresetResponse = (body: unknown) => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

describe('navidromeServerPreset', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', createStorage());
        vi.stubGlobal('window', { __FOLIA_RUNTIME_CONFIG__: { deployment: 'docker' } });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('writes the preset into an empty browser and marks it as server-owned', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('applied');
        expect(service.getNavidromeConfig()).toEqual({ serverUrl: 'http://nas:4533', username: 'family', passwordHash: 'pw1' });
        expect(service.getNavidromeConfigOrigin()).toBe('server');
    });

    it('never overrides a config the user entered by hand', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        service.saveNavidromeConfig({ serverUrl: 'http://other:4533', username: 'me', passwordHash: 'mine' });

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(service.getNavidromeConfig()?.serverUrl).toBe('http://other:4533');
    });

    it('does not hit the network when the preset cannot apply', async () => {
        const fetchMock = stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        service.saveNavidromeConfig({ serverUrl: 'http://other:4533', username: 'me', passwordHash: 'mine' });
        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');

        service.clearNavidromeConfig();
        service.dismissNavidromeServerPreset();
        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats a 403 from the gateway source restriction as no preset', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));
        const { service, preset } = await loadModules();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(service.getNavidromeConfig()).toBeNull();
    });

    it('follows the server when a preset-owned config changes', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        service.saveNavidromeConfig({ serverUrl: 'http://nas:4533', username: 'family', passwordHash: 'old' }, 'server');

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('updated');
        expect(service.getNavidromeConfig()?.passwordHash).toBe('pw1');
        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
    });

    it('stays logged out after the user clears the config, until they restore the preset', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        await preset.applyNavidromeServerPreset();
        service.clearNavidromeConfig();
        service.dismissNavidromeServerPreset();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(service.getNavidromeConfig()).toBeNull();

        await expect(preset.restoreNavidromeServerPreset()).resolves.toMatchObject({ username: 'family' });
        expect(service.getNavidromeConfigOrigin()).toBe('server');
        expect(service.isNavidromeServerPresetDismissed()).toBe(false);
    });

    it('a programmatic clear without dismissing lets the preset come back', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        await preset.applyNavidromeServerPreset();
        service.clearNavidromeConfig();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('applied');
    });

    it('boot turns Navidrome on for a first-time browser', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();

        await expect(preset.bootNavidromeServerPreset()).resolves.toBe('applied');
        expect(service.isNavidromeEnabled()).toBe(true);
    });

    it('boot keeps an explicit off switch', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        service.setNavidromeEnabled(false);

        await expect(preset.bootNavidromeServerPreset()).resolves.toBe('applied');
        expect(service.isNavidromeEnabled()).toBe(false);
    });

    it('boot gives up after the timeout and leaves storage alone', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { service, preset } = await loadModules();

        const pending = preset.bootNavidromeServerPreset();
        await vi.advanceTimersByTimeAsync(preset.NAVIDROME_PRESET_BOOT_TIMEOUT_MS);
        await expect(pending).resolves.toBe('skipped');
        expect(service.getNavidromeConfig()).toBeNull();
        vi.useRealTimers();
    });

    it('the boot deadline does not abort the shared request', async () => {
        vi.useFakeTimers();
        let respond: (value: unknown) => void = () => {};
        vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { respond = resolve; })));
        const { preset } = await loadModules();

        const boot = preset.bootNavidromeServerPreset();
        await vi.advanceTimersByTimeAsync(preset.NAVIDROME_PRESET_BOOT_TIMEOUT_MS);
        await expect(boot).resolves.toBe('skipped');

        const later = preset.fetchNavidromeServerPreset();
        respond({ ok: true, json: async () => PRESET });
        await expect(later).resolves.toMatchObject({ username: 'family' });
    });

    it('re-marks a hand-entered copy of the preset as server-owned, ignoring URL spelling', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        const typed = { serverUrl: 'HTTP://NAS:4533//', username: 'family', passwordHash: 'pw1' };
        service.saveNavidromeConfig(typed);

        await expect(preset.markNavidromeConfigAsPresetIfMatching(typed)).resolves.toBe(true);
        expect(service.getNavidromeConfigOrigin()).toBe('server');
    });

    it('leaves a different hand-entered account as manual', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        const typed = { serverUrl: 'http://nas:4533', username: 'me', passwordHash: 'pw1' };
        service.saveNavidromeConfig(typed);

        await expect(preset.markNavidromeConfigAsPresetIfMatching(typed)).resolves.toBe(false);
        expect(service.getNavidromeConfigOrigin()).toBe('manual');
    });

    it('restore replaces a manual config with the preset', async () => {
        stubPresetResponse(PRESET);
        const { service, preset } = await loadModules();
        service.saveNavidromeConfig({ serverUrl: 'http://other:4533', username: 'me', passwordHash: 'mine' });

        await preset.restoreNavidromeServerPreset();
        expect(service.getNavidromeConfig()?.serverUrl).toBe('http://nas:4533');
        expect(service.getNavidromeConfigOrigin()).toBe('server');
    });

    it('does not call the endpoint outside the Docker deployment', async () => {
        vi.stubGlobal('window', { __FOLIA_RUNTIME_CONFIG__: {} });
        const fetchMock = stubPresetResponse(PRESET);
        const { preset } = await loadModules();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats an unconfigured backend as no preset', async () => {
        stubPresetResponse({ configured: false });
        const { service, preset } = await loadModules();

        await expect(preset.applyNavidromeServerPreset()).resolves.toBe('skipped');
        expect(service.getNavidromeConfig()).toBeNull();
    });
});
