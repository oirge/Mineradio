# NOTICE

Mineradio 使用了以下第三方项目或服务。各项目版权归其原作者所有。

## Third-party Libraries

- Electron
- Three.js
- GSAP
- music-tempo
- NeteaseCloudMusicApi
- Noto Sans SC UI 字体子集（SIL Open Font License 1.1，来源说明见 `public/vendor/fonts/NotoSansSC-OFL.txt`）

## Third-party Services

Mineradio 可能与网易云音乐、QQ 音乐等第三方音乐服务进行用户自有账号相关的本地客户端交互。

Mineradio 不是任何音乐平台的官方客户端，也不隶属于网易云音乐、QQ 音乐或腾讯音乐娱乐集团。请用户自行遵守对应平台的服务协议、版权规则和会员权益规则。

## Community Contributions

视觉预设「音域回响」有两条实现，都不是本仓库原创。

**预设 7（Sonic-Topography，three.js 重写）**

- 视觉算法移植自社区分支 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) 的 `public/sonic-topography-preset.js`（GPL-3.0，commit `89c0d23`），本仓库同为 GPL-3.0，移植保留同一许可。
- 该分支又标注其实现移植自 [yin-yizhen/sonic-topography](https://github.com/yin-yizhen/sonic-topography) 1.1.1（commit `3ff303e`），作者 **Ajin**。
- 原始创意、配色与玩法出自 **CmzYa** 的 Wallpaper Engine 作品《音域回响》（Steam Workshop 物品号 `3747222633`）。

**预设 8（Wallpaper Engine 原作）**

- `public/vendor/sonic-workshop/` 下是 **CmzYa** 的上述 Wallpaper Engine 作品的构建产物（`mineradio-bridge.html`、`project.json`、`assets/index-Z-j1MQ-r.js`、`assets/index-Bhwp8mwk.css`），版权归 CmzYa 所有，本仓库原样嵌入、未修改其中任何一个字节。整幅画面由这份产物在 iframe 内渲染。
- 该产物与桥接页同样取自 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)（commit `89c0d23`）的 `public/vendor/sonic-workshop/` 与 `public/sonic-workshop-preset.js`；上游未在其 NOTICE 中记录这份第三方产物的出处，本仓库补记于此。
- 本仓库自己写的部分只有喂数据的宿主侧：`public/sonic-workshop-preset.js` 把本项目的音频、封面配色与播放状态按 Wallpaper Engine 的接口格式推进 iframe，本机适配记录在该文件头。
- 这份产物经检查不发起任何网络请求、不写入本地存储、不含 `eval`；`tests/sonic-workshop-preset.test.js` 把这条结论钉成回归测试。

本仓库只搬了视觉层；播放器、歌词、服务端与桌面端仍是自己的实现。适配改动记录在 `public/sonic-topography-preset.js` 与 `public/sonic-workshop-preset.js` 的文件头。

## Original Design

Mineradio 名称、MR Logo、界面视觉设计、启动动画方向、粒子视觉体验和电影镜头系统的产品表达属于作者原创设计。

emily 作为 Mineradio 早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此致谢。

感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。
