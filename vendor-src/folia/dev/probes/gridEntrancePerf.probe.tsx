import React from 'react';
import GridView from '../../src/library/suites/grid/collection/GridView';
import { createStaticCollectionResource } from '../../src/library/core/services/staticCollectionResource';
import type { CollectionResource } from '../../src/library/core/contracts/resource';
import { createScriptedPagingResource } from './gridEntrancePerf/scriptedPagingResource';
import { useCollectionMorphStore } from '../../src/library/suites/grid/transitions/collectionMorphStore';
import type { ProbeDefinition } from './definition';
// dev/probes/gridEntrancePerf.probe.tsx

/**
 * 大歌单打开时的**真实**代价：挂的是真正的 GridView（外部提供 tracks，所以它不会去请求
 * provider），按按钮时提交一次 morph plan 并把网格挂上去，然后用 PerformanceObserver +
 * rAF 采样这一个窗口：
 *
 * - longtask：主线程被占住超过 50ms 的块（帧掉在这里）
 * - 帧间隔的最差值与超过 32ms 的帧数（肉眼能看到的顿）
 *
 * 观感相关的东西一个都不要改（曲线、时长、位移全保留），这个探针只负责给出「还有多少
 * 主线程时间被吃掉」的答案。数字直接写在 data-probe-perf 上，由 component 用例断言。
 *
 * 注意：这里的卡片是真实 PolaroidCard（有封面、按钮、阴影），所以 mount 成本是可信的；
 * 但它不经过首页的 morph 合成层，只量「网格挂载 + 级联入场」这一段 —— 那正是大歌单打开时
 * 和动画抢主线程的部分。
 */

const PLAYLIST = {
    source: 'online',
    providerId: 'netease',
    id: 'perf-playlist',
    name: 'Perf Playlist',
    type: 'playlist',
    coverUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#3b5bdb"/></svg>')}`,
} as never;

/** 生成一首歌：字段形状与 omni 返回的一致，封面用 data URI（把网络/解码排除在测量之外）。 */
const makeTrack = (index: number) => ({
    id: 1_000_000 + index,
    name: `Track ${index}`,
    artists: [{ id: 7, name: 'Probe Artist' }],
    album: { id: 9, name: 'Probe Album' },
    duration: 180000,
    coverUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2f9e44"/><text x="32" y="40" font-size="20" text-anchor="middle" fill="#fff">${index % 10}</text></svg>`)}`,
}) as never;

const THEME = { primaryColor: '#4f8cf7', secondaryColor: '#4f8cf7', accentColor: '#4f8cf7' } as never;

type PerfReading = {
    longTaskTotal: number;
    longTaskMax: number;
    longTaskCount: number;
    frames: number;
    worstFrame: number;
    slowFrames: number;
    /** 挂载了多少张卡片：渲染环是「视口附近的卡」，大歌单不该改变它。 */
    cards: number;
};

