# Mineradio 插件开发指南

适用版本：`v1.7.0` 起。插件由用户从「设置面板 → 插件 → 管理 → 安装插件文件」导入，Mineradio 不内置任何插件。

## 一个插件是一个文件

两种写法：

- **`.js`** — 文件开头一段 `/** … */` 块注释当清单，后面是脚本正文。
- **`.json`** — 纯声明式，目前只有主题插件用得上（不需要跑代码就别跑代码）。

单文件上限 512 KB，最多同时安装 40 个插件。`.json` 里的 `schema` 可以不写，写了就必须是 `mineradio-plugin-v1`。

## JS 插件清单

```js
/**
 * @id demo.source
 * @name 示例音源
 * @kind source
 * @version 1.0.0
 * @author yourname
 * @host api.example.com, cdn.example.com
 */

mineradio.on('search', async function (keyword, opts) {
  const res = await mineradio.requestJson('https://api.example.com/search?q=' + encodeURIComponent(keyword));
  return res.list;
});

mineradio.on('url', async function (song, quality) {
  return 'https://cdn.example.com/' + song.id + '.mp3';
});
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `@id` | 是 | `[A-Za-z0-9][A-Za-z0-9._-]{1,63}`。同 `@id` 再次安装视为升级，会换掉脚本并保留用户的启用/禁用状态。 |
| `@name` | 是 | 显示名。搜索结果里的来源标签只取前 8 个字。 |
| `@kind` | 是 | `source` / `playlist` / `theme` 三者之一。 |
| `@version` | 否 | 显示用。 |
| `@author` | 否 | 显示用。 |
| `@host` | 非主题必填 | 逗号分隔的域名白名单。最多 16 个，写 `https://API.Example.com:443/x` 也会被归一化成 `api.example.com`。 |

`@host` 的匹配规则：只放行 **https**，命中声明域名本身或它的子域。`api.example.com` 放行 `cdn.api.example.com`，但不放行 `api.example.com.attacker.net`，也不放行 `xapi.example.com`。没声明 `@host` 的音源/歌单插件会被拒绝安装（`PLUGIN_NO_HOST`）。

## 插件能拿到什么

沙箱里只有 `mineradio`（别名 `lx`，同一个对象）：

| API | 说明 |
| --- | --- |
| `mineradio.version` | 当前为 `1`。 |
| `mineradio.manifest` | 冻结的自身清单。 |
| `mineradio.on(event, handler)` | 注册钩子。`handler` 可以返回 Promise。同名钩子后注册覆盖先注册。 |
| `mineradio.request(url, opts)` | 由宿主代发一次请求。`opts`：`method` / `headers` / `body` / `responseType` / `referer` / `userAgent`。返回 `{ ok, status, headers, body }`。 |
| `mineradio.requestJson(url, opts)` | 同上但直接返回解析后的 JSON 体。 |
| `mineradio.log(...)` | 打到宿主控制台，前缀 `[Plugin]`。单条截断到 800 字。 |

**拿不到**：`fetch`、`XMLHttpRequest`、`WebSocket`、`importScripts`、`indexedDB`、`caches`、`Worker`、`postMessage`、DOM、`localStorage`、文件系统、用户账号。这是设计如此，不是漏洞。

钩子返回值必须能被结构化克隆：循环引用、函数、DOM 对象都会让这次调用失败。单次钩子调用有超时（`PLUGIN_CALL_TIMEOUT`），别在钩子里做无上限的重试。

## 钩子清单

| 钩子 | 参数 | 返回 | 用于 |
| --- | --- | --- | --- |
| `search` | `(keyword, { limit })` | 歌曲数组 | `source` |
| `url` | `(song, quality)` | 播放直链字符串，或 `{ url, referer, userAgent }` | `source` |
| `lyric` | `(song)` | LRC 字符串，或 `{ lyric, translation }` | `source` |
| `cover` | `(song)` | 封面图 URL | `source` |
| `playlists` | `()` | 歌单数组 | `playlist` |
| `playlistDetail` | `(playlistId, raw)` | 歌曲数组，或 `{ songs: [...] }` | `playlist` |
| `theme` | `()` | `{ vars, css }` | `theme` |

`song` 参数就是你在 `search` / `playlistDetail` 里返回的**原始对象**原样回传，所以自定义字段可以随便加，不必挤进宿主字段。

### 歌曲字段

必须有名字（`name` / `title` / `songName` 任一），否则这条被丢掉。其余都是可选并且认多种别名：

- id：`id` / `songId` / `songmid` / `mid` / `hash` / `copyrightId` / `rid`
- 歌手：`artist` / `singer` / `artists` / `author` / `ar`（数组会用 ` / ` 连起来）
- 专辑：`album` / `albumName` / `al`
- 时长：`duration` / `interval` / `length`，接受秒、毫秒和 `mm:ss`
- 封面：`cover` / `img` / `pic` / `picUrl` / `albumPic` / `coverUrl`
- 播放需要的头：`referer` / `userAgent`（也可以在 `url` 钩子里返回）

