# Mineradio 插件系统架构

`v1.7.0` 引入。三种插件：主题（`theme`）、音源（`source`）、歌单（`playlist`）。零内置插件，全部由用户自己导入。

## 分层与文件

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 清单 | `public/plugin-manifest.js` | 包解析（JS 头注释 / JSON 清单）、字段校验、主题 CSS 清洗、`@host` 白名单归一化与匹配、localStorage 记录归一化。纯函数，UMD 尾，浏览器/Worker/Node 三处共用。 |
| 沙箱 | `public/plugin-sandbox.js` | Worker 内部。启动时把危险全局剥成 `undefined` 并 `delete`，再用 `new Function('mineradio','lx',…)` 执行插件正文，之后只靠消息协议与宿主往来。 |
| 宿主 | `public/plugin-runtime.js` | 渲染进程侧。管理插件记录、起停 Worker、RPC 收发、按插件清单做请求白名单判定、主题注入、结果归一化。对外暴露 `window.MineradioPlugins`。 |
| 出网 | `plugin-proxy.js` + `server.js` | 本地 HTTP 代理。协议门禁、私网/环回/链路本地/组播拦截、DNS 钉住、头白名单、体量与超时上限。 |
| 界面 | `public/app.js` + `public/index.html` | 插件管理弹窗、FX 面板入口、搜索结果合并、插件曲目播放分支。 |

## 关键边界

- **沙箱是能力沙箱，不是语言沙箱。** 插件仍然跑在同一个 JS 引擎里，防线是「它拿不到任何有副作用的东西」：`fetch` / `XMLHttpRequest` / `WebSocket` / `importScripts` / `indexedDB` / `caches` / `Worker` / `postMessage` 全部剥掉，没有 DOM、没有 localStorage、没有 `desktopWindow` IPC 桥，因此也就没有文件系统。
- **插件正文必须走 `new Function` 而不是 `eval`。** `eval` 会让插件看到 bootstrap 的闭包变量（`pending` / `handlers`），可以劫持别的插件的调用。`tests/plugin-system.test.js` 用正则把这条钉住。
- **白名单在宿主侧判，不在沙箱侧判。** 沙箱里的任何变量都可能被插件改写，只有渲染进程持有可信清单。请求被拒时代理连一次都不会被调用。
- **代理只管通用安全，不管业务白名单。** 谁能访问哪个域名是宿主的事；协议、私网地址、体量、超时是代理的事。两层都过才出网。
- **`/api/plugin/fetch` 只放 https，`/api/plugin/stream` 额外放 http。** 这是故意的不对称：音乐 CDN 直链经常 302 到 http，流代理必须能跟，否则播放全废。
- **音频和封面都走本地流代理。** 代理会补 `Access-Control-Allow-Origin: *` 和 `Cross-Origin-Resource-Policy: cross-origin`，这样 `<audio crossOrigin="anonymous">`（Web Audio 分析器）和封面取色 canvas 才不会被跨域污染。

## 本地播放路径不受影响

插件曲目走 `playPluginQueueItem()`，与 `playLocalQueueItem()` 完全并列，`playQueueAt()` 里按 `song.type` 分派。`playQueueAt()` 前半段共享的本地辅助函数（`updateLocalAudioQualityInfo`、`isCurrentLocalQueueSong`）本来就在 `type !== 'local'` / 缺 `localKey` 时提前返回，所以插件曲目穿过去是安全的。

歌词复用现成管线：把插件歌词写进 `song.localLyricText` 再调 `applyLocalOriginalLyricsState(song)`，LRC 解析、逐字判定、歌词偏好切换一行没改。本地歌词管线没有翻译概念，所以插件返回的 `translation` 目前被丢掉。

## 存档

localStorage `mineradio-plugins-v1`，经 `bridge.persist`（即 `setPersistentLocalStorageItem`）写入，同时进 preload 的 `PERSISTENT_UI_STATE_KEYS` 做主进程备份。同 id 覆盖安装视为升级：换脚本、保留用户的启用/禁用状态。

## 主题的 CSS 层级

插件主题写进 head 里唯一一个 `<style id="mineradio-plugin-theme-style">` 节点，用 `textContent` 而不是 `innerHTML`。`applyUiAccentColor()` 写在 documentElement 上的行内变量优先级更高，所以用户自己调的主色仍然压过插件主题——这是有意的。声明式主题在 `applyThemes()` 里同步写入，脚本主题的结果再合并重写一次，避免 Worker 启动那几秒界面裸着。

## 测试

- `tests/plugin-system.test.js`：`vm.createContext` 造最小渲染进程与最小 Worker 环境，跑**真**的 sandbox / runtime 源码互相对接，消息过一遍 `JSON.parse(JSON.stringify(…))` 模拟结构化克隆。
- `tests/plugin-proxy.test.js`：直接 require `plugin-proxy.js`，起 127.0.0.1 临时上游跑真 HTTP。

注意：vm 里造出来的数组原型与测试 realm 的 `Array.prototype` 不同，`assert.deepStrictEqual` 会因原型不匹配误报，断长度或逐字段断。
