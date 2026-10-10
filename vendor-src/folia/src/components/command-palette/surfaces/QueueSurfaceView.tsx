import React from 'react';
import CommandPaletteQueueView from '../CommandPaletteQueueView';
import type { QueueSearchSuggestion } from '../queueSearch';

// src/components/command-palette/surfaces/QueueSurfaceView.tsx
// Lazy entry point for the queue surface; restores input focus after a completion is accepted.

type QueueSurfaceViewProps = React.ComponentProps<typeof CommandPaletteQueueView> & {
    refocusInput: () => void;
};

const QueueSurfaceView: React.FC<QueueSurfaceViewProps> = ({
    refocusInput, onAcceptSuggestion, onExecuteMatch, onKeepOpenOnSongChange, ...rest
}) => (
    <CommandPaletteQueueView
        {...rest}
        onAcceptSuggestion={(suggestion: QueueSearchSuggestion) => {
            onAcceptSuggestion(suggestion);
            refocusInput();
        }}
        onKeepOpenOnSongChange={enable => {
            onKeepOpenOnSongChange(enable);
            refocusInput();
        }}
        onExecuteMatch={async index => {
            const didExecute = await onExecuteMatch(index);
            if (didExecute && rest.keepOpenOnSongChange) {
                refocusInput();
            }
            return didExecute;
        }}
    />
);

export default QueueSurfaceView;
