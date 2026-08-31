# Mineradio 插件开发指南

适用版本：主题插件格式适用于 `v1.7.4` 起，背景三变量适用于 `v1.7.5` 起。插件由用户从「设置面板 → 插件 → 管理 → 安装插件文件」导入。

**插件只能换外观。** `v1.7.4` 起插件只有主题一种，音源与歌单能力（以及插件的全部网络与播放通道）已整体移除：插件没有联网能力，拿不到本地文件、账号和其它插件的数据，能做的事就是给界面和默认背景轻量换色，再加一点 CSS。安装包自带 `午夜靛蓝` / `暖琥珀` / `深海微光` / `暗焰余晖` / `冷杉夜雾` 五份暗色完整主题，以及 `雪昼白` 一份浅色完整主题，默认都不启用。

## 一个插件是一个文件

两种写法：

- **`.json`** — 纯声明式，推荐。不需要跑代码就别跑代码。
- **`.js`** — 文件开头一段 `/** … */` 块注释当清单，后面是脚本正文；只有需要按条件算颜色时才用得上。

单文件上限 512 KB，最多同时安装 40 个插件。`.json` 里的 `schema` 可以不写，写了就必须是 `mineradio-plugin-v1`。

主题之间是**互斥**的：启用一个就会自动关掉当前那个，同一时刻只有一份主题生效。

## 声明式主题（`.json`）

