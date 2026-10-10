import React from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ArrowDownUp,
    Disc,
    FileJson,
    PackageOpen,
    Play,
    Radio,
    SkipBack,
    SkipForward,
    Heart,
    Home,
    FileText,
    ListMusic,
    ListEnd,
    ListPlus,
    LogOut,
    MirrorRectangular,
    Moon,
    PanelsTopLeft,
    RefreshCw,
    Repeat,
    Settings,
    Shuffle,
    SlidersHorizontal,
    Search,
    Sparkle,
    Star,
    Trash2,
    Upload,
    User,
    Volume2,
} from 'lucide-react';
import PonderSurfaceStateLayer, { PonderSurfaceBase, type PonderSurfaceStateRegistrar } from './PonderSurfaceStateLayer';
import {
    SIDE_PANEL_CONTROLS_PAGE as C,
    SIDE_PANEL_COVER_ACTIONS as A,
    SIDE_PANEL_FM_PAGE as F,
    SIDE_PANEL_GEOMETRY as G,
    SIDE_PANEL_SOURCE_LYRICS as L,
    SIDE_PANEL_SOURCE_PAGE as S,
    relativeRectStyle,
} from './ponderSurfaceGeometry';

// src/components/ponder/surfaces/PonderSidePanelSurface.tsx
// 右侧展开的控制面板：一张方封面压在最上面，紧接着一排标签页，再下面是当前标签页的内容。
//
// 封面和标签排之间没有第三段。歌名、歌手、专辑是**封面页的内容**，跟着标签一起换，
// 画成面板结构里的一条常驻信息带就把这件事讲反了。
//
// 标签页那一排是这块面板的全部意义 —— 封面、控制、队列、账号是同一块地方的几副面孔，
// 画成几个并排的小格子而不是一堆行，才读得出「这里可以换页」。
//
// 标签排和它下面那块内容同属一层：换页时高亮要跟着挪到新的那一格上，
// 只换下半截的话，画面会停在「还选着上一页」的状态。

/** 标签排 + 内容在登记表里的名字：换标签页替换的是它。 */
export const SIDE_PANEL_BODY_STATE = 'panel-body';

type PonderSidePanelSurfaceProps = {
    accent: string;
    line: string;
    outline: string;
    registerStateNode?: PonderSurfaceStateRegistrar;
};

type PageProps = { accent: string; line: string; outline: string };

/** 常驻那四页。 */
const TABS = [Disc, SlidersHorizontal, ListMusic, User];

/**
 * 当前这首来自本地、Navidrome 或在线来源时的那一排：来源那一格插在封面页后面，共五格。
 *
 * 不是给常驻那排加一个图标 —— 这一格真的时有时无，画成五格才说得清「它插进来了」。
 */
const SOURCE_TABS = [Disc, FileText, SlidersHorizontal, ListMusic, User];

/** 私人 FM 打开时的那一排：第三格从清单图标变成电台图标，位置不动。 */
const FM_TABS = [Disc, SlidersHorizontal, Radio, User];

/**
 * 标签排加它下面那块内容。换页时整块一起换，高亮才会落在新的那一格上。
 *
 * 真实那一排是 `rounded-xl` 的浅色槽加四个 `rounded-lg` 的格子：选中的那格换底色、
 * 没选中的降到 40% 不透明度，图标始终在。把选中格画成一块纯色会把图标盖掉，
 * 屏幕上就只剩三个图标加一个色块。
 */
const TabPage: React.FC<{
    active: number;
    accent: string;
    line: string;
    outline: string;
    /** 默认是常驻那四格；来源那一格在场时传五格的那一排。 */
    tabs?: typeof TABS;
    children: React.ReactNode;
}> = ({ active, accent, line, outline, tabs = TABS, children }) => (
    <>
        <div
            data-ponder-panel-tabs
            className="flex items-center gap-[1%] rounded-xl p-[1.5%]"
            style={{ ...relativeRectStyle(G.tabs), backgroundColor: line }}
        >
            {tabs.map((Icon, index) => (
                <span
                    key={index}
                    data-ponder-panel-tab
                    data-active={index === active || undefined}
                    className="flex h-full flex-1 items-center justify-center rounded-lg"
                    style={{
                        backgroundColor: index === active ? `${accent}33` : undefined,
                        opacity: index === active ? 1 : 0.4,
                    }}
                >
                    <Icon className="h-[46%] w-auto" style={{ color: index === active ? accent : undefined }} />
                </span>
            ))}
        </div>
        {children}
        <span
            data-ponder-panel-tab-marker
            className="absolute rounded-xl"
            style={{ ...relativeRectStyle(G.tabs), border: `1px solid ${outline}`, opacity: 0 }}
        />
    </>
);

