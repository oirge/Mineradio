import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOneTimeHint } from '../../../../hooks/useOneTimeHint';

// src/library/suites/grid/shared/GridPanelToggleIndicator.tsx
// Grid 顶部标题上的面板开关提示。面板从左侧切入，所以用方向性图标而不是名词标签，
// 让"点这里会有东西从左边出来"在静止状态就能读出来；hover 整块标题时才展开"展开/收起"文案。
//
// 调用方必须在外层可点击的标题元素上加 `group/grid-title`，文案展开靠这个命名 group 触发。
// Tailwind 不能生成动态类名，所以 group 名固定。

const PANEL_TOGGLE_HINT_STORAGE_KEY = 'folia:gridPanelToggleHintSeen';

interface GridPanelToggleIndicatorProps {
    isOpen: boolean;
}

const GridPanelToggleIndicator = ({ isOpen }: GridPanelToggleIndicatorProps) => {
    const { t } = useTranslation();
    // 首次进入任意 grid 视图时自我提示一次，解决存量用户完全不知道标题可点的问题
    const shouldHint = useOneTimeHint(PANEL_TOGGLE_HINT_STORAGE_KEY);
    const Icon = isOpen ? PanelLeftClose : PanelLeftOpen;
    const label = t(isOpen ? 'ui.panelCollapse' : 'ui.panelExpand');

    return (
        <span
            className={`inline-flex shrink-0 items-center align-middle font-normal ${shouldHint ? 'grid-panel-toggle-hint' : ''}`}
            title={t('ui.panelHint')}
        >
            <Icon size={14} className="shrink-0 opacity-60 transition-opacity group-hover/grid-title:opacity-100" />
            <span
                className={`max-w-0 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover/grid-title:max-w-[5rem] group-hover/grid-title:opacity-100 ${shouldHint ? 'grid-panel-toggle-hint-label' : ''}`}
            >
                <span className="block whitespace-nowrap pl-1 text-[10px] leading-none">{label}</span>
            </span>
        </span>
    );
};

export default GridPanelToggleIndicator;
