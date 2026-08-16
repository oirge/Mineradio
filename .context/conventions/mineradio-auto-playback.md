# Mineradio 启动自动播放开关

## Context

适用于 `public/app.js` 的自动播放状态机、`public/index.html` 的 `fx-playback-fold` 设置区，以及本地曲库启动恢复链路。

## Fact

- 播放中的队列本来就不会停：`nextTrack()` 按 `(currentIdx + 1) % playQueue.length` 环绕，队列播完自动回到开头，单曲和随机模式也各有既有分支。
- 唯一不自动出声的地方是启动：`restorePlaybackSessionForLocalLibrary` 故意只恢复索引、进度和播放模式，然后 `playing = false` 保持暂停，等用户自己点播放。
- `handleLocalFolderFiles` 启动时会先按持久化的播放歌单构建 `playQueue`（`playbackSource = readSavedLocalPlaybackPlaylistSelection()`），所以“自定义播放歌单”不需要第二套存储。
- 该链路有两条启动出口：会话恢复成功的分支，和 `opts.autoPlay === false` 的被动队列分支；只挂一条会有一半情况不出声。
- 后台增量扫描会重复走 `handleLocalFolderFiles`，没有一次性门会重复起播、打断用户当前听的歌。
- 自动播放三档状态 `off` / `continue` / `shuffle` 存在 `mineradio-auto-playback-v1`，并登记进 `PERSISTENT_UI_STATE_KEYS`，清理运行时缓存时不会被抹掉。

## Solution / Convention

- 自动播放只挂在启动出口上：`handleLocalFolderFiles` 的两条 `return` 前各调一次 `startAutoPlayback('restore')`，不要去改 `nextTrack`、`playMode` 循环或 `audio.onended`。
- `autoPlaybackRestoreHandled` 是每次会话一次性的启动门，只有 `reason === 'restore'` 消费它；用户手动切换开关走 `reason === 'setting'`，不占用启动名额。
- 起播前必须无条件退出的情况：模式为 `off`、`playQueue` 为空、`audio.src` 已存在且 `!audio.paused && !audio.ended`。空队列不能提前把启动门标记成已消费。
- `continue` 只在 `pendingPlaybackSessionResume.idx` 与当前索引一致时带上 `resumeAt`，用完立刻清空；模式为 `off` 时必须原样保留恢复点，否则用户手动点播放就丢了上次进度。
- `shuffle` 先切 `playMode = 'shuffle'` 并 `updatePlayModeButton(false)`，队列没进 `shuffledPlayQueueArrays` 时才 `shufflePlayQueueOnce` 一次，然后随机取索引并清空 `pendingPlaybackSessionResume`，避免随机到的歌从别人的时间点开始。
- 起播前调 `clearLocalLibraryPassiveQueue()` 并把 `playToggleBusy` 复位，否则被动队列标记会让首次播放被当成未确认队列。
- 自动播放歌单复用 `localLibraryPlaybackSelection` 与底部控制栏的 `#playlist-source-control` 选择器；`setLocalPlaybackPlaylistSelection` 必须回调 `updateAutoPlaybackControls`，设置区名称和底部按钮保持同一份真相。
- `openAutoPlaybackPlaylistPicker` 先 `toggleFxPanel(false)` 再展开选择器：视觉控制台会挡住底部控制栏。
- 设置区是 `fx-playback-fold`，通过 `fxPanelTargetForNode` 归入“高级”页并加进 `organizeFxPanel` 的默认展开清单；复用既有 `fx-fold` / `fx-seg` / `fx-section-label` / `lyric-color-row` / `fx-mini-btn ghost` / `mini-player-collapse-hint` 类，不新增 CSS。
- 自动播放接管起播时由它自己提示，`restorePlaybackSessionForLocalLibrary` 的“已恢复上次播放位置”只在模式为 `off` 时弹出，避免两条提示撞车。
- 回归测试必须锁定模式归一化、关闭态不出声且保留恢复点、`continue` 带进度与恢复点失配回退、`shuffle` 洗牌一次与清空恢复点、已固定乱序队列不重洗、启动只触发一次、正在出声不抢播、空队列安全退出、开关落盘与即时起播、播放歌单联动，以及两条启动出口都接上自动播放。

## Reference

- 相关实现：`public/app.js`、`public/index.html`
- 回归测试：`tests/auto-playback-startup.test.js`
