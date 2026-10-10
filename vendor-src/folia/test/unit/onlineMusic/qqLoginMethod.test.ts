import { beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/onlineMusic/qqLoginMethod.test.ts
// 登录方式选择走 omni 的泛型契约：UI 只认 QrLoginMethod，不认识任何 QQ 内部概念。

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/onlineMusic/qqTransport', () => ({
    getQqTransportAvailability: () => ({ configured: true }),
    hasQqSession: () => true,
    clearQqSession: vi.fn(),
    requestQq: requestMock,
}));

vi.mock('@/services/onlineMusic/providerStorage', () => ({
    writeProviderSessionValue: vi.fn(),
}));

vi.mock('@/utils/lyrics/providers/qqLyricProvider', () => ({
    searchQQLyrics: vi.fn(),
    fetchQQLyrics: vi.fn(),
}));

import { omni } from '@/services/onlineMusic/omni';
import { resetQqLoginChannelCache } from '@/services/onlineMusic/qqProvider';

describe('QQ login method selection', () => {
    beforeEach(() => {
        requestMock.mockReset();
        requestMock.mockResolvedValue({ code: 200, data: { unikey: 'qr-key', qrimg: 'data:image/png;base64,fixture' } });
        resetQqLoginChannelCache();
    });

    it('declares both scan methods with an i18n key and an icon key, never an asset', () => {
        const methods = omni.getQrLoginMethods('qq');

        expect(methods).toEqual([
            { id: 'qq', labelKey: 'home.qqLoginMethodMobile', iconKey: 'qq' },
            { id: 'wechat', labelKey: 'home.qqLoginMethodWechat', iconKey: 'wechat' },
        ]);
        // services 层不 import .svg：iconKey 只是字符串，映射留在 UI 层。
        for (const method of methods) {
            expect(method.iconKey).not.toMatch(/\.svg$/);
        }
    });

    it('reports no methods for providers with a single scan flow', () => {
        expect(omni.getQrLoginMethods('netease')).toEqual([]);
        expect(omni.getQrLoginMethods('kugou')).toEqual([]);
    });

    it('declares the QR lifetime only for QQ, whose session TTL we own', () => {
        // 后端 qq-music-api 的会话寿命是 180 秒，前端要早一步收手才有意义。
        expect(omni.getQrTtlMs('qq')).toBe(175_000);
        expect(omni.getQrTtlMs('qq')).toBeLessThan(180_000);
        // netease / kugou 的二维码能活多久我们无从得知，交给它们各自的后端去报过期。
        expect(omni.getQrTtlMs('netease')).toBeNull();
        expect(omni.getQrTtlMs('kugou')).toBeNull();
    });

    it('creates no QR session until a method is chosen', () => {
        omni.getQrLoginMethods('qq');

        // 读取方式列表只允许探测后端声明的通道，绝不能先去要一个二维码。
        const operations = requestMock.mock.calls.map(([operation]) => operation);
        expect(operations).not.toContain('login_qr_key');
        expect(operations).not.toContain('login_qr_create');
    });

    it('passes the chosen method to the backend as the channel parameter', async () => {
        await omni.createQrLogin('qq', 'wechat');

        expect(requestMock).toHaveBeenNthCalledWith(1, 'login_qr_key', { channel: 'wechat' });
    });

    it('falls back to the App channel when no method is given', async () => {
        await omni.createQrLogin('qq');

        expect(requestMock).toHaveBeenNthCalledWith(1, 'login_qr_key', { channel: 'qq' });
    });

    it('starts a fresh session per switch instead of reusing the previous choice', async () => {
        await omni.createQrLogin('qq', 'qq');
        await omni.createQrLogin('qq', 'wechat');
        await omni.createQrLogin('qq', 'qq');

        const channels = requestMock.mock.calls
            .filter(([operation]) => operation === 'login_qr_key')
            .map(([, params]) => params.channel);
        // 模块单例已删除：每次都由调用方明确指定，切换回来不会拿到上一次的残留值。
        expect(channels).toEqual(['qq', 'wechat', 'qq']);
    });
});

