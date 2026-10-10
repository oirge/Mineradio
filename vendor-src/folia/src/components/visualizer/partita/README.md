# Partita 字符处理流程

这份说明用于描述 Partita 如何把一行歌词变成最终屏幕上的分层文字。

## 当前代码入口

- renderer、sequential layout、缓存与预热：`VisualizerPartita.tsx`
- 模式 tuning 和 registry entry：`tuning.ts`、`entry.tsx`
- semantic/sticky/display layout units：`src/utils/lyrics/cjkSemanticLayout.ts`
- line transition / word reveal timing：`src/utils/lyrics/renderHints.ts`
- 当前/下一句预热窗口：`src/components/visualizer/runtime.ts`

修改前先确认这些共享 helper 的契约；Partita 不直接重写 parser，也不修改 `Line.words`。

## 术语定义

- `word`：歌词解析器产出的原始计时词，来自 `Line.words`。它拥有 `text`、`startTime`、`endTime`。
- `layoutUnit`：分行之前的布局规划单元，由 `buildPostLyricLayoutUnits()` 生成。它可能只包含一个原始 `word`，也可能包含一个 CJK 语义词组，或一个已经向前粘滞了标点的显示单元。
- `isSemantic`：表示这个 layout unit 来自 CJK semantic grouping。它可以包含多个原始 `word`，但最终 display 时仍保留逐字 timing。
- `isSticky`：表示这个 layout unit 做过标点 / 缩写粘滞。非 semantic 的 sticky unit 最终会合成一个 display word。
- `chunk`：Partita 里的一行视觉 row。一个 chunk 是一段连续的 `layoutUnit`。
- `chunkWords`：一个 chunk 内包含的全部原始 `word`。Partita 用它保留原始时间边界和结构信息。
- `displayWords`：最终交给 `PartitaWord` 渲染的文字单元。标点粘滞后的单元可以变成一个 display word，CJK 语义单元仍然可以保留逐字 timing。
- `最终渲染分行`：由 `PartitaChunk` 渲染出来的可见行。每一行都有自己的 stagger、guide line 和 transform。
- `逐字渲染`：`PartitaWord` 的 glow layer 会把非 CJK display text 拆成字符做高亮动画。body layer 仍然把整个 display word 作为一个文本 span 渲染。

## Step 1：从原始计时词开始

Partita 从 visualizer runtime 拿到当前激活的 `Line`。

关键字段是：

- `line.fullText`：完整歌词文本，用于测量和 layout cache key。
- `line.words`：解析器产出的原始计时 token。
- `line.renderHints`：行切换和词高亮的 timing 提示，例如 fast 或 instant reveal。

在这个阶段，Partita 不改写解析器 timing。比如 `It’s unbelievable` 可能已经被解析成 `It`、`’`、`s`、`unbelievable` 这些分开的 token。

Partita 随后会从 `getLineRenderHints(line)` 生成当前行的 render profile。这个 profile 统一决定：

- `lineRenderEndTime`：使用 `getLineRenderEndTime(line)`，作为整行最多可占用的视觉时间边界；
- `lineTransitionMode`：`normal`、`fast` 或 `none`，控制整行容器的进出场；
- `wordRevealMode`：`normal`、`fast` 或 `instant`，控制每个词的 active end 和最小显示时长；
- `wordLookahead`：为极短行和快速切换保留的预读窗口。

因此 `PartitaChunk` 的 active end 不总是直接等于原始 `word.endTime`；当 render hint 要求 fast/instant reveal 时，仍然以统一的 render profile 为准。

## Step 2：构建 Post Lyric Layout Units

`buildSequentialColumns()` 会先调用：

```ts
buildPostLyricLayoutUnits(line, {
    semantic: tuning.useSemanticLayout,
    sticky: true,
})
```

这个函数是 parser 之后、Partita layout 之前的后处理层。它不改 `Line` 本体，也不改 `line.words`，只派生出 Partita 用来分行和显示的 `layoutUnit[]`。

处理顺序固定是：

```text
Line.words
  -> semantic grouping 可选
  -> sticky punctuation 固定开启
  -> layoutUnit[]
```

当 `semantic: true` 时，会先尝试 CJK semantic grouping。

当 `semantic: false` 时，会从单个 `word` 对应单个 layout unit 的结构开始。

当 `sticky: true` 时，会继续做标点 / 缩写粘滞。

layout unit 的结构是：

- `text`：这个 layout unit 表示的文本。
- `words`：这个 unit 内包含的原始计时词。
- `startTime`：第一个原始词的开始时间。
- `endTime`：最后一个原始词的结束时间。
- `isSemantic`：这个 unit 是否是 CJK 语义分组，而不是普通单词 token。
- `isSticky`：这个 unit 是否做过标点 / 缩写粘滞。

## Step 3：统一处理标点粘滞

sticky punctuation 是 `buildPostLyricLayoutUnits()` 内部的第二阶段。Partita 当前固定传入 `sticky: true`。

接口拿到的 YRC 歌词大部分情况下拆分粒度比较细，标点和英文缩写后缀往往会被拆成单独 token。这是上游行为，`parserCore` 会保留这些原始时间片，不对标点做全局合并。因此 Partita 在 renderer layout 层处理显示分组。

