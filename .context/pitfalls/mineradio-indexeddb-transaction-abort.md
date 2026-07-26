# Pitfall: IndexedDB 事务的 promise 结算契约（必须处理 onabort）

## Context

- 适用于 `public/index.html` 中所有把 IndexedDB 事务包进 `new Promise` 并 `await` 的封装：自定义背景读写（`putCustomBackgroundBlob`/`getCustomBackgroundBlob`）、本地资产缓存读写（`getLocalAssetCacheRecords`/`putLocalAssetCacheRecord`）、本地曲库持久化读写删（`readLocalLibraryPersistentRecord`/`writeLocalLibraryPersistentRecord`/`deleteLocalLibraryPersistentRecords`）、缓存清理 `trimLocalIndexedDbCaches`（含扫描 tx 与删除 deleteTx）。
- 触发条件：事务被浏览器中止（abort）。常见来源是存储配额超限（QuotaExceededError）、`versionchange` 强制关闭连接、页面被浏览器冻结/丢弃（bfcache、tab freeze），以及显式 `tx.abort()`。

## Fact / Pitfall (Root Cause)

- IndexedDB 事务有三种终止事件：`complete`、`error`、`abort`。三者互斥且必居其一。
- 旧实现只挂了 `oncomplete`/`onerror`，没有 `onabort`。事务 abort 时**只触发 `onabort`**，既不触发 `oncomplete` 也不触发 `onerror`。
- 结果：包裹事务的 `new Promise` 既不 resolve 也不 reject，`await` 永久挂起，`db` 连接也不再 `close()`（连接泄漏）。
- 最严重的是 `trimLocalIndexedDbCaches`：它用模块级布尔 `localIndexedDbTrimRunning` 作互斥锁，锁的释放放在 `finally`，而 `finally` 依赖那条 `await new Promise(...)` 结算。事务一旦 abort，`await` 永挂 → `finally` 不执行 → 锁永远为 `true` → 之后每次清理调用在入口 `if (localIndexedDbTrimRunning) return 0` 直接跳过。本地封面/歌词/元数据缓存于是无限增长，反过来更容易触发配额中止，形成恶性循环。

## Solution / Convention

- 每个 IndexedDB 事务的 `new Promise` 必须同时处理 `complete`/`error`/`abort` 三种终止。
- `onabort` 应镜像该处 `onerror` 的行为：关闭连接（`db.close()`）并 `reject`，让中止走既有失败结算路径，使上层 `try/catch` 正常降级、互斥锁在 `finally` 释放、连接不泄漏。
- 注意有的事务把 resolve 放在 `request.onsuccess` 里、`tx.oncomplete` 只负责 `db.close()`（如 get 读取）；这类同样必须补 `onabort` 才能在中止时结算 promise。
- 真实 IndexedDB 在显式 abort 时 `tx.error` 常为 `null`，因此 `reject(tx.error || new Error('...aborted'))` 的默认分支要给出可辨识的错误信息。

## Reference

- 实现：`public/index.html` 中上述 9 处事务，均已补 `tx.onabort`/`deleteTx.onabort`。
- 回归测试：`tests/indexeddb-transaction-abort-settlement.test.js`（用可控 IDB 桩驱动 abort，断言 put/get 在中止时 reject 并 `db.close()`，正常 complete 仍正确 resolve）。
- IndexedDB 事务 `abort` 事件：<https://developer.mozilla.org/docs/Web/API/IDBTransaction/abort_event>
- `IDBTransaction`（complete/error/abort 三事件）：<https://developer.mozilla.org/docs/Web/API/IDBTransaction>
