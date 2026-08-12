# Mineradio M4A 元数据与播放兼容

## Context

处理 Mineradio 本地 M4A 导入、播放、iTunes 标签和内嵌封面时适用。

## Fact / Pitfall

- M4A 是 MP4 容器，能否读取 `moov/udta/meta/ilst` 元数据与 Chromium 是否能解码其中的音频编码是两个独立问题。
- iTunes `data` atom 的值头部为 8 字节：前 4 字节是类型指示器，后 4 字节是区域指示器；文本或图片值从第 8 字节开始。把它误当成 12 字节会同时导致标题、艺术家、专辑和封面全部错位。
- `moov` 可能位于文件尾部。后台扫描只能在轻量范围内读取 atom 目录；如果范围未覆盖 `moov`，必须返回未完成状态，前台完整读取才能重试。
- 修复前生成的本地缓存可能保存了错误的 M4A 空标签。M4A 标签解析规则变化时必须提升 `LOCAL_METADATA_TAG_SCHEMA`，让旧记录重新解析；时长、文件大小、封面缩略图等独立轻量字段仍可复用。

## Solution / Convention

- 只读取 atom 头、标签值和 `covr` 图片范围，不读取 `mdat` 音频内容。
- 支持 `©nam`、`©ART`、`©alb`、`aART`、`©day`、`trkn` 与 JPEG/PNG `covr`。
- 桌面曲库将 `.m4a` 映射为 `audio/mp4`，本地代理同样返回 `audio/mp4`，播放地址继续复用授权的持久流地址。
- 后台元数据或封面扫描未覆盖文件尾时保持可重试状态；当前歌曲前台路径执行完整扫描。
- M4A 播放失败仍需以 Chromium/Electron 的实际音频编码支持为准；容器和标签解析成功不代表 ALAC 等编码一定可解码。

## Verification

- `tests/local-m4a-support.test.js` 覆盖后置 `moov`、标准 `data` atom、UTF-8/UTF-16 标签、音轨号、JPEG/PNG 封面、文件夹扫描和 MIME。
- `tests/local-metadata-cache-version.test.js` 覆盖旧 M4A 元数据缓存失效重解析。

## Reference

- `node_modules/music-metadata/lib/mp4/AtomToken.js` 的 `DataAtom` 结构：类型/区域 8 字节后读取值。
- `node_modules/music-metadata/lib/mp4/MP4Parser.js` 的 M4A `ilst/data/covr` 解析分支。
