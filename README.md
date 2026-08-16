# Mineradio Local Player

中文 · [English](./README_EN.md)

<div align="center">

**基于 Mineradio 二次修改的本地音乐播放器**

- 删除登录、在线音乐入口、更新提示和无用引导。
- 支持导入本地音乐文件夹。
- 支持单独导入本地音乐文件。
- 支持 MP3 / FLAC / M4A / WAV / OGG 播放。
- 支持同名 `.lrc` / `.txt` 歌词。
- 支持 FLAC 内嵌 `LYRICS` 歌词标签，包括带时间轴的 LRC 歌词。
- 支持同目录封面图片和音频内嵌封面。
- 移除本地节奏分析环节。
- 支持多格式音频播放、歌词显示、迷你播放器和桌面歌词。

[下载最新版本](https://github.com/oirge/Mineradio/releases/latest) · [报告问题](https://github.com/oirge/Mineradio/issues) · [功能建议](https://github.com/oirge/Mineradio/issues/new?template=feature_request.yml)

</div>

---

## ✨ 功能特性

### 🎵 音频格式支持
- **MP3** - MPEG Audio Layer 3
- **FLAC** - 无损音频格式
- **M4A** - MPEG-4 Audio (AAC/ALAC)
- **WAV** - 未压缩音频
- **OGG** - Ogg Vorbis

### 📝 歌词功能
- ✅ 同名 `.lrc` / `.txt` 歌词文件
- ✅ FLAC 内嵌 `LYRICS` 歌词标签
- ✅ 带时间轴的 LRC 格式
- ✅ 歌词翻译自动识别和显示
- ✅ 桌面歌词窗口（可拖动、可调整大小）
- ✅ 双行歌词支持

### 🎨 播放器界面
- ✅ 迷你播放器（固定、拖动、动画效果）
- ✅ 封面显示（同目录图片或内嵌封面）
- ✅ 本地音乐库管理
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
   - 歌词文件需与音乐文件同名（`.lrc` 或 `.txt`）
   - FLAC 文件可使用内嵌歌词标签
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

### 最新版本 v1.4.2 (2026-08-12)

- 支持 MP3/FLAC/M4A/WAV/OGG/OGA/AAC/Opus/WebM/WebA 多格式播放
- 支持 LRC/TXT/SRT/VTT/ASS/YRC 外置歌词，以及 JPG/JPEG/JPE/JFIF/PNG/WebP/AVIF/GIF/BMP/SVG 封面
- 修复标准 M4A 标签、音轨号、内嵌封面和后置 `moov` 读取
- 修复旧 M4A 元数据缓存继续复用错误结果
- 迷你播放器优化和动画效果
- 桌面歌词功能
- 移除本地节奏分析环节
- 优化封面和歌词加载逻辑

---

## ❓ 常见问题

### 支持哪些音频格式？
支持 MP3、FLAC、M4A、WAV、OGG 五种常见音频格式。

### 如何添加歌词？
- 将 `.lrc` 或 `.txt` 歌词文件放在音乐文件同目录，保持文件名一致
- FLAC 文件可直接使用内嵌的 `LYRICS` 标签

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
