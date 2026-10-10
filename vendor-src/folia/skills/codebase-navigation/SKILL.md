---
name: codebase-navigation
description: Use when you need to locate code in this repository - unfamiliar areas, a feature described without a file path, or checking who uses something. Gives the three-layer order (generated code map, then rg, then the ts-code-map cli as fallback), says exactly when rg is not enough, and states the architectural boundaries that navigation must respect.
---

# Codebase Navigation

**先读 `docs/CODEMAP.md`，再用 rg，最后才用 cli。**

这份 skill 不维护路径表，`CODEMAP.md` 也不是人写的——它由 `npm run codemap` 从编译器和模块图
生成，main 落地后由 `codemap-sync` workflow 自动重生成并提交。仓库有 1300 个源文件、3800 条依赖，任何手写清单都覆盖不全且必然过期
（这里曾同时存在 7 处死引用，visualizer 模式清单也少了两个）。

## 三层，按成本从低到高

**1. 结构性问题读 `docs/CODEMAP.md`。** 有哪些区域、入口在哪、哪些是枢纽模块、某个 registry
当前有哪些成员、哪里违反分层边界。零成本，且保证不过期。

**2. 符号级问题默认用 rg。** 快、灵活、能组合关键词，而且覆盖 `.md`/`.json`/CSS/shader 这些
LSP 根本看不到的地方。绝大多数「这个东西在哪」用 rg 就够了。

**3. rg 拿不准时才升级到 cli。** 它是后备，不是默认。

```
node dev/mcp/ts-code-map/cli.mjs <tool> '<JSON>'
node dev/mcp/ts-code-map/cli.mjs list      # 全部工具和用法
node dev/mcp/ts-code-map/cli.mjs doctor    # 环境自检
```

## 什么时候该从 rg 升级到 cli

| 情况 | 用 | 原因 |
| --- | --- | --- |
| 同名符号太多，分不清哪个是定义 | `references` | rg 区分不了声明、引用、字符串和注释；cli 会列出候选声明让你用 `file`/`line` 限定 |
| 要确认「所有用到的地方都改到了」 | `references` | rg 证明不了完备性；cli 给出语义引用 + 同名声明 + 仅文本命中三段，可信度分开标注 |
| 这个引用是读还是写 | `references` | rg 分不出，cli 用 documentHighlight 判定 |
| 谁调用了这个函数，往上追几层 | `callers` / `callees` | rg 做不到调用链 |
| 改这里会波及多大范围 | `impact` | 需要模块依赖图 |
| 想知道大文件里有什么，又不想读全文 | `file_outline` | 3080 行的文件输出 3.4KB，比读源码省 37 倍 |
| 要签名、类型、JSDoc | `inspect_symbol` | rg 只能看到文本 |

反过来，**这些情况 rg 更好，不要绕道 cli**：

- 已知确切的字面量、数字、字符串（`0.85`、某段报错文案）
- 在 `.md`、`.json`、CSS、shader 字符串里找东西
- 想看一个词的全部出现，包括注释和文档里的
- 只是想确认某个文件里有没有某段代码

## 一个已知陷阱

同一个概念常在多处各自声明（`lyricsFontScale` 在 store、OBS 配置类型、编解码、每个 visualizer
模式里各有一份，共 27 个文件）。这种情况下 rg 的结果看着乱，而 `references` 的第一个结果也
未必是你要的——它按分层角色猜（stores/types 优先于 components），只是启发式。**别拿第一个
结果当唯一答案**，看它列出的候选声明。

## Boundaries

定位到位置之后，改动要落在正确的层：

- UI 结构在 `components`；React 生命周期和副作用在 `hooks`；跨组件状态在 `stores`；
  IO/缓存/provider 在 `services`；纯变换在 `utils`；契约在 `types`。
- `utils` 是叶子层，全仓都 import 它，所以它不能反过来读 store。需要读实时状态才能得出结果的
  「收集器」属于 `services` —— OBS 导出的 `visualSettingsConfig` / `currentObsUrl` / `obsCustomCss` /
  `webObsTarget` 因此在 `src/services/obs/`，而纯编解码的 `obsUrl` / `obsWebAppearance` / `appearanceCodec`
  留在 `utils`。
- 普通在线歌曲调用走 `omni`；provider adapter 和 transport 是实现边界，UI/hook/store 不应直连。
  详见 `skills/online-song-omni-routing/SKILL.md`。
- Visualizer 消费已解析的 `LyricData` / `Line` / `Word`；格式解析留在 `src/utils/lyrics` 和 workers 里。
- Visualizer 模式由 registry 从各模式的 `entry.tsx` 自动发现，**不要在 `App.tsx` 里加 switch**。
  背景同理，走 `backgrounds/` 下的 entry。
- entry 里的 renderer 必须包成 `React.lazy`：registry 用 eager glob 发现 entry，静态 import
  renderer 会让任何碰 visualizer 设置的模块连带拉进 13 个 renderer 和 three.js。