describe('QQ login channels declared by the backend', () => {
    beforeEach(() => {
        requestMock.mockReset();
        resetQqLoginChannelCache();
    });

    // 前端只显示该 runtime 真正支持的通道，不显示点进去必定失败的那个。
    const declare = (channels: string[]) => {
        requestMock.mockImplementation(async (operation: string) => (
            operation === 'login_channels'
                ? { code: 200, data: { channels, sessionMode: 'sealed', configured: true } }
                : { code: 200, data: {} }
        ));
    };

    it('hides the selector entirely when the backend serves a single channel', async () => {
        declare(['wechat']);

        const methods = await omni.resolveQrLoginMethods('qq');

        // 登录流程等待能力发现，用这同一份结果决定是否显示选择器与是否直接创建二维码。
        expect(methods).toEqual([]);
        expect(omni.getQrLoginMethods('qq')).toEqual([]);
    });

    it('uses the only declared channel when the hidden selector supplies no method', async () => {
        requestMock.mockImplementation(async (operation: string) => {
            if (operation === 'login_channels') {
                return { code: 200, data: { channels: ['wechat'], sessionMode: 'sealed', configured: true } };
            }
            if (operation === 'login_qr_key') return { code: 200, data: { unikey: 'qr-key' } };
            return { code: 200, data: { qrimg: 'data:image/png;base64,fixture' } };
        });

        omni.getQrLoginMethods('qq');
        await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith('login_channels'));
        await omni.createQrLogin('qq');

        expect(requestMock).toHaveBeenCalledWith('login_qr_key', { channel: 'wechat' });
    });

    it('keeps both methods when the backend declares both', async () => {
        declare(['qq', 'wechat']);

        omni.getQrLoginMethods('qq');
        await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith('login_channels'));

        expect(omni.getQrLoginMethods('qq').map(method => method.id)).toEqual(['qq', 'wechat']);
    });

    it('keeps the hardcoded methods when the route is missing on an older backend', async () => {
        requestMock.mockRejectedValue(new Error('404'));

        const methods = await omni.resolveQrLoginMethods('qq');

        // 旧后端没有这条路由，向后兼容的定义就是「行为和今天完全一样」。
        expect(methods.map(method => method.id)).toEqual(['qq', 'wechat']);
    });

    it('waits for delayed channel discovery before deriving the login flow', async () => {
        let finishProbe: ((value: unknown) => void) | undefined;
        requestMock.mockImplementation((operation: string) => (
            operation === 'login_channels'
                ? new Promise(resolve => { finishProbe = resolve; })
                : Promise.resolve({ code: 200, data: {} })
        ));

        let settled = false;
        const resolving = omni.resolveQrLoginMethods('qq').then(methods => {
            settled = true;
            return methods;
        });
        await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith('login_channels'));
        expect(settled).toBe(false);

        finishProbe?.({ code: 200, data: { channels: ['wechat'] } });

        await expect(resolving).resolves.toEqual([]);
    });

    it('retries a failed discovery when the user opens login later', async () => {
        requestMock
            .mockRejectedValueOnce(new Error('temporary network failure'))
            .mockResolvedValueOnce({ code: 200, data: { channels: ['wechat'] } });

        await expect(omni.resolveQrLoginMethods('qq')).resolves.toHaveLength(2);
        await expect(omni.resolveQrLoginMethods('qq')).resolves.toEqual([]);

        const probes = requestMock.mock.calls.filter(([operation]) => operation === 'login_channels');
        expect(probes).toHaveLength(2);
    });

    it('probes the backend only once however often the methods are read', async () => {
        declare(['qq', 'wechat']);

        omni.getQrLoginMethods('qq');
        omni.getQrLoginMethods('qq');
        await vi.waitFor(() => expect(requestMock).toHaveBeenCalledWith('login_channels'));
        omni.getQrLoginMethods('qq');

        const probes = requestMock.mock.calls.filter(([operation]) => operation === 'login_channels');
        expect(probes).toHaveLength(1);
    });
});
