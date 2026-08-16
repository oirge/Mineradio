# Mineradio 软件内更新线路自动选择

## Context

适用于 Mineradio 软件内完整安装包和快速补丁下载，涉及 `server.js` 的候选线路生成、镜像摘要门禁、线路测速、用户手动选线、本机代理隧道、取消更新、正式下载与失败换线。

## Fact / Pitfall

- `uniqueDownloadCandidates()` 会把配置中的镜像和 GitHub 直连组成候选列表；旧逻辑只按固定顺序串行下载，第一条可用但较慢的线路会一直占用整个下载过程。
- 线路测速必须放在服务端。候选 URL、镜像标记、摘要校验、文件写入和补丁应用都由服务端持有；前端测速会受到 CORS 限制，并会重复更新安全逻辑。
- 不能只用 `HEAD` 延迟判断大文件下载速度。线路选择使用带 `Range` 的正文小样本，把连接耗时和实际吞吐量一起计入结果。
- 测速窗口结束时，已收到的部分字节仍是有效速度样本。若把未读满 `128 KiB` 的线路全部判失败，慢速但稳定的网络可能没有任何成功结果。
- 镜像测速不能绕过 `ensureMirrorCanBeVerified()`；缺少 SHA-256/SHA-512 时，镜像在发起网络请求前就必须失败。
- 打包产物没有运行期 `node_modules`（`package.json` 无 `dependencies`，electron-builder `files` 白名单只含 `desktop/**`、`public/**`、`build/**`、`server.js`、`package.json`）。代理支持不能依赖 `undici` / `ProxyAgent`，只能用核心 `http` / `https` / `tls` 手写 CONNECT 隧道。
- `server.js` 跑在 Electron 主进程里，可以用 `session.defaultSession.resolveProxy()` 读系统代理；返回的是 PAC 风格串（`PROXY host:port` / `DIRECT`），必须解析后再用，且 socks 结果无法用 CONNECT 承载，要跳过。
- 更新接口不解析请求体，线路选择只能走查询参数（`?route=` / `?proxy=`）。
- `classifyUpdateError()` 里分类顺序是有语义的：取消会产生 `AbortError`，`UPDATE_PROXY_TIMEOUT` 又包含 `TIMEOUT`，所以取消、线路、代理三类必须排在超时/中止分类之前，否则用户主动取消会被误报成网络超时。
- 取消是**正常终态**，`publicUpdateJob()` 的 `ok` 仍为 `true`；前端 `applyUpdateDownloadJob()` 必须在 `queued/downloading` 分支之前处理 `status === 'canceled'`，否则会被当成还在下载。
- 补丁一旦进入写盘或回滚阶段就不能再被打断，否则会留下半套文件；这段时间必须靠 `job.applying` 拒绝取消。
- 取消不能只依赖传输层的中止信号。直连/镜像走 `fetch(url, { signal })`，`abort()` 会顺带掐掉响应体；代理线路的正文来自 `Readable.toWeb(res)`，它不认识 fetch 的 `AbortSignal`，而 `fetchThroughUpdateProxy()` 的 `settle()` 在响应头到达时就摘掉了 abort 监听。v1.5.8 因此出现过：`本机代理` 线路点取消后任务状态卡在 `downloading`，`received` 继续增长，整包被拉完。
- 给代理响应绑定取消时不能用 `res.destroy(err)`。正文可能还没有读取端，带错误销毁会发出无人监听的 `'error'` 事件，直接变成 `uncaughtException`。
- `tests/update-fastest-route.test.js` 用 vm 执行 `server.js` 的源码切片，上下文只注入固定几个全局量。测速路径新增的辅助函数必须落在切片内部（或只在测试不会走到的分支里被调用），否则回归会直接 `ReferenceError`。

## Solution / Convention

- `UPDATE_ROUTE_PROBE_BYTES = 128 * 1024`：单条线路最多读取 `128 KiB`。
- `UPDATE_ROUTE_PROBE_TIMEOUT_MS = 4 * 1000`：全部线路并行测速，正式下载最多增加约 `4 秒` 的有界等待。
- `probeUpdateDownloadCandidate()`：发送范围请求，主动取消剩余响应体；测速窗口内只要收到有效字节，就按实际字节数和总耗时计算速度。
- `rankUpdateDownloadCandidates()`：成功线路按速度、耗时、原始位置稳定排序；测速失败线路按原顺序放在队尾，不从正式下载兜底列表删除。取消发生在测速阶段时直接返回原顺序，交给下载循环收尾。
- `downloadUpdateAssetWithMirrors()` 与 `downloadAndApplyPatchWithMirrors()` 必须共用同一排序函数；不得分别实现两套选线规则。
- 正式下载仍必须执行摘要校验、大小限制、正文空闲超时和失败换线；测速结果只改变尝试顺序，不改变安全边界。
- 前端沿用现有任务状态：测速时显示 `正在测速更新线路` 和 `自动测速`，选线后显示实际线路、速度、进度和剩余时间。