- 只是校验「某字符串是不是合法模式」时用 `src/types/visualizerModes.ts` 的
  `isBuiltinVisualizerMode` / `isBuiltinVisualizerBackgroundMode`，不要 import registry。
  需要认 mod 投稿模式时才用 registry 的 `hasVisualizerMode`。模式清单由 registry 初始化时
  断言，漂移会抛错。
- 集合浏览（Library）按 headless core 与 UI suite 分开，都在 `src/library/`：`core/` 里
  `contracts`（只有类型：集合描述、资源、能力、端口、变更动作、会话）← `model`（纯变换，叶子：不读
  store、不调 service、不 import react）← `services`（资源、registry、缓存、同步、变更控制器）/
  `state`（zustand store，storeContract 一并扫描）← `bindings`（React hooks）。`suites/<id>/` 是
  各套 UI（每套 `entry.ts` + 自己的整个文件夹），`registry.ts` 发现 suite 并按 surface 回退到默认的
  grid，`app/` 是宿主装配（集合宿主、播放 / 变更端口、suite 切换）。规则：core 不 import suites、
  app、registry 和 `src/components`；suite 之间互不 import，也不直接用 `core/services`（资源与控制器
  由宿主创建后传入）；stores / services / utils / types 不 import suites 与 app；suites 之外只有 registry
  引用 suite（宿主、首页外壳都经 registry 解析）；不建 barrel。
  这些规则同时写在 `codemap.mjs` 的 `BOUNDARY_RULES` 和 `test/unit/library/layerBoundaries.test.ts` 里。
  网格 suite 按 surface 分子目录：`suites/grid/{home,collection,directory,artist,shared,transitions}`
  （首页 `Grid3D` 与本地 / Navidrome 首页、集合详情 `GridView`、`GridMap` 与批量面板、歌手页、
  hex 视口与卡片、打开转场）；TUI 在 `suites/tui/`（实现首页 `LibraryTuiHome`、集合 `LibraryTuiView` 与歌手页 `LibraryTuiArtist`）；
  集合宿主 `GridViewOverlayHost` 与端口在 `app/`，首页资源（在线 feed、Navidrome 概览、文件夹树、首页动作）由
  Home 外壳的 `app/useLibraryHomeResources` 持有，换 suite 不重新请求。
  能力契约在 `core/contracts/suite.ts`（surface：home / collection / artist；集合动作 `LibraryActionId`、
  首页动作 `LibraryHomeActionId`、歌手页动作 `LibraryArtistActionId`（能力规则在 `core/model/artistSurface`，两套歌手页共用 `core/bindings/useArtistView`）；
  每个 surface 的 props 契约；suite manifest），每套 suite 的 `entry.ts` 声明自己实现了哪些 surface 与动作。
  没实现的 surface 由默认 suite（grid）渲染，没声明的动作不进命令面板（`buildGridSurfaceState` 按声明过滤）。
  entry 里的组件必须是 `React.lazy`，只有默认 suite 例外（Grid3D 在首屏、移形换影要从第一次打开就在）；
  开发验证专用的 suite（tui）默认关闭，只有 `import.meta.env.DEV` 且显式 `VITE_LIBRARY_TUI=true` 时启用；测试配置自动开启。
  网格专属的转场（移形换影）经 entry 的
  `transitions` 交给宿主，宿主与 `switchLibrarySuite` 不直接 import 网格。
- `App.tsx` 是历史遗留的装配缝，已经很大。新行为应该组装进相邻的 `components/app/*`、
  hooks、stores、services，而不是继续堆进去。参见 `skills/file-modularization/SKILL.md`。

## 这些名字已经不是当前入口

LSP 会老老实实找到死文件和历史命名，这几个需要人工标注：

- `LocalMusicView`、`local/LocalPlaylistView`、`navidrome/*` —— 都已不存在。
  本地库和 Navidrome 的首页面现在是 `LocalGrid3DView` 和 `NavidromeGrid3DView`。
- `useSettingsUiStore` —— 已不存在，而且**不是简单改名**。设置弹窗的 UI 状态（当前 tab/子页）
  在 `useSettingsModalStore`；具体设置值被拆到了各领域 store（`useAudioSettingsStore`、
  `useLyricSettingsStore`、`useThemeSettingsStore`、`useTypographySettingsStore` 等）。
  想找某个设置项时按领域找，不要指望有一个统一的设置 store。
- `buildCommandPaletteContext` —— 现在是 `useCommandPaletteContext`（hook，不是 build 函数）。

发现文档里还有别的死路径，直接改掉，不要绕过去。

## Validation

改代码前先读 `skills/testing-strategy/SKILL.md` 选最小验证方式。
纯文档改动时，路径和符号用 `find_symbol` / `search` 核一遍即可。
