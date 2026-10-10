// src/components/ponder/ponderStageNodes.ts
// 教程层各子层把自己的 DOM 节点登记到这里，时间线直接对着这些节点写属性。
//
// 走一个可变的登记表而不是一层层传 ref，是因为时间线要按 step.id / 锚点名去找演员，
// 而演员分散在骨架层、字幕层、光标层里；这张表是它们之间唯一的接触面。

export type PonderSurfaceStateNode = { node: HTMLElement; replaces: boolean | string };

export type PonderStageNodes = {
    /** 光标本体，时间线对它写 x/y。 */
    cursor: HTMLElement | null;
    /** 按下时扩散的那个圈。 */
    cursorRing: HTMLElement | null;
    /** 字幕：一个 caption 步骤一个节点，预渲染在 opacity 0。 */
    captions: Map<string, HTMLElement>;
    /** 按键胶片：一个 keypress 步骤一个节点。 */
    keyChips: Map<string, HTMLElement>;
    /** 字幕的指向线，与对应字幕同生同灭，按 step.id 索引。 */
    pointers: Map<string, SVGGElement>;
    /** 骨架框本身，按锚点名索引。startsHidden 的框由 reveal 步骤对着它写 opacity。 */
    boxes: Map<string, HTMLElement>;
    /** 骨架框的高亮填充，按锚点名索引。 */
    highlights: Map<string, HTMLElement>;
    /**
     * region 锚点的名字标签，按锚点名索引。
     *
     * 只在讲到它的那段字幕期间露出来：一章里能被点到的区域有七八个，标签要是整章挂着，
     * 就会在命令面板这种整页浮层上留一串讲的是底下那屏的名字。
     */
    labels: Map<string, HTMLElement>;
    /**
     * synthetic surface 的操作结果层，先按锚点名、再按 state 名索引。
     * replaces 决定时间线揭开它的时候要不要把上一层淡出，见 PonderSurfaceStateLayer。
     */
    surfaceStates: Map<string, Map<string, PonderSurfaceStateNode>>;
    /** 进度条填充，时间线每帧写它的 scaleX。 */
    progressFill: HTMLElement | null;
    /** 关键帧刻度，按序号索引；当前帧靠 data-active 属性标记。 */
    ticks: (HTMLElement | null)[];
};

export const createPonderStageNodes = (): PonderStageNodes => ({
    cursor: null,
    cursorRing: null,
    captions: new Map(),
    keyChips: new Map(),
    pointers: new Map(),
    boxes: new Map(),
    highlights: new Map(),
    labels: new Map(),
    surfaceStates: new Map(),
    progressFill: null,
    ticks: [],
});
