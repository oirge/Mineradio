import { LibraryBig, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/library/suites/grid/account/OnlineProviderAccountlessPanel.tsx

type OnlineProviderAccountlessPanelProps = {
    providerLabel: string;
    isDaylight: boolean;
    onSearch: () => void;
};

// Shown on the online tabs when the active provider has no account (a Folium mod source): it only
// searches and plays, so instead of a library this points the user at the search box. Playlists,
// albums and radio for mod sources are left to the full provider interface in Folium v2.
const OnlineProviderAccountlessPanel = ({ providerLabel, isDaylight, onSearch }: OnlineProviderAccountlessPanelProps) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-1 w-full flex-col items-center justify-center space-y-6 px-4" data-testid="online-provider-accountless">
            <div className={`w-20 h-20 rounded-3xl ${isDaylight ? 'bg-white/40 shadow-sm border border-black/5' : 'bg-white/5 border border-white/5'} flex items-center justify-center backdrop-blur-md`}>
                <LibraryBig size={36} className="opacity-25" />
            </div>
            <div className="text-center max-w-md space-y-2">
                <h2 className="text-2xl font-bold opacity-90">{t('home.accountlessTitle', { provider: providerLabel })}</h2>
                <p className="opacity-50 text-sm leading-6 whitespace-pre-line">{t('home.accountlessBody')}</p>
            </div>
            <button
                type="button"
                onClick={onSearch}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-105 cursor-pointer border bg-white text-black border-white shadow-md"
            >
                <Search size={16} />
                <span>{t('home.accountlessSearch')}</span>
            </button>
        </div>
    );
};

export default OnlineProviderAccountlessPanel;
