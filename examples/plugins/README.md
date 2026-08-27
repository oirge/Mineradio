# 示例主题插件

Mineradio 自带 **午夜靛蓝** 和 **暖琥珀** 两份完整主题（1.7.2 起），以及
**深海微光** / **暗焰余晖** / **冷杉夜雾** 三份纯背景主题（1.7.5 起）。它们装好就在插件列表里，
默认都不启用。这里放的是五份自带主题的源文件，外加一份没进安装包的 **石墨**，同时当主题写法的参考。
1.7.4 起插件只有主题一种，本目录就是插件示例的全部。
完整 API 见 [`docs/PLUGIN_AUTHORING.md`](../../docs/PLUGIN_AUTHORING.md)。

## 安装

自带的五份不用装。石墨要装：设置面板 → 插件 → 管理 → 安装插件文件，选中 `theme-graphite.json`。
一个文件就是一个插件。

| 文件 | 随安装包自带 | 作用 |
| --- | --- | --- |
| `theme-midnight-indigo.json` | 是 | 午夜靛蓝：深蓝黑底 + 蓝调玻璃 |
| `theme-warm-amber.json` | 是 | 暖琥珀：暖黑底 + 金调玻璃 |
| `theme-background-deep-sea.json` | 是 | 深海微光：只调默认背景的冷青深海色调 |
| `theme-background-ember.json` | 是 | 暗焰余晖：只调默认背景的深红暖火色调 |
| `theme-background-forest.json` | 是 | 冷杉夜雾：只调默认背景的冷绿夜雾色调 |
| `theme-graphite.json` | 否 | 石墨：纯无彩，最克制的一版 |

**主题同一时刻只能启用一个。** 六份可以同时装在列表里，但启用一个的瞬间原来那个会被自动关掉，
不会出现完整主题与纯背景主题叠加后互相覆盖变量的情况。

自带的五份卸载后不会在下次启动时被塞回来；想要回来就再手动装一次本目录下的同名文件。

## 主题插件：能改什么，不能改什么

主题走声明式 `.json`，不跑代码，装上立刻生效；`id` 相同会被当成升级覆盖，启用状态保留。

先说期望值：**主题换的是外壳色调，不是重画整个界面。** 画面主色仍然来自封面取色和设置里的取色器，
面板是半透明玻璃、封面从下面透上来，所以卡片的选中态、Home 的填充、图标高亮依旧跟着你挑的强调色走。
主题拿下的是面板/卡片/浮层/底栏/搜索框的底色描边阴影、分隔线和次级文字 —— 1.7.3 起这部分从
十几处扩到了六十多处，左侧歌单、歌单来源弹层、右侧音效面板和迷你播放器都在内。1.7.5 起再加上
默认播放器背景的底色和封面色调，但用户自己选的背景媒体仍然优先。

**两类变量写了没反应**，第一版示例主题就是踩在这上面才「装上没效果」：

1. **被取色器钉在行内的**：`--fc-accent` `--fc-accent-hov` `--fc-accent-rgb` `--glass-border`
   `--glass-shadow-focus`（界面高亮）、`--home-accent` `--home-accent-rgb`（Home 填充）、
   `--home-icon-color/-rgb` `--visual-icon-color/-rgb`、`--visual-tint`。
   这些由设置面板写成 `documentElement` 的行内变量，插件注入的样式表压不过行内样式 ——
   这是刻意的设计，你自己挑的强调色不该被插件改掉。
2. **只声明、没人读的**：`--fc-bg` `--fc-paper` `--fc-ink` `--fc-ink-2` `--fc-muted` `--fc-hair`
   `--fc-hair-2` `--champagne-deep` `--chill-*` `--fc-blue` `--fc-warm` `--glass-border-soft`、
   以及 `--glass-bg` / `--glass-bg-focus` / `--glass-shadow`（底色由写死的 `!important` 决定）。
   改了等于没改。

### 主通道：`--th-*`

1.7.3 起 `public/app.css` 里那些写死的 `!important` 字面值被就地改写成
`var(--th-x, <原来的字面值>)`，主题只要设 `--th-*` 就能拿下这些面板。不设的时候取回落值，
外观与没装主题时完全一致。**这是现在唯一推荐的上色方式**，`css` 通道只留给真正特殊的补丁。

| 变量组 | 管到哪 |
| --- | --- |
| `--th-bg-color/-tint/-tint-opacity` | 默认背景底色、封面模糊层色调和色调透明度 |
| `--th-panel-bg/-border/-shadow` | 搜索结果、搜索模式标签、右侧音效面板；也是其它面板组的兜底 |
| `--th-side-panel-bg/-border/-shadow` | 左侧歌单面板（不设就跟 `--th-panel-*`） |
| `--th-popover-bg/-border/-shadow` | 歌单来源选择弹层等浮层 |
| `--th-subpanel-bg/-border` | 面板内嵌的分区容器（音效面板页签条） |
| `--th-row-bg/-border/-shadow` | 歌单卡片、队列项、详情行、收藏项、插件项 |
| `--th-row-hover-bg/-hover-border` | 上面那些的悬停态 |
| `--th-row-active-bg` | 展开的卡片与当前播放项 |
| `--th-chip-bg/-border/-hover-bg/-hover-border` | 小按钮与胶囊（不设就跟 `--th-row-*`） |
| `--th-bar-bg/-shadow` | 底部控制条 |
| `--th-search-bg` | 搜索框底 |
| `--th-hairline` `--th-hairline-soft` | 分隔线 |
| `--th-text-strong` `--th-text-dim` | 次级标题、艺人名等文字 |
| `--th-mini-*` | 迷你播放器窗口，见下 |

