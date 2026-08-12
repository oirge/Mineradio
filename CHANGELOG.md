# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-08-12

### ✨ Added
- **音频格式扩展支持** - 完整支持 M4A/AAC/ALAC 格式 (#5, #10)
- **完整的音频格式列表**：
  - MP3 (MPEG Audio Layer 3)
  - FLAC (Free Lossless Audio Codec)
  - M4A (MPEG-4 Audio, including AAC and ALAC)
  - WAV (Waveform Audio File Format)
  - OGG (Ogg Vorbis)

### 🎨 Improved
- **歌词功能增强** (#6)
  - 歌词翻译自动识别和显示
  - 优化桌面歌词双行显示
  - 改进 LRC 解析逻辑
- **迷你播放器优化** (#12)
  - 添加过渡动画效果
  - 改进 UI 视觉效果
  - 优化封面显示和律动关联
- **文档完善**
  - 更新 README 中文和英文版本
  - 添加完整的功能特性说明
  - 明确音频格式支持列表

### 🔧 Changed
- 升级 Electron 从 42.4.1 到 43.4.0
- 版本号从 1.3.13 升级到 1.4.0

### 🔒 Security
- 修复更新检查中的 TLS 证书验证问题 (#17)
- 增强更新机制的安全性

### 📋 Closed Issues
- #5 建议增加适配音频格式
- #6 歌词翻译和桌面歌词相关
- #10 麻烦支持下m4a格式
- #12 迷你播放器改进建议

## [1.3.13] - 2026-08-12

### 📝 Documentation
- 添加双语 README 切换功能

### Previous versions
See commit history for changes before v1.3.13.

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