### 手动选择更新线路

- `UPDATE_ROUTE_MODES = ['auto', 'direct', 'mirror', 'proxy']`，中文名由 `updateRouteModeLabel()` 单点提供：`自动测速` / `GitHub 直连` / `国内加速` / `本机代理`。`normalizeUpdateRouteMode()` 把未知值一律退回 `auto`。
- `filterUpdateRouteCandidates()` 只做过滤，不改写候选顺序，也不改写候选标签：`mirror` 只留 `mirrored` 候选，`direct` 与 `proxy` 只留非镜像候选，`auto` 全留。候选生成仍然只有 `uniqueDownloadCandidates()` 一个来源。
- 裁剪必须发生在测速排序之前；裁剪后为空时抛 `UPDATE_ROUTE_UNAVAILABLE`，提示用户换线路，而不是静默回落到别的线路。
- `opts.useMirrors === false` 只抑制**生成**镜像，输入里显式标记为镜像的候选仍会保留，所以 `filterUpdateRouteCandidates()` 不可省略。
- 代理线路：`resolveUpdateProxyTarget()` 按 `显式地址 → 环境变量/配置 → 系统代理` 顺序解析，只接受 http/https；`label` 不带账号密码，避免代理凭据顺着任务状态泄漏到前端。解析不到时启动阶段就返回 `UPDATE_PROXY_NOT_CONFIGURED`，不进入下载循环。
- 代理传输：`connectUpdateProxyTunnel()` 走 `CONNECT` → `tls.connect({socket, servername, ALPNProtocols:['http/1.1']})`，再由 `nodeResponseAsFetchLike()` 用 `Readable.toWeb()` 包成 fetch 风格响应，所以三处下载循环只需换一行 `openUpdateRouteResponse()` 调用。重定向手动跟随，上限 5 次。
- 前端线路选择持久化在 `UPDATE_ROUTE_STORE_KEY = 'mineradio-update-route-v1'`，并登记进 `PERSISTENT_UI_STATE_KEYS`；`/api/update/routes` 只用来给出镜像条数、检测到的代理和可用性，用于禁用不可用线路和写提示文案，不改变默认线路。
- 下载进行中禁止切线路（分段控件整体 `disabled`），避免半途换线导致进度与校验状态错乱。

### 取消更新

- 每个任务在 `attachUpdateJobRoute()` 里挂一个任务级 `AbortController`（`job.cancelController` / `job.cancelSignal`），线路信息也在这里落到任务上。
- `cancelUpdateDownloadJob()` 是唯一入口：`ready/done/error` 返回 `UPDATE_JOB_NOT_CANCELABLE`，`job.applying` 返回 `UPDATE_JOB_APPLYING`，其余置 `job.canceled = true` 并 `abort()`。
- `createUpdateDownloadIdleGuard(timeoutMs, cancelSignal)` 必须接入任务级信号，并在单次下载结束时摘掉监听，避免长任务在同一个信号上堆积回调。
- 下载循环在开始、每次换线前用 `throwIfUpdateJobCanceled()` 检查；每个 `catch` 里 `if (job.canceled) { markUpdateJobCanceled(job); return; }` 必须排在 `setUpdateJobError()` 之前，取消不写失败线路列表、不换线。
- 取消必须与传输实现无关，两层都要有：
  1. 安装包和补丁的 `reader.read()` 循环在**每一块**前后各做一次 `throwIfUpdateJobCanceled(job)`，测速循环里做 `if (job && job.canceled) break;`。这一层保证任何传输都能停下来。
  2. `nodeResponseAsFetchLike(res, signal, socket)` 自己监听 `signal` 的 `abort`，无参 `res.destroy()` 并销毁隧道 socket，`res.on('close')` 时摘监听。这一层保证 TCP 连接真的断开，而不是继续往没人读的缓冲区里灌数据。
- 只做第 1 层会让连接空转，只做第 2 层则依赖流一定抛错。两处 `settle` 分支都在 `classifyUpdateError()` 之前判 `job.canceled`，所以无参销毁引发的任意流错误都会收敛成 `canceled` 终态、`error` 为空。
- 终态 `'canceled'` 不在 `isActiveUpdateJob()` 里，用户可以立刻换线路重新下载。
- `/api/update/cancel?id=` 返回 `publicUpdateJob()` 快照；拒绝取消时返回 409，且 `error` 字段要放在 `Object.assign` 的最后一位，否则会被快照里的空 `error` 覆盖。

## Reference

- GitHub 仓库：`https://github.com/oirge/Mineradio`
- 实现：`server.js`、`public/app.js`、`public/index.html`、`public/app.css`
- 回归：`tests/update-fastest-route.test.js`、`tests/update-route-selection.test.js`
