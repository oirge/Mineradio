import React from 'react';
import UnifiedPanel from '../UnifiedPanel';
import type { PlayerPanelViewModel } from './player-panel/buildPlayerPanelModel';
import { countRender } from '../../dev/renderCount';

// App-level entry for the player side panel backed by a view model.
type PlayerPanelProps = {
    model: PlayerPanelViewModel;
};

const PlayerPanel: React.FC<PlayerPanelProps> = ({ model }) => {
    countRender('PlayerPanel');
    return <UnifiedPanel {...model.panelProps} />;
};

// Memoised: see the note in Home.tsx. `playerPanelModel` is the only prop, so this holds exactly
// as long as that memo does.
export default React.memo(PlayerPanel);
