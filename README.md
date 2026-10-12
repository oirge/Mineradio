# Mineradio Local Player

中文 · [English](./README_EN.md)

<div align="center">

**基于 Mineradio和Folia 二次修改的本地音乐播放器**

- 支持导入本地音乐文件夹。
- 支持单独导入本地音乐文件。
- 支持音乐文件夹自动监控：新增、删除、改标签、换封面自动同步，不必重启。
- 支持 MP3 / MP2 / FLAC / M4A / M4B / WAV / OGG / OGA / AAC / Opus / WebM / WebA / AIFF / APE / DSD(.dsf) 播放。
- 支持同名 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.ssa` / `.yrc` / `.krc` / `.qrc` / `.ttml` 歌词。
- 支持加密歌词：KRC（`krc1`）与 QRC（十六进制文本与二进制密文两种形态）都能直接读。
- 支持一首歌配多份同名歌词时按格式优先级自动挑，也可以自己挑一份并记住。
- 支持歌词编码自动识别：UTF-8 / UTF-16 / GB18030 / Big5 / Shift_JIS / EUC-KR / Windows-1252。
- 支持 MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 内嵌歌词标签，包括带时间轴的 LRC 歌词。
- 支持同目录封面图片和音频内嵌封面。
- 移除本地节奏分析环节。
- 支持多格式音频播放、歌词显示、迷你播放器和桌面歌词。
- 支持 Folia 本地播放：歌词、悬浮 Polaroid 唱片墙、Lattice 封面拼贴墙三种视图，14 种歌词效果和 5 种背景；沿用 Mineradio 曲库与音频引擎。

[下载最新版本](https://github.com/oirge/Mineradio/releases/latest) · [报告问题](https://github.com/oirge/Mineradio/issues) · [功能建议](https://github.com/oirge/Mineradio/issues/new?template=feature_request.yml)

</div>

---

## ✨ 功能特性

### 🌿 Folia 本地播放（v2.4.0）

- 在标题栏切换 **Mineradio / Folia**；Folia 内可选歌词播放、悬浮 Polaroid 唱片墙和 Lattice 封面拼贴墙，切换视图时音乐继续播放。
- 14 种内置歌词效果：Classic、Partita、Tempera、Lumiere、Cadenza、Fume、Claddagh、Cappella、Tilt、Diorama、Monet、Pendolo、Sonnet、Still。其中 12 种提供原版专属参数面板。
- 5 种本地背景：Common、Latent、Sora、Monet、Nomand；支持主题、字号、译文、图片素材及视觉偏好保存。
- 音乐库、收藏、歌单和队列共用 Mineradio 的本地数据，播放仍由 Mineradio 的音频引擎负责。
- 只集成 Folia 的本地播放功能和视觉组件，不接入它的在线音乐、账号或同步服务。实现与源码说明见 [Folia 本地集成文档](./docs/FOLIA_INTEGRATION.md)。

### 🎵 音频格式支持
- **MP3** - MPEG Audio Layer 3
- **MP2** - MPEG Audio Layer 2
- **FLAC** - 无损音频格式
- **M4A** - MPEG-4 Audio (AAC/ALAC)
- **M4B** - MPEG-4 有声书音频
- **WAV** - 未压缩音频
- **OGG** - Ogg Vorbis
- **OGA** - Ogg 音频
- **AAC** - Advanced Audio Coding
- **Opus** - Ogg Opus
- **WebM/WebA** - WebM 音频
- **AIFF/AIFC** - AIFF 无损音频
- **APE** - Monkey's Audio 无损音频
- **DSD (.dsf)** - DSD Stream File 高解析音频

### 📝 歌词功能
- ✅ 同名 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.ssa` / `.yrc` / `.krc` / `.qrc` / `.ttml` 歌词文件
- ✅ 逐字歌词：YRC（网易云）/ KRC（酷狗，含 `krc1` 加密二进制）/ QRC（QQ 音乐，含 XML 容器与加密载体）/ TTML（Apple Music 一族）
- ✅ QRC 加密歌词：接口原样落盘的十六进制文本与直接写成二进制的密文两种形态都收，识别只看内容特征，后缀被改过也认得出来
- ✅ 同名多份歌词按格式优先级自动挑：逐字时间轴（`.qrc` / `.krc` / `.ttml` / `.yrc`）> 逐行 `.lrc` > 字幕（`.ass` / `.ssa` / `.srt` / `.vtt`）> `.txt`
- ✅ 同名多份歌词也能自己挑：自定义歌词弹窗里列出候选（写着路径与格式），选择会记住，下次重新导入同一批文件仍用你挑的那一份
- ✅ 歌词编码自动识别：UTF-8 / UTF-16LE / UTF-16BE（含无 BOM）/ GB18030 / Big5 / Shift_JIS / EUC-KR / Windows-1252
- ✅ 歌词时间轴兼容在野写法：`[offset:±N]` 全局偏移、`[mm:ss:cc]`、`[hh:mm:ss.fff]`，小数位按实际位数换算
- ✅ MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 内嵌歌词标签
- ✅ 带时间轴的 LRC 格式
- 🧪 本地歌曲后台时间轴校正（实验性）：只在单独配置 Python 3.13、FFmpeg 和本地模型后运行；未配置或区间不可靠时保留原歌词，不弹出校正界面。详见 [运行时说明](./lyric-aligner/README.md)。
- ✅ 歌词翻译自动识别和显示
- ✅ 桌面歌词窗口（可拖动、可调整大小）
- ✅ 双行歌词支持

