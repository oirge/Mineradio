# Mineradio Local Player

这是基于 Mineradio 二次修改的本地音乐播放器版本，已改为纯本地播放使用。

原项目地址：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

## 主要改动

- 删除登录、在线音乐入口、更新提示和无用引导。
- 支持导入本地音乐文件夹。
- 支持单独导入本地音乐文件。
- 支持 MP3 / FLAC 播放。
- 支持同名 `.lrc` / `.txt` 歌词。
- 支持 FLAC 内嵌 `LYRICS` 歌词标签，包括带时间轴的 LRC 歌词。
- 支持同目录封面图片和音频内嵌封面。
- 移除本地节奏分析环节。

## 使用

```bash
npm install
npm start
```

打包 Windows 安装包：

```bash
npm run build:win
```

打包产物位于 `dist/`。

## 说明

本仓库为本地播放器二改版本，主要面向个人本地音乐库播放，不提供在线音乐搜索、登录、会员音源或音乐内容分发能力。

请自行确保导入和播放的音乐文件来源合法。

## 授权

本项目沿用原项目授权，详见 [LICENSE](./LICENSE)。