这一步是语言无关的。它发生在分行之前，所以被粘住的标点后面不会再被拆到不同视觉层里。

目前处理的情况包括：

- 英文后置标点：`Hello` + `,` 变成 `Hello,`。
- CJK 后置标点：`世界` + `。` 变成 `世界。`。
- 英文缩写：`It` + `’` + `s` 变成 `It’s`。
- 直接缩写后缀：`we` + `'re` 变成 `we're`。

这一步只改变 layout / display 分组，不改变原始 timing。被合并后的 unit 仍然保留内部所有原始 `words`。

例如：

```text
Line.words:
It | ’ | s | unbelievable

layoutUnit[]:
It’s(isSticky, words=[It, ’, s]) | unbelievable
```

CJK semantic 和 sticky 也可以同时存在：

```text
Line.words:
世 | 界 | 。

layoutUnit[]:
世界。(isSemantic, isSticky, words=[世, 界, 。])
```

## Step 4：把 Layout Units 切成 Chunks

标点粘滞完成后，Partita 决定当前歌词行最多能用多少个可见 row。

row 数量由可用高度决定：

- `availableHeight = windowHeight * 0.65`
- `targetRowCount = floor(availableHeight / baseRowHeight)`
- `actualRowCount = min(layoutUnits.length, targetRowCount)`

然后 Partita 会把连续的 `layoutUnit` 切成不均匀的 chunks。这里故意不做完全平均，因为 Partita 想要的是手写乐谱一样的错落感，而不是机械网格。

此时需要记住：

- 一个 `chunk` 就是一行可见 row。
- 一个 chunk 包含一个或多个连续的 `layoutUnit`。
- 标点已经在切 chunk 前粘滞完成，所以 `It’s` 不会再被拆成 `It`、`’`、`s` 三个不同 row。

## Step 5：生成 Chunk 元数据

每个 chunk 会派生出这些数据：

- `chunkUnits`：分配到这一行的 layout units。
- `chunkWords`：这些 units 内的全部原始 words。
- `displayWords`：通过 `buildDisplayWordsFromLayoutUnits(chunkUnits)` 得到的最终可渲染文本单元。
- `config`：这一行的 transform 配置，例如 x 偏移、y 偏移、scale、rotate、passedRotate。
- `rowIndex`：这一行在当前歌词行里的位置。

`chunkWords` 和 `displayWords` 的职责不同。

`chunkWords` 保留原始 timing 细节。

`displayWords` 决定屏幕上哪些文本会作为一个整体对象被画出来。

`buildDisplayWordsFromLayoutUnits()` 的规则是：

- `isSticky && !isSemantic`：合成一个 display word，例如 `It’s`。
- `isSemantic`：返回内部原始 words，保留 CJK 逐字 timing。
- 普通 unit：原样返回内部 words。

## Step 6：用 PartitaChunk 渲染行

每个 chunk 会变成一个 `PartitaChunk`。

`PartitaChunk` 是行级 wrapper，负责：

- 行级 waiting、active、passed 状态；
- guide line 的显示和颜色；
- 行级 opacity、scale、x、y、rotate；
- 把 `displayWords` 映射成多个 `PartitaWord`。

这一行的 active 时间窗口仍然来自 `chunkWords`：

- 开始时间：chunk 内第一个原始 word。
- 结束时间：chunk 内最后一个原始 word。

这样即使标点被合并显示，动画 timing 仍然基于解析器的原始数据。

## Step 7：用 PartitaWord 渲染 Display Words

每个 `displayWord` 会变成一个 `PartitaWord`。

`PartitaWord` 负责词级动画：

- waiting、active、passed 状态；
- chunk 内的随机词级 transform；
- active color 匹配；
- body 文本渲染；
- glow 文本渲染；
- chorus ripple。

对于长度大于 1 的非 CJK display text，glow layer 会把文本拆成字符做高亮动画。这只是视觉高亮层的逐字效果。body layer 仍然把整个 display word 放在同一个文本 span 里。

例如标点粘滞后：

```text
It + ’ + s -> displayWord "It’s"
```

最终 body 渲染的是一个包含 `It’s` 的 `PartitaWord`，而 glow layer 可以在内部继续分别动画 `I`、`t`、`’`、`s`。

## Step 8：最终屏幕结构

最终屏幕上的结构是：

```text
Line
  Column
    Chunk / 最终渲染分行
      PartitaWord / display word
        Body layer
        Glow layer
```

最重要的规则是：

```text
Parser words 提供 timing。
Layout units 负责分行规划。
Sticky layout units 防止标点漂到不同视觉层。
Display words 决定最终可见文本对象。
PartitaWord 负责 display word 级动画和 glow layer 逐字动画。
```

## 预热与缓存

当前实现会把当前行的 `PartitaSequentialLayout` 缓存在 renderer 内，并在 `shouldPreheatLine()` 判定下一句进入 `0.18s` 至 `1.2s` 的预热窗口时提前构建下一句布局。缓存 key 包含歌词文本、主题、窗口高度和 Partita tuning；缓存只服务布局产物，不改变 `Line.words` 的原始 timing。
