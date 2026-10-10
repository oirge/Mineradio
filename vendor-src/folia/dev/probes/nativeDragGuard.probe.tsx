import React, { useEffect, useState } from 'react';
import { motionValue } from 'framer-motion';
import ProgressBar from '../../src/components/ProgressBar';
import { installNativeDragGuard } from '../../src/utils/nativeDragGuard';
import type { ProbeDefinition } from './definition';
// dev/probes/nativeDragGuard.probe.tsx

const currentTime = motionValue(30);

// 自包含的封面图，避免探针依赖网络
const COVER_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#c2410c"/></svg>',
)}`;

/**
 * 复现 #394：页面上存在选区（封面图、文字、Ctrl+A）时，在进度条或设置滑块上按下并拖动，
 * 浏览器会改为发起原生 drag，滑块收到 pointercancel 后失效。
 * 探针里并排放了进度条、两种原生 range、文本框和 contenteditable，
 * 用 `?guard=0` 或 mount 参数 guard=false 关掉保护来复现，默认与产品一致（开启）。
 * 所有结果都镜像到 data 属性，供用例断言。
 */
const NativeDragGuardProbe: React.FC<{ guard?: boolean }> = ({ guard = true }) => {
    const [seeks, setSeeks] = useState<string[]>([]);
    const [volume, setVolume] = useState(50);
    const [volumeCancels, setVolumeCancels] = useState(0);
    const [dragStarts, setDragStarts] = useState<string[]>([]);
    const [dragPrevented, setDragPrevented] = useState<boolean[]>([]);

    useEffect(() => (guard ? installNativeDragGuard() : undefined), [guard]);

    // 记录每次 dragstart 及其最终是否被阻止（冒泡到 window 时 defaultPrevented 已定）
    useEffect(() => {
        const onDragStart = (event: DragEvent) => {
            const target = event.target;
            const name = target instanceof Element ? target.tagName : (target as Node)?.nodeName ?? '?';
            setDragStarts(prev => [...prev, name]);
            setDragPrevented(prev => [...prev, event.defaultPrevented]);
        };
        window.addEventListener('dragstart', onDragStart);
        return () => window.removeEventListener('dragstart', onDragStart);
    }, []);

    return (
        <div
            className="flex w-[640px] flex-col gap-6 p-8 text-zinc-100"
            data-probe-guard={guard ? 'on' : 'off'}
            data-probe-seeks={seeks.join(',')}
            data-probe-volume={volume}
            data-probe-volume-cancels={volumeCancels}
            data-probe-dragstarts={dragStarts.join(',')}
            data-probe-dragprevented={dragPrevented.join(',')}
        >
            <img data-probe="cover" src={COVER_SRC} alt="cover" width={120} height={120} />
            <a data-probe="link" href="https://example.com/">link target</a>
            <p data-probe="text" className="text-sm">Some body text that can be selected, like a track title.</p>

            <div data-probe="progress" className="w-full">
                <ProgressBar
                    currentTime={currentTime}
                    duration={240}
                    onSeek={time => setSeeks(prev => [...prev, time.toFixed(0)])}
                />
            </div>

            <input
                data-probe="volume"
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={event => setVolume(Number(event.target.value))}
                onPointerCancel={() => setVolumeCancels(count => count + 1)}
                className="w-full"
            />

            <input data-probe="field" type="text" defaultValue="select me in the input" className="rounded bg-zinc-800 px-2 py-1" />
            <textarea data-probe="area" defaultValue="textarea content to select" className="rounded bg-zinc-800 px-2 py-1" />
            <div data-probe="editable" contentEditable suppressContentEditableWarning className="rounded bg-zinc-800 px-2 py-1">
                editable content to select
            </div>
            <img data-probe="draggable-cover" data-native-drag="allow" src={COVER_SRC} alt="allowed" width={40} height={40} />
        </div>
    );
};

const probe: ProbeDefinition = {
    id: 'nativeDragGuard',
    title: 'Native drag guard (#394)',
    description: '存在选区时拖动进度条与滑块：原生 drag 不得抢走 pointer 手势，文本框内的选择与拖拽保持可用。',
    Component: NativeDragGuardProbe as React.ComponentType,
};

export default probe;
