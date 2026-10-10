import { afterEach, describe, expect, it, vi } from 'vitest';
import { canRunLoginSelfCheck, runLoginSelfCheck } from '@/services/onlineMusic/loginSelfCheck';

// test/unit/onlineMusic/loginSelfCheck.test.ts

describe('provider login self-check entry', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('hands the check to the main process on the desktop build', async () => {
        const result = { providerId: 'netease', runtime: 'electron' };
        const runLoginSelfCheckBridge = vi.fn().mockResolvedValue(result);
        vi.stubGlobal('window', { electron: { runLoginSelfCheck: runLoginSelfCheckBridge } });

        expect(canRunLoginSelfCheck(null)).toBe(true);
        await expect(runLoginSelfCheck('netease', null)).resolves.toBe(result);
        expect(runLoginSelfCheckBridge).toHaveBeenCalledWith('netease');
    });

    it('probes the configured remote API on the web build', async () => {
        vi.stubGlobal('window', {});
        const fetchMock = vi.fn().mockResolvedValue({ status: 0 });
        vi.stubGlobal('fetch', fetchMock);

        expect(canRunLoginSelfCheck(null)).toBe(false);
        expect(canRunLoginSelfCheck('https://api.example.test/')).toBe(true);
        await expect(runLoginSelfCheck('qq', null)).resolves.toBeNull();

        const result = await runLoginSelfCheck('qq', 'https://api.example.test/');
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/', expect.objectContaining({ mode: 'no-cors', cache: 'no-store' }));
        // no-cors 的不透明响应没有状态码，但能拿到它就说明远端可达。
        expect(result).toMatchObject({
            providerId: 'qq',
            runtime: 'web',
            backend: { status: 'remote', url: 'https://api.example.test/', probe: { ok: true, httpStatus: null, error: null } },
            proxy: null,
            hosts: [],
        });
    });

    it('records an unreachable remote API instead of throwing', async () => {
        vi.stubGlobal('window', {});
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        await expect(runLoginSelfCheck('netease', 'https://api.example.test')).resolves.toMatchObject({
            backend: { probe: { ok: false, error: { code: null, message: 'Failed to fetch' } } },
        });
    });
});