/**
 * 封面页：居中的大歌名，下面是歌手和专辑。
 *
 * 这一页没有第二张封面 —— 封面本来就常驻在面板顶上。歌手和专辑是可点的链接，
 * 歌名点一下是复制信息，所以三行都按「文字」画，不画跳转图标。
 */
const CoverPage: React.FC<PageProps> = ({ accent, line }) => (
    <div data-ponder-panel-cover-page className="flex flex-col items-center gap-[7%] pt-[6%]" style={relativeRectStyle(G.body)}>
        <span className="h-[14%] w-[72%] rounded-full" style={{ backgroundColor: line, opacity: 0.95 }} />
        <span className="h-[9%] w-[46%] rounded-full" style={{ backgroundColor: accent, opacity: 0.55 }} />
        <span className="h-[8%] w-[34%] rounded-full opacity-45" style={{ backgroundColor: line }} />
    </div>
);

/**
 * 控制页：三颗大按钮、一行音量、两行模式取景器，再加主题来源和当前主题名两行。
 *
 * 顶上那排三颗是循环 / 喜欢 / 生成主题，是整块面板里唯一一排大触控目标；
 * 下面才是边听边调的那些参数。画成三条滑杆会把这一页认错成均衡器。
 */
const ControlsRows: React.FC<PageProps> = ({ accent, line, outline }) => (
    <>
        <div className="grid grid-cols-3 gap-[4%]" style={relativeRectStyle(C.songActions)}>
            {[Repeat, Heart, Sparkle].map((Icon, index) => (
                <span
                    key={index}
                    data-ponder-panel-song-action
                    className="flex items-center justify-center rounded-xl"
                    style={{ backgroundColor: line }}
                >
                    <Icon className="h-[38%] w-auto opacity-70" />
                </span>
            ))}
        </div>

        <div
            data-ponder-panel-volume
            className="flex items-center gap-[4%] rounded-xl px-[4%]"
            style={{ ...relativeRectStyle(C.volume), backgroundColor: line }}
        >
            <Volume2 className="h-[42%] w-auto shrink-0 opacity-45" />
            <span className="relative h-[8%] min-w-0 flex-1 rounded-full" style={{ backgroundColor: outline }}>
                <span className="absolute inset-y-0 left-0 w-[64%] rounded-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
            </span>
            <SlidersHorizontal className="h-[36%] w-auto shrink-0 opacity-45" />
        </div>

        {/* 两行取景器。中间那块名称按几何表单独摆，不走 flex —— 它是一颗可点的按钮，
            要能被锚点指住，而 flex 里的一条占位文字量不出稳定的位置。 */}
        {([
            [C.modeRowVisualizer, C.modeName, true],
            [C.modeRowBackground, C.modeNameBackground, false],
        ] as const).map(([rowRect, nameRect, isFirst]) => (
            <React.Fragment key={isFirst ? 'visualizer' : 'background'}>
                <div data-ponder-panel-mode-row className="flex items-center gap-[3%] px-[1%]" style={relativeRectStyle(rowRect)}>
                    <ChevronLeft className="h-[40%] w-auto shrink-0 opacity-35" />
                    <span className="aspect-square h-[62%] shrink-0 rounded-md border" style={{ borderColor: outline }} />
                    <span className="min-w-0 flex-1" />
                    <span
                        className="h-[62%] w-[22%] shrink-0 rounded-full border"
                        style={{ borderColor: outline, backgroundColor: isFirst ? `${accent}22` : undefined }}
                    />
                    <ChevronRight className="h-[40%] w-auto shrink-0 opacity-35" />
                </div>
                <span
                    {...(isFirst ? { 'data-ponder-panel-mode-name': true } : {})}
                    className="flex items-center"
                    style={relativeRectStyle(nameRect)}
                >
                    <span className="h-[18%] w-full rounded-full opacity-70" style={{ backgroundColor: line }} />
                </span>
            </React.Fragment>
        ))}

        {/* 取景器下面那两行：主题来源，以及写着当前主题名的那一条。
            它们不在任何一章的字幕里，但真实那一页到这里才到底 —— 漏掉就等于凭空少了一截。 */}
        <div
            data-ponder-panel-theme-source
            className="flex items-center gap-[3%] rounded-xl px-[4%]"
            style={{ ...relativeRectStyle(C.themeSource), backgroundColor: line }}
        >
            <Sparkle className="h-[40%] w-auto shrink-0 opacity-45" />
            <span className="h-[14%] min-w-0 flex-1 rounded-full" style={{ backgroundColor: outline }} />
            <span className="h-[52%] w-[26%] shrink-0 rounded-full border" style={{ borderColor: outline }} />
        </div>
        <div data-ponder-panel-current-theme className="flex items-center gap-[4%] px-[2%]" style={relativeRectStyle(C.currentTheme)}>
            <Moon className="h-[44%] w-auto shrink-0 opacity-45" />
            <span className="h-[16%] w-[44%] rounded-full" style={{ backgroundColor: line }} />
            <span className="flex-1" />
            <RefreshCw className="h-[40%] w-auto shrink-0 opacity-40" />
        </div>
    </>
);

