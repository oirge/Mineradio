# 第三方组件声明

Mineradio 本体以 `GPL-3.0` 发布（见 `LICENSE`）。下列组件来自第三方，保留各自的版权与授权条款。

## public/vendor/folia 与 vendor-src/folia —— Folia（AGPL-3.0）

Folia Web 界面来自 chthollyphile/folia-major，取材版本 0.7.16（2026-10-10）。
项目地址：https://github.com/chthollyphile/folia-major 。
记录的上游 main commit 为 `d824c0b854e54d5411cb072092999823e9bd7071`。
本地嵌入适配只挂载独立本地播放器，复用原版歌词、背景和视觉参数组件，将播放和曲库操作交给 Mineradio；不加载上游完整应用入口、在线功能、独立 Electron 程序及在线服务部署。
修改后的 Folia 源码位于本项目源码检出的 `vendor-src/folia`，构建命令为 `npm run build:folia`。
源码与桌面运行产物的边界、重建步骤见 `docs/FOLIA_INTEGRATION.md`；当前桌面打包配置只包含编译后的界面文件。
上游版本记录见源码内及运行产物内的 `MINERADIO-UPSTREAM.json`。
Folia 的 GNU Affero General Public License v3 全文随源码和界面产物分别保留于
`vendor-src/folia/LICENSE` 和 `public/vendor/folia/LICENSE`。相关作者声明及依赖清单保留在原始源码中。

嵌入界面实际打包的 npm 依赖（包括 React、React DOM、PixiJS、Zustand 等）的原始版权、许可和 NOTICE 文本，
随安装包保留于 `public/vendor/folia/THIRD-PARTY-LICENSES.txt`。该文件由主界面与 worker 的实际入包模块生成，
不会将仅安装、未打包的开发或在线服务依赖列为分发组件；每个条目记录对应包名、版本和许可来源文件。
`local-player-build.json` 保存该清单及 SHA-256，`npm run check:folia` 会检查文本与清单一致，缺失或变更时阻止打包。
若某个 npm 归档遗漏许可文件，仅对已核验的精确包版本使用 `third-party/folia-license-fallbacks/` 中的原始文本；
该目录记录不可变上游提交、来源及内容校验值，构建时不联网下载或为其他版本猜测许可。

## desktop/audio/ape-decoder.js —— FFmpeg（LGPL-2.1-or-later）

Monkey's Audio (APE) 解复用与解码实现是 FFmpeg 以下文件的逐行 JavaScript 移植：

- `libavformat/ape.c`
- `libavcodec/apedec.c`

```
Copyright (c) 2007 Benjamin Zores <ben@geexbox.org>
based upon libdemac from Dave Chapman.

This file is part of FFmpeg.

FFmpeg is free software; you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free
Software Foundation; either version 2.1 of the License, or (at your option)
any later version.

FFmpeg is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more
details.
```

原始条款为 `LGPL-2.1-or-later`，本移植沿用同一授权条款；按 LGPL v2.1 第 3 条，该文件在本项目内以 `GPL-3.0` 分发。
FFmpeg 项目主页：<https://ffmpeg.org/>；LGPL-2.1 全文：<https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html>。

`desktop/audio/dsf-decoder.js` 与 `desktop/audio/wav-stream.js` 是本项目原创实现，不含第三方代码。

## public/vendor/three.r128.min.js —— three.js（MIT）

```
Copyright 2010-2021 Three.js Authors
SPDX-License-Identifier: MIT
```

## public/vendor/music-tempo.min.js —— music-tempo（MIT）

```
Copyright (c) 2017 killercrush
```

完整条款见 `public/vendor/music-tempo.LICENCE`。

## public/vendor/fonts —— Inter（SIL Open Font License 1.1）

```
Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)
```

完整条款见 `public/vendor/fonts/Inter-OFL.txt`。

## public/vendor/gsap.min.js —— GSAP 3.15.0（GreenSock Standard License）

```
Copyright 2026, GreenSock. All rights reserved.
Subject to the terms at https://gsap.com/standard-license
@author: Jack Doyle, jack@greensock.com
```

GSAP 不是开源许可，适用 GreenSock 标准许可条款。

## node_modules/uiohook-napi —— uiohook-napi（MIT）+ libuiohook（LGPL-3.0-or-later）

全局鼠标中键 / 侧键热键靠这个原生模块实现：Electron 的 `globalShortcut` 只收键盘，鼠标键必须走系统级低层输入钩子。模块本体是 MIT：

```
MIT License

Copyright (c) 2020 Alexander Drozdov
```

完整条款见安装包内 `node_modules/uiohook-napi/LICENSE`。项目主页：<https://github.com/SnosMe/uiohook-napi>。

其中静态链接的 `libuiohook` 是另一套授权：

```
libUIOHook: Cross-platform keyboard and mouse hooking from userland.
Copyright (C) 2006-2023 Alexander Barker.  All Rights Reserved.
https://github.com/kwhat/libuiohook/

libUIOHook is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
```

原始条款为 `LGPL-3.0-or-later`；按 LGPL v3 第 2 条，该组件在本项目内以 `GPL-3.0` 分发。LGPL-3.0 全文：<https://www.gnu.org/licenses/lgpl-3.0.html>。

安装包里随附的是预编译二进制 `node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node`（静态链接 libuiohook）。`package.json` 与 `package-lock.json` 把版本钉死在 `uiohook-napi@1.5.5`，对应源码见上面两个仓库；照该版本重新编译并替换这个 `.node` 文件即可完成再链接。

## node_modules/node-gyp-build —— node-gyp-build（MIT）

`uiohook-napi` 的入口用它在运行时挑选预编译二进制。

```
Copyright (c) 2017 Mathias Buus
```

完整条款见安装包内 `node_modules/node-gyp-build/LICENSE`。项目主页：<https://github.com/prebuild/node-gyp-build>。
