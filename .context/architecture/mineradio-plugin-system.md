# Mineradio 插件系统架构

`v1.7.0` 引入，`v1.7.4` 收窄成只有一种插件：主题（`theme`）。音源与歌单能力（含插件的全部网络与播放通道）在 `v1.7.4` 整体移除。`v1.7.5` 起主题可轻量调整默认背景，安装包自带六份完整主题（五份暗色：午夜靛蓝、暖琥珀、深海微光、暗焰余晖、冷杉夜雾；一份浅色：雪昼白），默认都不启用，其余由用户自己导入。

## 分层与文件

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 清单 | `public/plugin-manifest.js` | 包解析（JS 头注释 / JSON 清单）、字段校验、主题变量与 CSS 清洗、localStorage 记录归一化。纯函数，UMD 尾，浏览器/Worker/Node 三处共用。 |
| 沙箱 | `public/plugin-sandbox.js` | Worker 内部。启动时把危险全局剥成 `undefined` 并 `delete`，再用 `new Function('mineradio','lx',…)` 执行插件正文，之后只靠消息协议与宿主往来。只有 `theme` 一个钩子。 |
| 宿主 | `public/plugin-runtime.js` | 渲染进程侧。管理插件记录、起停 Worker、RPC 收发、主题互斥、主题注入、把合并后的变量表交给迷你播放器转发。对外暴露 `window.MineradioPlugins`。 |
| 自带主题 | `public/plugin-builtin-themes.js` | 安装包内置的声明式主题包，走与用户导入完全相同的 `parsePluginPackage` 通道。 |
| 界面 | `public/app.js` + `public/index.html` | 插件管理弹窗与 FX 面板入口。 |

## 关键边界

- **插件只能换外观。** 没有网络（宿主不代发请求，也没有本地代理），没有播放通道，拿不到本地文件与账号。脚本插件唯一能做的事就是从 `theme` 钩子返回一份变量表与一段 CSS 文本。
- **沙箱是能力沙箱，不是语言沙箱。** 插件仍然跑在同一个 JS 引擎里，防线是「它拿不到任何有副作用的东西」：`fetch` / `XMLHttpRequest` / `WebSocket` / `importScripts` / `indexedDB` / `caches` / `Worker` / `postMessage` 全部剥掉，没有 DOM、没有 localStorage、没有 `desktopWindow` IPC 桥，因此也就没有文件系统。
- **插件正文必须走 `new Function` 而不是 `eval`。** `eval` 会让插件看到 bootstrap 的闭包变量（`handlers`），可以劫持别的插件的调用。`tests/plugin-system.test.js` 用正则把这条钉住。
- **`@kind` 必须是 `theme`。** 这同时是拒绝外部市场（LX 系）音源插件的那道门：它们要么不声明 `@kind theme`，要么连 `@id` 都没有，解析阶段就返回 `PLUGIN_BAD_KIND` / `PLUGIN_BAD_ID`，永远不会被启动。
- **主题是互斥的，不叠加。** 启用一个就把其它主题关掉（`enforceSingleTheme()`）。`1.7.2` 之前的存档可能同时启用多个，`init()` 时收敛成 `updatedAt` 最新的那一个。
- **清洗在宿主侧做，脚本返回值也要过。** `normalizeThemeVars()` / `sanitizeThemeCss()` 对声明式负载和 `theme` 钩子返回值一视同仁：变量名白名单、值不许含 `; { } < >` 与 `url()`，CSS 里 `@import` / 远端 `url()` / `</style>` / `expression(` / `javascript:` 全部拦掉，`data:image/` 内联图放行。
- **背景只是轻量换色，用户设置优先。** `--th-bg-color` 提供默认底色，`--th-bg-tint` / `--th-bg-tint-opacity` 提供封面模糊层上的色调。`#custom-bg` 始终先读 `--custom-bg-color`，用户选了纯色、图片、视频或透明度后，`applyCustomBackground()` 会写行内变量；默认态才 `removeProperty()` 让主题接管。播放器背景板启用时，默认底色会让位，但带 `.custom-background-override` 的用户背景仍留在画布上层；Wallpaper Engine 与自定义媒体的既有图层关系不变。

## 存档

localStorage `mineradio-plugins-v1`，经 `bridge.persist`（即 `setPersistentLocalStorageItem`）写入，同时进 preload 的 `PERSISTENT_UI_STATE_KEYS` 做主进程备份。同 id 覆盖安装视为升级：换脚本、保留用户的启用/禁用状态。自带主题的卸载记忆单独存在 `mineradio-plugins-builtin-v1`，用户卸载过就不再自动补回。

旧存档里残留的 `source` / `playlist` 记录会在 `normalizePluginRecords()` 阶段被整条丢掉（`PLUGIN_KINDS` 现在只有 `theme`），不会参与任何调用。

## 主题的 CSS 层级

插件主题写进 head 里唯一一个 `<style id="mineradio-plugin-theme-style">` 节点，用 `textContent` 而不是 `innerHTML`。`applyUiAccentColor()` 写在 documentElement 上的行内变量优先级更高，所以用户自己调的主色仍然压过插件主题——这是有意的。声明式主题在 `applyThemes()` 里同步写入，脚本主题的结果再合并重写一次，避免 Worker 启动那几秒界面裸着。

背景变量也走同一个注入节点：`#custom-bg` 读 `var(--custom-bg-color,var(--th-bg-color,#000))`，独立的 `#theme-bg-tint` 覆在 `#album-bg` 之上并读取 `--th-bg-tint` 和 `--th-bg-tint-opacity`。所有内置主题都同时覆盖背景与面板变量；三份历史背景主题已升级为完整主题，仍受互斥的 `theme` 规则约束。

迷你播放器是独立窗口、不加载插件运行时，只能靠 `themeVars()` → `miniPlayerThemePayload()` → `mineradio-mini-player-state` 的整表转发拿到 `--th-*`。

## 测试

- `tests/plugin-system.test.js`：`vm.createContext` 造最小渲染进程与最小 Worker 环境，跑**真**的 sandbox / runtime 源码互相对接，消息过一遍 `JSON.parse(JSON.stringify(…))` 模拟结构化克隆。环境里刻意不提供 `fetch` / `XMLHttpRequest` / `URL`，运行时哪天又长出网络调用会直接炸。
- `tests/plugin-theme-reach.test.js`：七份示例主题的完整覆盖面、三个背景变量、暗色主题视觉签名、白色主题可读性、用户自定义背景优先级，以及 `--th-*` 从 renderer 到迷你窗口的整条转发链路。

注意：vm 里造出来的数组/对象原型与测试 realm 的不同，`assert.deepStrictEqual` 会因原型不匹配误报，用 `Array.from(...)` / `Object.assign({}, ...)` 抄一份再断，或断长度、逐字段断。