const GridEntrancePerfProbe: React.FC = () => {
    const [trackCount, setTrackCount] = React.useState(2000);
    const [runId, setRunId] = React.useState(0);
    const [entrance, setEntrance] = React.useState(true);
    const [running, setRunning] = React.useState(false);
    const [reading, setReading] = React.useState<PerfReading | null>(null);
    // 分页模式：曲目像在线大歌单那样分页到达（见 scriptedPagingResource），量分页过程中的帧成本。
    const [paging, setPaging] = React.useState(false);
    const [pagingResource, setPagingResource] = React.useState<CollectionResource | null>(null);
    const tracks = React.useMemo(
        () => Array.from({ length: trackCount }, (_, index) => makeTrack(index)),
        [trackCount],
    );
    // 曲目从静态资源来（不发请求），与真实宿主给网格的形态一致。
    const staticResource = React.useMemo(() => createStaticCollectionResource('probe:perf', tracks), [tracks]);
    const resource = paging ? pagingResource : staticResource;
    React.useEffect(() => () => pagingResource?.dispose(), [pagingResource]);

    const start = () => {
        setReading(null);
        setRunning(false);
        // 分页资源在每次打开时新建：分页从打开那一刻开始，正好落在测量窗口里。
        setPagingResource(paging ? createScriptedPagingResource(`probe:paging:${runId + 1}`, tracks) : null);
        // 每次换 key 重新挂载，模拟一次「打开」
        setRunId(current => current + 1);
    };

    // 开着测量的窗口：网格挂载 + 级联入场的前 1.6 秒。
    React.useEffect(() => {
        if (runId === 0) return;
        // 提交一次 morph plan：网格会走「级联入场」那条分支（和真实打开一致）。
        if (entrance) {
            useCollectionMorphStore.getState().commitPlan({ kind: 'morph' });
        } else {
            useCollectionMorphStore.getState().clear();
        }
        setRunning(true);

        const longTasks: number[] = [];
        const observer = typeof PerformanceObserver === 'function'
            ? new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    longTasks.push(entry.duration);
                }
            })
            : null;
        try {
            observer?.observe({ entryTypes: ['longtask'] });
        } catch {
            // longtask 不被支持时退化成只看帧
        }

        const frameGaps: number[] = [];
        let last = performance.now();
        let raf = 0;
        const startedAt = last;
        const tick = (now: number) => {
            frameGaps.push(now - last);
            last = now;
            if (now - startedAt < 1600) {
                raf = requestAnimationFrame(tick);
                return;
            }
            observer?.disconnect();
            const sorted = [...frameGaps].sort((a, b) => a - b);
            setReading({
                longTaskTotal: longTasks.reduce((sum, value) => sum + value, 0),
                longTaskMax: longTasks.length > 0 ? Math.max(...longTasks) : 0,
                longTaskCount: longTasks.length,
                frames: frameGaps.length,
                worstFrame: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
                // 32ms ≈ 两帧：低于这个数的抖动肉眼基本看不出来
                slowFrames: frameGaps.filter(gap => gap > 32).length,
                cards: document.querySelectorAll('[data-folia-grid-item-id]').length,
            });
            setRunning(false);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            observer?.disconnect();
        };
    }, [entrance, runId]);

    const buttonClass = 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10';

    return (
        <div className="min-h-screen bg-zinc-900 text-zinc-200">
            {/* 工具条必须在网格之上：GridView 是 fixed inset-0 z-[110]，否则连按钮都点不到。 */}
            <div className="flex flex-wrap items-center gap-2 p-4" style={{ position: 'relative', zIndex: 200 }}>
                <button type="button" data-probe-action="open" className={buttonClass} onClick={start} disabled={running}>
                    打开 {trackCount} 首的歌单并测量
                </button>
                {/* 对照组：同样的网格、同样的挂载成本，但不做入场动画。
                    两者的差就是「级联入场」自己吃掉的主线程时间。 */}
                <button
                    type="button"
                    data-probe-entrance={entrance ? 'on' : 'off'}
                    className={buttonClass}
                    onClick={() => setEntrance(current => !current)}
                >
                    入场动画：{entrance ? '开' : '关（对照组）'}
                </button>
                <button
                    type="button"
                    data-probe-paging={paging ? 'on' : 'off'}
                    className={buttonClass}
                    onClick={() => { setPaging(current => !current); setReading(null); }}
                >
                    曲目到达：{paging ? '分页（150 + 每 100ms 1000 首）' : '一次给全'}
                </button>
                {[500, 2000, 5000].map(count => (
                    <button
                        key={count}
                        type="button"
                        data-probe-size={count}
                        className={buttonClass}
                        onClick={() => { setTrackCount(count); setReading(null); }}
                    >
                        {count} 首
                    </button>
                ))}
                <span className="text-xs text-zinc-400" data-probe-reading={reading ? JSON.stringify(reading) : ''}>
                    {reading
                        ? `longtask ${reading.longTaskTotal.toFixed(0)}ms / 最大 ${reading.longTaskMax.toFixed(0)}ms ×${reading.longTaskCount}；掉帧 ${reading.slowFrames} 帧，最差 ${reading.worstFrame.toFixed(0)}ms；卡片 ${reading.cards}`
                        : (running ? '测量中…' : '待测量')}
                </span>
            </div>

            {/* 高度固定，让网格有一块稳定的视口 */}
            <div style={{ position: 'relative', height: 'calc(100vh - 64px)' }}>
                {runId > 0 ? (
                    <GridView
                        key={runId}
                        title="Perf Playlist"
                        mode="tracks"
                        collection={PLAYLIST}
                        resource={resource}
                        theme={THEME}
                        isDaylight={false}
                        isInteractive
                        onBack={() => {}}
                        onDone={() => {}}
                        morphPlan={{ kind: 'morph' }}
                    />
                ) : null}
            </div>
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'gridEntrancePerf',
    title: '大歌单打开的帧预算（真实 GridView）',
    description: '挂真实的 GridView + 2000/5000 首外部 tracks，测 longtask 与掉帧，用于判断级联入场的单帧成本。',
    Component: GridEntrancePerfProbe,
};

export default definition;
