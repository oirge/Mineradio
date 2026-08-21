# 示例主题插件

Mineradio 自带 **午夜靛蓝** 和 **暖琥珀** 两份主题（1.7.2 起随安装包发货，装好就在插件列表里，
默认不启用）。这里放的是这两份的源文件，外加一份没进安装包的 **石墨**，同时当主题写法的参考。
完整 API 见 [`docs/PLUGIN_AUTHORING.md`](../../docs/PLUGIN_AUTHORING.md)。

## 安装

自带那两份不用装。石墨要装：设置面板 → 插件 → 管理 → 安装插件文件，选中 `theme-graphite.json`。
一个文件就是一个插件。

| 文件 | 随安装包自带 | 作用 |
| --- | --- | --- |
| `theme-midnight-indigo.json` | 是 | 午夜靛蓝：深蓝黑底 + 蓝调玻璃 |
| `theme-warm-amber.json` | 是 | 暖琥珀：暖黑底 + 金调玻璃 |
| `theme-graphite.json` | 否 | 石墨：纯无彩，最克制的一版 |

**主题同一时刻只能启用一个。** 三份可以同时装在列表里，但启用一个的瞬间原来那个会被自动关掉 ——
两份主题一起生效时后注入的会盖住前一份的同名变量，结果取决于安装顺序，没法调也说不清。

自带的两份卸载后不会在下次启动时被塞回来；想要回来就再手动装一次本目录下的同名文件。

## 主题插件：能改什么，不能改什么

主题走声明式 `.json`，不跑代码，装上立刻生效；`id` 相同会被当成升级覆盖，启用状态保留。

先说期望值：**主题换的是玻璃外壳的色温，不是重画整个界面。** 这个播放器的画面主色来自封面取色和
设置里的取色器，面板本身是半透明玻璃，封面会从下面透上来。所以主题生效后你看到的是面板/卡片/
搜索框的底色偏冷或偏暖、内发光换色、香槟色文字和来源角标换色，而不是整屏变蓝或变黄。

**三类变量写了没反应**，第一版示例主题就是踩在这上面才「装上没效果」：

1. **被取色器钉在行内的**：`--fc-accent` `--fc-accent-hov` `--fc-accent-rgb` `--glass-border`
   `--glass-shadow-focus`（界面高亮）、`--home-accent` `--home-accent-rgb`（Home 填充）、
   `--home-icon-color/-rgb` `--visual-icon-color/-rgb`、`--visual-tint`。
   这些由设置面板写成 `documentElement` 的行内变量，插件注入的样式表压不过行内样式 ——
   这是刻意的设计，你自己挑的强调色不该被插件改掉。
2. **只声明、没人读的**：`--fc-bg` `--fc-paper` `--fc-ink` `--fc-ink-2` `--fc-muted` `--fc-hair`
   `--fc-hair-2` `--champagne-deep` `--chill-*` `--fc-blue` `--fc-warm` `--glass-border-soft`。
   改了等于没改。
3. **被后面的 `!important` 字面值盖掉的**：`#search-box` 的底色最终由一条写死的
   `rgba(0,0,0,.1)!important` 决定，所以 `--glass-bg` / `--glass-bg-focus` / `--glass-shadow` 也无效。

**`vars` 里真正有效的是这九个**（三个示例主题只改这些）：`--panel-glass-shadow`
`--saved-panel-glass-bg` `--saved-panel-glass-shadow` `--saved-button-glass-bg`
`--saved-button-glass-hover-bg` `--saved-button-glass-shadow` `--saved-button-glass-hover-shadow`
`--champagne`（十几处文字与描边）`--source-local`（来源角标）。

**面板、卡片、搜索框的底色只能走 `css` 通道**：用 app 自己的选择器写同名属性并加 `!important`，
靠「同特异性、更靠后」赢下层叠 —— 示例文件末尾那三行就是这么做的。两条自律：
不要动任何 `*-filter` 变量（玻璃的模糊/饱和度是调好的黄金参数），
渐变第一段保留 `rgba(var(--home-accent-rgb),…)`，让用户自己的强调色继续透出来。

想自己调一版：复制任意一个 `.json`，改 `id`、`name` 和几个色值即可。
变量值不能超过 200 字符、不能出现 `;` `{` `}`，`url()` 只允许 `data:`，远端地址会被清掉；
`css` 上限 64KB，`@import` / `@charset` / `@namespace` 会被剔除。

## 写给要写音源 / 歌单插件的人

播放器仍然支持 `source` / `playlist` / `lyric` 三类脚本插件（`.js`），只是本目录不再附带示例 ——
示例音源依赖第三方公益服务，节点间歇性超时会被当成播放器的毛病，得不偿失。
接口、钩子签名和沙箱限制见 [`docs/PLUGIN_AUTHORING.md`](../../docs/PLUGIN_AUTHORING.md)，
下面三条是写这类插件时最容易踩的坑：

1. **`playlist` 类插件也必须注册 `url` 钩子。** 宿主是按歌曲所属的 `pluginId` 回调 `url` 的，不看插件 kind；
   歌单插件不注册 `url`，它给出的歌就全都放不出声。
2. **单次钩子调用有超时上限（12 秒）。** 别在钩子里串行发一长串请求，也别做无上限重试；
   并发那批的数量要压在宿主的在飞请求上限（6）以内，否则会排队。
3. **返回值必须能结构化克隆。** 循环引用、函数、DOM 对象都会让这次调用整体失败。
4. **插件歌曲不能加入「特别喜欢」或本地歌单** —— 那两处按本地文件引用存盘，插件歌曲没有文件可引用。