### 🎨 播放器界面
- ✅ 迷你播放器（固定、拖动、动画效果）
- ✅ 封面显示（同目录图片或内嵌封面）
- ✅ 本地音乐库管理
- ✅ 音乐库智能分类独立标签页（艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代 / 最近添加 / 最近播放 / 播放最多 / 未播放）
- ✅ 音乐文件夹自动监控（新增/删除/改标签/换封面自动同步，搜索框下方提示已同步数量）
- ✅ 播放列表管理
- ✅ 随机/循环播放模式
- ✅ 单曲播放统计（播放次数、完整播放、累计播放时长、最近播放时间）
- ✅ 断点续播（每首歌单独记住上次听到哪儿）与「继续上次播放」
- ✅ 最近播放记录可两档清空（只清最近播放 / 连次数与时长一起清）
- ✅ 全局快捷键可自定义，支持鼠标中键与两个侧键
- ✅ 无缝播放（Gapless）与 `0~10` 秒交叉淡入淡出（Crossfade）
- ✅ 整机备份：导出 `mineradio.backup`（曲库索引 / 歌单 / 收藏 / 听歌统计 / 主题 / 音效 / 播放器设置 / 音乐文件夹），换电脑导入自动按新路径挂回，不含音频与封面缓存

---

## 📦 安装使用

### 下载安装

从 [Releases](https://github.com/oirge/Mineradio/releases/latest) 页面下载最新版本的 Windows 安装包。

### 从源码运行

源码构建需要 Node.js 24 或更新版本。

```bash
# 克隆仓库
git clone https://github.com/oirge/Mineradio.git
cd Mineradio

# 分别安装 Mineradio 与 Folia 的锁定依赖
npm ci
npm ci --prefix vendor-src/folia --ignore-scripts

# 构建 Folia 本地界面
npm run build:folia

# 启动应用
npm start
```

### 构建安装包

```bash
# 构建 Windows 安装包
npm run build:win

# 构建产物位于 dist/ 目录
```

---

## 🚀 快速开始

1. **导入音乐**
   - 点击「导入文件夹」批量导入
   - 或「导入文件」单个添加

2. **播放音乐**
   - 双击歌曲开始播放
   - 支持拖拽调整播放顺序

3. **查看歌词**
   - 歌词文件需与音乐文件同名（`.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.ssa` / `.yrc` / `.krc` / `.qrc` / `.ttml`）
   - MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 文件可使用内嵌歌词标签
   - 开启桌面歌词窗口显示

4. **使用 Folia 本地界面**
   - 在标题栏点击「Folia」，切换歌词、悬浮唱片墙或封面拼贴墙
   - 通过「音乐库」和「效果」打开本地曲库与视觉设置；点击「Mineradio」切回原界面，播放不会中断

---

## 🔧 开发

### 技术栈

- **Electron** v43.4.0 - 桌面应用框架
- **Node.js** 24+ - 源码构建与测试环境
- **electron-builder** - Windows 打包工具
- **uiohook-napi** v1.5.5 - 唯一的运行时依赖，只为全局鼠标键热键提供系统级低层输入钩子；没有绑定鼠标键时不会被加载

### 开发指南

查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解：
- 开发环境配置
- 代码规范
- 提交流程
- 测试要求

### 运行测试

```bash
npm test
```

---
## ❓ 常见问题

### 支持哪些音频格式？
支持 MP3、MP2、FLAC、M4A、M4B、WAV、OGG、OGA、AAC、Opus、WebM/WebA、AIFF/AIFC、APE、DSD(.dsf) 等格式。

### 如何添加歌词？
- 将 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.ssa` / `.yrc` / `.krc` / `.qrc` / `.ttml` 歌词文件放在音乐文件同目录，保持文件名一致
- 逐字歌词直接认：YRC、KRC（含 `krc1` 加密二进制）、QRC（含 `<Lyric_1 LyricContent="…">` XML 容器与加密载体）、TTML
- 加密的 QRC 不用先解密：十六进制文本与二进制密文两种形态都能直接放进去，识别看内容不看后缀
- 一首歌配了多份同名歌词时，默认按格式优先级挑（逐字 > `.lrc` > 字幕 > `.txt`）；想换成另一份就在自定义歌词弹窗里点候选按钮，选择会被记住
- 歌词文件不是 UTF-8 也没关系：UTF-16、GB18030、Big5、Shift_JIS、EUC-KR、Windows-1252 会自动识别，合法的 UTF-8 一律不重猜
- MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 文件可直接使用内嵌歌词标签（如 FLAC/OGG 的 `LYRICS`、MP3 的 `USLT`）

### 封面图片如何加载？
- 自动读取音频文件内嵌封面
- 或读取同目录下的 `cover.jpg`/`cover.png` 等图片文件

---

欢迎提交 Issue 和 Pull Request！

- [报告 Bug](https://github.com/oirge/Mineradio/issues/new?template=bug_report.yml)
- [建议功能](https://github.com/oirge/Mineradio/issues/new?template=feature_request.yml)
- [贡献指南](./CONTRIBUTING.md)

---

## ⚠️ 免责声明

本仓库为本地播放器版本，主要面向个人本地音乐库播放。

请自行确保导入和播放的音乐文件来源合法，遵守相关版权法律法规。
