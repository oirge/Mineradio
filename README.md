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
- ✅ 音乐库智能分类独立标签页（艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代 / 最近添加 / 最近播放 / 播放最多 / 未播放）
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

### 最新版本 v1.7.24 (2026-09-02)

- 音乐库升级成外层标签页：左侧面板顶部现在是 `当前队列 / 歌单 / 音乐库` 三个并排入口，点「音乐库」直接进智能分类，不必先切到「歌单」再点卡片
- 两个标签页共用同一份列表与选中状态，切换时自动摆位：切到音乐库落在分类首页，切回歌单退回「全部音乐」，不会串页
- 停在某位艺术家或某个分组时切到「当前队列」再回来，仍停在原来那一层
- 音乐库那一页工具条说明改为「音乐库智能分类」并隐藏「新建」，「导入」保留；「歌单」页恢复成 特别喜欢 → 独立歌单 → 全部音乐
- 音乐库智能分类：`所有歌曲 / 最近添加 / 最近播放 / 播放最多 / 未播放` 五个歌曲视图，加 `艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代` 五个分组浏览
- 三层导航「音乐库 → 分组 → 歌曲」，分组层与歌曲层都带返回按钮，歌曲层还有「播放全部」，任意分类都能直接当底部播放来源
- 年代按十年归档（`1990年代` / `2000年代` / `2010年代`），读不出年份的归入「未知年代」并垫底；专辑艺术家缺失时回落到艺术家
- 最近播放 / 播放最多 / 未播放由本地收听统计驱动，播放次数相同再比累计时长与最近播放时间
- 入库时间戳让「最近添加」按真实入库顺序倒序并封顶 200 首；改标签换封面不会让歌重新变「最近添加」，首次整库导入也不会盖成同一时刻
- 整库只扫一遍建索引，分组卡片沿用面板懒加载额度，几千位艺术家不会一次铺完；界面零新增样式
- 真正的音效链，顺序固定为 `预设 → EQ → Preamp → Limiter → Spatial → Output`，整条链常驻音频图，开关切换不会有咔哒声
- 8 个预设：Normal / Rock / Pop / Classical / Jazz / Bass Boost / Vocal / 自定义；10 段图示均衡 `31 Hz ~ 16 kHz`，每段 ±12 dB / 0.5 dB 步进
- 自动预增益按最大提升量反向留余量，末端限幅压住瞬时过冲；立体声扩展用真正的中/侧矩阵，宽度 1 逐样本原样输出
- 音效档案可导出 / 导入 `xxx.eq.json`，含曲线、预增益、限幅与声场参数
- 音量均衡（ReplayGain）：读取歌曲已有的响度标签，支持整轨 / 整专辑基准、±12 dB Preamp 与防削波
- 音乐文件夹自动监控：新增自动入库、删除自动清理、改标签自动更新、换封面自动刷新，不必重启；同步过程不打断播放，右下角提示 `已同步 12,431 首歌曲`
- 支持 OGG / OGA / OPUS / WAV / APE / DSD(.dsf) 的标签、封面、内嵌歌词与时长解析，APE 与 DSD 可直接播放
- 本地曲库改用 SQLite + 文件指纹/路径索引，几万首歌启动不再重放整包 JSON，并解除历史 16000 条上限
- 全量 Node 回归 `655/655` 通过

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
