---
name: file-modularization
description: Use when adding or refactoring frontend features in this repository and you need to prevent large single-file changes, oversized entry files, mixed responsibilities, or giant App.tsx/Home.tsx style implementations. Apply it when a task risks stuffing UI, state, effects, data access, and helper logic into one file instead of splitting focused components, hooks, services, utils, and types.
---

# File Modularization

先判断职责，再决定文件。`App.tsx` 是历史遗留的全局编排接缝，当前已经很大；新功能不要继续堆进它。`Home.tsx`、`PlayerPanel.tsx`、`AppOverlays.tsx`、`AppDialogs.tsx` 已有相邻的 model/helper 目录，应沿现有边界扩展。

## Layer map

- 视图结构：`src/components/*`
- app-level 装配和单区域协调：`src/components/app/*`
- React 生命周期、异步副作用、可复用交互：`src/hooks/*`
- 跨组件共享状态：`src/stores/*`
- 请求、解析、provider、播放流程、缓存：`src/services/*`
- 纯计算、排序、映射、格式化：`src/utils/*`
- 跨层合同：`src/types.ts` 或 `src/types/*`

如果一个文件同时新增 UI、请求、副作用、状态派生、事件处理和类型定义，说明拆分不足。

## Current app boundaries

- `src/components/app/Home.tsx` -> `components/app/home/*`（`buildHomeModel.ts`、collection adapters）与 `src/library/`（集合宿主 `app/GridViewOverlayHost.tsx`、网格 suite `suites/grid/*` 里的 local/Navi grid views）。
- `src/components/app/PlayerPanel.tsx` -> `components/app/player-panel/*`。
- `src/components/app/overlays/AppOverlays.tsx` -> `components/app/overlays/*`。
- `src/components/app/dialogs/AppDialogs.tsx` -> `components/app/dialogs/*`。
- 播放恢复、在线回退、缓存 -> `components/app/playback/*`。
- 搜索工作台和搜索动作 -> `components/app/search/*`。
- 主进程更新通道 -> `electron/updateChannels.cjs`；不要把新的 Electron 逻辑都塞回 `electron/main.cjs`。

## Size guardrail

这些是默认警戒值，不是要求机械重写历史文件：

- `src/index.tsx`、新页面根组件、全局 provider 装配文件：尽量不超过 180 行。
- 普通容器、页面组件、复杂 hook：尽量不超过 220 行。
- 展示组件、工具、适配器：尽量不超过 160 行。
- 单次需求若要向现有文件追加超过 80 行，先判断是否应新建模块。
- `src/App.tsx` 已经超过入口阈值；触碰相关区域时优先抽到上述 app boundary，不要以“就近”为由继续扩大。

## Split order

1. 抽离独立视觉区块到 `components`。
2. 把 props 组装、导航映射和展示派生放到相邻 `components/app/*/build*.ts` 或 `create*.ts`。
3. 把 React 状态和副作用放到 `hooks`。
4. 把请求、缓存、适配放到 `services`。
5. 把纯函数、常量和映射放到 `utils` 或 `types`。
6. 让原文件只保留传参、组合和必要分支。

## Decision signals

- JSX 跨越多个主要视觉区域：拆 component。
- 同类 state/effect 成组且与 UI 弱相关：拆 hook。
- 只服务 Home、PlayerPanel、AppOverlays 或 AppDialogs 的无生命周期组装：拆 app-level builder/helper。
- 包含请求、解析、适配、排序、缓存或序列化：拆 service/util。
- 需要独立测试、可能复用，或让当前文件新增职责：不要留在原文件。

## What to avoid

- 在 `App.tsx` 中直接新增完整功能区、请求函数或大段事件处理。
- 在页面组件中混合 provider 请求、缓存、排序工具和类型声明。
- 把新首页、GridView、集合详情功能塞回旧的 `LocalMusicView`、`local/LocalPlaylistView` 或 `navidrome/*` 路径；当前入口在 `components/app/home/*` 与 `src/library/`（`suites/grid`、`app`）。
- 通过“拆成很多空壳文件”伪装模块化；拆分后职责和依赖方向必须更清楚。
- 为了省一次 import，继续向已有超大 visualizer、`VisPlayground` 或 `SettingsModal` 追加大段实现。

## Review checklist

- [ ] 新代码的层职责是否唯一？
- [ ] 是否复用了当前 app-level builder、hook、service、utils 和 shared types？
- [ ] 是否把实现细节留在正确目录，只让入口负责装配？
- [ ] 是否避免扩大 `App.tsx`、`SettingsModal.tsx`、`VisPlayground.tsx` 或单个 visualizer 文件？
- [ ] 新的跨层合同是否进入 `src/types.ts` / `src/types/*`，而不是内联在组件里？
