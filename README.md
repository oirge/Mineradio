# Mineradio Local Player

中文 · [English](./README_EN.md)

<div align="center">

**基于 Mineradio 二次修改的本地音乐播放器**

- 支持导入本地音乐文件夹。
- 支持单独导入本地音乐文件。
- 支持音乐文件夹自动监控：新增、删除、改标签、换封面自动同步，不必重启。
- 支持 MP3 / MP2 / FLAC / M4A / M4B / WAV / OGG / OGA / AAC / Opus / WebM / WebA / AIFF / APE / DSD(.dsf) 播放。
- 支持同名 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc` 歌词。
- 支持 MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 内嵌歌词标签，包括带时间轴的 LRC 歌词。
- 支持同目录封面图片和音频内嵌封面。
- 移除本地节奏分析环节。
- 支持多格式音频播放、歌词显示、迷你播放器和桌面歌词。

[下载最新版本](https://github.com/oirge/Mineradio/releases/latest) · [报告问题](https://github.com/oirge/Mineradio/issues) · [功能建议](https://github.com/oirge/Mineradio/issues/new?template=feature_request.yml)

</div>

---

## ✨ 功能特性

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
- ✅ 同名 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc` 歌词文件
- ✅ MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 内嵌歌词标签
- ✅ 带时间轴的 LRC 格式
- ✅ 歌词翻译自动识别和显示
- ✅ 桌面歌词窗口（可拖动、可调整大小）
- ✅ 双行歌词支持

### 🎨 播放器界面
- ✅ 迷你播放器（固定、拖动、动画效果）
- ✅ 封面显示（同目录图片或内嵌封面）
- ✅ 本地音乐库管理
- ✅ 音乐文件夹自动监控（新增/删除/改标签/换封面自动同步，右下角提示已同步数量）
- ✅ 播放列表管理
- ✅ 随机/循环播放模式

---

## 📦 安装使用

### 下载安装

从 [Releases](https://github.com/oirge/Mineradio/releases/latest) 页面下载最新版本的 Windows 安装包。

### 从源码运行

```bash
# 克隆仓库
git clone https://github.com/oirge/Mineradio.git
cd Mineradio

# 安装依赖
npm install

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
   - 歌词文件需与音乐文件同名（`.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc`）
   - MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 文件可使用内嵌歌词标签
   - 开启桌面歌词窗口显示

---

## 🔧 开发

### 技术栈

- **Electron** v43.4.0 - 桌面应用框架
- **Node.js** 22.x - 运行环境
- **electron-builder** - Windows 打包工具

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

## 📋 变更日志

查看 [Releases](https://github.com/oirge/Mineradio/releases) 页面获取完整变更历史。

### 最新版本 v1.7.22 (2026-09-02)

- 新增真正的音效链，顺序固定为 `预设 → EQ → Preamp → Limiter → Spatial → Output`，整条链常驻音频图，开关切换不会有咔哒声
- 8 个预设：Normal / Rock / Pop / Classical / Jazz / Bass Boost / Vocal / 自定义；拖动任意频段自动落到「自定义」，改回预设形状也会自动认回
- 10 段图示均衡 `31 Hz ~ 16 kHz`，两端搁架、中间 peaking，每段 ±12 dB / 0.5 dB 步进
- 自动预增益按最大提升量反向留余量，末端限幅保护压住瞬时过冲（阈值 -12 ~ 0 dB）
- 立体声扩展用真正的中/侧矩阵，宽度 1 逐样本原样输出、0 并成单声道、最大 2 加宽
- 音效档案可导出 / 导入 `xxx.eq.json`，含曲线、预增益、限幅与声场参数
- 新增音量均衡（ReplayGain）：读取歌曲已有的响度标签，把不同专辑、不同来源的歌拉到同一水平，不再一首震耳一首听不见
- 支持整轨（Track）与整专辑（Album）两种基准、±12 dB 的 Preamp 预增益，以及按峰值封顶的防削波开关
- 覆盖 FLAC / OGG / OPUS / MP3 / WAV / APE / M4A / DSF 里的 `REPLAYGAIN_*`、ID3v2 `TXXX` / `RVA2` 与 Opus `R128_*` 标签
- 不需要重扫曲库：新扫到的歌顺手采集，老歌在第一次播放时补齐一次并写回缓存
- 音效链与音量均衡都挂在独立节点上，音量条、淡入淡出与可视化电平全部保持原样
- 音乐文件夹自动监控：新增歌曲自动入库、删除歌曲自动清理、修改标签自动更新、修改封面自动刷新，不必重启播放器
- 同步过程不打断播放：曲库原地增删改，正在播放的那首即使文件被删也保留在原位
- 右下角新增同步指示器 `已同步 12,431 首歌曲`
- 新增 OGG / OGA / OPUS / WAV / APE / DSD(.dsf) 的标签、封面、内嵌歌词与时长解析
- APE 与 DSD 可直接播放：桌面端把它们包装成虚拟 WAV 流，Range 请求与进度拖动照常工作
- 本地曲库改用 SQLite + 文件指纹/路径索引，几万首歌启动不再重放整包 JSON，并解除历史 16000 条上限
- 全量 Node 回归 `630/630` 通过

---

## ❓ 常见问题

### 支持哪些音频格式？
支持 MP3、MP2、FLAC、M4A、M4B、WAV、OGG、OGA、AAC、Opus、WebM/WebA、AIFF/AIFC、APE、DSD(.dsf) 等格式。

### 如何添加歌词？
- 将 `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc` 歌词文件放在音乐文件同目录，保持文件名一致
- MP3 / FLAC / OGG / OPUS / WAV / APE / DSF 文件可直接使用内嵌歌词标签（如 FLAC/OGG 的 `LYRICS`、MP3 的 `USLT`）

### 封面图片如何加载？
- 自动读取音频文件内嵌封面
- 或读取同目录下的 `cover.jpg`/`cover.png` 等图片文件

### 是否支持在线音乐？
本版本为**纯本地播放器**，不提供在线音乐搜索、登录、会员音源等功能。

---

## 📄 授权

本项目沿用原项目授权，详见 [LICENSE](./LICENSE)。

原项目地址：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

- [报告 Bug](https://github.com/oirge/Mineradio/issues/new?template=bug_report.yml)
- [建议功能](https://github.com/oirge/Mineradio/issues/new?template=feature_request.yml)
- [贡献指南](./CONTRIBUTING.md)

---

## ⚠️ 免责声明

本仓库为本地播放器版本，主要面向个人本地音乐库播放。

请自行确保导入和播放的音乐文件来源合法，遵守相关版权法律法规。
