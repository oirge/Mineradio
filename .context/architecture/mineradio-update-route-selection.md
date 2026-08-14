# Mineradio 软件内更新线路自动选择

## Context

适用于 Mineradio 软件内完整安装包和快速补丁下载，涉及 `server.js` 的候选线路生成、镜像摘要门禁、线路测速、正式下载与失败换线。

## Fact / Pitfall

- `uniqueDownloadCandidates()` 会把配置中的镜像和 GitHub 直连组成候选列表；旧逻辑只按固定顺序串行下载，第一条可用但较慢的线路会一直占用整个下载过程。
- 线路测速必须放在服务端。候选 URL、镜像标记、摘要校验、文件写入和补丁应用都由服务端持有；前端测速会受到 CORS 限制，并会重复更新安全逻辑。
- 不能只用 `HEAD` 延迟判断大文件下载速度。线路选择使用带 `Range` 的正文小样本，把连接耗时和实际吞吐量一起计入结果。
- 测速窗口结束时，已收到的部分字节仍是有效速度样本。若把未读满 `128 KiB` 的线路全部判失败，慢速但稳定的网络可能没有任何成功结果。
- 镜像测速不能绕过 `ensureMirrorCanBeVerified()`；缺少 SHA-256/SHA-512 时，镜像在发起网络请求前就必须失败。

## Solution / Convention

- `UPDATE_ROUTE_PROBE_BYTES = 128 * 1024`：单条线路最多读取 `128 KiB`。
- `UPDATE_ROUTE_PROBE_TIMEOUT_MS = 4 * 1000`：全部线路并行测速，正式下载最多增加约 `4 秒` 的有界等待。
- `probeUpdateDownloadCandidate()`：发送范围请求，主动取消剩余响应体；测速窗口内只要收到有效字节，就按实际字节数和总耗时计算速度。
- `rankUpdateDownloadCandidates()`：成功线路按速度、耗时、原始位置稳定排序；测速失败线路按原顺序放在队尾，不从正式下载兜底列表删除。
- `downloadUpdateAssetWithMirrors()` 与 `downloadAndApplyPatchWithMirrors()` 必须共用同一排序函数；不得分别实现两套选线规则。
- 正式下载仍必须执行摘要校验、大小限制、正文空闲超时和失败换线；测速结果只改变尝试顺序，不改变安全边界。
- 前端沿用现有任务状态：测速时显示 `正在测速更新线路` 和 `自动测速`，选线后显示实际线路、速度、进度和剩余时间。

## Reference

- GitHub 仓库：`https://github.com/oirge/Mineradio`
- 实现：`server.js`
- 回归：`tests/update-fastest-route.test.js`
