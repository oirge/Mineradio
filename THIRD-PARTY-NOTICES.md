# 第三方组件声明

Mineradio 本体以 `GPL-3.0` 发布（见 `LICENSE`）。下列组件来自第三方，保留各自的版权与授权条款。

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