两条硬约束：**不要动任何 `*-filter` 变量**（玻璃的模糊/饱和度是调好的黄金参数），
面板渐变第一段保留 `rgba(var(--home-accent-rgb),…)`，让用户自己的强调色继续透出来。
卡片的「选中 / 已添加 / 当前播放」描边一律是 `rgba(var(--fc-accent-rgb),…)`，
那是取色器的地盘，主题够不到也不该够到。

### 纯背景主题

`--th-bg-color` 设最底层颜色或渐变，`--th-bg-tint` 设封面模糊背景上的轻色调，
`--th-bg-tint-opacity` 控制这层色调的透明度。一份纯背景主题可以只声明这三个 `vars`，
不需要 `css`。三份 `theme-background-*.json` 就是最小示例。

用户在设置里选的纯色、图片、视频或透明度会通过行内 `--custom-bg-color` 压过主题；
自定义媒体、Wallpaper Engine 或「播放器背景板」启用时，封面模糊层仍按原逻辑让位。
这三个变量不会改玻璃参数、粒子、电影镜头或壁纸逻辑。另外，纯背景主题仍是互斥的
`theme`：启用它会关掉当前完整主题，面板回落到默认配色。

**左侧歌单面板只能走 `--th-side-panel-*`。** 它最终由
`html.control-glass-svg-ok #playlist-panel` 这条 `(1,1,1)` 规则决定，
主题在 `css` 通道里写 `#playlist-panel{…!important}` 只有 `(1,0,0)`，压不过去。

### 迷你播放器

迷你播放器是另一个窗口，不加载插件运行时。主窗口把当前生效的 `--th-*` 通过
`mineradio-mini-player-state` 那条 IPC 整表转发过去，主进程会再清洗一遍（只收 `--th-` 前缀、
单值 200 字符上限、最多 64 个），迷你窗口收到后写到自己的 `documentElement` 上。
它自己的一族是 `--th-mini-bg/-border/-shadow`、`-cover-bg/-cover-border/-cover-text`、
`-title/-artist/-ghost-text`、`-btn-bg/-btn-border/-btn-text/-btn-hover-bg/-btn-hover-border/-btn-hover-text`、
`-play-bg/-play-border/-play-text`；不设的会回落到 `--th-popover-*` / `--th-chip-*` / `--th-text-*`，
所以只写通用组也能让迷你窗口跟着换色。封面的青色律动光晕是几何调好的，留作字面值不参与主题。

### 还是走不通的老变量

`--panel-glass-shadow` `--saved-panel-glass-*` `--saved-button-glass-*` `--champagne`
`--source-local` 这九个仍然有效（示例主题保留着），但覆盖面远不如 `--th-*`。

想自己调一版：复制任意一个 `.json`，改 `id`、`name` 和几个色值即可。改了载荷记得抬 `version` ——
自带主题的种子只在版本号更高时才替换已经存下来的那份。
变量最多 160 个、值不能超过 200 字符、不能出现 `;` `{` `}`，`url()` 只允许 `data:`，远端地址会被清掉；
`css` 上限 64KB，`@import` / `@charset` / `@namespace` 会被剔除。

## 写给想装外部市场插件的人

装不上，也不打算适配。GitHub 上那些 LX Music / 落雪音乐系的「音源插件」要的是宿主代发网络请求、
返回播放直链，而这条通道在 1.7.4 被整体删掉了：现在插件唯一的能力就是换外观，没有网络，
也碰不到播放。它们要么没有 `@kind theme`（报 `PLUGIN_BAD_KIND`），要么连 `@id` 都不写
（报 `PLUGIN_BAD_ID`），在解析阶段就被拒，永远不会被启动。

旧版本装过的音源 / 歌单插件记录，升级后会在读取存档时被整条丢掉，不需要手动清理。

需要脚本主题（按时间或系统状态算颜色）的话，写 `@kind theme` 的 `.js` 并注册 `theme` 钩子，
返回和声明式一样的 `{ vars, css }`，走同一套清洗。三条容易踩的坑：

1. **只有 `theme` 一个钩子名。** 注册 `search` / `url` / `playlists` 之类会直接启动失败。
2. **单次钩子调用超时 12 秒**，Worker 启动超时 8 秒。别在钩子里做无上限的循环。
3. **返回值必须能结构化克隆。** 循环引用、函数、DOM 对象都会让这次调用整体失败 ——
   失败的后果只是这份主题不生效，不会影响别的插件，但你也就看不到效果。
