import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OnlineProviderConnectPanel from '../../src/library/suites/grid/account/OnlineProviderConnectPanel';
import { canSwitchToProviderDirectly } from '../../src/library/core/model/onlineProviderAccountView';
import type { ProviderAccountSummary } from '../../src/types/onlineMusic';
import type { ProbeDefinition } from './definition';

// dev/probes/providerConnect.probe.tsx

const platforms = [['netease', '网易云'], ['kugou', '酷狗'], ['qq', 'QQ音乐'], ['bodian', '波点'], ['f14', 'F14']];
const providers: ProviderAccountSummary[] = platforms.map(([providerId, shortName]) => ({
    providerId, shortName, displayName: shortName, availability: { configured: true },
    requiresAccount: providerId !== 'f14', status: 'anonymous', user: null, collections: [],
}));

function ProviderConnectProbe() {
    const { t } = useTranslation();
    const [selected, setSelected] = useState('');
    const [many, setMany] = useState(false);
    const [daylight, setDaylight] = useState(false);
    const [hideMod, setHideMod] = useState(false);
    const list = [...providers.filter(provider => !hideMod || provider.providerId !== 'f14'),
        { ...providers[0], providerId: 'disabled', shortName: 'Disabled', availability: { configured: false } },
        { ...providers[0], providerId: 'hidden', shortName: 'Hidden', availability: { configured: false, reason: 'runtime-unavailable' as const } },
        ...(many ? Array.from({ length: 16 }, (_, i) => ({ ...providers[4], providerId: `mod-${i}`, shortName: `Mod ${i}` })) : []),
    ];
    return (
        <div className={`flex min-h-screen flex-col ${daylight ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-white'}`}>
            <div className="flex gap-4 p-4">
                <button onClick={() => setMany(!many)}>More sources</button>
                <button onClick={() => setDaylight(!daylight)}>Toggle theme</button>
                <button onClick={() => setHideMod(!hideMod)}>Remove F14</button>
                <output data-testid="selected">{selected}</output>
            </div>
            <OnlineProviderConnectPanel
                providers={list} isDaylight={daylight} title={t('home.guestTitle')} prompt={t('home.guestPrompt')}
                getActionLabel={provider => t(canSwitchToProviderDirectly(provider) ? 'home.switchToProvider' : 'home.loginToProvider', { provider: provider.shortName })}
                onSelect={provider => setSelected(provider.providerId)}
            />
        </div>
    );
}

export default {
    id: 'providerConnect', title: '平台连接入口',
    description: '动态音源、重叠徽章、鼠标和键盘选择、窄窗口溢出。', Component: ProviderConnectProbe,
} satisfies ProbeDefinition;