### 歌单字段

`name`（或 `title` / `playlistName`）与 `id`（或 `playlistId` / `listId` / `tid`）都必填，其余可选：`desc` / `description` / `intro`、`count` / `total` / `trackCount` / `songCount`、封面同上。

## 主题插件

声明式（推荐，`.json`）：

```json
{
  "schema": "mineradio-plugin-v1",
  "id": "demo.theme",
  "name": "暗夜主题",
  "kind": "theme",
  "theme": {
    "vars": { "--fc-accent": "#7f5af0", "--panel-bg": "rgba(10,10,14,0.86)" },
    "css": ".panel{border-radius:18px}"
  }
}
```

变量名不写 `--` 前缀也会自动补上。清洗规则（不合规的整条丢掉，不会报错）：

- 变量值不能带 `;` `{` `}`，否则会越出声明。
- 变量值和 CSS 里的 `url(...)` 只允许 `data:`，远端 URL 一律去掉——避免主题偷偷拉取远程资源做追踪。
- CSS 里 `@import`、`expression(`、`javascript:` 和任何 `<` 都会被清掉。子选择器 `>` 保留。
- `vars` 和 `css` 清洗之后全空的话，安装会失败（`PLUGIN_NO_PAYLOAD`）。
- 变量最多 160 条，`css` 最长 64 KB，超出部分截断。

脚本主题就是 `@kind theme` 的 JS 插件里注册 `theme` 钩子，返回同样的 `{ vars, css }`，走同一套清洗。声明式部分会立刻生效，脚本部分等 Worker 起来之后再合并进去。

用户在设置面板里手调的主色（`applyUiAccentColor()` 写在 `documentElement` 上的行内变量）优先级高于插件主题，插件压不过去，这是有意的。

### 上色请走 `--th-*`

`public/app.css` 里那些决定面板外观的 `!important` 字面值已经就地改成 `var(--th-x, <原字面值>)`，
主题设 `--th-*` 就能拿下面板、浮层、卡片、底栏、分隔线和次级文字；不设就取回落值，
外观与没装主题时一致。反过来说，在 `css` 通道里写 `#playlist-panel{…!important}` 是压不过
`html.control-glass-svg-ok #playlist-panel` 那条 `(1,1,1)` 规则的，左侧歌单只能走
`--th-side-panel-*`。完整变量清单和各组管到哪见
[`examples/plugins/README.md`](../examples/plugins/README.md)。

迷你播放器是独立窗口、不加载插件运行时，主窗口会把当前生效的 `--th-*` 通过
`mineradio-mini-player-state` 整表转发过去，主进程再清洗一遍（只收 `--th-` 前缀、单值 200 字符、
最多 64 条）。它自己那族是 `--th-mini-*`，不设时回落到 `--th-popover-*` / `--th-chip-*` / `--th-text-*`。

一条容易忘的：改了已发布主题的载荷要同时抬 `version`，内置主题的种子只在版本号更高时才替换用户
profile 里存着的那一份，否则装过旧版的人看不到改动。

## 播放限制

- 插件歌曲能搜索、能播、能出歌词封面，但**不能**加入「特别喜欢」或本地歌单——那两处按本地文件引用存盘，插件歌曲没有文件可引用，会留下死记录。
- 播放直链允许 http（音乐 CDN 经常 302 到 http），但一切流量都经本地代理转发：私网、环回、链路本地、组播地址一律拒绝，DNS 被钉在解析出的公网 IP 上以防 DNS rebinding。
- 单次 `request` 响应体上限 8 MB、超时 15 秒；流代理超时 30 秒、最多跟 5 次跳转。
- 转发给上游的请求头只有 `referer`、`user-agent`、`cookie`；`Host` 由代理自己钉，插件改不了。

## 常见报错

| 代码 | 含义 |
| --- | --- |
| `PLUGIN_NO_HOST` | 音源/歌单插件没声明 `@host`。 |
| `PLUGIN_HOST_NOT_ALLOWED` | 请求的域名不在自己的 `@host` 白名单里。 |
| `PLUGIN_INSECURE_URL` | `request` 用了非 https（播放直链除外）。 |
| `PLUGIN_HOST_BLOCKED` | 目标解析到私网/环回地址。 |
| `PLUGIN_URL_EMPTY` | `url` 钩子没给出可用直链。 |
| `PLUGIN_CALL_TIMEOUT` | 钩子超时没返回。 |
| `PLUGIN_RESPONSE_TOO_LARGE` | 响应体超过 8 MB。 |
| `PLUGIN_NO_PAYLOAD` | 主题清洗完什么都没剩。 |
| `PLUGIN_TOO_LARGE` | 插件文件超过 512 KB。 |

## 安全提醒（给用户）

插件是真实的 JavaScript 代码。沙箱能保证它拿不到你的本地文件、账号和其它插件的数据，联网也只能去它自己声明的域名，但**它能把你搜索的关键词、播放的歌曲发到那些域名去**。只安装你信得过来源的插件，安装前看一眼 `@host` 写了什么。
