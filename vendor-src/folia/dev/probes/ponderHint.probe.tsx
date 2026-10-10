import React, { useState } from 'react';
import '../../src/i18n/config';
import PonderHost from '../../src/components/ponder/PonderHost';
import { usePonderStore } from '../../src/stores/usePonderStore';
import type { PonderHintVisibility } from '../../src/types/ponder';
import type { Theme } from '../../src/types';
import type { ProbeDefinition } from './definition';
// dev/probes/ponderHint.probe.tsx

/**
 * 思索的进入链路：悬停提示胶囊 + 长按 G。
 *
 * 这条链路单测盖不住，因为它整个建立在真实指针事件、WAAPI 动画和「不产生 React 重渲染」
 * 这三件只有浏览器里才成立的事情上。需要在真实浏览器里确认：
 *
 * 1. 悬停满 600ms 才出胶囊，不到就不出。
 * 2. 胶囊真的不可点击（pointer-events: none），点它命中的是底下的东西。
 * 3. 长按 G 不到 400ms 松手会取消，擦除回弹；按满才开教程层。
 * 4. 输入框里按 G 什么都不发生。
 * 5. 三档可见性里的「关闭」连提示都不出。
 * 6. 移动 100 次指针，PonderHost 的渲染次数不变 —— 光标坐标全程走 MotionValue。
 *
 * 真实目标（侧栏开关）只在播放页存在，所以这里放一个带同样 data-testid 的替身，
 * 让注册表里的 panel-slide 能命中。
 */
const VISIBILITIES: PonderHintVisibility[] = ['always', 'unseen', 'off'];

/** 骨架、指向线和高亮都吃强调色，给一个便于在真实主题下核对观感。 */
const PROBE_THEME = { accentColor: '#f43f5e' } as Theme;

const ProbeBody: React.FC = () => {
    const visibility = usePonderStore(state => state.ponderHintVisibility);
    const setVisibility = usePonderStore(state => state.setPonderHintVisibility);
    const openNavigation = usePonderStore(state => state.openNavigation);
    const hoveredTargetId = usePonderStore(state => state.hoveredTargetId);
    const hasSession = usePonderStore(state => state.session !== null);
    const [clicks, setClicks] = useState(0);

    return (
        <div
            className="flex min-h-screen flex-col gap-6 p-8"
            style={{
                ['--text-primary' as string]: '#e4e4e7',
                ['--text-secondary' as string]: '#a1a1aa',
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                {VISIBILITIES.map(value => (
                    <button
                        key={value}
                        type="button"
                        data-probe-visibility={value}
                        onClick={() => setVisibility(value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                            visibility === value
                                ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-200'
                                : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                        }`}
                    >
                        {value}
                    </button>
                ))}
                <button
                    type="button"
                    data-probe-clear-seen
                    onClick={() => {
                        localStorage.removeItem('folia_ponder_seen');
                        location.reload();
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                    清掉已看过并重载
                </button>
                <button
                    type="button"
                    data-probe-open-navigation
                    onClick={openNavigation}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                    打开帮助导航页
                </button>
            </div>

            {/* Playwright 读这几个属性，不必去猜内部状态。 */}
            <div
                data-probe-state
                data-probe-hovered={hoveredTargetId ?? ''}
                data-probe-session={hasSession ? 'open' : ''}
                data-probe-clicks={clicks}
                className="text-xs text-zinc-400"
            >
                hovered: {hoveredTargetId ?? '—'} · session: {hasSession ? 'open' : 'closed'} · clicks: {clicks}
            </div>

            {/* 侧栏开关的替身：同样的 data-testid，注册表按它命中 panel-slide。
                外层 div 对应真实结构里那个带入场动画的 motion.div，内层 button 是锚点。 */}
            <div className="flex items-center gap-8">
                <div
                    data-testid="panel-toggle"
                    className="w-20 flex justify-end"
                    onClick={() => setClicks(current => current + 1)}
                >
                    <div className="relative h-12 w-12">
                        <button
                            type="button"
                            className="absolute inset-0 rounded-full border border-white/15 bg-white/10 text-zinc-200"
                        >
                            ‹
                        </button>
                    </div>
                </div>

                <span className="text-xs text-zinc-500">← 悬停这里 600ms</span>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-400" htmlFor="probe-input">
                    输入框里按 G 应该什么都不发生
                </label>
                <input
                    id="probe-input"
                    data-probe-input
                    className="w-64 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none"
                    placeholder="在这里打字"
                />
            </div>

            <PonderHost theme={PROBE_THEME} isDaylight={false} />
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'ponderHint',
    title: '思索·悬停提示与长按 G',
    description: '600ms 悬停出胶囊、400ms 长按进教程、输入框里禁用、三档可见性，以及光标跟随不触发重渲染',
    Component: ProbeBody,
};

export default probe;
