import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

// test/helpers/appState.ts

/**
 * 与 vite.config.ts 注入的 __APP_VERSION__ 同源。
 *
 * 测试里绝对不要硬编码这个版本号。用户指引弹窗的判定是「已看版本 !== 当前版本就自动弹出」，
 * 硬编码的种子会在下一次发版时静默失效：弹窗以 z-[200] 盖住整页，所有点击被拦截，
 * 相关用例会以「locator 超时」或「截图大面积不一致」的形式失败，且看不出和版本号有关。
 */
export const APP_VERSION: string = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
).version as string;

/** 对应 src/stores/useSettingsModalStore.ts 的 LAST_SEEN_GUIDE_VERSION_STORAGE_KEY */
export const GUIDE_VERSION_STORAGE_KEY = 'folia_last_seen_ponder_onboarding_version';

/**
 * 应用首帧挂载的超时。dev server 下每个新页面都要逐个拉取几千个未打包的模块：单独跑约 9s，
 * 并行 worker 同时开页时实测 16–19s，超过 expect 默认的 15s。首批用例于是随机挂在
 * 「面板没打开」「Daily Mix 没出现」这类断言上，其实只是应用还没挂载完。
 */
export const APP_MOUNT_TIMEOUT_MS = 60_000;

/**
 * 等应用挂载完：AppSplashGate 在第一次 mount effect 里摘掉 index.html 的 #app-splash。
 * 挂载单独给足时间，之后的断言照旧用默认超时，真正的回归不会被放宽的超时掩盖。
 */
export const waitForAppMounted = async (page: Page) => {
    await page.locator('#app-splash').waitFor({ state: 'detached', timeout: APP_MOUNT_TIMEOUT_MS });
};
