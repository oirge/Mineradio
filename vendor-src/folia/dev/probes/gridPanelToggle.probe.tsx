import React, { useState } from 'react';
import '../../src/i18n/config';
import GridPanelToggleIndicator from '../../src/library/suites/grid/shared/GridPanelToggleIndicator';
import type { ProbeDefinition } from './definition';
// dev/probes/gridPanelToggle.probe.tsx

/**
 * Grid 顶部标题的面板开关提示。
 *
 * 这个东西存在的原因是发现性：面板从左侧切入，但标题看起来只是标题，大量用户没发现能点。
 * 需要在真实浏览器里确认三件事，单测都盖不住：
 *
 * 1. hover 整块标题时，"展开/收起"文案从图标右边推出来——靠命名 group
 *    `group/grid-title` 跨组件边界生效，Tailwind v4 的语法必须用真实产物验证。
 * 2. 首次进入的一次性提示动画跑完会自己停，之后交还给 hover 控制，不留残影。
 * 3. StrictMode 下 effect 双调用不会把提示吃掉（初始化读的是 useState 的惰性值）。
 *
 * 提示只弹一次，所以带一个重置按钮：清掉 localStorage 的 key 并强制重挂。
 */
const HINT_STORAGE_KEY = 'folia:gridPanelToggleHintSeen';

const TitleBlock: React.FC<{ label: string; isDaylight: boolean }> = ({ label, isDaylight }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className="rounded-3xl p-8"
            style={{
                backgroundColor: isDaylight ? '#e4e4e7' : '#18181b',
                ['--bg-color' as string]: isDaylight ? '#e4e4e7' : '#18181b',
                ['--text-primary' as string]: isDaylight ? '#18181b' : '#e4e4e7',
            }}
        >
            <div className="mb-4 text-[11px] opacity-50" style={{ color: 'var(--text-primary)' }}>
                {label}
            </div>
            <div
                onClick={() => setIsOpen(current => !current)}
                data-probe-title-block={label}
                className="group/grid-title mx-auto flex w-fit cursor-pointer select-none flex-col items-center rounded-2xl px-5 py-2 backdrop-blur-md transition-all hover:scale-[1.01] active:scale-98"
                style={{
                    backgroundColor: 'color-mix(in srgb, var(--bg-color) 20%, transparent)',
                    color: 'var(--text-primary)',
                }}
            >
                <h2 className="flex items-center justify-center gap-1.5 text-lg font-bold tracking-tight">
                    夏日的告别
                    <GridPanelToggleIndicator isOpen={isOpen} />
                </h2>
                <p className="mt-0.5 text-xs opacity-50">28 首歌曲</p>
            </div>
        </div>
    );
};

const ProbeBody: React.FC = () => {
    const [mountKey, setMountKey] = useState(0);

    return (
        <div className="flex flex-col gap-6 p-8">
            <button
                type="button"
                data-probe-reset-hint
                className="w-fit rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                onClick={() => {
                    localStorage.removeItem(HINT_STORAGE_KEY);
                    setMountKey(current => current + 1);
                }}
            >
                重置首次提示并重挂
            </button>
            <div key={mountKey} className="flex flex-col gap-6">
                <TitleBlock label="dark" isDaylight={false} />
                <TitleBlock label="daylight" isDaylight />
            </div>
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'gridPanelToggle',
    title: 'Grid 标题·左侧面板开关提示',
    description: '方向图标、hover 推出的"展开/收起"文案，以及首次进入时的一次性提示动画',
    Component: ProbeBody,
};

export default probe;
