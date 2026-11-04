# 视频导出固定帧率 CFR

## 2026-11-04：需求与原故障

用户指出选择其他帧率后播放器仍显示 `23.976`，并明确要求「我要的是固定60」；后续要求 `30／60／90／120` 每一档都生成对应的实际固定帧率成片。

原流程只把选择值传给原生 tab 捕获、宿主更新间隔和 MediaRecorder 码率。MediaRecorder 的录制仍是可变帧率（VFR），画面无变化、渲染迟到或编码丢帧时不会自动补齐时间轴。用户提供的 60 档样本多数时段接近 60，但帧数和时间戳并非完整的 60 CFR。不能把轨道 settings 或平均帧率当作成片验收，也不能只补帧率标记就声称修复。

## 实现入口与时间轴

- `public/video-export.js`：保留隐藏普通窗口原生视频与唯一宿主音频的实时录制；停止录制后等待实际固定帧率编码和最终保存。
- `desktop/video-export.js`：将原录制留在本任务 `.part`，向隐藏页下发 `mineradio-video-export-finalize`；最终成片写入独立 `.cfr.part`，完成后原子 rename 到用户选择的目标。
- `vendor-src/folia/src/mineradio/local/LocalVideoExportSurface.tsx`：仅接收当前 job 的一次 finalize；先卸载可视化、停止其 RAF、释放资产和更新订阅，再动态加载 `videoExportCfr.ts`。编码失败必须显式上报 `bridge.failed`。
- `vendor-src/folia/src/mineradio/local/videoExportCfr.ts`：使用固定版本 `mediabunny@1.65.1` 和 WebCodecs 解码／重新编码 VP8 视频，并重新封装 WebM。

固定输出帧数为 `ceil(audioEnd * FPS)`，其中 `audioEnd` 是原音频最后编码包的 PTS 加包内真实时长，包含首 PTS 偏移及时间戳间隙。第 `n` 帧使用 `n / FPS` 时间戳和 `1 / FPS` 时长；从原录制中选择不晚于该时间的最近画面，采集缺帧处重复前一画面，末尾不足时延用最后画面。第一幅可用画面覆盖开头尚无画面的时间段。该方式保证时间轴固定，不能凭空增加原录制缺失的动画细节。

WebM 封装当前 `TimestampScale` 为 `1e6` 纳秒，即 1 ms 精度；60 档的相邻 PTS 因量化呈 16／17 ms 交替，围绕 `n / 60` 时间网格，不应据此判为原来的不规则 VFR。封装同时写入与选择档位对应的 `DefaultDuration`。验收必须结合帧数、全部 PTS 和声明帧率，不能仅检查单个标记。

音频必须是原录制的 Opus 轨道。`EncodedAudioPacketSource('opus')` 复制原编码包和 decoder config，保留原 bytes 与时间戳，不重新编码、不加第二路声音。用 `EncodedPacketSink.getPacket(Infinity)` 取得最后包，通过 `videoExportOpus.ts` 的 `opusPacketDuration` 按 RFC 6716 §3.1／§3.2 的 TOC config／frame count 推导真实时长；转封装时逐包 `clone({ duration: opusPacketDuration(packet.data) })`，仅修正封装使用的 duration。

不能使用原容器 `computeDuration()` 或最后一个 SimpleBlock 的 duration 直接决定输出帧数。MediaRecorder 的最后 SimpleBlock 没有显式时长，也没有下一包 PTS 可用于推断；mediabunny 可能因此返回 `lastPTS + 0`。缺视频、缺音频、音频非 Opus、没有有限正音频结束时间、非法 Opus 时长或没有视频样本时，保存应失败并清理本任务临时文件。

## 流式处理与释放

- 不把整段原录制或最终成片读取为一个 Buffer／Blob。`CustomSource` 每次读取最多 1 MiB，缓存上限 8 MiB；主进程限定范围必须位于当前录制文件字节数内。
- CFR 输出 `StreamTarget` 使用 1 MiB chunk，并逐块 await `writeFinalized`。主进程单 IPC 块上限 8 MiB、待写上限 32 MiB／8 块，校验顺序和写位置；补写封装头仅能从已经写过的位置开始，不接受跳过文件末尾的稀疏写入。
- 视频解码只持有当前／下一样本；每个克隆输出样本和被替换的原样本都 close。逐帧 await 编码并交错复制音频，避免 muxer 缓存整首歌。
- 每 8 帧让出一次事件循环，进度至多每 250 ms 上报一次。编码收尾释放迭代器、剩余样本和 input；异常取消 output。取消任务会销毁隐藏页并撤销它的文件 IPC 能力。
- 保留原受限捕获授权，详见 [视频导出权限文档](mineradio-video-export-permissions.md)。不能恢复 `offscreen`、`stopPainting` 或逐帧 GPU 图片读回来追求帧率。

