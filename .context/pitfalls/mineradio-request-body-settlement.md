# Pitfall: HTTP 请求体读取的 promise 结算契约

## Context

- 适用于 `server.js` 本地 HTTP 服务的请求体读取函数 `readRequestBody(req)`，以及任何 `await readRequestBody(req)` 的 POST 处理器（当前为 `/api/beatmap/cache` 的 POST）。
- 触发条件：请求体超过 8MB 上限，或客户端在请求体发送中途中断连接。

## Fact / Pitfall (Root Cause)

- 旧实现超限时调用 `req.destroy()`，然后只监听 `data`/`end`/`error` 三个事件来结算 promise。
- Node 的 `IncomingMessage.destroy()`（无 error 参数）**只触发 `close`/`aborted`，不触发 `end`，通常也不触发 `error`**。实证：销毁后仅收到 `aborted` 与 `close` 事件。
- 结果：promise **永不 resolve/reject**。`await readRequestBody(req)` 的 async 处理器永久挂起，响应永不发出，socket 与处理器闭包资源泄漏。这是一条可被超大 POST body 触发的拒绝响应 + 资源泄漏面。

## Solution / Convention

- 用单次结算门 `settle(fn, value)` 保证 `end`/`error`/`close` 任一终止路径都只结算一次。
- 超限时先以 `REQUEST_BODY_TOO_LARGE`（`err.code`）**拒绝（Fail-Fast）**，再 `req.destroy()`；上层 POST 处理器的 `try/catch` 会捕获并返回精确 reason。
- 必须监听 `close` 作为兜底：流在未正常 `end` 就关闭（客户端中断、`destroy()` 等）时仍需结算，避免处理器永久挂起。
- 约束：任何新增的"读取请求流后 await"的入口，都必须保证 promise 在所有流终止路径上恰好结算一次；不要只监听 `end`/`error`。

## Reference

- 实现：`server.js` 的 `readRequestBody`。
- 回归测试：`tests/request-body-limit.test.js`（真实 HTTP server 覆盖超大体拒绝不挂起、正常/空体/客户端中断均结算）。
- Node `readable.destroy([error])` 语义：<https://nodejs.org/api/stream.html#readabledestroyerror>
- Node HTTP `IncomingMessage`/`'aborted'`/`'close'` 事件：<https://nodejs.org/api/http.html#class-httpincomingmessage>