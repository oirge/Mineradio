import React from 'react';
import type { LibrarySuiteStageProps } from '../core/contracts/suite';
import type { ResolvedLibraryStage } from '../registry';

// src/library/app/LibrarySuiteStageSlot.tsx
// 集合宿主里 stage 的挂载位（B1）：只挂生效 suite 的 stage（registry.resolveLibraryStage 的结果），没有就什么都不渲染，
// 也就不会触发任何 lazy chunk。Suspense 按 suite 加 key：换成另一套带 stage 的 suite 时重挂，同一套 suite 下
// 打开 / 关闭集合（navigation 变化）只是换 props，不重挂。

type LibrarySuiteStageSlotProps = LibrarySuiteStageProps & {
    stage: ResolvedLibraryStage | null;
};

const LibrarySuiteStageSlot: React.FC<LibrarySuiteStageSlotProps> = ({ stage, ...stageProps }) => {
    if (!stage) return null;
    const Stage = stage.component;
    return (
        <React.Suspense key={stage.suiteId} fallback={null}>
            <Stage {...stageProps} />
        </React.Suspense>
    );
};

// 宿主随首页数据频繁重渲染；props 不变时不必让整面墙跟着重渲染。
export default React.memo(LibrarySuiteStageSlot);
