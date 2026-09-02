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
