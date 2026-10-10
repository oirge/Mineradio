import { useEffect, useRef } from 'react';
import { usePlayerBottomBarLayoutStore } from '../stores/usePlayerBottomBarLayoutStore';
import { closeSettings } from '../stores/useSettingsModalStore';

// src/hooks/usePlayerBottomBarPositioningEntry.ts
// App alone owns navigation while settings and commands only emit a positioning request.

export const usePlayerBottomBarPositioningEntry = (navigateToPlayer: () => void): void => {
    const seq = usePlayerBottomBarLayoutStore(state => state.positioningRequest.seq);
    // 只认没处理过的请求号。effect 也依赖 navigateToPlayer，而它的身份稳定与否取决于
    // useAppNavigation 里三层深的 memo 链；少了这个守卫，那条链一旦断掉就会凭空
    // 把用户拽回播放页并重新进入定位模式。
    const handledSeqRef = useRef(0);

    useEffect(() => {
        if (seq === handledSeqRef.current) {
            return;
        }
        handledSeqRef.current = seq;
        closeSettings();
        navigateToPlayer();
        usePlayerBottomBarLayoutStore.getState().startPositioning();
    }, [navigateToPlayer, seq]);
};
