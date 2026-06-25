# QQ 音乐接口排障记录

更新日期：2026-06-21

## 触发症状

- 登录 QQ 后顶部能显示 QQ 账号状态，但很快又显示未登录，或者只有账号状态没有 QQ 头像和昵称。
- QQ 歌单能读取，但点击 QQ 音乐正式歌曲听不了。
- `/api/qq/song/url` 对部分片段/非正式曲目可返回 URL，但正式曲目常返回 `104003`。

## 已确认根因

- `p_skey` 只能证明网页 QQ 账号态，不等于 QQ 音乐播放授权。
- 真正更接近播放授权的 cookie 字段是 `qm_keyst`、`qqmusic_key`、`music_key`，微信通道可看 `wxskey`。
- 只有 `p_skey` 时，资料、歌单可能可用，但正式歌曲 vkey 仍可能不给 `purl`。
- QQ 资料接口 `fcg_get_profile_homepage.fcg` 可能返回 `code:1000`，此时不能直接把账号判成未登录，应从 cookie 的 `ptnick_*` 和 `qlogo.cn` 兜底昵称/头像。

## 当前修复点

- `server.js`
  - `qqCookieNickname()` 从 `ptnick_*` 等 cookie 兜底 QQ 昵称。
  - `qqCookieAvatar()` 用 `https://q1.qlogo.cn/g?b=qq&nk=<uin>&s=100` 兜底头像。
  - `qqCookiePlaybackKey()` 单独判断播放票据，不再把 `p_skey` 当成完整播放授权。
  - `/api/qq/login/status` 返回 `playbackKeyReady`。
  - `/api/qq/song/url` 同时尝试 `mediaMid` 和 `songmid` 生成文件名候选。
  - 缺播放票据且 vkey 返回 `104003` 时归类为 `login_required`，提示重新授权，而不是误判为普通版权失败。
- `desktop/main.js`
  - QQ 登录窗口不再一拿到 `p_skey` 就自动关闭。
  - 登录后会继续跳到 QQ 音乐播放器页 warmup，等待 `qm_keyst`、`qqmusic_key`、`music_key` 或 `wxskey`。
  - 如果用户手动关窗但只有网页态，返回 `partial: true`。
- `public/index.html`
  - QQ 登录状态只有在 `profileUnavailable` 且没有昵称/头像时才标记 stale。
  - QQ 播放失败先降音质重试，再自动查找网易云同名同歌手版本换源。
  - 登录成功提示会区分完整播放授权和账号态同步。

## 后续同类问题优先检查

1. 先看 `C:\Users\Administrator\AppData\Roaming\Mineradio\.qq-cookie` 是否有 `qm_keyst`、`qqmusic_key`、`music_key` 或 `wxskey`。
2. 调 `/api/qq/login/status`，确认 `loggedIn`、昵称、头像和 `playbackKeyReady`。
3. 调 `/api/qq/song/url?mid=<songmid>&mediaMid=<media_mid>&quality=highest`，检查 `reason`、`qqCode`、`playbackKeyReady`。
4. 如果 `playbackKeyReady=false` 且 `qqCode=104003`，优先重新跑 QQ 官方登录窗口，不要先改搜索或播放器 audio 逻辑。
5. 如果 `playbackKeyReady=true` 仍大量 `104003`，再判断版权、会员、地区、官方客户端限制或换源策略。