const ControlsPage: React.FC<PageProps> = ({ accent, line, outline }) => (
    <div data-ponder-panel-controls style={relativeRectStyle(G.body)}>
        <ControlsRows accent={accent} line={line} outline={outline} />
    </div>
);

/**
 * 点中间那块名称展开的完整模式列表，最底下一条是通往完整设置的出口。
 *
 * 这一层整块替换内容区，所以它得先把控制页原样画回来 —— 列表是压在这一页上的一块浮层，
 * 不是一页新内容。被点开的那块名称留在列表上方：列表盖住它的话，
 * 「点的是这里、掉下来的是它」就没了。
 */
const ModeListPage: React.FC<PageProps> = ({ accent, line, outline }) => (
    <div data-ponder-panel-mode-list-page style={relativeRectStyle(G.body)}>
        <ControlsRows accent={accent} line={line} outline={outline} />
        <span
            data-ponder-panel-mode-name-open
            className="flex items-center"
            style={relativeRectStyle(C.modeName)}
        >
            <span className="h-[18%] w-full rounded-full" style={{ backgroundColor: accent }} />
        </span>
        <div
            data-ponder-panel-mode-list
            /* 底部留出出口那一条的高度：不留的话最后一个模式正好压在它下面。 */
            className="flex flex-col justify-evenly rounded-xl px-[5%] pb-8"
            style={{ ...relativeRectStyle(C.modeList), backgroundColor: 'rgba(9,9,11,0.96)', boxShadow: `inset 0 0 0 1px ${outline}` }}
        >
            {[0, 1, 2, 3, 4].map(index => (
                <span key={index} data-ponder-panel-mode-option className="flex items-center gap-[4%]">
                    <span className="aspect-square h-[13%] shrink-0 rounded-sm border" style={{ borderColor: outline }} />
                    <span
                        className="h-[6%] rounded-full"
                        style={{ width: `${54 + (index % 3) * 12}%`, backgroundColor: index === 1 ? accent : line }}
                    />
                </span>
            ))}
        </div>
        {/* 列表底下那一条：它不是第七个模式，是「去完整设置」。 */}
        <span
            data-ponder-panel-mode-list-footer
            className="flex items-center gap-[4%] rounded-lg px-[5%]"
            style={{ ...relativeRectStyle(C.modeListFooter), backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
            <Settings className="h-[46%] w-auto shrink-0 opacity-55" />
            <span className="h-[16%] w-[46%] rounded-full opacity-55" style={{ backgroundColor: line }} />
        </span>
    </div>
);

/**
 * 电台页：私人 FM 打开时，队列那一格整格换成它。
 *
 * 顶上那枚胶囊开的是命令窗口里的电台模式选择器；下面三颗是传送；最底下一对是
 * 扔掉和喜欢 —— 扔掉会告诉服务别再放这首，不是从一份清单里移掉一行。
 */
const FmPage: React.FC<PageProps> = ({ accent, line, outline }) => (
    <div data-ponder-panel-fm style={relativeRectStyle(G.body)}>
        <span
            data-ponder-panel-fm-mode
            className="flex items-center justify-center gap-[8%] rounded-full"
            style={{ ...relativeRectStyle(F.modeChip), backgroundColor: line }}
        >
            <Radio className="h-[52%] w-auto opacity-70" />
            <span className="h-[18%] w-[44%] rounded-full opacity-60" style={{ backgroundColor: outline }} />
        </span>

        <div data-ponder-panel-fm-transport className="flex items-center justify-center gap-[10%]" style={relativeRectStyle(F.transport)}>
            <SkipBack className="h-[38%] w-auto opacity-45" />
            <span className="flex aspect-square h-full items-center justify-center rounded-full" style={{ backgroundColor: accent, opacity: 0.85 }}>
                <Play className="h-[44%] w-auto" />
            </span>
            <SkipForward className="h-[38%] w-auto opacity-45" />
        </div>

        <div data-ponder-panel-fm-actions className="flex items-center justify-between" style={relativeRectStyle(F.actions)}>
            {[Trash2, Heart].map((Icon, index) => (
                <span
                    key={index}
                    data-ponder-panel-fm-action
                    className="flex aspect-square h-full items-center justify-center rounded-full"
                    style={{ backgroundColor: line }}
                >
                    <Icon className="h-[40%] w-auto opacity-70" />
                </span>
            ))}
        </div>
    </div>
);

/**
 * 队列页：顶上一行标题与三颗小按钮，下面一行一首歌。
 *
 * 行里没有缩略图 —— 真实那一行左端只有一根标记条（当前这首才亮），然后是歌名和歌手，
 * 指针悬上去右端才浮出「下一首播放 / 移到队尾 / 移除」。
 */
const QueuePage: React.FC<PageProps> = ({ accent, line, outline }) => (
    <div data-ponder-panel-queue className="flex flex-col gap-[4%]" style={relativeRectStyle(G.body)}>
        <div className="flex h-[12%] shrink-0 items-center gap-[3%] px-[2%]">
            <span className="h-[22%] w-[34%] rounded-full opacity-60" style={{ backgroundColor: line }} />
            <span className="flex-1" />
            <PanelsTopLeft className="h-[52%] w-auto opacity-45" />
            <Shuffle className="h-[52%] w-auto opacity-45" />
        </div>
        {[0, 1, 2, 3].map(index => (
            <div
                key={index}
                data-ponder-panel-queue-row
                className="flex min-h-0 flex-1 items-center gap-[3%] rounded-lg px-[2%]"
                style={{ backgroundColor: index === 0 ? outline : undefined }}
            >
                <span
                    className="h-[46%] w-[2%] shrink-0 rounded-full"
                    style={{ backgroundColor: index === 0 ? accent : 'transparent' }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-[14%]">
                    <span className="h-1.5 rounded-full" style={{ width: `${78 - index * 9}%`, backgroundColor: line }} />
                    <span className="h-1 rounded-full opacity-45" style={{ width: `${46 + index * 5}%`, backgroundColor: line }} />
                </span>
                {index === 0 ? (
                    <span className="flex shrink-0 items-center gap-[2px] opacity-60">
                        <ListPlus className="h-3 w-3" />
                        <ListEnd className="h-3 w-3" />
                        <Trash2 className="h-3 w-3" />
                    </span>
                ) : null}
            </div>
        ))}
    </div>
);

/**
 * 账号页：来源账号卡、音质四选一、同步按钮。
 *
 * 缓存占用和清理那一块在真实界面里是注释掉的，画出来等于教一个屏幕上不存在的东西。
 */
const AccountPage: React.FC<PageProps> = ({ accent, line, outline }) => (
    <div data-ponder-panel-account className="flex flex-col gap-[6%]" style={relativeRectStyle(G.body)}>
        <div
            data-ponder-panel-account-card
            className="flex h-[30%] shrink-0 items-center gap-[4%] rounded-xl px-[4%]"
            style={{ backgroundColor: line }}
        >
            <span className="aspect-square h-[58%] shrink-0 rounded-full" style={{ backgroundColor: accent, opacity: 0.5 }} />
            <span className="flex flex-1 flex-col gap-1">
                <span className="h-1.5 w-[52%] rounded-full" style={{ backgroundColor: outline }} />
                <span className="h-1 w-[34%] rounded-full opacity-60" style={{ backgroundColor: outline }} />
            </span>
            <LogOut className="h-3.5 w-3.5 shrink-0 opacity-55" />
        </div>

        <div
            data-ponder-panel-account-quality
            className="flex flex-1 flex-col gap-[8%] rounded-xl p-[4%]"
            style={{ backgroundColor: line }}
        >
            <span className="flex shrink-0 items-center gap-[3%]">
                <SlidersHorizontal className="h-2.5 w-2.5 opacity-50" />
                <span className="h-1 w-[32%] rounded-full opacity-60" style={{ backgroundColor: outline }} />
            </span>
            <span className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-[5%]">
                {[0, 1, 2, 3].map(index => (
                    <span
                        key={index}
                        className="flex items-center justify-center rounded-lg"
                        style={{ backgroundColor: index === 1 ? `${accent}33` : outline, opacity: index === 1 ? 1 : 0.5 }}
                    >
                        <span className="h-1 w-[46%] rounded-full" style={{ backgroundColor: index === 1 ? accent : outline }} />
                    </span>
                ))}
            </span>
        </div>

        <span
            data-ponder-panel-account-sync
            className="flex h-[16%] shrink-0 items-center justify-center gap-[3%] rounded-lg"
            style={{ backgroundColor: line }}
        >
            <RefreshCw className="h-3 w-3 opacity-60" />
            <span className="h-1 w-[26%] rounded-full opacity-60" style={{ backgroundColor: outline }} />
        </span>
    </div>
);

/**
 * 来源那一格：来源信息、音频增益、歌词管理、时间轴偏移。
 *
 * 本地 / Navidrome / 在线歌词三页画同一个形状 —— 它们本来就是同一块地方，
 * 后三段完全一样，只有最上面那块写的东西不同。
 */
const SourcePage: React.FC<PageProps & { fileDialogOpen?: boolean }> = ({ accent, line, outline, fileDialogOpen }) => (
    <div data-ponder-panel-source className="relative" style={relativeRectStyle(G.body)}>
        {/* 来源信息：几行「字段 → 值」。在线来源没有这一块。 */}
        <div
            data-ponder-panel-source-info
            className="flex flex-col justify-evenly rounded-xl px-[5%]"
            style={{ ...relativeRectStyle(S.info), backgroundColor: line }}
        >
            {[0, 1, 2].map(index => (
                <span key={index} className="flex items-center gap-2">
                    <span className="h-1 w-[26%] rounded-full opacity-55" style={{ backgroundColor: outline }} />
                    <span className="flex-1" />
                    <span className="h-1 rounded-full opacity-75" style={{ width: `${34 - index * 6}%`, backgroundColor: outline }} />
                </span>
            ))}
        </div>

        {/* 音频增益：标题行右端写着这首歌自带的 dB 值，下面三选一。 */}
        <div data-ponder-panel-source-gain className="flex flex-col justify-between" style={relativeRectStyle(S.gain)}>
            <span className="flex items-center gap-2">
                <span className="h-1.5 w-[30%] rounded-full opacity-55" style={{ backgroundColor: line }} />
                <span className="flex-1" />
                <span className="h-1 w-[24%] rounded-full opacity-45" style={{ backgroundColor: line }} />
            </span>
            <span className="flex gap-[3%]">
                {[0, 1, 2].map(index => (
                    <span
                        key={index}
                        data-ponder-panel-gain-mode
                        className="flex h-5 flex-1 items-center justify-center rounded-md"
                        style={{ backgroundColor: index === 1 ? `${accent}33` : line }}
                    >
                        <span
                            className="h-1 w-[46%] rounded-full"
                            style={{ backgroundColor: index === 1 ? accent : outline, opacity: index === 1 ? 1 : 0.7 }}
                        />
                    </span>
                ))}
            </span>
        </div>

        {/* 歌词：标题行右端两颗图标（导入 / 导出、在线匹配），下面一条写着当前用的是哪一份。
            两颗都按 SIDE_PANEL_SOURCE_LYRICS 单独定位，标题行给它们让出右端那一截。 */}
        <div data-ponder-panel-source-lyrics className="flex flex-col justify-between" style={relativeRectStyle(S.lyrics)}>
            <span className="flex items-center gap-2" style={{ paddingRight: `${(L.fileIcon.width + L.matchIcon.width) * 100}%` }}>
                <span className="h-1.5 w-[22%] rounded-full opacity-55" style={{ backgroundColor: line }} />
            </span>
            <span
                data-ponder-panel-source-lyrics-file-icon
                className="flex items-start justify-end"
                style={relativeRectStyle(L.fileIcon)}
            >
                <ArrowDownUp className="h-3 w-3" style={fileDialogOpen ? { color: accent } : { opacity: 0.5 }} />
            </span>
            <span className="flex items-start justify-end" style={relativeRectStyle(L.matchIcon)}>
                <Search className="h-3 w-3 opacity-50" />
            </span>
            <span
                className="flex items-center justify-between rounded-lg px-[4%] py-[2%]"
                style={{ backgroundColor: line }}
            >
                <span className="h-1 w-[32%] rounded-full opacity-55" style={{ backgroundColor: outline }} />
                <span className="flex h-4 w-[30%] items-center justify-center rounded-full" style={{ backgroundColor: `${accent}33` }}>
                    <span className="h-1 w-[54%] rounded-full" style={{ backgroundColor: accent }} />
                </span>
            </span>
        </div>

        {/* 时间轴偏移：左边标题，右边 ‹ 数字 ms ›。 */}
        <div data-ponder-panel-source-offset className="flex items-center gap-2" style={relativeRectStyle(S.offset)}>
            <span className="h-1 w-[34%] rounded-full opacity-55" style={{ backgroundColor: line }} />
            <span className="flex-1" />
            <ChevronLeft className="h-3 w-3 opacity-55" />
            <span className="h-1.5 w-[16%] rounded-full" style={{ backgroundColor: line }} />
            <ChevronRight className="h-3 w-3 opacity-55" />
        </div>

        {/* 歌词文件窗口：上面是导入，中间两块是把这一首导成 .fia / .lrc，最底下一行去批量导出。
            真实窗口居中在整个屏幕上，这里压在面板上画，只为了和按下它的那颗按钮放在一张图里。 */}
        {fileDialogOpen && (
            <div
                data-ponder-panel-source-file-dialog
                className="flex flex-col gap-[5%] rounded-2xl border p-[5%] backdrop-blur-md"
                style={{ ...relativeRectStyle(S.fileDialog), borderColor: outline, backgroundColor: 'rgba(24,24,27,0.86)' }}
            >
                <span className="h-1.5 w-[34%] shrink-0 rounded-full" style={{ backgroundColor: line }} />
                <span className="flex min-h-0 flex-1 items-center gap-[4%] rounded-lg border px-[4%]" style={{ borderColor: outline }}>
                    <Upload className="h-2.5 w-2.5 shrink-0 opacity-65" />
                    <span className="h-1 w-[46%] rounded-full" style={{ backgroundColor: line }} />
                </span>
                <span className="flex min-h-0 flex-[1.4] gap-[4%]">
                    {[FileJson, FileText].map((Icon, index) => (
                        <span key={index} className="flex flex-1 flex-col justify-center gap-1.5 rounded-lg border px-[5%]" style={{ borderColor: outline }}>
                            <Icon className="h-2.5 w-2.5 opacity-65" />
                            <span className="h-1 w-[70%] rounded-full opacity-45" style={{ backgroundColor: line }} />
                        </span>
                    ))}
                </span>
                <span className="flex min-h-0 flex-1 items-center gap-[4%] rounded-lg border px-[4%]" style={{ borderColor: outline }}>
                    <PackageOpen className="h-2.5 w-2.5 shrink-0" style={{ color: accent }} />
                    <span className="h-1 w-[52%] rounded-full" style={{ backgroundColor: accent }} />
                </span>
            </div>
        )}
    </div>
);

/** 封面四角那四颗按钮。平时是透明的，指针移上封面才浮出来。 */
const CoverActions: React.FC<{ accent: string; outline: string }> = ({ accent, outline }) => (
    <div data-ponder-panel-cover-actions className="overflow-hidden rounded-[6%]" style={relativeRectStyle(G.cover)}>
        <span className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        {([
            ['data-ponder-panel-cover-settings', A.settings, Settings],
            ['data-ponder-panel-cover-transparent', A.transparent, MirrorRectangular],
            ['data-ponder-panel-cover-home', A.home, Home],
            ['data-ponder-panel-cover-playlist', A.addToPlaylist, Star],
        ] as const).map(([marker, rect, Icon]) => (
            <span
                key={marker}
                {...{ [marker]: true }}
                className="flex items-center justify-center rounded-full border"
                style={{ ...relativeRectStyle(rect), borderColor: outline, backgroundColor: 'rgba(9,9,11,0.55)', color: accent }}
            >
                <Icon className="h-[46%] w-auto" />
            </span>
        ))}
    </div>
);

const PonderSidePanelSurface: React.FC<PonderSidePanelSurfaceProps> = ({
    accent,
    line,
    outline,
    registerStateNode,
}) => (
    <div className="absolute inset-0 overflow-hidden" data-ponder-side-panel-structure>
        <PonderSurfaceBase registerStateNode={registerStateNode}>
            <span
                data-ponder-panel-cover
                className="flex items-center justify-center rounded-[6%] border"
                style={{ ...relativeRectStyle(G.cover), borderColor: outline, backgroundColor: accent, opacity: 0.4 }}
            >
                <Disc className="h-[28%] w-[28%] opacity-45" />
            </span>

            <PonderSurfaceStateLayer state={SIDE_PANEL_BODY_STATE} registerStateNode={registerStateNode} visible>
                <TabPage active={0} accent={accent} line={line} outline={outline}>
                    <CoverPage accent={accent} line={line} outline={outline} />
                </TabPage>
            </PonderSurfaceStateLayer>
        </PonderSurfaceBase>

        {/* 指针移上封面，四个角浮出来。纯叠加：底下那张封面要留着。 */}
        <PonderSurfaceStateLayer state="cover-actions" registerStateNode={registerStateNode}>
            <CoverActions accent={accent} outline={outline} />
        </PonderSurfaceStateLayer>

        {/* 换标签页替换的是「标签排 + 内容」这一整层，高亮才会跟着挪到新的那一格上。 */}
        <PonderSurfaceStateLayer state="cover-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={0} accent={accent} line={line} outline={outline}>
                <CoverPage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        {/* 来源那一格在场时，标签排是五格 —— 它插在封面页后面，不是替掉某一格。 */}
        <PonderSurfaceStateLayer state="source-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={1} tabs={SOURCE_TABS} accent={accent} line={line} outline={outline}>
                <SourcePage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        {/* 同一格按下歌词行的导入 / 导出：整页不变，上面压一扇歌词文件窗口。 */}
        <PonderSurfaceStateLayer state="source-tab-file-dialog" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={1} tabs={SOURCE_TABS} accent={accent} line={line} outline={outline}>
                <SourcePage accent={accent} line={line} outline={outline} fileDialogOpen />
            </TabPage>
        </PonderSurfaceStateLayer>

        <PonderSurfaceStateLayer state="controls-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={1} accent={accent} line={line} outline={outline}>
                <ControlsPage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        <PonderSurfaceStateLayer state="queue-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={2} accent={accent} line={line} outline={outline}>
                <QueuePage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        {/* 点中间那块名称：完整列表压下来，底下还有一条去完整设置的出口。 */}
        <PonderSurfaceStateLayer state="controls-mode-list" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={1} accent={accent} line={line} outline={outline}>
                <ModeListPage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        {/* 私人 FM 打开时，队列那一格整格换成电台面板 —— 同一格标签，另一套内容。 */}
        <PonderSurfaceStateLayer state="fm-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={2} tabs={FM_TABS} accent={accent} line={line} outline={outline}>
                <FmPage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>

        <PonderSurfaceStateLayer state="account-tab" registerStateNode={registerStateNode} replaces={SIDE_PANEL_BODY_STATE}>
            <TabPage active={3} accent={accent} line={line} outline={outline}>
                <AccountPage accent={accent} line={line} outline={outline} />
            </TabPage>
        </PonderSurfaceStateLayer>
    </div>
);

export default PonderSidePanelSurface;
