import type { LoginSelfCheckResult, OnlineProviderId } from '../../types/onlineMusic';

// src/services/onlineMusic/loginSelfCheck.ts
// provider 的扫码自检入口：桌面版交给主进程（electron/loginSelfCheck.cjs：本地后端、代理、DNS、分协议族的 TCP / TLS、HTTPS）；
// 网页版浏览器做不了这些，只检查配置的远端 API 能不能连上。provider 只需告诉这里自己的远端地址。

const WEB_PROBE_TIMEOUT_MS = 8000;

const hasElectronSelfCheck = (): boolean => (
    typeof window !== 'undefined' && typeof window.electron?.runLoginSelfCheck === 'function'
);

/** 此刻能不能自检：桌面版总能；网页版要配置了远端 API。 */
export const canRunLoginSelfCheck = (remoteBase: string | null): boolean => hasElectronSelfCheck() || Boolean(remoteBase);

// 网页版：no-cors 请求只要拿到任何响应（哪怕是不透明的）就说明远端可达；网络层失败才会抛 TypeError。
const probeRemoteApi = async (providerId: OnlineProviderId, remoteBase: string): Promise<LoginSelfCheckResult> => {
    const startedAt = Date.now();
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), WEB_PROBE_TIMEOUT_MS) : null;
    let probe: NonNullable<LoginSelfCheckResult['backend']>['probe'];
    try {
        const response = await fetch(`${remoteBase.replace(/\/$/, '')}/`, {
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller?.signal,
        });
        probe = { ok: true, httpStatus: response.status || null, durationMs: Date.now() - startedAt, error: null };
    } catch (error) {
        probe = {
            ok: false,
            httpStatus: null,
            durationMs: Date.now() - startedAt,
            error: {
                code: error instanceof DOMException && error.name === 'AbortError' ? 'ETIMEDOUT' : null,
                message: error instanceof Error ? error.message : String(error),
            },
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
    return {
        providerId,
        runtime: 'web',
        startedAt,
        durationMs: Date.now() - startedAt,
        backend: { status: 'remote', port: null, error: null, probe, url: remoteBase },
        proxy: null,
        hosts: [],
    };
};

/** 跑一次自检；没有可检查的对象时返回 null。自己不抛错：失败写进结果里。 */
export const runLoginSelfCheck = async (
    providerId: OnlineProviderId,
    remoteBase: string | null,
): Promise<LoginSelfCheckResult | null> => {
    if (hasElectronSelfCheck()) return window.electron!.runLoginSelfCheck!(providerId);
    if (!remoteBase) return null;
    return probeRemoteApi(providerId, remoteBase);
};
