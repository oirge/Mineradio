import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PonderSurfaceStateRegistrar } from './PonderSurfaceStateLayer';
import type { PonderRelativeRect } from '../../../types/ponder';
import { relativeRectStyle } from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/ponderSettingsParts.tsx
// 设置类合成界面的三个小件：分组标题、一行开关、一张并排选项卡。
//
// 抽出来是因为设置面板在真实界面里本来就是同一套形状，此前每个 surface 文件各写了一份 ——
// 第三份出现的时候，「改一次开关的画法」就变成了在三个文件里找同名组件。
// 各处的细微差别（图标 58% 还是 62%）是抄来抄去的噪声，不是设计，这里统一成一套。

export type PonderSettingsSurfaceProps = {
    accent: string;
    line: string;
    outline: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
};

/** 分组标题：小图标加一条标题文字。 */
export const SettingsHeading: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    icon: LucideIcon;
}> = ({ rect, line, icon: Icon }) => (
    <span className="flex items-center gap-[5%]" style={relativeRectStyle(rect)}>
        <Icon className="h-[60%] w-auto opacity-55" />
        <span className="h-[25%] flex-1 rounded-full opacity-70" style={{ backgroundColor: line }} />
    </span>
);

/** 一行开关：左边标题（可带说明），右边 48×24 的滑块。 */
export const SettingsToggleRow: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    accent: string;
    on?: boolean;
    withDesc?: boolean;
    marker: string;
}> = ({ rect, line, accent, on, withDesc = true, marker }) => (
    <div {...{ [marker]: true }} className="flex items-center gap-[4%]" style={relativeRectStyle(rect)}>
        <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-1.5 w-[40%] rounded-full" style={{ backgroundColor: line }} />
            {withDesc && <span className="h-1 w-[74%] rounded-full opacity-45" style={{ backgroundColor: line }} />}
        </span>
        <span
            className="relative h-4 w-8 shrink-0 rounded-full"
            style={{ backgroundColor: on ? accent : line, opacity: on ? 0.75 : 1 }}
        >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white ${on ? 'right-0.5' : 'left-0.5'}`} />
        </span>
    </div>
);

/** 一张并排的选项卡：图标、标题、一行说明，选中时描边换成强调色。 */
export const SettingsChoiceCard: React.FC<{
    rect: PonderRelativeRect;
    line: string;
    accent: string;
    outline: string;
    selected?: boolean;
    icon?: LucideIcon;
    marker: string;
    children?: React.ReactNode;
}> = ({ rect, line, accent, outline, selected, icon: Icon, marker, children }) => (
    <div
        {...{ [marker]: true }}
        className="flex flex-col justify-center gap-[10%] rounded-xl border px-[6%]"
        style={{
            ...relativeRectStyle(rect),
            borderColor: selected ? accent : outline,
            backgroundColor: selected ? `${accent}14` : undefined,
        }}
    >
        <span className="flex items-center gap-[6%]">
            {Icon && <Icon className="h-3 w-3 shrink-0 opacity-65" />}
            <span className="h-1.5 w-[44%] rounded-full" style={{ backgroundColor: selected ? accent : line }} />
            {children}
        </span>
        <span className="h-1 w-[76%] rounded-full opacity-45" style={{ backgroundColor: line }} />
    </div>
);
