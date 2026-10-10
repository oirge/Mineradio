import type { NavidromeConfig } from '../types/navidrome';
import {
    clearNavidromeServerProfile,
    getNavidromeConfig,
    getNavidromeConfigOrigin,
    hasNavidromeEnabledPreference,
    hashPassword,
    isNavidromeServerPresetDismissed,
    saveNavidromeConfig,
    setNavidromeEnabled,
} from './navidromeService';

// src/services/navidromeServerPreset.ts
// Docker 部署可以在 backend 预置一组 Navidrome 凭据（NAVIDROME_URL / _USERNAME / _PASSWORD），
// 新打开的浏览器自动登录，不用每台设备各填一遍。
//
// 优先级：浏览器里手动填的配置 > 服务端预置。预置只在这几种情况下写入：
//   - 浏览器里没有配置，且用户没在这里清除过；
//   - 现有配置本来就是预置写入的（管理员改了密码或地址时跟上）；
//   - 用户在设置页点了「恢复使用服务器预置」。
//
// 启动时由 bootstrap 在 React 渲染之前调用 bootNavidromeServerPreset：曲库概览、恢复播放、
// 设置页都在挂载时读一次配置，预置晚到一步它们就会拿着旧配置或空配置跑完。

type NavidromeServerPreset = {
    serverUrl: string;
    username: string;
    password: string;
};

export type NavidromePresetApplyResult = 'applied' | 'updated' | 'skipped';

const PRESET_ENDPOINT = '/api/navidrome-preset';
// 启动最多为预置挡首屏这么久。局域网正常几十毫秒；等不到就照常启动，下次打开再套用。
// 只是启动不再等，请求本身不中止：设置页之后还能拿到同一个结果。
export const NAVIDROME_PRESET_BOOT_TIMEOUT_MS = 1500;
// 请求本身的上限。请求被共享，不设上限的话一个挂住的请求会卡住之后所有调用。
const NAVIDROME_PRESET_REQUEST_TIMEOUT_MS = 5000;

// 一次页面生命周期只问一次：启动和设置页都会用到，凭据不会在会话中途变。
let presetRequest: Promise<NavidromeServerPreset | null> | null = null;

/** 只有 Docker gateway 的 runtime-config.js 带 deployment:'docker'；Electron 和其他 Web 部署不发请求。 */
export const canUseNavidromeServerPreset = (): boolean => (
    typeof window !== 'undefined' && window.__FOLIA_RUNTIME_CONFIG__?.deployment === 'docker'
);

const requestPreset = async (): Promise<NavidromeServerPreset | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAVIDROME_PRESET_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(PRESET_ENDPOINT, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return null;
        const body = await response.json() as Partial<NavidromeServerPreset> & { configured?: boolean };
        if (!body.configured || !body.serverUrl || !body.username || !body.password) return null;
        return { serverUrl: body.serverUrl, username: body.username, password: body.password };
    } catch (error) {
        console.warn('[Navidrome] Failed to fetch server preset:', error);
        return null;
    } finally {
        clearTimeout(timer);
    }
};

export const fetchNavidromeServerPreset = (): Promise<NavidromeServerPreset | null> => {
    if (!canUseNavidromeServerPreset()) return Promise.resolve(null);
    if (!presetRequest) {
        presetRequest = requestPreset().then((preset) => {
            // 失败不缓存：网关重启后打开设置页还能再试。
            if (!preset) presetRequest = null;
            return preset;
        });
    }
    return presetRequest;
};

/** 等 promise 最多 ms 毫秒，超时给 fallback；不取消 promise 本身。 */
const waitAtMost = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};

/** 比对用的地址形态：去掉所有结尾斜杠，协议和主机名小写、省略默认端口（交给 URL 解析）。 */
const normalizeServerUrl = (url: string): string => {
    const trimmed = url.trim().replace(/\/+$/, '');
    try {
        const parsed = new URL(trimmed);
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
        return trimmed;
    }
};

export const toNavidromePresetConfig = (preset: NavidromeServerPreset): NavidromeConfig => ({
    serverUrl: preset.serverUrl.replace(/\/+$/, ''),
    username: preset.username,
    passwordHash: hashPassword(preset.password),
});

export const isSameNavidromeCredentials = (a: NavidromeConfig, b: NavidromeConfig): boolean => (
    normalizeServerUrl(a.serverUrl) === normalizeServerUrl(b.serverUrl)
    && a.username === b.username
    && a.passwordHash === b.passwordHash
);

const writePreset = (preset: NavidromeServerPreset, current: NavidromeConfig | null): void => {
    const next = toNavidromePresetConfig(preset);
    if (current?.serverUrl !== next.serverUrl || current?.username !== next.username) {
        clearNavidromeServerProfile();
    }
    saveNavidromeConfig(next, 'server');
};

/** 按上面的优先级决定是否写入预置。'applied' 表示这个浏览器第一次拿到配置。 */
export const applyNavidromeServerPreset = async (waitMs?: number): Promise<NavidromePresetApplyResult> => {
    // 先看本地：手动配置或清除过时预置注定用不上，不必为它发请求、更不必挡着首屏。
    const before = getNavidromeConfig();
    if (before ? getNavidromeConfigOrigin() !== 'server' : isNavidromeServerPresetDismissed()) return 'skipped';

    const request = fetchNavidromeServerPreset();
    const preset = await (waitMs === undefined ? request : waitAtMost(request, waitMs, null));
    if (!preset) return 'skipped';

    const current = getNavidromeConfig();
    if (current) {
        if (getNavidromeConfigOrigin() !== 'server') return 'skipped';
        if (isSameNavidromeCredentials(current, toNavidromePresetConfig(preset))) return 'skipped';
        writePreset(preset, current);
        return 'updated';
    }

    if (isNavidromeServerPresetDismissed()) return 'skipped';
    writePreset(preset, null);
    return 'applied';
};

/**
 * 渲染前调用：写入预置，第一次拿到配置且用户没表过态时顺手打开 Navidrome。
 * 只写 localStorage；已经按旧值初始化的 store 由调用方同步。
 */
export const bootNavidromeServerPreset = async (): Promise<NavidromePresetApplyResult> => {
    const result = await applyNavidromeServerPreset(NAVIDROME_PRESET_BOOT_TIMEOUT_MS);
    if (result === 'applied' && !hasNavidromeEnabledPreference()) {
        setNavidromeEnabled(true);
    }
    return result;
};

/**
 * 设置页手动测试成功、已按手动配置保存之后调用：凭据其实就是预置的话改标成预置，
 * 以后管理员改密码时这个浏览器还会跟。等预置期间用户又改了配置就不动。
 */
export const markNavidromeConfigAsPresetIfMatching = async (config: NavidromeConfig): Promise<boolean> => {
    const preset = await fetchNavidromeServerPreset();
    if (!preset || !isSameNavidromeCredentials(config, toNavidromePresetConfig(preset))) return false;
    const stored = getNavidromeConfig();
    if (!stored || getNavidromeConfigOrigin() !== 'manual' || !isSameNavidromeCredentials(stored, config)) return false;
    saveNavidromeConfig(stored, 'server');
    return true;
};

/** 设置页「恢复使用服务器预置」：丢掉手动配置，改回预置。拿不到预置时返回 null，不动现有配置。 */
export const restoreNavidromeServerPreset = async (): Promise<NavidromeConfig | null> => {
    const preset = await fetchNavidromeServerPreset();
    if (!preset) return null;
    writePreset(preset, getNavidromeConfig());
    return getNavidromeConfig();
};