## 临时文件所有权与结算门

随机 UUID 路径不等于文件所有权。`.part` 和 `.cfr.part` 都以 `wx` 打开，只在 open 成功的同一同步续体内登记 `tempOwned`；原录制转为 CFR 输入时把所有权移交到 `sourceOwned`。`EEXIST` 失败不得删除同名既有文件。

取消先撤销当前任务，再等待 `opening` 和已接受写入，关闭输入／输出句柄，仅删除带所有权标志的临时路径。即使 open 已在操作系统创建文件而返回句柄的 Promise 仍未结算，cleanup 也必须等待成功续体登记并释放该句柄，不能遗漏迟到资源。

所有 CFR 读写 IPC 同时验证当前 job、当前隐藏 WebContents、主 frame、精确 URL 和 `encoding` 阶段。`finalized` 确认立即把阶段改为 `sealing`，拒绝新读写，排空已接受的写链后才 sync／close；不能允许迟到写入与关闭句柄竞争。

## 原子提交与取消边界

`rename` 开始前进入 `committing`，此后取消不能回滚，返回 `{ cancelled: false, committing: true }`。主进程 dispose 同样等待该提交 Promise；rename 失败转为 `commit-failed`，正常报错和清理。

rename 成功立即设置 `committed` 并清除 active，记住最近成功 job 的 id／fileName。此后的同 job 取消返回 `{ cancelled: false, fileName }`，不能因为原 `.part` 清理慢就声称取消成功。原录制删除任务纳入 `cleanups`／`hasPendingWork`，退出必须等其结算。

前端在 saving 阶段请求取消时先等待后端决定。返回 `cancelled:false` 就等待同一 `s.finishing`，保留保存成功／失败语义；只有确实接受取消才标记 cancelled、释放资源和发布取消状态。不能先在前端发布 cancelled，再让后端替换目标文件。

## 验证与尚未确认的边界

本机仅允许低优先级后台检查，禁止启动可见 Electron／浏览器窗口、抢焦点、安装新版本或操作正在使用的播放器和用户数据。真实 GUI 与媒体验收在 Windows GitHub Actions 运行。

`tests/video-export.test.js` 覆盖两个 wx 碰撞、迟到 open 取消、CFR 文件能力范围、结算门、编码失败、提交期间取消／dispose、提交后慢速原录制清理。`tests/video-export-recorder.test.js` 覆盖前端取消协商。`vendor-src/folia/test/unit/mineradio/localVideoExportSurface.test.ts` 覆盖真实 Surface 的 finalize 接线、先释放再编码、旧 job 忽略和异步错误上报。

`.github/workflows/video-export.yml` 构建正式 Folia surface，并通过 `scripts/verify-video-export-electron.js` 导出所有四档实际视频。独立 FFmpeg 以 `-fps_mode passthrough` 解码视频；音频以 `-copyts`／`ashowinfo` 取得最后 PCM 帧的 `pts_time + nb_samples / rate`，据此计算真实 `audioEnd`。直接累加解码 PCM 样本长度不包含首 PTS 偏移或时间戳间隙，不能用来代表音频 presentation timeline 的结束位置。

验收逐帧检查帧数接近 `audioEnd * FPS`（容差仍为 2 帧）、每帧 PTS 距 `n / FPS` 不超过 1.1 ms、声明帧率与所选档一致；音视频结束差收紧到 `1 / FPS + 1.1 ms`。同时检查移动画面、歌词、音频和权限处理器，不能通过放宽帧数容差掩盖少编码了音频尾部。

## 首次云端失败与音频尾部修正

功能提交 `15327012` 的 Windows run [41790467418](https://github.com/oirge/Mineradio/actions/runs/41790467418) 和测试追加提交 `615c65a3` 的 run [41790629909](https://github.com/oirge/Mineradio/actions/runs/41790629909) 均因音频时间轴验收失败。已检查的 30／60／90 fps 成片格点及声明帧率均正确；120 fps 尚未运行，不能据前三档推广为四档通过。

真实缺陷是原 `computeDuration()` 取到最后音频 `lastPTS + 0`，而该 Opus 包实际含 60 ms 音频，导致视频尾部少编码约 40～60 ms。新实现使用最后包的 TOC 真实时长决定 CFR 输出覆盖范围，并逐包补正 duration，保留原音频数据和 PTS；独立验收也改为检查 FFmpeg `ashowinfo` 给出的真实音频结束位置。

**本记录更新时，音频尾部修正后的新代码尚未运行云端，最终四档 CFR 结果仍待核验。** 本地单测通过不能替代实际成片逐帧验收；不能写成云端成功、已发布，或所有硬件的实时采集都持续达到 90／120 fps。后续只在核对指定提交的 workflow 和 artifact 后追加真实结果，不把其他提交或旧版本的成功混入本次结论。
