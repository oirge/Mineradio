import React from 'react';
import '../../src/i18n/config';
import GridViewOverlayHost from '../../src/library/app/GridViewOverlayHost';
import type { ProbeDefinition } from './definition';
import { ProbeControlPanel } from './libraryBehavior/ProbeControlPanel';
import {
    onProbeBackCollection,
    onProbePopCollectionTo,
    useLibraryProbeHarness,
} from './libraryBehavior/useLibraryProbeHarness';
// dev/probes/libraryBehavior.probe.tsx

/**
 * 集合详情的行为回归探针：挂真实的 GridViewOverlayHost（真实 GridView、导航 store、morph、命令
 * surface 注册），数据来自两个内存假 provider、本地曲库 fixture 和 Navidrome 垫片。
 *
 * 它是重构期间的回归闸门：test/component/libraryBehavior.spec.ts 通过 window.__libraryProbe 驱动它，
 * 断言请求账、回调账和 surface 状态，而不是像素。手动点检时左侧面板能做同样的事。
 *
 * 宿主区域套了一层 transform：GridView 是 `fixed inset-0`，transform 让它以这块区域为包含块，
 * 不会盖住左侧面板。
 */
const LibraryBehaviorProbe: React.FC = () => {
    const harness = useLibraryProbeHarness();

    return (
        <div className="fixed inset-0" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
            <ProbeControlPanel harness={harness} />
            <div
                data-probe-host
                className="absolute inset-y-0 left-[300px] right-0 overflow-hidden"
                style={{ transform: 'translateZ(0)' }}
            >
                {harness.ready && (
                    <GridViewOverlayHost
                        surfaceProps={harness.surfaceProps}
                        onOpenCollection={harness.onOpenCollection}
                        onPushCollection={harness.onPushCollection}
                        onPopCollectionTo={onProbePopCollectionTo}
                        onBackCollection={onProbeBackCollection}
                        isInteractive
                    >
                        {() => (
                            <div data-probe-home className="flex h-full items-center justify-center text-sm opacity-50">
                                Probe home — open a fixture from the panel
                            </div>
                        )}
                    </GridViewOverlayHost>
                )}
            </div>
        </div>
    );
};

export default {
    id: 'libraryBehavior',
    title: '集合详情行为回归（真实 GridViewOverlayHost）',
    description: '假 provider + 本地/Navidrome fixture，覆盖分页、缓存、筛选、播放入队、编辑、导航恢复；重构期间每步跑的回归闸门。',
    Component: LibraryBehaviorProbe,
} satisfies ProbeDefinition;
