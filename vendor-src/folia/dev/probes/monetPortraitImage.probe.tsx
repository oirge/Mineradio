import React, { useState } from 'react';
import MonetPortraitImage from '../../src/components/visualizer/monet/MonetPortraitImage';
import type { ProbeDefinition } from './definition';

// dev/probes/monetPortraitImage.probe.tsx

const INITIAL_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%237c3aed"/%3E%3C/svg%3E';
const RESOLVED_COVER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%2310b981"/%3E%3C/svg%3E';
/** Shaped like a blob URL the media cache has already revoked - it can never decode. */
const DEAD_COVER = 'blob:http://localhost/00000000-0000-4000-8000-000000000000';

const MonetPortraitImageProbe: React.FC = () => {
    const [coverUrl, setCoverUrl] = useState(INITIAL_COVER);

    return (
        <div className="flex min-h-screen items-center justify-center gap-6 p-10">
            <div className="h-64 w-64 overflow-hidden rounded-3xl bg-white/10">
                <MonetPortraitImage src={coverUrl} />
            </div>
            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    className="rounded-full bg-white px-4 py-2 text-sm text-black"
                    onClick={() => setCoverUrl(RESOLVED_COVER)}
                >
                    Resolve cached cover
                </button>
                <button
                    type="button"
                    className="rounded-full bg-white px-4 py-2 text-sm text-black"
                    onClick={() => setCoverUrl(DEAD_COVER)}
                >
                    Point at a dead blob
                </button>
            </div>
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'monetPortraitImage',
    title: 'Monet · 异步封面切换',
    description: '模拟切歌后缓存封面晚于歌曲信息到达：新封面解码完成前旧封面必须一直留在画面上，指向失效 blob 时同样不能把画面清空。',
    Component: MonetPortraitImageProbe,
};

export default definition;
