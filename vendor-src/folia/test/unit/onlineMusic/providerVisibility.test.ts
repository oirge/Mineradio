import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import OnlineProviderConnectPanel from '@/library/suites/grid/account/OnlineProviderConnectPanel';
import OnlineProviderSwitcher from '@/library/suites/grid/account/OnlineProviderSwitcher';
import { vi } from 'vitest';
import type { ProviderAccountSummary } from '@/types/onlineMusic';

// test/unit/onlineMusic/providerVisibility.test.ts — runtime-only providers should not appear in the Web UI.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => vi.unstubAllGlobals());
const providers = [
    { providerId: 'bodian', displayName: '波点音乐', shortName: '波点', availability: { configured: false, reason: 'runtime-unavailable' } },
    { providerId: 'netease', displayName: '网易云音乐', shortName: '网易云', availability: { configured: true } },
    { providerId: 'qq', displayName: 'QQ 音乐', shortName: 'QQ', availability: { configured: false, reason: 'missing-api-base' } },
] as ProviderAccountSummary[];

describe('provider UI availability', () => {
    it('hides runtime-unavailable login actions while keeping configurable providers', () => {
        const html = renderToStaticMarkup(createElement(OnlineProviderConnectPanel, {
            providers, isDaylight: true, title: 'Login', prompt: '', getActionLabel: p => p.displayName, onSelect: () => {},
        }));
        expect(html).not.toContain('波点');
        expect(html).toContain('网易云音乐');
        expect(html).toContain('QQ 音乐');
    });
    it('does not select a hidden provider as the switcher fallback', () => {
        const html = renderToStaticMarkup(createElement(OnlineProviderSwitcher, {
            providers, activeProviderId: 'bodian', isDaylight: true, onSelect: () => {}, onLogout: () => {}, onBackToPlayer: () => {},
        }));
        expect(html).not.toContain('波点音乐');
        expect(html).toContain('网易云音乐');
    });
    it('preserves a nested Kuwo HTTP avatar in Electron', () => {
        vi.stubGlobal('window', { electron: {} });
        const avatarUrl = 'http://img1.kwcdn.kuwo.cn/star/avatar.jpg';
        const html = renderToStaticMarkup(createElement(OnlineProviderSwitcher, {
            providers: [{ ...providers[0], availability: { configured: true }, user: { id: '1', nickname: 'Test', avatarUrl } }],
            activeProviderId: 'bodian', isDaylight: true, onSelect: () => {}, onLogout: () => {}, onBackToPlayer: () => {},
        }));
        expect(html).toContain(`src="${avatarUrl}"`);
    });
});
