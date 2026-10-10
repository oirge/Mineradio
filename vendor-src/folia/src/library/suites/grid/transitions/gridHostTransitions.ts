import type { LibrarySuiteTransitions } from '../../../core/contracts/suite';
import { useCollectionMorphStore } from './collectionMorphStore';
import { probeArtistIntroTargets, probeGridSquadRects, probeHeroTargets } from './morphProbes';
import { gridBackdrop } from './gridBackdrop';

// src/library/suites/grid/transitions/gridHostTransitions.ts
// 网格交给集合宿主的转场钩子（移形换影）：压栈前给新网格一个级联入场计划，返回前量好 hero 与卡片、
// 武装反向转场，切换 suite 时丢掉没用掉的计划。逻辑原样搬自 GridViewOverlayHost 的
// handlePushCollection / handleBackCollection 与 switchLibraryRenderer；宿主只在网格渲染当前集合层、
// 且没关闭动态效果时调用（见 core/contracts/suite 的 LibrarySuiteTransitions）。

export const gridHostTransitions: Omit<LibrarySuiteTransitions, 'Overlay'> = {
    backdrop: gridBackdrop,
    beforePush: ({ depth }) => {
        // Nested open (album/artist inside a playlist): no home card was clicked,
        // so instead of the hero morph, hand the incoming grid a fly-in plan —
        // its cards cascade in, matching every other grid entrance. The overlay
        // upgrades it to 'morph' if a flight actually launches (origin 'home').
        if (depth >= 1) {
            useCollectionMorphStore.getState().commitPlan({ kind: 'cascade' });
        }
    },
    beforeBack: ({ depth, origin, activeType }) => {
        // Arm the reverse morph before the view flips. Two distinct gestures:
        // - top-level back (stack depth 1) → hero flies onto the original home
        //   card while the squad scatters;
        // - nested back (album → playlist) → no home card exists, so the hero
        //   shrinks away in place with the squad scattering, and the previous
        //   grid underneath is revealed by the backdrop crossfade.
        const morphStore = useCollectionMorphStore.getState();
        // Artist pages morph from their circular avatar, not a song card.
        const hero = (activeType === 'artist' ? probeArtistIntroTargets() : probeHeroTargets()) ?? morphStore.hero;
        if (!hero) return;
        const squad = probeGridSquadRects();
        if (depth <= 1 && origin === 'home' && morphStore.lastHome) {
            morphStore.armExit(hero, squad);
        } else if (depth > 1) {
            morphStore.armNestedExit(hero, squad);
            // The previous collection remounts underneath: give it the same
            // cascade entrance so the cut reads as scatter-out → cascade-in.
            // 'cascade', not 'morph': the reverse composite lands on the card
            // this level was pushed from, which is not the previous grid's
            // centred hero, so nothing is covering that hero.
            morphStore.commitPlan({ kind: 'cascade' });
        }
    },
    // 切换 suite 时清掉还没用掉的转场计划（它是给网格入场准备的）。
    reset: () => useCollectionMorphStore.getState().clear(),
};