```json
{
  "schema": "mineradio-plugin-v1",
  "id": "demo.theme",
  "name": "暗夜主题",
  "kind": "theme",
  "version": "1.0.0",
  "author": "yourname",
  "theme": {
    "vars": { "--th-bg-color": "#05070b", "--th-panel-bg": "rgba(10,10,14,0.86)", "--th-hairline": "rgba(255,255,255,.08)" },
    "css": ".pl-card{border-radius:18px}"
  }
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | `[A-Za-z0-9][A-Za-z0-9._-]{1,63}`。同 `id` 再次安装视为升级，会换掉负载并保留用户的启用/禁用状态。 |
| `name` | 是 | 显示名，最长 40 字。 |
| `kind` | 否 | 只能是 `theme`。`.json` 里不写就默认 `theme`。 |
| `version` | 否 | 显示用，同时决定自带主题要不要覆盖已装的旧版。 |
| `author` / `description` / `homepage` | 否 | 显示用。`homepage` 必须是 https。 |
| `theme.vars` | 否 | CSS 变量表。 |
| `theme.css` | 否 | 附加 CSS 文本。 |

变量名不写 `--` 前缀也会自动补上。清洗规则（不合规的整条丢掉，不会报错）：

- 变量值不能带 `;` `{` `}` `<` `>`，否则会越出声明。
- 变量值和 CSS 里的 `url(...)` 只允许 `data:`，远端 URL 一律去掉——避免主题偷偷拉取远程资源做追踪。
- CSS 里 `@import`、`expression(`、`javascript:` 和任何 `<` 都会被清掉。子选择器 `>` 保留。
- `vars` 和 `css` 清洗之后全空的话，安装会失败（`PLUGIN_NO_PAYLOAD`）。
- 变量最多 160 条、单值 200 字符，`css` 最长 64 KB，超出部分截断。

## 脚本主题（`.js`）

```js
/**
 * @id demo.script-theme
 * @name 示例脚本主题
 * @kind theme
 * @version 1.0.0
 * @author yourname
 */

mineradio.on('theme', function () {
  const dark = new Date().getHours() >= 18;
  return {
    vars: { '--th-panel-bg': dark ? '#0b0e12' : '#12161b' },
    css: '.pl-card{border-radius:14px}',
  };
});
```

`@id`、`@name`、`@kind theme` 三个都必填，`@kind` 不是 `theme` 会被拒绝安装（`PLUGIN_BAD_KIND`）。返回值走的是和声明式负载**完全相同**的一套清洗，脚本里绕不过去。

沙箱里只有 `mineradio`（别名 `lx`，同一个对象）：

| API | 说明 |
| --- | --- |
| `mineradio.version` | 当前为 `1`。 |
| `mineradio.manifest` | 冻结的自身清单。 |
| `mineradio.on('theme', handler)` | 注册主题钩子，`handler` 可以返回 Promise。只有 `theme` 这一个钩子名，注册别的会直接启动失败。 |
| `mineradio.log(...)` | 打到宿主控制台，前缀 `[plugin:<id>]`。单条截断到 800 字。 |

**拿不到**：`fetch`、`XMLHttpRequest`、`WebSocket`、`importScripts`、`indexedDB`、`caches`、`Worker`、`postMessage`、DOM、`localStorage`、文件系统、用户账号，也没有任何由宿主代发请求的通道。这是设计如此，不是漏洞。

返回值必须能被结构化克隆：循环引用、函数、DOM 对象都会让这次调用失败（这份主题就是不生效，不会影响别的插件）。单次钩子调用超时 12 秒（`PLUGIN_CALL_TIMEOUT`），Worker 启动超时 8 秒。

## 上色请走 `--th-*`

`public/app.css` 里那些决定面板外观的 `!important` 字面值已经就地改成 `var(--th-x, <原字面值>)`，
主题设 `--th-*` 就能拿下面板、浮层、卡片、底栏、分隔线和次级文字；不设就取回落值，
外观与没装主题时一致。反过来说，在 `css` 通道里写 `#playlist-panel{…!important}` 是压不过
`html.control-glass-svg-ok #playlist-panel` 那条 `(1,1,1)` 规则的，左侧歌单只能走
`--th-side-panel-*`。完整变量清单和各组管到哪见
[`examples/plugins/README.md`](../examples/plugins/README.md)。

### 背景三变量

`v1.7.5` 起主题可以轻量调整播放器的默认背景，不用再靠特异性更高的附加 CSS：

| 变量 | 作用 |
| --- | --- |
| `--th-bg-color` | 最底层底色，可以是颜色或渐变。 |
| `--th-bg-tint` | 覆在默认封面模糊背景上的轻量色调层。 |
| `--th-bg-tint-opacity` | 色调层透明度，通常用 `0` 到 `1`。 |

这三个变量只接管**默认播放器背景**。用户在设置里选的纯色、图片、视频或透明度会继续优先；Wallpaper Engine 和「播放器背景板」启用时也保持原有图层关系。所以背景主题不会覆盖用户自己选的媒体，也不会改动玻璃模糊、粒子、电影镜头或壁纸逻辑。

所有内置主题都同时提供背景变量和面板变量；历史上的三份 `theme-background-*.json` 已升级为完整主题，不再只是三变量、无 CSS 的背景包。它们仍是普通 `theme` 插件，受主题互斥规则约束。

迷你播放器是独立窗口、不加载插件运行时，主窗口会把当前生效的 `--th-*` 通过
`mineradio-mini-player-state` 整表转发过去，主进程再清洗一遍（只收 `--th-` 前缀、单值 200 字符、
最多 64 条）。它自己那族是 `--th-mini-*`，不设时回落到 `--th-popover-*` / `--th-chip-*` / `--th-text-*`。

用户在设置面板里手调的主色（`applyUiAccentColor()` 写在 `documentElement` 上的行内变量）优先级高于插件主题，插件压不过去，这是有意的。玻璃的模糊/饱和度是调好的参数，不接受主题接管（`--th-*filter` 一律没有）。

一条容易忘的：改了已发布主题的载荷要同时抬 `version`，自带主题的种子只在版本号更高时才替换用户
profile 里存着的那一份，否则装过旧版的人看不到改动。

## 装不了外部市场的插件

GitHub 上那些 LX Music / 落雪音乐系的「音源插件」在 Mineradio 里装不上，也不打算适配：它们要的是宿主代发网络请求、返回播放直链，而这条通道在 `v1.7.4` 被整体删掉了。它们要么没有 `@kind theme`（`PLUGIN_BAD_KIND`），要么连 `@id` 都不写（`PLUGIN_BAD_ID`），解析阶段就被拒，永远不会被启动。

旧版本装过的 `source` / `playlist` 插件记录，升级后会在读取存档时被整条丢掉，不需要手动清理。

## 常见报错

| 代码 | 含义 |
| --- | --- |
| `PLUGIN_EMPTY` | 插件文件是空的。 |
| `PLUGIN_TOO_LARGE` | 插件文件超过 512 KB。 |
| `PLUGIN_BAD_JSON` | `.json` 包不是合法 JSON。 |
| `PLUGIN_BAD_ID` | 缺 `@id` / `id`，或者格式不合规。 |
| `PLUGIN_BAD_NAME` | 缺 `@name` / `name`。 |
| `PLUGIN_BAD_KIND` | `@kind` 不是 `theme`——只支持主题插件。 |
| `PLUGIN_NO_PAYLOAD` | 清洗完什么都没剩（也没有脚本正文）。 |
| `PLUGIN_LIMIT_REACHED` | 已经装满 40 个。 |
| `PLUGIN_HOOK_MISSING` | 脚本插件没注册 `theme` 钩子。 |
| `PLUGIN_CALL_TIMEOUT` | 钩子 12 秒没返回。 |

## 安全提醒（给用户）

插件是真实的 JavaScript 代码，但它能做的事被限死在「换外观」上：没有网络，拿不到你的本地文件、账号和其它插件的数据，也碰不到播放。最坏的情况是把界面弄丑，卸载或禁用即可恢复。仍然建议只安装你看得懂或信得过来源的主题。
