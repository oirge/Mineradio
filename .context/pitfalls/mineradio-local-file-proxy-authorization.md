# Mineradio 本地文件代理越权读取

## Context

适用于 `server.js` 的 HTTP 本地文件代理 `/api/local-file`（支持 Range，用于持久化本地曲库播放）与 `desktop/main.js` 的本地文件 IPC（`readAuthorizedLocalFileRange` / `readAuthorizedLocalFileDataUrl`）。桌面主进程 `require('../server.js')` 把 server 引入同一进程，并通过环境变量注入随机 `MINERADIO_LOCAL_FILE_TOKEN`。

## Fact / Pitfall

- 两条读取本地文件的通道授权强度曾经不一致：
  - IPC 通道走 `resolveAuthorizedLocalFile`（`desktop/main.js`），强制目标路径落在 `authorizedLocalMusicRoots` 登记的曲库根目录内，否则抛 `LOCAL_FILE_NOT_AUTHORIZED`。
  - HTTP 代理 `/api/local-file` 只校验 `token`，随后对请求方 `path` 参数 `path.resolve` → `statSync` → `createReadStream`，**缺少“必须位于授权根目录内”的校验**。
- 后果：持有 token 的本地请求可读取授权曲库以外的任意文件（含 `..` 路径穿越）。服务绑 `127.0.0.1`、token 为随机 16 字节，定级 P2（本机越权读取），但与主进程既有授权模型不一致，属真实缺口。
- `LOCAL_FILE_TOKEN` 仅由桌面主进程注入，独立 `node server.js` 时该端点恒 403；因此授权门的注入时机绑定在主进程 `require` 之后、首个请求之前。

## Solution / Convention

- `server.js` 暴露可注入钩子，缺省 **Fail-Closed（未注入即拒绝）**，杜绝退化为开放代理：
  - `let localFileAuthorizer = null;`
  - `function setLocalFileAuthorizer(fn)`：非函数入参立即抛 `TypeError('LOCAL_FILE_AUTHORIZER_INVALID')`（Fail-Fast）。
  - 挂到导出对象：`server.setLocalFileAuthorizer = setLocalFileAuthorizer;`
- `/api/local-file` 在 `statSync` 之前：无授权函数直接 403；有则调用授权函数解析路径，越权抛错转 403，通过才继续。
- `desktop/main.js` 在 `localServer = require('../server.js')` 之后、`waitForServer` 之前注入：
  `localServer.setLocalFileAuthorizer(resolveAuthorizedLocalFile);`
- 授权门不会误杀合法播放：代理 URL 只来自 `makeLocalLibraryFileRecord` / `rehydrateLocalLibraryFileRecord`，其上游 `scanLocalMusicFolder*` / `refreshLocalMusicFileEntries` 都会先 `rememberLocalMusicRoot` 登记根目录。
- 回归测试：`tests/local-file-proxy-authorization.test.js`，用 `vm` 从 `desktop/main.js` 加载真实 `resolveAuthorizedLocalFile`（防止两处逻辑漂移），覆盖缺省拒绝、授权内放行、授权外拒绝、`..` 穿越拒绝、令牌错误拒绝。

## Reference

- 关键坐标：`server.js` 授权钩子与 `/api/local-file`；`desktop/main.js:190` `resolveAuthorizedLocalFile`、`desktop/main.js:55` `authorizedLocalMusicRoots`、注入点在 `createWindow` 内 `require('../server.js')` 之后。