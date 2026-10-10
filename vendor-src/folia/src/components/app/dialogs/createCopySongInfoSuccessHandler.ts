import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { StatusMessage } from '../../../types';
import { setStatusMessage as setStatusMsg } from '../../../stores/useStatusMessageStore';

// src/components/app/dialogs/createCopySongInfoSuccessHandler.ts

type CreateCopySongInfoSuccessHandlerParams = {
    t: TFunction;
};

// Creates the toast callback used by app-level dialogs feedback for successful song-info copies.
export const createCopySongInfoSuccessHandler = ({
    t,
}: CreateCopySongInfoSuccessHandlerParams) => {
    return () => {
        setStatusMsg({
            type: 'success',
            text: t('status.copiedSongInfo'),
        });
    };
};
