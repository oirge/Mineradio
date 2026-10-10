import { User } from 'lucide-react';
import ProviderConnectButton from './ProviderConnectButton';
import type { ProviderAccountSummary } from '../../../../types/onlineMusic';

// src/library/suites/grid/account/OnlineProviderConnectPanel.tsx

type OnlineProviderConnectPanelProps = {
    providers: ProviderAccountSummary[];
    isDaylight: boolean;
    title: string;
    prompt: string;
    getActionLabel: (provider: ProviderAccountSummary) => string;
    onSelect: (provider: ProviderAccountSummary) => void;
};

const OnlineProviderConnectPanel = ({
    providers,
    isDaylight,
    title,
    prompt,
    getActionLabel,
    onSelect,
}: OnlineProviderConnectPanelProps) => (
    <div className="flex flex-1 w-full flex-col items-center justify-center space-y-6 px-4">
        <div className={`w-20 h-20 rounded-3xl ${isDaylight ? 'bg-white/40 shadow-sm border border-black/5' : 'bg-white/5 border border-white/5'} flex items-center justify-center backdrop-blur-md`}>
            <User size={36} className="opacity-25" />
        </div>
        <div className="text-center max-w-md space-y-2">
            <h2 className="text-2xl font-bold opacity-90">{title}</h2>
            <p className="opacity-50 text-sm leading-6 whitespace-pre-line">{prompt}</p>
        </div>
        {/* 原先用 max-w-3xl / 四列容纳平台按钮；现在用可滚动的重叠徽章容纳动态 Mod 音源。 */}
        <ProviderConnectButton
            providers={providers}
            isDaylight={isDaylight}
            getActionLabel={getActionLabel}
            onSelect={onSelect}
        />
    </div>
);

export default OnlineProviderConnectPanel;
