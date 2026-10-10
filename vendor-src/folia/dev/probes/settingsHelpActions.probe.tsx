import React, { useState } from 'react';
import SettingsHelpActions from '../../src/components/modal/SettingsHelpActions';
import ReleaseNotesDialog from '../../src/components/modal/ReleaseNotesDialog';
import PonderHost from '../../src/components/ponder/PonderHost';
import { openPonderNavigation } from '../../src/services/ponder/pagePonderTarget';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import type { ProbeDefinition } from './definition';

// dev/probes/settingsHelpActions.probe.tsx

const ProbeBody: React.FC = () => {
    const [showReleaseNotes, setShowReleaseNotes] = useState(false);

    return (
        <div
            data-ponder-page-scope="help-page"
            className="min-h-screen bg-zinc-950 p-10 text-white"
            style={{ '--text-primary': '#fafafa', '--text-secondary': '#a1a1aa' } as React.CSSProperties}
        >
            <SettingsHelpActions
                onOpenReleaseNotes={() => setShowReleaseNotes(true)}
                onOpenPonder={openPonderNavigation}
            />
            <ReleaseNotesDialog
                isOpen={showReleaseNotes}
                isDaylight={false}
                theme={DEFAULT_THEME}
                onClose={() => setShowReleaseNotes(false)}
            />
            <PonderHost theme={DEFAULT_THEME} isDaylight={false} />
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'settingsHelpActions',
    title: 'Help · 版本更新与页面思索入口',
    description: '验证两个入口各自打开 release notes 和 Help 页面级 Ponder。',
    Component: ProbeBody,
};

export default probe;
