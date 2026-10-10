import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLoginStatusFailure, isAuthRequiredFailure } from '@/services/onlineMusic/loginStatusFailure';
import { OnlineProviderError } from '@/types/onlineMusic';
import type { ProviderUser } from '@/types/onlineMusic';

// test/unit/onlineMusic/loginStatusFailure.test.ts
// 登录状态检查出错时的分流：网络类错误保留缓存账号，只有 auth-required 才清账号。

const cachedUser: ProviderUser = { id: '42', nickname: 'cached' };

const setup = (cached: ProviderUser | null) => {
    const clearAuthState = vi.fn().mockResolvedValue(undefined);
    const updateAccount = vi.fn();
    const handlers = {
        providerId: 'kugou' as const,
        cachedUser: cached,
        fallbackMessage: 'login_status_failed',
        clearAuthState,
        updateAccount,
    };
    return { clearAuthState, updateAccount, handlers };
};

describe('login status failure handling', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    it('recognizes only OnlineProviderError auth-required as an auth failure', () => {
        expect(isAuthRequiredFailure(new OnlineProviderError('auth-required', 'x', 'kugou'))).toBe(true);
        expect(isAuthRequiredFailure(new OnlineProviderError('network', 'x', 'kugou'))).toBe(false);
        expect(isAuthRequiredFailure(new Error('auth-required'))).toBe(false);
        expect(isAuthRequiredFailure({ code: 'auth-required' })).toBe(false);
        expect(isAuthRequiredFailure(undefined)).toBe(false);
    });

    it('keeps the cached account and snapshot on a network error', async () => {
        const { clearAuthState, updateAccount, handlers } = setup(cachedUser);

        const result = await handleLoginStatusFailure(
            new OnlineProviderError('network', 'KuGou request failed (operation=user_detail status=502)', 'kugou'),
            handlers,
        );

        expect(result).toBeNull();
        expect(clearAuthState).not.toHaveBeenCalled();
        expect(updateAccount).toHaveBeenCalledTimes(1);
        expect(updateAccount).toHaveBeenCalledWith({
            status: 'authenticated',
            error: 'KuGou request failed (operation=user_detail status=502)',
            hydration: 'ready',
            freshness: 'error',
        });
        // The patch must not carry user/collections, otherwise the cached account would be overwritten.
        expect(Object.keys(updateAccount.mock.calls[0][0])).not.toContain('user');
        expect(Object.keys(updateAccount.mock.calls[0][0])).not.toContain('collections');
    });

    it('keeps the cached account on unknown (non-provider) errors too', async () => {
        const { clearAuthState, updateAccount, handlers } = setup(cachedUser);

        await handleLoginStatusFailure('[object Object]', handlers);

        expect(clearAuthState).not.toHaveBeenCalled();
        expect(updateAccount).toHaveBeenCalledWith(expect.objectContaining({
            status: 'authenticated',
            error: 'login_status_failed',
            freshness: 'error',
        }));
    });

    it('marks the account as error, without clearing, when there was no cached account', async () => {
        const { clearAuthState, updateAccount, handlers } = setup(null);

        await handleLoginStatusFailure(new OnlineProviderError('network', 'offline', 'kugou'), handlers);

        expect(clearAuthState).not.toHaveBeenCalled();
        expect(updateAccount).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error: 'offline' }));
    });

    it('clears the account with auth-required when the provider reports a rejected login', async () => {
        const { clearAuthState, updateAccount, handlers } = setup(cachedUser);

        const result = await handleLoginStatusFailure(
            new OnlineProviderError('auth-required', 'KuGou login required', 'kugou'),
            handlers,
        );

        expect(result).toBeNull();
        expect(clearAuthState).toHaveBeenCalledTimes(1);
        expect(clearAuthState).toHaveBeenCalledWith('auth-required');
        expect(updateAccount).not.toHaveBeenCalled();
    });

    // QQ 的原始错误文字可能带上后端或网络层的细节：只去掉 name / message，其余字段照记。
    it('logs QQ failures without the raw error name and message', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        warn.mockClear();
        const { handlers } = setup(cachedUser);

        await handleLoginStatusFailure(
            new OnlineProviderError('network', 'private-error https://private.example/?cookie=private-cookie', 'qq', undefined, 502),
            { ...handlers, providerId: 'qq' },
        );

        expect(warn).toHaveBeenCalledExactlyOnceWith('[LoginStatus] failure', {
            providerId: 'qq',
            hadCachedAccount: true,
            authRequired: false,
        });
    });

    it('keeps the raw error name and message for other providers', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        warn.mockClear();
        const { handlers } = setup(null);

        await handleLoginStatusFailure(new OnlineProviderError('auth-required', 'KuGou login required', 'kugou'), handlers);

        expect(warn).toHaveBeenCalledExactlyOnceWith('[LoginStatus] failure', {
            providerId: 'kugou',
            hadCachedAccount: false,
            authRequired: true,
            name: 'OnlineProviderError',
            message: 'KuGou login required',
        });
    });

    it('clears an auth failure without an error flag when no account was cached', async () => {
        const { clearAuthState, handlers } = setup(null);

        await handleLoginStatusFailure(new OnlineProviderError('auth-required', 'login required', 'kugou'), handlers);

        expect(clearAuthState).toHaveBeenCalledWith(undefined);
    });
});
