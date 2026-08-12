+﻿# 发布流程

## v1.4.2 M4A 播放与元数据修复

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.2`。
- 桌面曲库、文件夹导入、本地文件代理和文件选择器统一支持 `.m4a` / `audio/mp4`。
- 新增 M4A MP4 atom 解析：后置 `moov`、`udta/meta/ilst`、标准 8 字节 `data` 值头、UTF-8/UTF-16 标签、`trkn`、JPEG/PNG `covr`。
- 修复旧实现把标准 `data` atom 当作 12 字节值头的问题；该错误会让真实 M4A 的所有标签和封面同时错位。
- 后台轻量读取不进入超出范围的 `moov`，当前播放前台路径会执行完整重试；不读取 `mdat` 音频内容。
- M4A 标签缓存 schema 从 `1` 升为 `2`，旧测试版错误元数据会自动重新解析，时长、文件大小和独立封面缩略图仍可复用。
- 新增 `tests/local-m4a-support.test.js` 与 M4A 缓存回归；合并 WAV/OGG、本地曲库和特别喜欢功能后全量 Node 回归 `266/266`，关键 JavaScript 语法检查和 `git diff --check` 通过。
- 说明：M4A 容器标签解析成功不代表其中每一种音频编码都能由 Electron/Chromium 解码；AAC/MPEG-4 与 ALAC 等编码需要按实际运行环境验证。
- Windows x64 NSIS 构建使用 Electron `43.4.0` 完成；安装器 `101394836` 字节，blockmap `105865` 字节，`latest.yml` `347` 字节。
- SHA256：安装器 `0DB344D41221BEDA912E29DE4BD20EC4B6FB6E5E7E167C5A344BEF674FFF6651`；blockmap `041AA61E579AD981DE6D5F2DFDA7EC4FAB9F71AD22D6C0D050965F6F0DEB3D11`；`latest.yml` `491786B9F04E6B8E53D3D901D51FBC77A3DB28FD9B40C2CE86D23698047E326F`；SHA256 清单 `3E3E1A6DD13AA3E291C2E76790C1597BE0B22208991995C9225FD0DBE97F6C43`。
- `latest.yml` 的 Setup SHA512：`IPTyVH4I6OeHhKHh5GOHgGPe+XBqlQ4VyyA6mOhVOvjlWj1KTyG2eLSFEbWvvhY5089ng48D9DySt1/jwXKRNQ==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.4.2`，正式 Latest；四个远端资产已重新下载，大小与 SHA256 均和本地产物一致。`.github/workflows/release.yml` 已改为仅手动触发，避免发布事件自动重建并覆盖已验证资产。

## v1.3.13 本地曲库空状态与播放来源恢复稳定性

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.13`。
- 本地扫描结果为空时清理旧曲库快照、索引、播放队列、当前歌曲、歌词、封面和播放会话，避免重启后恢复已经不存在的歌曲。
- 曲库初始化完成前不清理特别喜欢引用；初始化完成后自动移除失效引用，避免启动阶段误删用户歌单。
- 普通 / 喜欢播放来源严格校验队列顺序，来源切换时保留当前播放进度，避免两个来源歌曲混排。
- 全量 Node 回归 `262/262`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。

## v1.3.12 播放来源持久化与喜欢队列稳定性

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.12`。
- 普通 / 喜欢播放来源写入独立持久化键，重启软件和恢复本地曲库后继续使用上次选择。
- 恢复曲库时按当前来源重建播放队列；特别喜欢为空时自动安全回退普通歌单。
- 移除当前喜欢歌曲后同步重建队列，并在播放中自动衔接下一首；打开队列时校验来源一致性。
- 全量 Node 回归 `259/259`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。

## v1.3.11 主播放栏歌单切换按钮

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.11`。
- 主播放控制栏在当前队列按钮后新增“普通 / 喜欢”双态按钮，可直接在全部本地音乐和“特别喜欢”之间切换播放来源。
- 切换后立即按目标歌单重建队列并从第一首开始播放；“特别喜欢”为空时保留当前队列并提示，不产生空队列或错误状态。
- 歌单面板浏览状态与实际播放来源使用独立状态，打开“特别喜欢”页面不会误显示为正在播放该歌单。
- 喜欢状态使用克制的粉色文字、图标和光晕，并提高状态规则优先级，避免通用玻璃悬停覆盖双态反馈。
- 全量 Node 回归 `257/257`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 发布继续只生成安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.3.11-Setup.exe` `103345079` 字节；`Mineradio-1.3.11-Setup.exe.blockmap` `110091` 字节；`latest.yml` `350` 字节；`Mineradio-1.3.11-SHA256SUMS.txt` `272` 字节。
- SHA256：安装器 `31115F258B651281FC5D7057B3C7B8F865F748FA15B30D7B0DC35DB4E876B6D4`；blockmap `1BBDFC3EE593814BC050A40A46A141DFC8E8A7D0CAF32A6B7022927421409EB2`；`latest.yml` `0E3C55ABBB2AA9A7B0B31B338A2F6035E1A3CEB8B06E1BDF1BA8EBE76488F375`；SHA256 清单 `812AB2BC782AC0F0273DB06FA199FF13F0E79B903D14396B944FB1EA53569222`。
- `latest.yml` 的 Setup SHA512：`BqjdfI8LxlaJ47uU0euyibyqveMjN5Xlf7LF0cQcZ4EIo58Akukg4nVn8KXA0FiPv8ZTWapPXO2CITBSmWhxfw==`。

## v1.3.10 搜索排序与特别喜欢歌单

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.10`。
- 本地搜索范围收紧为歌名、歌手和音频文件名，并按歌名、歌手、文件名的优先级稳定排序，专辑名不再参与匹配。
- 新增持久化的“特别喜欢”本地歌单，搜索结果、播放队列、本地曲库和主播放控制栏均可添加或移除；保存轻量引用并按本地路径回退恢复。
- 选择“特别喜欢”后，点击歌曲或“播放全部”会将播放队列替换为该歌单歌曲，上一首和下一首只在其中导航。
- 本地模式恢复歌单标签、歌单面板和红心按钮，修复特别喜欢播放按钮的事件委托；重新导入曲库时安全返回全部音乐视图。
- 全量 Node 回归 `256/256`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 发布继续只生成安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.3.10-Setup.exe` `103345037` 字节；`Mineradio-1.3.10-Setup.exe.blockmap` `110396` 字节；`latest.yml` `350` 字节；`Mineradio-1.3.10-SHA256SUMS.txt` `272` 字节。
- SHA256：安装器 `F767367E9687054F4F144A969F000A4A1CEFAB5CFF68640879A7EEA6DCE69AEA`；blockmap `D90D0AC1442E791B0A890C776A7E46B65F12D723CA774347B871A1BDFE83CE60`；`latest.yml` `F4D9BAA8B16FAA167A4774D098B226046B3181B82EEC5E503BB783140E4E31AA`；SHA256 清单 `DE344DE18C78B4EC80E8C89031D705B017BA5E558273DF69FD1886F4BC5D5787`。
- `latest.yml` 的 Setup SHA512：`yMLzhZLwIUM38dikrKNmWCqe3wnp7qAS98ONnwt2nrQaM+CiqvUEe2GQQ1aYyIIzCAQbYPrb0eDexuECBnQ/Hg==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.10` 已标记 Latest；`main` 提交 `8be60c5b3834b51bfc747690430358bcf43c6bc9`，annotated tag 对象 `ca6164b3bf90bd8bc7c423aac3354ddd46890613`；Verify run `31366148876` 成功，远端四个资产大小与 SHA256 均和本地一致。

## v1.3.9 主渲染缓存回收与帧调度热路径优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.9`。
- 运行时缓存回收只在 `sampleRenderPerf()` 的一秒级采样边界检查，保留活动态 `45` 秒、后台 `7000/3600` 毫秒的原有回收门槛，减少稳定帧中的重复判断。
- `animate()` 复用本帧 `performance.now()` 和 `getAdaptiveRenderFps(now)` 结果，并传给下一次调度与节流判断；事件入口省略参数时保留原有回退读取。
- 更新主渲染热路径测试对可选 FPS 参数的契约；不改变播放器布局、视觉、播放、歌词、桌面覆盖层或用户设置。
- 全量 Node 回归 `250/250`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过；Windows x64 NSIS 构建通过。
- 发布资产：`Mineradio-1.3.9-Setup.exe` `103342529` 字节；`Mineradio-1.3.9-Setup.exe.blockmap` `110415` 字节；`latest.yml` `347` 字节；`Mineradio-1.3.9-SHA256SUMS.txt` `270` 字节；不生成 Portable ZIP。
- SHA256：安装器 `8ED04BCB4F0590D74E40A92B09C8F3046C1B4A03259C348F291AA4F7C3059198`；blockmap `4D19A18933596ADFA1C9475BC65A4056DE95A6A44303AD8C675A9061F7CEED6B`；`latest.yml` `AC33E2C59F7557F8111265CCE48693CFEF7F5152D27D7EC8F629E8191526DAA0`；SHA256 清单 `1B1CEBB6369C007A95861F3F0912C18C6C52C066C96EA105230B3360C79CCD3A`。
- `latest.yml` 的 Setup SHA512：`9YHcwTyQ32Unw18bbnAB6P5Rhv+pUONNp52Rggv2QwvhTeJizGrlKsACrpSzUDqwSIji7fBAUIgMW0e/+AQsNw==`。

## v1.3.8 主循环状态快照与时间戳复用

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.8`。
- 主循环将同一帧时间戳传给自由镜头、手势活跃度衰减、歌单架更新、Home 空库波形和空闲引导；省略参数时保留原有时钟回退语义。
- `refreshShelfRenderFrameState()` 就地复用歌单状态快照，在主渲染链路中只读取一次 `getMode()`、`hasOpenContent()` 和侧栏模式下的 `shelfAlwaysVisible()`，并传给歌单架、壁纸压暗、Skull 相机、Skull 粒子和舞台歌词。
- 新增 `tests/frame-hot-path.test.js` 的快照 getter 复用断言；不改变播放器布局、视觉、播放、歌词、桌面覆盖层或用户设置。
- 全量 Node 回归 `248/248`；`public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查和 `git diff --check` 通过；Windows x64 NSIS 构建通过。
- 发布资产：`Mineradio-1.3.8-Setup.exe` `103342250` 字节；`Mineradio-1.3.8-Setup.exe.blockmap` `110214` 字节；`latest.yml` `347` 字节；`Mineradio-1.3.8-SHA256SUMS.txt` `270` 字节；不生成 Portable ZIP。
- SHA256：安装器 `0F1B395B4A50A1148796C9CE04B7DBCDB65AD61EC2045F658B6C1537CB55F58E`；blockmap `F4A1BD6003760CC4110B3050EA7063239B696BBBCA45AD883B0F22EFB0CA7FD0`；`latest.yml` `2CD0423032E81EB013A8A89217B7374B353881E81E0F3BBA190AAE1AEA3984EF`；SHA256 清单 `01CC8B9E8EBA59744336EF1E31EFEDDBD352E8E468DA3168ED6FEEC9FE08615E`。
- `latest.yml` 的 Setup SHA512：`5OjxMFAw/xK4D4hukU7+IbOhpnk6+W68nzHcW4Nr+pZBMK23K+dLpR7b2we6/6pC+yz5y3I/1NQn3T9hSEouKg==`。

## v1.3.7 主渲染帧时间戳与歌词歌单状态复用

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.7`。
- 主循环将同一帧时间戳传给歌单架 hover 提示、Home 空库波形和空闲引导；省略参数时保留原有 `performance.now()` 回退语义。
- `updateStageLyrics3D()` 每帧只读取一次歌单模式、详情状态和常驻状态，避免重复调用 `getMode()`、`hasOpenContent()` 与 `shelfAlwaysVisible()`；布局、相机、歌词光晕和详情偏移语义保持不变。
- 新增/扩展 `tests/frame-hot-path.test.js`、`tests/home-wave-hot-path.test.js`、`tests/audio-analysis-hot-path.test.js` 的时间戳和状态快照断言；全量 Node 回归 `247/247` 通过。
- `public/app.js`、`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查、`git diff --check` 和 Windows x64 NSIS 构建通过。
- 发布资产：`Mineradio-1.3.7-Setup.exe` `103424395` 字节；`Mineradio-1.3.7-Setup.exe.blockmap` `110266` 字节；`latest.yml` `347` 字节；`Mineradio-1.3.7-SHA256SUMS.txt` `270` 字节；不生成 Portable ZIP。
- SHA256：安装器 `1E90B84AA7C73F33372C1760559CC0E7D1E4B4943156F865F468491EE7D27A9A`；blockmap `555EAFDA125DAD424A9C5A05A8CBC5B284A9D7C128ABA8618EA9FA96444D9FFC`；`latest.yml` `F57EE42E7D02E43B13B1C2CB4535503D850B1708761055D4317D4980295F9784`；SHA256 清单 `117604E08965651FD7283C893D6D274500D2000AFDCB62C8F8B9F50761B107D5`。
- `latest.yml` 的 Setup SHA512：`ddJSeGhFY9oR/NPz9j8aq49itWT4upH3nk3GQ0Yxh05nGlDC9s5OkhNl6PF0YpNOnNjDTvmbKRhxwMt1rf18qQ==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.7` 已标记 Latest；`main` 提交 `b677f6159c5d65bcde84b7a862fe60afce03f600`，annotated tag 对象 `a67c4ce6a27b7e27a02f3ebd7b1013513d2162d6`；远端四个资产大小与 SHA256 均和本地一致。

## v1.3.6 3D 歌单详情绘制快路径复用

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.6`。
- 详情页每次同步可见歌曲行时只读取一次歌单架外观设置，并将同一帧快照传给面板、可见行和中心行重绘；异步封面回调、主题刷新等非帧入口保留按需读取。
- 面板与详情行绘制复用当前帧强调色和背景透明度，减少滚动、加载动画和主题刷新期间的重复偏好归一化与颜色解析。
- 新增帧快照复用回归断言，并更新可见行热路径测试对新函数签名的定位；不改变播放器布局、视觉、播放、歌词、桌面覆盖层或用户设置。
- 全量 Node 回归、主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过后构建 Windows x64 NSIS 安装器。
- 发布资产：`Mineradio-1.3.6-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.3.6-SHA256SUMS.txt`；不生成 Portable ZIP。
- 安装器 `103424549` 字节；blockmap `110427` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `4ED229AAC3B84FBDEC0E718D758CE6D827555EBE57364380ED9CD83C90D1B3B3`；blockmap `EE81E37985159BE9A47B75498C65CA2ACEB2FE2F779F45F4EB80F3F45A14CC66`；`latest.yml` `341C54F5BC5284AD4E10A932ACEE155C78C3FEDFAB317419E831BABD71ED851B`。
- `latest.yml` 的 Setup SHA512：`HabqEJ8tw9KmCoSDHMKl9DdcSjjnU8shRWEyeLYIsD8lyp2w6RZkuTS72MjuBKGoAPhZ6JivNDbPTKfMkQqypg==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.6` 已标记 Latest；`main` 提交 `2482ab84d8164d1e0930d55dd6ad3b3c563218a4`，annotated tag 对象 `f963238be92012e6a152b637abfcc38bacc477f0`；远端四个资产大小与本地一致。

## v1.3.5 3D 歌单详情属性低写入优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.5`。
- 3D 歌单详情可见行的位置、缩放、旋转、可见性、渲染顺序和材质透明度通过稳定值缓存写入；详情组的位置、缩放、普通欧拉姿态和面板透明度同样跳过相同目标值的重复 setter。
- 相机四元数姿态分支会使详情组欧拉缓存失效，切回普通姿态时重新提交当前目标；不改变详情布局、动画、播放或交互语义。
- 新增 `tests/frame-hot-path.test.js` 详情行与详情组属性写入回归；全量 Node 回归 `245/245` 通过，主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过后构建 Windows x64 NSIS 安装器。
- 发布资产：`Mineradio-1.3.5-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.3.5-SHA256SUMS.txt`；不生成 Portable ZIP。
- 安装器 `103424049` 字节；blockmap `110328` 字节；`latest.yml` `347` 字节。
- SHA256：安装器 `A9B2692AEF19B32CD73F6C01A8FCB1CC6F86E5FAE21BB95B1EA53F177330D835`；blockmap `C76E185C1B79631527DF0409BF94A1DF8C179368E23FABC1CF86E3B0C01CDE20`；`latest.yml` `5C5F58B7AF3E1F56638F98F12CC6202EDA420FDA467534AFD62A67BDE9D7A397`。
- `latest.yml` 的 Setup SHA512：`oBrjDL6+7ndLTObzG7hFQqDoL4drZRQXNFcXITfxSgaHC3yuwVKP2WekX4HVZn5BlSmBZvXu24lkDyE0XHDI2g==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.5` 已标记 Latest；`main` 提交 `e4d9248df94c53b2245e87fbc17d148cb3781bbb`，annotated tag 对象 `1822e1f51b3329cdf31f8b7a693c47bb151841c2`；Verify run `31314090176`、`31314089225` 成功。

## v1.3.4 3D 歌单架卡片属性低写入优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.4`。
- 3D 歌单架卡片的位置、缩放、旋转、相机姿态、可见性、渲染顺序、材质颜色和透明度通过卡片级稳定值缓存写入；相同目标值不重复触发 Three.js setter，动画目标仍按帧计算。
- 普通欧拉姿态未显式传入 `z` 时保留当前 `rotation.z`，避免从 Skull 相机四元数姿态切回普通姿态时改变滚转。
- 新增 `tests/frame-hot-path.test.js` 歌单架卡片属性写入缓存回归；不改变 UI、视觉、播放、歌词、桌面覆盖层或用户设置。
- 全量 Node 回归 `243/243` 通过；主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过后构建 Windows x64 NSIS 安装器。
- 发布资产：`Mineradio-1.3.4-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.3.4-SHA256SUMS.txt`；不生成 Portable ZIP。
- 安装器 `103341011` 字节；blockmap `110354` 字节；`latest.yml` `347` 字节。
- SHA256：安装器 `D850FAADCCC7622224BAE1F992F0C167EEB924980770DABDB9B4EA60BD877B0C`；blockmap `F3C333AF42B69E4AC1AEFE8C8AE5077FCC1C6D3D907AD52867F22504032C4EFA`；`latest.yml` `8B1A212FC671E6325167717A7AF787911AFD56F8E6971D1C1C41BAEC9B7A48C1`。
- `latest.yml` 的 Setup SHA512：`f9sdiF/SyMUpWnzGSWrXqDooniuXbYhs4ns+cjzeIzUHLyz7hrCiS+XQQM5l0AlIZvL0E3t5NUYgaL8IMEdVlw==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.4` 已标记 Latest；tag 指向提交 `1f8304672e9cdc44c595f9237b3e9dd1bd859b75`，`main` Verify run `31311580320` 成功；远端四个资产大小与 SHA256 均和本地一致。

## v1.3.3 相机与交互热路径低分配优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.3`。
- 普通相机姿态使用位置、观察点和节拍滚转缓存；稳定帧跳过重复 `position.set()`、`lookAt()` 和滚转重建，自由镜头与 Skull 覆盖相机切换时显式失效缓存。
- 歌单架 hover 检测复用固定指针 scratch，涟漪九宫格去重使用整数位掩码，减少稳定播放和交互期间的短命对象。
- 新增 `tests/camera-pose-hot-path.test.js` 和 `tests/ripple-hot-path.test.js`；不改变 UI、视觉、播放、歌词、桌面覆盖层或用户设置。
- 全量 Node 回归、主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过后构建 Windows x64 NSIS 安装器。
- 发布资产：`Mineradio-1.3.3-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.3.3-SHA256SUMS.txt`；不生成 Portable ZIP。
- 全量 Node 回归 `242/242` 通过；安装器 `103339186` 字节，blockmap `110304` 字节，`latest.yml` `347` 字节。
- SHA256：安装器 `6683a8ac07fa2df8bb07b142850480490d9f6d7543267fa1627c94aec044eda9`；blockmap `cc90ceb7bf47df24cad01b7fbc1187fbb682f98d9e8e9822af7f4785f528970e`；`latest.yml` `2a3bd7d21e5d7f0c6c0cf3459831667f0046fa214ead8087efb079862e2b31eb`。
- `latest.yml` 的 Setup SHA512：`AkIwLl87y1+kt4yNLC6/mmKMpJzBf1lyMXx1d0UoyDediFbPal5zdX1tAly98IX2CdKFdeXVUPnc+CK6AVL68g==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.3` 已标记 Latest；annotated tag 解引用到提交 `30d41a141c98e81da7c438ef4efb4a49516502ac`，远端四个资产大小与 SHA256 均和本地一致；`codex/release-v1.2.87` Verify run `31308926719`、`main` Verify run `31309010672` 成功。

## v1.3.2 主渲染器与壁纸覆盖层低占用优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.2`。
- 可见空闲态的主渲染器按 30 FPS 定时唤醒，播放或交互开始时立即切回 RAF，避免高刷新率屏幕上的无效 RAF 回调。
- 壁纸覆盖层播放时使用 RAF，未播放限为 30 FPS，关闭时使用 1 秒低频调度，并释放封面图引用和粒子数组。
- 状态切换与可见性恢复会取消旧调度句柄，避免 RAF 和定时器并存。
- 新增 `tests/render-scheduler-hot-path.test.js`，扩展 `tests/runtime-resource-release.test.js`；保留 UI、视觉、播放、歌词和桌面覆盖层交互语义。
- 全量 Node 回归、主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过后构建 Windows x64 NSIS 安装器。
- 发布资产：`Mineradio-1.3.2-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.3.2-SHA256SUMS.txt`；不生成 Portable ZIP。
- 全量 Node 回归 `239/239` 通过；安装器 `103340590` 字节，blockmap `110189` 字节，`latest.yml` `347` 字节。
- SHA256：安装器 `23a91ceb5496e6f9c990fa7c480a6ed56ab5305b26177cdcd017d21c5b2d9114`；blockmap `c24ce02afc9bb275ef8a26fb105941bade65aa596215765e9af01e719aabde62`；`latest.yml` `dd15632d9cdb6f9b8f47f506baa318693ae3095ce307da96c3dbb5153c4490a0`。
- `latest.yml` 的 Setup SHA512：`6RyYxzZihi49UmI8DN0AgJxclrtiBY6mn+pstYkn01zL8263LSixwnDQSKyPAz04NsEwSSKSjwO+bbX9t5w6/w==`。

## v1.3.0 固定乱序播放队列

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.0`。
- 进入随机播放模式时对整个 `playQueue` 执行一次 Fisher-Yates 洗牌；自动播完、手动上一首和手动下一首都只沿这份固定乱序前后移动并首尾循环，不再逐次随机索引。
- 洗牌前捕获当前歌曲对象，重排后重新定位 `currentIdx`，保证切换播放模式和手动随机队列时当前声音、进度与歌曲都不跳。
- 随机模式恢复上次会话时先定位恢复歌曲再洗牌，并同步修正待恢复进度使用的新索引；随机模式换入新数组队列时在首次播放前只洗牌一次。
- 使用 `WeakSet` 记录已洗牌数组身份，旧队列被替换后可直接回收；移除 v1.2.100 的 96 条播放历史 ID/key 数组和歌曲 `WeakMap`，不再维护额外导航状态。
- 主界面按钮、方向键、全局快捷键、系统 Media Session、迷你播放器和桌面歌词均复用顺序前后导航，不需要额外状态同步。
- 用 `tests/playback-shuffle-order.test.js` 替换播放历史测试，覆盖单次整队洗牌、当前歌曲保持、固定乱序往返、手动洗牌、新队列首次洗牌、会话恢复和弱引用所有权。
- Windows 构建继续只生成 x64 NSIS、blockmap 和 `latest.yml`，不生成 Portable ZIP。
- 本版本不改动播放器 UI、视觉质感、歌词、桌面覆盖层、音质或用户设置。
- 全量 Node 回归 `224/224`、四个关键 JavaScript 语法检查和 `git diff --check` 通过；验证与构建没有启动 Mineradio GUI。
- 打包后 `app.asar` 已确认包含 `APP_VERSION = '1.3.0'`、Fisher-Yates 单次洗牌、当前歌曲保持、`WeakSet` 队列身份、固定乱序前后循环，且旧播放历史实现已经移除。
- 产物大小：安装器 `103336921` 字节；blockmap `110180` 字节；`latest.yml` `347` 字节。
- SHA256：安装器 `840753c5fc4647389907f8b15ac0463bb0ea1e095db5d92c8460a1caecf1a2d3`；blockmap `3fa5ef65c5519b91a62bf624cbe40df97accaf794f91accb15fbc24f1b38122b`；`latest.yml` `248ad71583c4819a03fc63599aa16a8d7962b128f8e31a8b832391f0dea4ebc8`。
- `latest.yml` 的 Setup SHA512：`WdhKIPd4mNuZf7FdlR3yzzElVUkMqWnpuLjFanCngcduGDom5rm0ZiDtfbIibL8i/qgO2rqs3Z5JvjCPidi9uA==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.0`，已标记 Latest，且不是 draft 或 prerelease；tag 指向功能提交 `b9be5a1e45298904f4301157300dca5de410d3c5`。
- 正式远端资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，没有 Portable ZIP；GitHub 返回的四个资产大小与 SHA256 均和本地一致。
- `main` CI run `31250009229` 成功，全量测试、语法和发布门禁均通过。

## v1.3.1 CPU 与运行内存优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.3.1`。
- 可见但未播放且没有交互时，主 3D 渲染降至 30 FPS；播放、交互、后台和帧压力状态保持原有调度语义。
- 3D 歌单架在启动页或完全隐藏时跳过卡片位置、旋转、透明度和详情更新。
- 主实时频谱四段累加改为单次 TypedArray 扫描；独立节拍频谱按 30 FPS 刷新并复用五个频段标量，保持音频分析结果不变。
- 本地资产后台预载改用数字排序键，减少大曲库导入期间的临时对象和 GC 压力。
- IndexedDB 清理改为串行游标扫描与逐条删除，降低长期缓存维护时的运行内存峰值。
- 歌词特效关闭、暂停镜头无残留冲击时直接跳过无效帧工作；歌词镜头边界计算移除每帧临时闭包。
- `build/installer.nsh` 从原始 Windows 命令行读取 `/D=`，保留专用安装目录归一化、`.mineradio-install-root` 标记和卸载安全门禁。
- 全量 Node 回归 `237/237`、主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过。
- 产物大小：安装器 `103337852` 字节；blockmap `110078` 字节；`latest.yml` `347` 字节；SHA256 清单 `273` 字节。
- SHA256：安装器 `d7be6b7cc50bc8db7c45a915c0cbe759cac18b5025d8087ee29ad07d44e0ee43`；blockmap `2e64d7e430b514626bf64c6e272472dda28380ab5f513329e0f2f5e24fa95e9e`；`latest.yml` `e7479f08f9e5abf78d2d1e6cc64c42036d8b7d2d9c254756c6ac72125a286a48`；SHA256 清单 `aab32ee89249681a646efcf974f863a8d2c730611f828721ca7ff1247c82cfbe`。
- `latest.yml` 的 Setup SHA512：`N5ya4x+cji9kNxJMjSZIdbzT7tAd3xYPwcKkYYzVDVX2OLFwz0fEK42uMBwk/ZDXuSoz/FQcGM0+yEtI+AQi/g==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.3.1`，正式资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，不生成 Portable ZIP。

## v1.2.100 随机播放历史导航修复

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.100`。
- 根因修复：旧随机模式只为“下一首”随机改写 `currentIdx`，“上一首”仍用队列索引减一，无法知道用户实际刚听过哪首；现在由成功播放事件提交真实导航历史。
- 随机模式“上一首”沿历史后退，“下一首”优先沿历史前进，历史末尾才生成新的随机目标；新随机目标会排除当前歌曲。
- 历史上限为 96 条，仅保存数字 ID 和轻量歌曲键；对象身份放在 `WeakMap`，不会因为导航历史长期强引用歌词、封面或完整歌曲对象。队列清空时完整释放历史。
- 队列重排后按对象身份恢复，歌曲对象被曲库刷新替换后按歌曲键回退；被删除的历史项会安全跳过。
- 主界面按钮、方向键、全局快捷键、系统 Media Session、迷你播放器和桌面歌词均复用 `prevTrack()` / `nextTrack()`，不需要各自维护重复状态。
- 新增 `tests/playback-navigation-history.test.js`，覆盖随机前进/后退、历史前进、队列重排/克隆、空历史、固定内存上限和清空释放。
- Windows 构建继续只生成 x64 NSIS、blockmap 和 `latest.yml`，不生成 Portable ZIP。
- 本版本不改动播放器 UI、视觉质感、歌词、桌面覆盖层、音质或用户设置。
- 全量 Node 回归 `224/224`、四个关键 JavaScript 语法检查和 `git diff --check` 通过；验证与构建没有启动 Mineradio GUI。
- 打包后 `app.asar` 已确认包含 `APP_VERSION = '1.2.100'`、96 条轻量历史上限、`WeakMap` 对象身份、真实上一首导航和随机下一首排除当前歌曲。
- 产物大小：安装器 `103337026` 字节；blockmap `110384` 字节；`latest.yml` `353` 字节。
- SHA256：安装器 `e9032c3989b89fc39033a7d25077f560a06f66836bf15a81f306e3891c9c0c83`；blockmap `8ee6bc6def143b1d0c66634593d862970ebdc9cf69cf96605051464dccf3c29e`；`latest.yml` `a16d604b422c6099455886d1db2e184a5a934ae98e6095933d337783a6099098`。
- `latest.yml` 的 Setup SHA512：`TmHrklIWFhLKctQbP/DHbLvMiVTVQ2vfn+SXtznuH3pRcm38k4NTwxY5TbF3kSzBH8VnZm01uYQQljo16fAvvA==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.100`，已标记 Latest，且不是 draft 或 prerelease；tag 指向修复提交 `e47539352806bb1af4e5f13494d9604ece563c60`。
- 正式远端资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，没有 Portable ZIP；GitHub 返回的四个资产大小与 SHA256 均和本地一致。
- `main` CI run `31249331807` 成功，全量测试、语法和发布门禁均通过。

## v1.2.99 更新动画与下载轮询状态租约

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.99`。
- 更新入口的 GSAP 呼吸动画改为状态租约：仅在入口可见、确有更新且窗口前台时运行；无更新、入口隐藏、窗口最小化或后台时取消两条无限 tween 并清空延迟启动定时器。
- 完整安装包与快速补丁的状态轮询改为自适应节奏：面板打开保持 360ms / 320ms，面板关闭降到 1.5 秒，窗口后台降到 5 秒；面板重新打开会立即排入一次刷新，服务端下载任务继续运行。
- 预览进度 `setInterval` 在面板关闭或窗口后台时取消并置空句柄，避免隐藏界面继续做随机进度计算与 DOM 更新。
- 新增 `tests/update-runtime-lifecycle.test.js`，并扩展 `tests/update-poll-single-flight.test.js` 覆盖动画释放、预览定时器释放、轮询降频和单飞重排。
- Windows 构建继续只生成 x64 NSIS、blockmap 和 `latest.yml`，不生成 Portable ZIP。
- 本版本不改动播放器 UI、视觉质感、播放控制、歌词内容、桌面覆盖层或用户设置。
- 全量 Node 回归 `218/218`、四个关键 JavaScript 语法检查和 `git diff --check` 通过；整个验证与构建过程未启动 Mineradio GUI。
- 打包后 `app.asar` 已确认包含 `APP_VERSION = '1.2.99'`、更新入口动画租约、1.5/5 秒自适应轮询与预览定时器释放。
- 产物大小：安装器 `103336027` 字节；blockmap `110284` 字节；`latest.yml` `350` 字节。
- SHA256：安装器 `e3207c1f82f995a47d2cd786848ba705c453ea6cf7e1db4fd58410e2e2279b1f`；blockmap `64fb90cd5e7255da964ca1b10077be1b290803420c8491f789ff681feb17c56c`；`latest.yml` `7463ddabfafec811c7ccaf9b3637994c71cad96ea3cc68cede098db5f46dc359`。
- `latest.yml` 的 Setup SHA512：`DHUhn7WkPgKiKOeO6i6mymQIbTKpd8nrwsPhfWsIQ1Ea5JMz8xsIYlhNpKmW6sOdh6wZguh7K9/P0D2LyqjweA==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.99`，已标记 Latest，且不是 draft 或 prerelease；tag 指向性能提交 `c3a5bb9ed38653983fc75c6f19d851fefe7f0fc4`。
- 正式远端资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，没有 Portable ZIP；GitHub 返回的四个资产大小与 SHA256 均和本地一致。
- `main` CI run `31246505555` 成功，全量测试、语法和发布门禁均通过。

## v1.2.98 空闲 Canvas 与提示音资源按需释放

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.98`。
- `IDLE_GUIDE_BACKGROUND_ENABLED=false` 时，`initIdleGuideCanvas()` 只保留 DOM 引用并把 backing store 设为 `1 × 1`，不再取得全屏 2D context、不绑定 resize、不启动 140ms 轮询。
- 视觉引导进入歌单架步骤时由 `ensureIdleGuideCanvasActive()` 按需恢复；完全淡出后由 `releaseIdleGuideCanvasResources()` 取消 RAF/定时器/监听、清空粒子和轨迹并释放全屏 backing store。
- 歌单架选择提示音在空闲 5 秒后通过 `releaseUiSfxContext()` 关闭独立 AudioContext，同时释放该 context 的 6 个 noise buffer；定时器使用 context 所有权校验，不会关闭替代实例。
- Windows 构建继续只生成 x64 NSIS、blockmap 和 `latest.yml`，不生成 Portable ZIP。
- 本版本不改动播放器 UI、视觉质感、播放控制、歌词内容或用户设置。
- 新增 `tests/idle-runtime-resource-release.test.js`；全量 Node 回归 `213/213`、关键 JavaScript 语法和 `git diff --check` 通过。
- 真 Electron 独立实例验证：默认空场 Canvas 为 `1 × 1`、仅 `4` 字节颜色 backing store，context/resize/RAF/140ms timer 均未创建；视觉引导激活时恢复到 `1440 × 810`，释放后重新回到 `1 × 1`，粒子、轨迹、监听与调度全部归零。UI SFX 实例的 6 个 noise buffer 与 AudioContext 均可按所有权释放。
- 打包后 `app.asar` 已确认包含空场 Canvas 租约、UI SFX 空闲释放与 `APP_VERSION = '1.2.98'`；测试用独立 Mineradio/Electron 进程已全部关闭，没有残留后台进程。
- 产物大小：安装器 `103335796` 字节；blockmap `110374` 字节；`latest.yml` `350` 字节。
- SHA256：安装器 `30f2c43a7c008ce737b32ff0c7999976f69322bbed8ce981852c7f222639cc43`；blockmap `b4e5cd46f1fdbdbd6f1e9fd61ee70b2453ce2518c78229669fcb3cf46355c037`；`latest.yml` `50a13a8fc749c9177ab4087abeb3a40b31c2e53c65f714ba2d24e2fbf2f9fb5d`。
- `latest.yml` 的 Setup SHA512：`u8TfOml0W8pXEefkVinRhsA8V1X2Qqpw5H33oAdlPWrGOUqx1Sje0z3k9+rc+doSxv+i19Z0/QSa0Bg6uToNjA==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.98`，已标记 Latest，且不是 draft 或 prerelease；tag 指向性能提交 `24fb38b3ba2d51887b0b86e7b43fb5c6893d9d88`。
- 正式远端资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，没有 Portable ZIP；四个资产的大小与 SHA256 均与本地产物一致。
- `main` CI run `31245966288` 成功，全量测试、语法和发布门禁均通过。

## v1.2.97 CPU 与运行内存释放优化重发

- 保持 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.97`，覆盖重发同版本安装包。
- 启动页退出后调用 `releaseMineradioSplashResources()`：移除 resize 监听，删除 WebGL buffer/program，主动释放 context，把隐藏 Canvas 缩到 `1 × 1`，并清空启动粒子数组。
- 启动音效最后一个节点结束后关闭独立 `splashAudioCtx`，释放音频线程、节点图和约 2.45 秒 Float32 噪声缓冲。
- 主 3D 渲染改为 `scheduleMainRenderFrame()` 单入口；深后台由 `suspendMainRenderLoop()` 取消 RAF，恢复可见时由 `resumeMainRenderLoop()` 重置时间并继续。播放 tick、桌面歌词和壁纸独立调度保持不变。
- Windows 构建仍只生成 x64 NSIS、blockmap 和 `latest.yml`，不生成 Portable ZIP。
- 本版本不改动播放器 UI、视觉质感、播放控制、歌词内容或用户设置。
- 新增 `tests/runtime-resource-release.test.js`，使用假 WebGL/RAF 环境执行释放、暂停和恢复函数；全量 Node 回归 `209/209`、关键 JavaScript 语法与 `git diff --check` 通过。
- 真 Electron 独立实例验证：启动页 Canvas 为 `1440 × 810`，单颜色 backing store 至少 `4665600` 字节；退出后 Canvas、WebGL、三组粒子数组和 resize 监听全部释放。模拟最小化后 `mainRenderFrameId=0` 且模式为 `suspended`，恢复后只排入一个新 RAF。
- 打包后 `app.asar` 已确认包含 `releaseMineradioSplashResources()`、主 RAF 暂停/恢复、`AudioContext.close()` 与 `APP_VERSION = '1.2.97'`；`dist` 中不存在 `1.2.97` Portable ZIP。
- 产物大小：安装器 `103335120` 字节；blockmap `110106` 字节；`latest.yml` `350` 字节。
- SHA256：安装器 `c44f99cb848a2f88717bee3000548c37a75940365a7a9c6fd31ed454abf66ce6`；blockmap `a4112bbd942ba9179eaa58a9379a5c5f6e83e7fca484573362fe7882a2e1a432`；`latest.yml` `028bafb3d4238582b5de7e27487d79f1a39c32466a3c08579fc0dba2bd96f8fd`。
- `latest.yml` 的 Setup SHA512：`vpNzpddzCaOqmn+qs9QZe0oKM9DGF0rAw7LYEJoII0eV3JXgfUg98cw3v9GGyeJZsaF6sv+nTvJL/iXX5b+Pug==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.97`，已重新创建并标记 Latest，且不是 draft 或 prerelease；tag 指向性能提交 `f741ffbe8dc981314e452cec7cc2ea144aa908a1`。
- 正式远端资产仅包含安装器、blockmap、`latest.yml` 和 SHA256 清单，没有 Portable ZIP；四个资产的大小与 SHA256 均与本地重发产物一致。
- `main` CI run `31244923752` 成功，全量测试、语法和发布门禁均通过。

## v1.2.96 迷你播放器桌面歌词按钮细化版

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.96`。
- 桌面歌词按钮移到标准、极简迷你播放器右下角，缩小为无边框“词”字按钮。
- 去掉复杂显示器图标和额外控制栏占位，开启时只保留青色文字状态反馈。
- 保留桌面歌词显示/关闭命令、主界面状态同步、播放控制和桌面歌词位置持久化。
- 全量 Node 回归 `205/205`、关键 JavaScript 语法、`git diff --check` 和打包后 `app.asar` 内容核对通过。
- 发布资产：`Mineradio-1.2.96-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 SHA256 清单；Portable ZIP 仅本地生成，不上传远端。
- 产物大小：安装器 `103336754` 字节；blockmap `110281` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144919087` 字节。
- SHA256：安装器 `61462725d6ea9943e29a312e7bfb126a76322ea6eb84ed7811349003b7ed66d2`；blockmap `ad872219afd74a6aba1008592afb261df5bba5b25885269e531b2cc653411a68`；`latest.yml` `cc12f7ded562d7f0606a80e35f589b1b9136703771166fa1e76ddfeff05b54d6`；本地 Portable ZIP `51e958c70b500bc338d0df22f8279993765b7cd74cfb2bbd1ea73bdf4004f5e5`。
- `latest.yml` 的 Setup SHA512：`g1qBP2gvRNA5y6Rdl7lAHUdLUdcg472NyWtLl6mJsBk2lr8lppgO2crf3EuHH8I8rh25niasflBqMbJUdWWkCw==`。
- 正式远端资产仅上传安装器、blockmap、`latest.yml` 和 SHA256 清单，未上传 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.96`，已标记 Latest，且不是 draft 或 prerelease；tag 目标为 `main`。
- 远端资产回读：安装器、blockmap、`latest.yml` 和 SHA256 清单均已上传，大小与本地一致；前三项 SHA256 与本地一致。
- `main` CI run `31156936180` 成功，提交为 `1e4699d047e0b0703a6608738a4c2ce242438327`。

## v1.2.95 迷你播放器桌面歌词开关版

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.95`。
- 标准迷你播放器与极简迷你播放器各增加一个独立桌面歌词按钮，点击即可显示/关闭桌面歌词。
- 按钮状态由主 renderer 的 `fx.desktopLyrics` 同步，复用既有开关、保存和窗口生命周期逻辑。
- 保留原有上一首、播放/暂停、下一首、返回主界面、桌面歌词位置持久化和控制栏布局。
- 全量 Node 回归 `205/205`、关键 JavaScript 语法、`git diff --check` 和打包后 `app.asar` 内容核对通过。
- 发布资产：`Mineradio-1.2.95-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 SHA256 清单；Portable ZIP 只保留本地。
- 产物大小：安装器 `103334394` 字节；blockmap `110314` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144919265` 字节。
- SHA256：安装器 `b0888f0ded838bc6ee0c3ef088e31e6c9efb992a8d306454eb75f282b7fcf4cb`；blockmap `dc622dd7d32580d1e47350297d1644775a2ae82bf14b983c75e593770bf69b93`；`latest.yml` `bee463f3695a4ef0a0101cecbf5dd7b0f502c6d6e1b6159543b28d57f0950b38`；本地 Portable ZIP `229f15c7488d2be261a616cdb67fc3934fbe1e7f59c086ed4a6443dcbd4a2a47`。
- `latest.yml` 的 Setup SHA512：`5PNSNRac4sXkZp1d8Kl5XToINJ95qdJiY4FbujX045wx6dXeJubkRyEKKOECTf+U474nj5ou8qq6umnyydCnBQ==`。
- 正式远端资产仅上传安装器、blockmap、`latest.yml` 和 SHA256 清单；Portable ZIP 只保留本地。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.95`，已标记 Latest，且不是 draft 或 prerelease；tag 目标为 `main`。
- 远端资产回读：四个 Release 资产大小与本地一致；Setup、blockmap、`latest.yml` 和 SHA256 清单重新回读的 SHA256 均与本地一致。
- `main` CI run `31154917795` 成功，提交为 `13bdf9bb5078f1388315e2536d82d8cde80b0af5`。

## v1.2.94 桌面歌词调节控件重排版

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.94`。
- 桌面歌词字号与光效调整改为两组独立设置胶囊，包含图标、标签、数值和加减键；去掉散落的圆形/方块按钮。
- 保留原有调节步进、锁定、播放控制、`×` 关闭、位置持久化和鼠标穿透语义。
- 发布资产：`Mineradio-1.2.94-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 SHA256 清单；Portable ZIP 只保留本地。
- 构建验证：全量 Node 回归 `204/204`、关键 JavaScript 语法、`git diff --check` 和打包后 `app.asar` 内容核对通过。
- 产物大小：安装器 `103333819` 字节；blockmap `110223` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144918530` 字节。
- SHA256：安装器 `9118b7b01ca145fa87a3276efe556768c0368292d0c62497e1201f0bf575f331`；blockmap `5c85a0eae90c28c56ac0b4e9ae446aab0b2a1e1f1870a9c8ffcd060b74587d7d`；`latest.yml` `51164bba294675bbd0ff519665c70a3e1ea5dbf6664cf1343f9148cc1a2ceed4`；本地 Portable ZIP `6bf136c29beeb27631de3a82f6fa0933c652a7cb68dc1781e526d3996af48132`。
- `latest.yml` 的 Setup SHA512：`JuK5un9KS0CoB1BjRmrqpntB/scEMSPhaQlwU2RcIOR1gbL0RfCqGBIl0zce6utCbnDYz8p1QvGhofgCCK9w9Q==`。
- 正式远端资产只上传安装器、blockmap、`latest.yml` 和 SHA256 清单；Portable ZIP 只保留本地。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.94`，已标记 Latest，且不是 draft 或 prerelease；tag 目标为 `main`。
- 远端资产回读：四个 Release 资产大小与本地一致；Setup、blockmap、`latest.yml` 和 SHA256 清单重新下载后的 SHA256 均与本地一致。
- `main` CI run `31152609456` 成功，提交为 `8917c2bb5e7e0574a369439f74ca14bd551feeea`。

## v1.2.93 桌面歌词调节按钮视觉优化版

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.93`。
- 重做桌面歌词字号、光效调节按钮：加入独立加减图标、细边框胶囊样式、百分比数值徽章和悬停/按下/禁用反馈。
- 保持原有调节步长、持久化、锁定逻辑、播放控制和桌面歌词布局不变。
- 定向桌面歌词回归和全部发布页面内联脚本解析通过；正式产物与远端回读信息在构建发布完成后补齐。

## v1.2.92 桌面歌词播放控制栏版

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.92`。
- 桌面歌词工具栏新增上一首、播放/暂停、下一首按钮；命令经过当前桌面歌词窗口 sender 校验后转发到主 renderer，复用既有 `togglePlay()`、`prevTrack()` 和 `nextTrack()`。
- 关闭桌面歌词按钮改为 `×` 符号，保持现有窗口关闭与状态持久化链路不变。
- 新增桌面歌词播放控制栏回归门禁，覆盖按钮、preload IPC channel、主进程命令白名单和播放状态图标切换。
- 全量 Node 回归 `204/204`、关键 JavaScript 语法、`git diff --check` 和打包后 `app.asar` 内容核对通过；`app.asar` 已确认包含三个控制按钮、`×` 关闭符号、播放 IPC 和 `APP_VERSION = 1.2.92`。
- 发布资产：`Mineradio-1.2.92-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.2.92-SHA256SUMS.txt`；Portable ZIP 只保留本地。
- 产物大小：安装器 `103334479` 字节；blockmap `110126` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144918411` 字节。
- SHA256：安装器 `25065fda977f8be87d2c99565301f16a6a08d22819db1995842e2d707d195eb9`；blockmap `de15e5ac66d3f07c31eeab0077955974ed7b6afc2cb8bb3adb55f5382cb44ac6`；`latest.yml` `c38b16bbb35bf074a76f72af55b9e47ff4bbe64af5f394f18a0d1bf20f077bb2`；本地 Portable ZIP `e6fc16d9b28ec80f15053c2fa94bc563f8825398b49b3029980cbb81f0e2f8de`。
- `latest.yml` 的 Setup SHA512：`Vymrn9UQiPUbnvIcpmTQD4FLi+tWuBKczqoYGqGInChb+d+m63uPS68X3s9MgQbT+US50aLKegP7P/pabK/GXw==`。
- Release 标题使用 `Mineradio v1.2.92 桌面歌词播放控制栏版`；正式远端资产仅上传安装器、blockmap、`latest.yml` 和 SHA256 清单。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.2.92`，已标记 Latest，且不是 draft 或 prerelease；tag 目标为 `main`。
- 远端资产回读验证：四个 Release 资产均已上传；安装器、blockmap 和 `latest.yml` 重新下载后的文件大小与 SHA256 均与本地构建产物一致；`main` CI run `31139738647` 成功。

## v1.2.91 桌面歌词手动位置持久化修复重发

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.91`。
- 现场确认运行版窗口实际位于 `y=-171`，但 `desktop-shell-settings.json` 被写成 `y=0`；根因是手动 bounds 在保存和恢复时复用了只允许完整位于屏幕内的夹紧逻辑。
- 保存、恢复和重新定位手动 bounds 时允许保留仍有可操作区域可见的部分越界坐标；完全不可达的位置或显示器变化仍安全回到当前屏幕。
- 保留纵向位置偏好清除旧手动 bounds 的修复；新增真实负坐标保存链路回归，全量 Node 回归 `202/202` 通过，关键 JavaScript 语法和 `git diff --check` 通过。
- 不改变桌面歌词 UI、布局、字号、透明度、光效、播放时钟、鼠标穿透或交互入口。
- Release 标题使用 `Mineradio v1.2.91 桌面歌词手动位置持久化修复重发版`，覆盖现有 GitHub Latest Release。
- 同版本客户端不会触发版本号升级提示；已经安装旧 `1.2.91` 的设备需要手动覆盖安装重发安装包。
- 构建验证：打包后的 `app.asar` 已确认包含版本 `1.2.91`、`desktopLyricsBoundsHasReachableArea()` 与手动 bounds 的 `allowPartial` 保存/恢复路径；安装器 `103334349` 字节，blockmap `110394` 字节，`latest.yml` `350` 字节，本地 Portable ZIP `144917458` 字节。
- SHA256：安装器 `61bc45e9b966acf426f0fabdcab201f1bc0893a61c8f7a85d068344d5ce62d9d`；blockmap `4d1a008ee6c301d7e3e5ce747fa39bb79209e269c8a645b1feafc1a5d1ad68f9`；`latest.yml` `a1f989ac17bbe839157a94d8423b63cd99ca7b5a85f802a0bee816bc787a41ed`；本地 Portable ZIP `8bc8a341f5c6cc134862fdb9bfb9328dd6ca637d219f1c451fa45d8c2e1f6ff8`。
- `latest.yml` 的 Setup SHA512：`BarG1GWE8LV8lDZIQhZMykqfJi/GNRM+9RkSvUyRvMe3xbtkDvNJFN6Fp6UxkVFOmGByG31fIOiK/kb9cHtZ2w==`。
- 安装器沿用现有 `signAndEditExecutable: false` 配置，`Get-AuthenticodeSignature` 返回 `NotSigned`。
- GitHub 重发验证：`main` CI run `30994715092` 成功；annotated tag `v1.2.91` 已强制更新并解引用到源码提交 `4294b856f7239d54c89c79adc88a6ae0b37fce77`；Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.91` 继续标记 Latest，且不是 draft 或 prerelease。
- 远端资产回读验证：现有四个 Release 资产均已覆盖；Setup、blockmap、`latest.yml` 和 SHA256 清单重新下载后的文件大小与 SHA256 均与本地重发产物完全一致，Release 正文不包含 Unicode replacement character。

## v1.2.90 更新介绍清洗与乱码防护

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.90`。
- GitHub Release 正文不再把“修复内容 / 验证 / 下载”等章节标题当作摘要或更新条目；验证、下载、安装和校验信息不会混入用户可见更新介绍。
- 更新介绍统一处理 Markdown 链接、图片、重复项、SHA 摘要、UTF-8 BOM 和常见 Latin-1 乱码；不可恢复的替换字符或控制字符会被丢弃并回退到安全文案。
- 自定义更新 manifest 的 `summary` / `notes` 与 GitHub Release 正文复用同一归一化链路。
- 新增 `tests/update-release-notes.test.js`；真实 `/api/update/latest` 已确认摘要取首条修复内容，全量 Node 回归 `200/200` 通过。
- 不改变更新面板布局、下载线路、快速补丁策略、安装器校验、UI、歌词、播放或视觉效果。
- Release 标题使用 `Mineradio v1.2.90 更新介绍清洗与乱码防护版`，目标为 GitHub Latest Release。
- 构建验证：关键 JavaScript 语法、`git diff --check`、全量 Node 回归 `200/200` 和打包后 `app.asar` 内容核对通过；安装器 `103332320` 字节，blockmap `110211` 字节，`latest.yml` `350` 字节，本地 Portable ZIP `144917024` 字节。
- SHA256：安装器 `761fae6bb44d05e1b363b21500dac24b7fd297df88071cfe454f6646b5fd02fc`；blockmap `3eebf96f1ff581faae08dcee59bba3f125cebb74dae073a759e49c8a45b72f86`；`latest.yml` `d3b66834134a6c8e3575d96bd03a6b30025cdd658bd06fbf39b79892635412e5`；本地 Portable ZIP `0fe0cac83b0fa80ab9cd93bbfeabd5beb4dff1347d8757fd0dda315e87f937e1`。
- `latest.yml` 的 Setup SHA512：`u6HQwjgFUsZG6I3TPp5IGxPqNeIw1yaFHUleIdYsbaSrXQ75J+dRMjDtOk20dAqSWupHyTN3L4onb57kuDVPGQ==`。
- 安装器沿用现有 `signAndEditExecutable: false` 配置，`Get-AuthenticodeSignature` 返回 `NotSigned`。
- GitHub 发布验证：`main` CI run `30972509285` 成功；annotated tag `v1.2.90` 解引用到源码提交 `c38a46ea1284bb5075652eb332889cd12cea17e1`；Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.90` 已标记 Latest，且不是 draft 或 prerelease。
- 远端资产回读验证：Release 仅包含 Setup、blockmap、`latest.yml` 和 SHA256 清单四个资产；重新下载后文件大小和 SHA256 均与本地发布产物完全一致，Release 正文不包含 Unicode replacement character。
- GitHub Issue `#11`“更新介绍是乱码”已回填 v1.2.90 修复说明并按 completed 关闭。

## v1.2.89 桌面歌词状态与位置持久化修复

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.89`。
- 软件退出、主窗口销毁和更新重启仅拆卸桌面歌词覆盖层，不再把系统拆卸误写成用户关闭偏好；用户主动关闭仍会同步保存关闭状态。
- 桌面歌词拖动与关闭时强制保存最终窗口 bounds；快速补丁立即重启前同步保存视觉配置，避免直接退出跳过 renderer 卸载保存。
- 新增 `tests/desktop-lyrics-persistence.test.js`；全量 Node 回归 `196/196` 通过。
- 不改变 UI、布局、玻璃质感、歌词文本、字号、颜色、光效、播放时钟、鼠标穿透或桌面歌词交互语义。
- Release 标题使用 `Mineradio v1.2.89 桌面歌词状态与位置持久化修复版`，目标为 GitHub Latest Release。
- 发布资产只上传安装器、blockmap、`latest.yml` 和 UTF-8 SHA256 清单；Portable ZIP 仅本地保留。
- 构建验证：全量 Node 回归 `196/196`、关键 JavaScript 语法、`git diff --check` 和打包后 `app.asar` 内容核对通过；安装器 `103333863` 字节，blockmap `110281` 字节，`latest.yml` `350` 字节，本地 Portable ZIP `144916275` 字节。
- SHA256：安装器 `031958f60adc4bab756f39f19df6a5186deb320bd9926ced834f67699e9de67a`；blockmap `cddcccb4d10f947608dde514475a3de7e419e3a3cb6f1537dbf1230908589c88`；`latest.yml` `4adf2244632814142a82c40a35240c77b765e80c0bdf6265d488147fb4dc2a5d`；本地 Portable ZIP `8881e2ee5990d526a604e6fe3e87dc6aca1ea65e3cb72be47d30508ad39ca88d`。
- `latest.yml` 的 Setup SHA512：`xs4kgBz3NNm64LOcN6TMtUo2v9TFJyW6fj9EEDfbcEi/iRBh35/gbuCgnxkScO0ugA0wjZJlkS/DwKlokY3igw==`。
- GitHub 发布验证：`main` CI run `30968545148` 成功；annotated tag `v1.2.89` 解引用到源码提交 `dfd93143a7c8e47ddc9fca3b8b141533de332eb8`；Release `https://github.com/oirge/Mineradio/releases/tag/v1.2.89` 已标记 Latest，且不是 draft 或 prerelease。
- 远端资产回读验证：Release 仅包含 Setup、blockmap、`latest.yml` 和 SHA256 清单四个资产；重新下载后文件大小和 SHA256 均与本地发布产物完全一致。

## v1.2.88 Home 空库波形热路径优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.88`。
- Home 空库波形缓存 24 个频谱柱的频谱桶索引；只在频谱长度变化时重新计算，保持原有取样曲线和刷新节奏。
- 新增 `tests/home-wave-hot-path.test.js`；全量 Node 回归 `194/194` 通过。
- 不改变 UI、布局、玻璃质感、播放控制、歌词、桌面歌词、壁纸或 3D 歌单架语义。
- Release 标题使用 `Mineradio v1.2.88 Home 空库波形热路径优化版`，目标为 GitHub Latest Release。
- 发布资产只上传安装器、blockmap、`latest.yml` 和 UTF-8 SHA256 清单；Portable ZIP 仅本地保留。
- 构建验证：`node --check`、`git diff --check` 和打包后 `app.asar` 内容核对通过；安装器 `103331885` 字节，blockmap `110197` 字节，`latest.yml` `350` 字节，本地 Portable ZIP `144916097` 字节。
- SHA256：安装器 `107d6731c11bd504c5dfd48c9bb186f48eda41d484e27bea638df093be8b3ae8`；blockmap `899cff581d698256b198d872aa1911608bf4f36366384f624b3cc363a316656d`；`latest.yml` `a7553b3974490c4fa3ef41fa17d42af73b152be98c23fb23bab55dd407c5d37d`；本地 Portable ZIP `a2790f1a5a74c26e917c249fd9391f82499ee909cc59274f9c9df5a7f8624ab8`。
- `latest.yml` 的 Setup SHA512：`TC9d1O9UzZf2PtVQK0v9d9r2TzMuFfxN5TGA5GRGLVwYPh7S/qRgHT9iB5g+KeS4Hr9cUnQ467tiuOad/6ep5g==`。
- GitHub Release 已标记 Latest；远端 API 返回的三个自动更新资产 SHA256 与本地一致，`main` CI run `30875753697` 成功。

## v1.2.87 桌面歌词 60 FPS 少分配优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.87`。
- 桌面歌词 renderer 缓存相同输入文本的归一化结果，并把 Unicode 字形数组与字宽放入同一缓存；减少 30/60 FPS 播放期间的短命数组与字符串分配。
- 保持歌词内容、行数语义、代理对字符、字距、居中位置、光效、播放时钟和桌面操作不变。
- 新增 `tests/desktop-lyrics-render-hot-path.test.js` 和 `tests/frontend-html-script-syntax.test.js`；CI 增加 `node --check public/app.js`。
- Release 标题使用 `Mineradio v1.2.87 桌面歌词 60 FPS 少分配优化版`，目标为 GitHub Latest Release。
- 发布资产只上传安装器、blockmap、`latest.yml` 和 UTF-8 SHA256 清单；Portable ZIP 仅本地保留。中文 Release 正文必须通过 UTF-8 文件配合 `gh release --notes-file` 上传，禁止再从 PowerShell 字符串管道传入。
- 构建验证：全量 Node 回归 `193/193` 通过，关键 JavaScript 语法、全部发布页面内联脚本和 `git diff --check` 通过；打包后的 asar 已确认包含 `1.2.87`、文本归一化缓存和 Unicode 字形数组缓存。
- 产物大小：安装器 `103333797` 字节；blockmap `110198` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144915948` 字节。
- SHA256：安装器 `91b8dc27601a4c71c9ef7d4b1c6bcee5f8e5fa5ae6183a92fde875782ceee8b8`；blockmap `6ba77e9954e0a5d584af0ffd9040e13b888c995653267234dc3c72bbd2541561`；`latest.yml` `8fa7703d64797fddb4d39549251fb21dacb063aea091543589f58ccdfce93413`；本地 Portable ZIP `91c33495ede6c78dd4aabe0c0b1b61cdbd002cd41b504428d2cdd30aac1d2252`。
- `latest.yml` 的 Setup SHA512：`3qWkchuUQ0exNYmqTa8Wn176UOcYhCvYtQlih73vHhBtDWLsOEumVF8L1uLxhxa+cMbwiMtI7zohvxmZbHZ79A==`。

## v1.2.86 桌面歌词修复与发布链路完善

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.86`；这是对 `1.2.85` 修复重发的正式版本升级。
- 保留桌面歌词顶部物理裁切修复；旧版 `1.2.85` 客户端会因版本号变大而进入自动更新链路。
- 将包含修复的当前源码同步到默认 `main`，使 GitHub 仓库首页和发布包保持同一提交链。
- 新增 `.github/workflows/verify.yml`：Windows CI 在 `main`、`codex/**` push、向 `main` 的 PR 和手动触发时执行 `npm ci --ignore-scripts`、全量 Node 测试、JavaScript 语法检查和空白检查。
- Release 标题使用 `Mineradio v1.2.86 桌面歌词修复与发布链路完善版`，目标为 GitHub Latest Release。
- 发布资产：`Mineradio-1.2.86-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.2.86-SHA256SUMS.txt`；Portable ZIP 只保留本地产物，未上传时不得在 Release 正文写成已保留远端。
- 构建验证：全量 Node 回归 `190/190` 通过，`desktop/main.js`、`desktop/overlay-preload.js`、`server.js` 与 `public/app.js` 语法检查通过，`git diff --check` 通过；打包后的 asar 已确认含 `1.2.86` 和桌面歌词物理屏幕裁切修复。
- 产物大小：安装器 `103331153` 字节；blockmap `110176` 字节；`latest.yml` `350` 字节；本地 Portable ZIP `144915599` 字节。
- SHA256：安装器 `18971d4a85a2e3f186534205b980e5bb85b2ba28576dce9348dd45ed106eaed1`；blockmap `d69b25649d685243a389b7bb417ac4e4fc698781a8300234051157dc5c6178c3`；`latest.yml` `c4eb389b66b9e846f3075e2ca98f9024674f2e823d03e529b690d9a94c959245`；本地 Portable ZIP `bc6e68aed9ae3ef85d7cc3e0f24196434cb0e9c31baf93672693ccb1a81ded4b`。
- `latest.yml` 的 Setup SHA512：`+EEqobVskpxNt/xESC/s8IujlubFCh+kSq24vhXZBlKRAoL2rSi7W/dYZg2d2aeDwbxxvV/KgsdpoPZKk6QO/A==`。
## 2026-08-09 待发布安装器安全修复

- `build/installer.nsh` 直接读取 Windows 原始命令行中的 `/D=`，继续执行安装目录归一化，避免显式目录被默认路径覆盖。
- 发布前必须执行安装器命令行回归，确认 `/S /D=目标目录` 只写入目标目录下的 `Mineradio` 子目录，并保留卸载安全门禁。

## v1.2.85 桌面歌词调整栏自动避让修复重发

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.85`。
- 修复桌面歌词靠近屏幕顶部时，上方调整栏被裁切的问题；上方空间不足自动移动到歌词下方，上下都不完整时选择可见空间更大的一侧。
- 调整栏跟随歌词舞台浮动、滚动和入场动画按约 `32ms` 节流重新定位；主进程额外同步窗口相对物理显示器的上下裁切量，修复窗口拖到屏幕顶部之外时调整栏仍被裁切的问题。
- 新增物理窗口几何 IPC、顶部裁切和动态重定位回归测试；全量 Node 回归 `189/189` 通过。
- Release 标题使用 `Mineradio v1.2.85 桌面歌词调整栏自动避让修复重发版`，目标为 GitHub Latest Release。
- 发布资产：`Mineradio-1.2.85-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.2.85-SHA256SUMS.txt`；本版本不生成快速补丁，Portable ZIP 视上传稳定性决定。
- 修复重发构建产物：安装器大小 `103330816` 字节；Portable ZIP 大小 `144915590` 字节；blockmap 大小 `110399` 字节；`latest.yml` 大小 `350` 字节。
- 安装器 SHA256：`409e36493bbf4738fdf80d6fe3a27d7235e9302d014bcbaeeeb188443d520650`；blockmap：`ff93aa3b112348a4b34ed9c5dfbd9514d855e8d7c95ff25d91d1d54a309d7e10`；`latest.yml`：`b2e7cc153b778a2b3055c0024a075352e0e4ef8376eb59724081d433ef12ba1a`；Portable ZIP：`a05c2f02b0dbbba64dbfcdfb8bb48831792e8e462f7e97bedd13da3cbce41a6c`。
- Portable ZIP 如再次上传超时不影响安装器自动更新链路；本轮正式覆盖安装器、blockmap、`latest.yml` 和 SHA256 清单。

## v1.2.84 桌面覆盖层帧热路径优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.84`。
- 移除主渲染 `animate()` 对 `syncDesktopOverlayState()` 的重复调用；桌面歌词/壁纸继续由独立自调度计时器驱动，避免每个视觉帧重复做时间检查、载荷判重和状态分支。
- 保持桌面歌词 FPS 同步、壁纸节奏、后台/隐藏窗口降载、UI、布局、玻璃质感、电影视觉、播放控制和鼠标操作不变。
- 新增 `tests/desktop-overlay-scheduler.test.js`；构建前需通过全量 Node 回归 `183/183`、JavaScript 语法检查、实际 Electron 资源访问验证和 `git diff --check`。
- 本版本不生成快速补丁；GitHub 更新链路使用完整安装器，Portable ZIP 已本地构建并校验，但当前代理上传大文件超时未上传。
- Release 标题使用 `Mineradio v1.2.84 桌面覆盖层帧热路径优化版`，目标为 GitHub Latest Release。
- 发布资产：`Mineradio-1.2.84-Setup.exe`、对应 `.blockmap`、`latest.yml` 和 `Mineradio-1.2.84-SHA256SUMS.txt`。
- 安装器大小：`103330195` 字节；Portable ZIP 本地大小：`144971458` 字节；blockmap 大小：`110266` 字节；远端 SHA256 清单大小：`275` 字节。
- 安装器 SHA256：`e30243b084e91b59a6913fc07f44a2381a115438b24dfba3bd39d2bc55fee717`；blockmap：`50ea6f55d788701b3cc5f2ec819e4848621ace104182322a5fe71ad92d63e93f`；`latest.yml`：`2ceed2a4583dca9d53e88eb2538a3f73d250b8251916daa4eb7c03f9c710faa0`；Portable ZIP 本地 SHA256：`4bae1c0e1c929c3567bf6673c554db44a9783625bf9cfb606c6c188934807d0f`。

## v1.2.83 更新状态轮询与桌面歌词同步优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.83`。
- 更新下载/快速补丁状态轮询由固定 `setInterval` 改为单飞请求；上一轮未完成时不叠加请求，减少慢线路下的网络、JSON 解析和 DOM 刷新压力。
- 增加轮询代际与任务 ID 校验，旧任务迟到响应不能覆盖新任务；完成、失败和切换任务时统一释放轮询定时器与在途状态。
- 桌面歌词提示顶部空间不足时自动翻到歌词下方；手动拖动后的窗口 bounds 在重启后优先恢复，关闭时补存一次。
- 修复桌面歌词外层同步调度固定 `320ms` 导致的歌词慢半拍；启用桌面歌词时跟随 `desktopLyricsFps` 推送，30 FPS 约 `33ms`、60 FPS 约 `16.7ms`，后台压力/隐藏窗口仍保留降载保护。
- 新增更新轮询、桌面歌词布局和同步频率回归测试；构建前需通过全量 Node 回归 `182/182`、JavaScript 语法检查、实际 Electron 资源访问验证和 `git diff --check`。
- 本版本不生成快速补丁，使用完整安装器或 Portable ZIP。
- Release 标题使用 `Mineradio v1.2.83 更新状态轮询与桌面歌词同步优化版`，目标为 GitHub Latest Release。
- 发布资产：`Mineradio-1.2.83-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.83-SHA256SUMS.txt` 和 `Mineradio-1.2.83-Portable-win-x64.zip`。
- 安装器大小：`103329920` 字节；Portable ZIP 大小：`144971481` 字节；blockmap 大小：`110335` 字节；SHA256 清单大小：`380` 字节。
- 安装器 SHA256：`cba10d843d5e059adec4c8cdabbf36ee0a60c503fdd82e7fa6b218675abafa40`；blockmap：`b0501cb861e5626a92f86f3883dd16354500f2058aa100a6000768c45faec0da`；`latest.yml`：`f7ca491b44b9412c70ce07362f9332645321480b36684c9a9447a561cf431f57`；Portable ZIP：`47635da05b0d323a337aae4db304dbc9969837e7f940efbcf36eec55013ce0e8`。

## v1.2.82 静态资源流式传输优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.82`。
- 本地服务器对静态资源 `200` 响应改用 `fs.createReadStream()` 流式发送，避免 `fs.readFile()` 先复制完整 renderer 文件，降低启动和重复加载时的瞬时内存峰值。
- 保留 ETag、Last-Modified、`Cache-Control: no-cache` 和 `304` 条件缓存语义；页面、UI、布局、玻璃质感、电影视觉、播放控制和交互语义不变。
- 新增流式静态资源回归测试；构建前需通过全量 Node 回归 `175/175`、JavaScript 语法检查、实际 Electron 资源访问验证和 `git diff --check`。
- 由于本版本仅更新 `server.js` 静态资源服务逻辑，且 `server.js` 位于 `app.asar.unpacked`，不生成快速补丁；使用完整安装器或 Portable ZIP。
- Release 标题使用 `Mineradio v1.2.82 静态资源流式传输优化版`，已发布为 GitHub Latest Release。
- 发布资产：`Mineradio-1.2.82-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.82-SHA256SUMS.txt` 和 `Mineradio-1.2.82-Portable-win-x64.zip`。
- 安装器大小：`103329187` 字节；Portable ZIP 大小：`144914189` 字节；blockmap 大小：`110449` 字节；SHA256 清单大小：`380` 字节。
- 安装器 SHA256：`f2d07ed3c1e7413e6517f4f2e3c31a50b051970cb4bb4f8bbc9564211f5d71ed`；blockmap：`ad20226f20e129d2b4316f9eded3bbeeb746a2158f4a37b3d713d681bbf103a2`；`latest.yml`：`ae91bffeb0be8baef0dd78ab719874ffdbb67afcbc26465709563dd169669296`；Portable ZIP：`8e1da8e90e78c3df05cee82697505604678e639c2f8322ec1c10051ef35843b1`。

## v1.2.81 本地静态资源条件缓存优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.81`。
- 本地服务器为 HTML、CSS、JS、字体和图标增加 ETag/Last-Modified 条件缓存；重复启动命中缓存时返回 `304`，避免重新传输大型 renderer 资源。
- 使用 `Cache-Control: no-cache` 保证补丁或完整更新后的资源立即重新校验，不使用可能造成旧脚本残留的长时间强缓存。
- 新增真实 HTTP 200/304 回归测试；构建前需通过全量 Node 回归、全量 JavaScript 语法检查、实际 Electron 资源访问验证和 `git diff --check`。
- Release 标题使用 `Mineradio v1.2.81 本地静态资源条件缓存优化版`，已发布为 GitHub Latest Release。
- 由于本版本仅更新 `server.js` 的静态资源服务逻辑，且 `server.js` 位于 `app.asar.unpacked`，不生成快速补丁；使用完整安装器或 Portable ZIP。
- 发布资产：`Mineradio-1.2.81-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.81-SHA256SUMS.txt` 和 `Mineradio-1.2.81-Portable-win-x64.zip`。
- 安装器大小：`103328676` 字节；Portable ZIP 大小：`144914153` 字节；blockmap 大小：`110244` 字节；SHA256 清单大小：`380` 字节。
- 安装器 SHA256：`4f1e96791494cd4a1f0efd2eafa1cff9ec131039707c96b6ca97c0070e090449`；blockmap：`5612cbf828697b5297ec79743b199009c8e23b0dfc61139a7a40f15bce64cad4`；`latest.yml`：`b7d623d1b06645e043786bd4035b268d53ac74939a39749dfc0ce7a5235caac1`；Portable ZIP：`c935f85b7ee33d897f6380a533f9e74b8926ac73c7aa1c8760062063695dd6ff`。

## v1.2.80 asar 资源归档与运行根拆分优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.80`。
- `asarUnpack` 收窄到 `server.js`、`package.json`；`public`、`build` 和桌面脚本回到 `app.asar`，减少解包文件与启动 I/O。
- 主进程、本地服务器和补丁链路拆分可写运行根与静态资源根；补丁继续写 `app.asar.unpacked`，静态页面、字体和图标从 `app.asar` 读取。
- 兼容 `v1.2.79` 的旧解包布局；由于旧版真正加载的 `desktop/main.js` 位于 `app.asar` 内，本版不上传快速补丁，避免补丁只改写未加载的副本；请使用完整安装器或 Portable ZIP。
- 发布资产：`Mineradio-1.2.80-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.80-SHA256SUMS.txt` 和 `Mineradio-1.2.80-Portable-win-x64.zip`。
- 安装器大小：`103328894` 字节；Portable ZIP 大小：`144913870` 字节；blockmap 大小：`110210` 字节；SHA256 清单大小：`376` 字节。
- 安装器 SHA256：`30e611c5098a0e8792f3968bbb2347585b658bb89e45bc35ec53a3b700557c74`；blockmap：`e77da9ceb032fa9e7e4f3a558f1801025718c3632f018ca2af5d93053eb2fdb1`；`latest.yml`：`94c9f7230f51210854e3ee2fd14caec7623fd3bd6c5eb9a2cd98cb9d79f724fc`；Portable ZIP：`017ac1cd57760b560ef6bdc90095e8017bf4596ad21ee69f19cb23fb66d331ce`。
- 构建前需通过全量 Node 回归、全量 JavaScript 语法检查、实际 Electron 资源访问验证和 `git diff --check`。
- Release 标题使用 `Mineradio v1.2.80 asar 资源归档与运行根拆分优化版`，目标为 GitHub Latest Release。

## v1.2.79 全量启动与后台资源优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.79`。
- `asar:true` 配合 `app.asar.unpacked` 可写运行根；`server.js`、主进程和快速补丁均不再假定打包资源位于可写的 `__dirname`。
- 自定义封面/歌词/歌词偏好、本地节奏图、听歌统计和用户视觉存档改由独立 IndexedDB 持久化；旧 `localStorage` 自动迁移，失败才回退。
- 桌面歌词与壁纸窗口启用后台节流并在隐藏时暂停 RAF；移除全局禁用后台节流开关。
- 本地 Inter WOFF2 与 Noto Sans SC UI 子集全部自托管，动态中文未命中时回退 Windows 本地字体。
- 由于 `v1.2.78` 使用 `asar:false`，本次打包布局发生迁移，不生成 `v1.2.78 → v1.2.79` 快速补丁；请使用完整安装器或 Portable ZIP。
- 构建前需通过全量 Node 回归、全量 JavaScript 语法检查、资源/asar/后台节流/localStorage 门禁和 `git diff --check`。
- Release 标题使用 `Mineradio v1.2.79 全量启动与后台资源优化版`，目标为 GitHub Latest Release。

## v1.2.78 启动资源本地化与渲染器缓存优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.78`。
- 主渲染页面拆出 `public/app.css` 与 `public/app.js`，`index.html` 从约 `1.6MB` 降至约 `55KB`；同步更新 Node 回归测试的 renderer 源码入口，静态页面标记仍由 `index.html` 单独校验。
- 移除 Google Fonts 启动网络依赖，加入本地 Inter Latin woff2；中文使用 Windows 本地字体回退，避免为动态歌曲名/歌词打包全量 Noto Sans SC。
- 逐字歌词进度增加独立运行时游标，连续播放从上次扫描位置继续，跳播自动重置；歌词高亮、Canvas/DOM 输出和交互语义保持不变。
- 删除未使用的 `gsap`、`mpg123-decoder` npm 依赖及 lockfile 记录；保留 `asar:false`，避免破坏现有快速补丁对 `__dirname` 资源的原地替换链路。
- 新增 `tests/local-renderer-assets.test.js` 与 `tests/lyric-progress-cursor.test.js`；构建前需通过全量 Node 回归、主进程/renderer 语法检查和 `git diff --check`。
- 发布资产：`Mineradio-1.2.78-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.77→1.2.78.patch.json`、ASCII 补丁别名、`Mineradio-1.2.78-SHA256SUMS.txt` 和 Portable ZIP。
- 安装器大小：`103068307` 字节；Portable ZIP 大小：`144652122` 字节；快速补丁大小：`2382082` 字节；SHA256 清单大小：`376` 字节。
- 安装器 SHA256：`dc6be53ca62cb1155256b712d616c407d3ac407d1176e8331dcdd845529f99a1`；blockmap：`0cfe60bc754c47e63237e15112e6779804ce9a92b3962381df8535b1528ccf7b`；快速补丁：`84c2e4dd6a7552ed4c5ed40bafcb73a5063be02a800c02cfbee6f51f09c53fcf`；`latest.yml`：`eca74cfe0ca6ce1dfe6215e8c746446d1ff2b7ab858580c8f1f4953ee98c7670`；Portable ZIP：`d9832dc170a589a168c2708c8a98e0a10f2697fe5f1af14a038775344d2b0cb6`；SHA256 清单：`f871ec61611c6302adfe798683ba7c35103bcf7a326d3b24498587989e726edb`。
- Release 标题使用 `Mineradio v1.2.78 启动资源本地化与渲染器缓存优化版`，目标为 GitHub Latest Release。

## v1.2.77 3D 歌单详情屏幕命中低分配优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.77`。
- 详情歌单屏幕点击兜底改为单次扫描可见行，按 `renderOrder` 保持原命中优先级；详情行屏幕投影复用固定四角向量和 bounds scratch，移除每次点击的 `filter().sort()` 与临时 `THREE.Vector3` 分配。
- 保持详情列表布局、命中范围、按钮区域、播放/收藏/下一首动作、UI、玻璃质感和 3D 歌单架交互语义不变；新增 `tests/content-list-screen-hit-hot-path.test.js`。
- 全量 Node 回归 `167/167`、主进程与桌面脚本语法检查、4 个前端内联脚本解析和 `git diff --check` 均通过。
- 发布资产：`Mineradio-1.2.77-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.76→1.2.77.patch.json`、`Mineradio-1.2.77-SHA256SUMS.txt` 和 Portable ZIP。
- 安装器大小：`104760630` 字节；Portable ZIP 大小：`146496635` 字节；快速补丁大小：`2311620` 字节；SHA256 清单大小：`376` 字节。
- 安装器 SHA256：`0e5368d7cac27219cb3963cc174f3f2080f421e26ad86a80d549471869a27245`；blockmap：`7e52a0835e6971bc65e8d5711cb3ad483e72a011840982e5825bd631909f89b4`；快速补丁：`6a70ee5e3863dac302bc3e4c9673cfaabec0c891cd89a8cc01ee529761276b2e`；`latest.yml`：`136cb111133749105dfb69643aebcafab8cd30dc134c728f7e45d188df13f28a`；Portable ZIP：`9fb9f8b4ae14fd0f3aef99784da1a937d7884fdc0b88467a33a26a6834ff901c`；SHA256 清单：`d7df8fecd0ad08573968b355bbf7b591ae1f47b2a2a67f7f6846fd6f6a597b2d`。
- Release 标题使用 `Mineradio v1.2.77 3D 歌单详情屏幕命中低分配优化版`，目标为 GitHub Latest Release。

## v1.2.76 3D 歌单架卡片绘制低卡顿优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.76`。
- 歌单架每帧复用同一份 `frameShelfLook` 外观快照，卡片绘制签名、DOF 重绘、中心状态重绘和周期重绘不再重复归一化设置、解析颜色；非帧入口保留原有回退读取。
- 保持卡片颜色、透明度、布局、UI、视觉质感和交互语义不变；新增 `tests/frame-hot-path.test.js` 卡片绘制快照复用断言。
- 全量 Node 回归 `166/166`、59 个 JavaScript 文件语法检查、前端内联脚本解析和 `git diff --check` 均通过后构建发布。
- 发布资产：`Mineradio-1.2.76-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.75→1.2.76.patch.json`、ASCII 文件名补丁别名、`Mineradio-1.2.76-SHA256SUMS.txt` 和 Portable ZIP。
- 安装器大小：`104760392` 字节；Portable ZIP 大小：`146496579` 字节；快速补丁大小：`2311400` 字节；校验值以 `Mineradio-1.2.76-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`6dbd1deca240f7b0b7eba146ad48562843ca7daa144bf798c26e473df4fd0fe1`；blockmap：`a41f2d343411d57c2eb2aae6195e0d6b86ae5c2cdc2133c6b2528490bfc79086`；快速补丁：`e22bef36c63559e1a1c6871555a60945f98ec75f58153b19242e1f1a04a3d3ba`；`latest.yml`：`1914d101561618b5b56823e8cfde6af893e7f2a084ab9ac907361915c8d7e2be`；Portable ZIP：`1b5b8d90d43f0b94b394ae3061461037c0f81ef9337d4fcc8f71c5d80177c990`。
- Release 标题使用 `Mineradio v1.2.76 3D 歌单架卡片绘制低卡顿优化版`，目标为 GitHub Latest Release。

## v1.2.75 音频分析热循环低卡顿优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.75`。
- 频谱分析先累加 8 位采样值再统一归一化，时域 RMS 使用 256 项平方查找表，减少播放分析帧的重复除法和乘法；频段、RMS、节拍判断、视觉输出和交互语义保持不变。
- 新增 `tests/audio-analysis-hot-path.test.js` 数值等价断言；全量 Node 回归、主进程/桌面脚本语法检查、前端内联脚本解析和 `git diff --check` 均通过后构建发布。
- 发布资产：`Mineradio-1.2.75-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.74→1.2.75.patch.json`、`Mineradio-1.2.75-SHA256SUMS.txt` 和 Portable ZIP；本地另保留 ASCII 文件名补丁别名。
- 安装器大小：`104760018` 字节；Portable ZIP 大小：`146496136` 字节；快速补丁大小：`2309504` 字节；校验值以 `Mineradio-1.2.75-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`0ae19211860e9401dfff7b7f065bc134196d741e47bf32aaeff23bf0dbb9b4bf`；blockmap：`36c7074677f18e5f21aea1eb058bd323249176585d2ea5261967d48533a4cc1c`；快速补丁：`77c84eb36dcb34ccdc9259acdc42b4c777bda1fd424584948578effe1c41e246`；`latest.yml`：`35050b1a26dfcbec30af4e5548a7a1c57988125779bc5aea192836de0d9319c7`；Portable ZIP：`5a03824c4e7f9e13983c04243275b19577460586fd6e8de39646bc4a74f0bfe8`。
- Release 标题使用 `Mineradio v1.2.75 音频分析热循环低卡顿优化版`，目标为 GitHub Latest Release。

## v1.2.73 3D 歌单架帧设置快照复用低卡顿优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.73`。
- 歌单架更新帧复用同一份 `shelfSettings()` 快照，布局计算不再重复归一化设置和解析颜色；保持布局、视觉输出、UI 和交互语义不变。
- 新增 `tests/frame-hot-path.test.js` 设置快照复用断言；全量 `node --test` 共 `163/163` 通过，主进程与 preload 语法检查、`git diff --check` 通过。
- 发布资产：`Mineradio-1.2.73-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.72→1.2.73.patch.json`、ASCII 文件名补丁别名、`Mineradio-1.2.73-SHA256SUMS.txt` 和 Portable ZIP。
- 安装器大小：`104759712` 字节；Portable ZIP 大小：`146495548` 字节；快速补丁大小：`2307612` 字节；校验值以 `Mineradio-1.2.73-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`55b6451d13fb2a1fcd88d3fbe29ddaed4344471c9d346f17787e65b7ccc4a988`；blockmap：`0af5ce2f548968021323961dd18bf9ee029404355646fcc59a4040747713f4d2`；快速补丁：`93ded123ff60284a3bcca938e6acb292ac45db2ccc347828f5924f511dd96e5d`；`latest.yml`：`127709895f25a3ea77ff2a88978ab949195ebf9c3bc98846aeed409f488d6934`。
- Release 标题使用 `Mineradio v1.2.73 3D 歌单架帧设置快照复用低卡顿优化版`，目标为 GitHub Latest Release。

## v1.2.72 相机投影矩阵低卡顿优化

- 普通镜头和自由镜头复用投影参数缓存，`fov` 漂移不超过 `0.0005` 度时跳过重复矩阵重建；窗口尺寸变化和显式强制同步仍立即刷新。
- 保持镜头位置、节拍推拉、自由镜头、UI、布局、视觉质感和交互语义不变；新增 `tests/camera-projection-hot-path.test.js`。
- 验证：`node --test` 通过 `162/162`；`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查通过；前端内联脚本解析和 `git diff --check` 通过。
- 发布资产：`Mineradio-1.2.72-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.71→1.2.72.patch.json`、ASCII 文件名补丁别名、`Mineradio-1.2.72-SHA256SUMS.txt` 和 Portable ZIP。
- 安装器大小：`104759578` 字节；Portable ZIP 大小：`146495176` 字节；快速补丁和各资产校验值以 `Mineradio-1.2.72-SHA256SUMS.txt` 为准。
- Release 标题使用 `Mineradio v1.2.72 相机投影矩阵低卡顿优化版`，目标为 GitHub Latest Release。

## v1.2.61 妗岄潰姝岃瘝婊氳疆缂╂斁涓庢洿灏忓瓧鍙?- `v1.2.61` 鍦ㄦ闈㈡瓕璇嶈В閿佹€佸姞鍏ユ粴杞缉鏀撅細榧犳爣鍛戒腑瀹為檯姝岃瘝鎴栨偓鍋滃伐鍏锋潯鏃讹紝涓婃粴鏀惧ぇ銆佷笅婊氱缉灏忥紝姣忔。 `0.05`锛涢攣瀹氭€併€佹嫋鍔ㄤ腑鍜岄€忔槑绌虹櫧鍖哄煙涓嶅搷搴斻€?- 缂╂斁鑼冨洿浠?`0.72鈥?.55` 鎵╁睍涓?`0.20鈥?.55`锛屾渶灏忚瑙夊瓧鍙风害浠?`42px` 闄嶈嚦 `12px`锛沗鈭?/ +` 鎸夐挳銆丏IY 婊戝潡銆佽鐩栧眰鍜屼富杩涚▼缁熶竴浣跨敤鏂拌竟鐣岋紝瓒呴暱姝岃瘝鍙户缁嚜閫傚簲鑷崇害 `8px`銆?- 瑙ｉ攣宸ュ叿鏉″湪 `鈭?/ +` 涔嬮棿鏄剧ず瀹炴椂瀛楀彿鐧惧垎姣旓紱姝岃瘝鎷栧姩銆佹偓鍋滃拰涓敭鍒ゆ柇浣欓噺闅忓疄闄呭瓧鍙风缉鏀撅紝鏈€灏忔。姣忎晶绾?`3px 脳 2px`锛屽浐瀹氬伐鍏锋潯涓嶅苟鍏ヤ富杩涚▼姝岃瘝鐑尯銆?- 瀛楀彿浠嶇敱涓?renderer 鎸佷箙鍖栵紱鏃ф瓕璇嶇獥鍙ｃ€佺鐢?閿佸畾鎬佸拰 ignored 璇锋眰缁х画琚墍鏈夋潈闂ㄧ鎴栧洖婊氥€傞紶鏍囩┛閫忓強鏃㈡湁姝岃瘝瑙嗚鍩虹嚎涓嶅彉銆?- 鍏ㄥ `node --test` 143/143銆?1 涓?JS 鏂囦欢璇硶銆佺湡瀹?Chrome DOM/婊氳疆浜や簰鍜?`git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄣ€乥lockmap銆乣latest.yml` 鍜?`1.2.59 -> 1.2.60` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.61`锛屾鏂囦娇鐢ㄦ湰鑺傛寮忔洿鏂拌鏄庛€?
## v1.2.59 妗岄潰姝岃瘝缂╂斁涓庣簿鍑嗘嫋鍔ㄧ儹鍖?- `v1.2.59` 鍦ㄦ闈㈡瓕璇嶈В閿佸伐鍏锋潯澧炲姞绱у噾 `鈭?/ +` 瀛楀彿鎸夐挳锛岀户缁鐢ㄥ苟鎸佷箙鍖栫幇鏈?`desktopLyricsSize`锛岃皟鏁磋寖鍥翠繚鎸?`0.72鈥?.55`銆?- 鎷栧姩銆佹偓鍋滄崟鑾峰拰涓敭閿佸畾鐑尯鏀逛负璐村悎鍔ㄧ敾涓殑瀹為檯姝岃瘝鐭╁舰骞惰鍓埌 viewport锛屽彧淇濈暀鏈€澶?`16px 脳 10px` 浣欓噺锛涙粴鍔ㄥ彉鎹㈠厛鏇存柊銆佺儹鍖哄悗閲囨牱锛屽伐鍏锋潯鍥哄畾璐村湪姝岃瘝涓婃柟涓斾笉鑳藉惎鍔ㄦ嫋鍔ㄣ€?- 瑕嗙洊灞傚瓧鍙?IPC 淇濇寔涓?renderer 涓鸿缃湡婧愶紝骞舵牎楠屽綋鍓嶆瓕璇?renderer銆佸惎鐢ㄦ€佸拰瑙ｉ攣鎬侊紱鏃х獥鍙ｆ垨 ignored 璇锋眰浼氬洖婊氥€傞攣瀹氱┛閫忋€佽疆璇㈡墍鏈夋潈銆佹瓕璇嶉鑹?鎻忚竟/鍙戝厜鍩虹嚎涓嶅彉銆?- 鍏ㄥ娴嬭瘯 139/139銆乣node --check`銆佸墠绔唴鑱旇剼鏈В鏋愩€丳laywright DOM 浜や簰鍜?`git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄣ€乥lockmap銆乣latest.yml` 鍜?`1.2.58 -> 1.2.59` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.59`锛屾鏂囧凡鏀逛负鏈妭姝ｅ紡鏇存柊璇存槑锛屼笉鍐嶄娇鐢ㄥ崰浣嶆枃妗堛€?
## v1.2.58 FLAC Enhanced LRC 閫愬瓧姝岃瘝閫傞厤
- `v1.2.58` 璇嗗埆 FLAC 鍐呭祵 Enhanced LRC 鐨?`<mm:ss.xx>` 閫愬瓧鏃堕棿鏍囩锛屼笉鍐嶆妸鏍囩褰撲綔姝岃瘝姝ｆ枃鏄剧ず锛屽苟澶嶇敤鐜版湁 `words` 缁撴瀯鎻愪緵閫愬瓧楂樹寒銆?- 鍚屾椂闂村瓧璇嶃€佽灏剧粨鏉熸爣绛俱€佸琛屾椂闂存埑銆佹櫘閫?LRC 涓庡弻璇悎骞跺潎鏈夊洖褰掕鐩栵紱鐢ㄦ埛闂鏍锋湰瀹為檯瀵煎叆寰楀埌 88 琛屾瓕璇嶃€?37 涓€愬瓧楂樹寒缁勶紝姝ｆ枃鏍囩娈嬬暀涓?0銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄣ€乥lockmap銆乣latest.yml` 鍜?`1.2.57 -> 1.2.58` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.58`銆?
## v1.2.57 3D 姝屽崟鏋舵粴鍔ㄧ儹璺緞浣庡垎閰嶄紭鍖?- `v1.2.57` 浼樺寲 3D 姝屽崟鏋跺崱鐗?璇︽儏琛屾粴鍔ㄥ懡涓細姝ヨ繘涓庡姩浣滆Е鍙戞敼涓虹洿鎺ユ壂鎻忥紝閬垮厤姣忔 `find` 鍥炶皟鍒嗛厤銆?- 閫夋嫨闊虫晥鍣０缂撳啿鎸?AudioContext 棰勭敓鎴愬浐瀹氬彉浣撳苟杞崲澶嶇敤锛涢煶鏁堝弬鏁颁笌浜や簰璇箟淇濇寔涓嶅彉銆?- 鍓嶇鏇存柊闈㈡澘鐗堟湰鍙峰悓姝ヤ负 `1.2.57`锛屽苟鏂板鍖呯増鏈竴鑷存€у洖褰掓祴璇曘€?- 鍏ㄥ娴嬭瘯 130/130銆乣node --check`銆佸墠绔唴鑱旇剼鏈В鏋愩€丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.56 -> 1.2.57` 蹇€熻ˉ涓侊紙杩愯鏃跺彉鏇翠负 `public/index.html`锛屽彟鍚?`package.json` / `package-lock.json` 鐗堟湰鍏冩暟鎹級锛汸ortable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.57`銆?## v1.2.56 蹇€熻ˉ涓佸浠界洰褰曚粠涓嶆竻鐞嗙殑纾佺洏娉勬紡淇
- `v1.2.56` 淇 `server.js` 蹇€熻ˉ涓佸簲鐢ㄥ悗澶囦唤鐩綍姘镐笉娓呯悊鐨勭鐩樻硠婕忥細`applyPatchFiles` 琛ヤ竵鎴愬姛鍚庣洿鎺?`return changed`锛屼粠涓嶅垹闄?`updates/backups/patches/<job.id>/` 涓嬬殑鍘熸枃浠跺浠斤紝鑰?`job.id` 姣忔鍞竴锛屽鑷存瘡娆″揩閫熻ˉ涓佸崌绾ч兘姘镐箙閬楃暀涓€浠藉浠斤紙鍗曚唤 index.html 绾?2MB锛夋棤闄愮疮绉€?- 鏂板 `removePatchBackupDir(job)`锛屽湪琛ヤ竵鎴愬姛搴旂敤鍚庝笌鍥炴粴鎴愬姛鍚庡悇娓呯悊涓€娆″搴斿浠界洰褰曪紱鍥炴粴澶辫触鐨勮嚧鍛藉垎鏀繚鐣欏浠姐€傛竻鐞嗗け璐ュ彧 `warn` 涓嶆姏鍑恒€?- 鏂板 4 鏉″洖褰掓祴璇曪紙`tests/patch-backup-cleanup.test.js`锛夈€傚叏濂?129/129銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.55 -> 1.2.56` 蹇€熻ˉ涓侊紙鏈増杩愯鏃跺彉鏇翠负 `server.js`锛夛紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.56`銆?
## v1.2.55 latest.yml 鏍囬噺瑙ｆ瀽鍙兘鍛戒腑閿欒璧勪骇鐨勬洿鏂版牎楠屽姞鍥?- `v1.2.55` 鍔犲浐 `server.js` 鐨?`yamlScalar`锛氳В鏋?`latest.yml` 鏃跺師鐢?`^\s*key:` 鍖归厤浠绘剰缂╄繘锛屼細鍛戒腑 `files:` 棣栭」鑰岄潪椤跺眰瀛楁銆傚崟璧勪骇 latest.yml锛堝綋鍓嶆瀯寤猴級涓ゅ鍊间竴鑷村皻涓嶅彲瑙﹀彂锛屼絾 files 棣栭」鑻ヤ笉鏄富瀹夎鍖呬細鍙栧埌閿欒璧勪骇鐨?sha512/size锛屼护鑷姩鏇存柊鏍￠獙澶辫触銆?- 淇涓轰紭鍏堥敋瀹氶《灞?`^key:`锛岄《灞傜己澶辨墠鍥為€€浠绘剰缂╄繘锛涘褰撳墠鍗曡祫浜?latest.yml 杈撳嚭閫愰」涓嶅彉銆?- 鏂板 4 鏉″洖褰掓祴璇曪紙`tests/latest-yml-scalar-parsing.test.js`锛夈€傚叏濂?125/125銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.54 -> 1.2.55` 蹇€熻ˉ涓侊紙鏈増杩愯鏃跺彉鏇翠负 `server.js`锛夛紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.55`銆?
## v1.2.54 灏侀潰鍥剧墖涓婁紶瑙ｇ爜澶辫触闈欓粯鏃犲弽棣堜慨澶?- `v1.2.54` 淇鐢ㄦ埛涓婁紶灏侀潰瑙ｇ爜澶辫触鏃舵棤浠讳綍鍙嶉鐨勭己闄凤細`loadCoverFromFile`/`applyCoverDataUrl` 鍙寕 `onload` 缂?`onerror`锛屾崯鍧忔垨瓒呭ぇ鍥剧墖瑙ｇ爜澶辫触鏃跺皝闈笉鏇存柊涔熶笉鎻愮ず锛岀敤鎴疯浠ヤ负鍗℃銆?- 瀵归綈鑳屾櫙鍥剧墖涓婁紶 `readBackgroundImageFile` 鐨勫仛娉曪紝涓哄皝闈笂浼犵殑 `FileReader`/`Image` 琛?`onerror` 鍙嶉涓庤В缁戯紱`applyCoverDataUrl` 瑙ｇ爜澶辫触鍒绘剰淇濈暀鐜版湁灏侀潰涓嶆竻绌恒€?- 鏂板 4 鏉″洖褰掓祴璇曪紙`tests/cover-upload-decode-failure.test.js`锛夈€傚叏濂?121/121銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.53 -> 1.2.54` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.54`銆?
## v1.2.53 鏈湴鏇插簱鏁存壒鏇挎崲瀵艰嚧 Object URL 娉勬紡淇
- `v1.2.53` 淇閲嶆柊瀵煎叆鏈湴鏂囦欢/鏂囦欢澶归€犳垚鐨?`blob:` Object URL 鍐呭瓨娉勬紡锛歚ensureLocalSongUrl`/鏈湴灏侀潰瀵规祻瑙堝櫒 `File` 鍒涘缓鐨?Object URL 鍐欏叆 `song.localUrl`/`localCoverObjectUrl`锛岃€屾暣鎵规浛鎹?`localLibrarySongs` 鏃舵棫瀵硅薄琚涪寮冨嵈浠庝笉 `revokeObjectURL`銆?- 鏂板 `revokeDiscardedLocalSongObjectUrls`锛屽湪 `handleLocalFolderFiles`/`handleFiles` 鏇挎崲鏇插簱鍓嶅洖鏀惰涓㈠純涓旀棤瀛樻椿寮曠敤鐨?`blob:` 鍦板潃锛涗繚鐣欓泦瑕嗙洊鏂版洸搴撲笌瀛樻椿姝屽崟锛屾寔涔呭湴鍧€锛坔ttp/鑷畾涔夊崗璁級涓庣┖鍊间笉鍔紝閲嶅鍦板潃鍙挙閿€涓€娆°€?- 鏂板 5 鏉″洖褰掓祴璇曪紙`tests/local-media-object-url-revoke.test.js`锛夈€傚叏濂?117/117銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.52 -> 1.2.53` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.53`銆?
## v1.2.52 IndexedDB 浜嬪姟涓瀵艰嚧缂撳瓨姘镐箙鍋滄憜淇
- `v1.2.52` 淇 IndexedDB 浜嬪姟 abort 鏃?Promise 姘镐笉缁撶畻鐨勭己闄凤細9 澶勪簨鍔℃鍓嶇己 `onabort`锛屼簨鍔″洜閰嶉/`versionchange`/椤甸潰鍐荤粨涓鏃?`await` 姘告寕銆佽繛鎺ユ硠婕忋€?- 鏈€涓ラ噸鐨勬槸 `trimLocalIndexedDbCaches`锛歚await` 姘告寕浣?`finally` 涓嶆墽琛岋紝浜掓枼閿?`localIndexedDbTrimRunning` 姘镐负 true锛岀紦瀛樻竻鐞嗘案涔呭仠鎽嗐€佺紦瀛樻棤闄愬闀裤€?- 涓哄叏閮?9 澶勪簨鍔¤ˉ `onabort`锛堥暅鍍?`onerror`锛氬叧闂繛鎺ュ苟 reject锛夛紱鏂板 3 鏉″洖褰掓祴璇曘€傚叏濂?112/112銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.51 -> 1.2.52` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.52`銆?
## v1.2.51 娣″嚭鏆傚仠琚垏姝屾墦鏂鑷存挱鏀鹃敭鍗℃淇
- `v1.2.51` 淇鎾斁/鏆傚仠鎸夐挳鍙兘姘镐箙澶辨晥鐨勬寕璧风己闄凤細`fadeOutAndPauseAudio` 鐨?Promise 鍙敱娣″嚭璁℃椂鍣ㄧ粨绠楋紝鑰屽垏姝屼笌闊抽噺璋冭妭浼?`clearAudioFadeTimers` 娓呮帀璇ヨ鏃跺櫒锛涙殏鍋滄贰鍑烘湡闂村垏姝屼細璁?`await` 姘告寕銆乣playToggleBusy` 姘镐负 true锛屾寜閽鍚庡叏閮ㄥけ鐏点€?- 鏂板缁熶竴缁撶畻鍏ュ彛涓庡厹搴曞彞鏌?`pendingFadeOutSettle`锛歚clearAudioFadeTimers` 娓呯悊鍓嶅厛缁撶畻鎸傝捣娣″嚭锛坒alse锛夛紝姝ｅ父鍒扮偣浠嶇粨绠?true 骞舵殏鍋滐紝`settled` 鏍囧織淇濊瘉鍙粨绠椾竴娆°€?- 鏂板 3 鏉″洖褰掓祴璇曡鐩栧埌鐐?鎵撴柇/涓€娆℃€х粨绠楋紱鍏ㄥ 109/109銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.50 -> 1.2.51` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.51`銆?
## v1.2.50 鍒囨瓕绔炴€佸惉姝屼細璇濇薄鏌撲慨澶?- `v1.2.50` 淇蹇€熷垏姝屾椂鍚瓕浼氳瘽琚棫姝岃鐩栫殑绔炴€侊細`playLocalQueueItem` 鍦?`await playAudio` 鎸傝捣鏈熼棿鑻ョ敤鎴峰垏鍒颁笅涓€棣栵紝鏃ц皟鐢ㄨ繑鍥炲悗鐨勬敹灏炬鏈鏌?`trackSwitchToken`锛屼細鐢ㄦ棫姝屽揩鐓ц鐩栨柊姝屽惉姝屼細璇濓紝姹℃煋缁熻鐢诲儚涓庢渶杩戞挱鏀炬暟鎹€?- 鍦?`await playAudio` 杩斿洖鍚庤ˉ `token !== trackSwitchToken` 瀹堝崼锛岃繃鏈熻皟鐢ㄧ洿鎺ヨ繑鍥烇紱杩欐槸鍒囨瓕璺緞涓敮涓€鏈仛 token 鏍￠獙鐨?await 灏炬锛屽叾浣?await 鍒嗘敮鏃╁凡鏈夊悓娆鹃槻鎶ゃ€?- 涓?`playLocalQueueItem` 琛ヤ腑鏂?JSDoc锛涘叏濂?106/106銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.49 -> 1.2.50` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.50`銆?
## v1.2.49 瀛樻。瀵煎叆澶у皬涓婇檺淇
- `v1.2.49` 涓?`mineradio-import-json-file` 琛ラ綈鏂囦欢澶у皬涓婇檺锛氭鍓?`fs.readFileSync` 鐩存帴璇诲彇鐢ㄦ埛閫変腑鐨勬枃浠躲€佹棤浠讳綍澶у皬鏍￠獙锛岃閫夎秴澶ф枃浠朵細涓€娆℃€ц鍏ュ唴瀛樻嫋鍨富杩涚▼锛涜繖鏄」鐩唴鍞竴缂哄皯杈撳叆涓婇檺鐨勫閮ㄦ枃浠惰鍙栬矾寰勩€?- 鐜板湪鍏?`fs.statSync` 鏍￠獙锛岄潪鏂囦欢杩斿洖 `IMPORT_NOT_A_FILE`銆佽秴杩?16MB 杩斿洖 `IMPORT_FILE_TOO_LARGE`锛屾甯稿瓨妗ｄ笉鍙楀奖鍝嶏紝閲嶆柊婊¤冻鈥滄墍鏈夊閮ㄦ枃浠惰鍙栭兘鏈夊唴瀛樹笂闄愨€濅笉鍙橀噺銆?- 鏂板鍥炲綊娴嬭瘯瑕嗙洊瓒呭ぇ鎷掔粷/姝ｅ父鏀捐/鍙栨秷涓夋潯璺緞锛涘叏濂?106/106銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.48 -> 1.2.49` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.49`銆?
## v1.2.48 妗岄潰姝岃瘝杞瀛ゅ効杩涚▼淇
- `v1.2.48` 淇妗岄潰姝岃瘝绐楀彛鎰忓鍏抽棴锛堝娓叉煋杩涚▼宕╂簝锛夋椂娉勬紡涓敭杞瀛愯繘绋嬬殑缂洪櫡锛歚closed` 浜嬩欢鐨勯噴鏀惧彛 `releaseOwnedDesktopLyricsWindow` 鍙疆绌虹獥鍙ｅ彞鏌勩€佹湭鍋滆疆璇紝瀵艰嚧 spawn 鐨?PowerShell 杞杩涚▼鎴愪负瀛ゅ効骞朵互 24ms 闂撮殧鎸佺画绌鸿浆鐩村埌搴旂敤閫€鍑恒€?- 鍦?`releaseOwnedDesktopLyricsWindow` 琛ヤ笂 `stopDesktopLyricsMousePoller()`锛涙甯稿叧闂矾寰勫凡鍏堝仠杞锛屾澶勮皟鐢ㄥ箓绛夛紝浠呭宕╂簝绛夋剰澶栧叧闂矾寰勮ˉ婕忋€?- 鏂板鍥炲綊娴嬭瘯锛氭柇瑷€ `releaseOwnedDesktopLyricsWindow` 鍑芥暟浣撹皟鐢ㄤ簡 `stopDesktopLyricsMousePoller()`锛涘叏濂?105/105 銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.47 -> 1.2.48` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.48`銆?
## v1.2.47 璇锋眰浣撹秴闄愭寕璧蜂慨澶?- `v1.2.47` 淇鏈湴 HTTP 鏈嶅姟 `readRequestBody` 鍦ㄨ姹備綋瓒?8MB 涓婇檺鏃剁殑鎸傝捣缂洪櫡锛歚req.destroy()` 鍙Е鍙?close/aborted 鑰岄潪 end锛屾棫瀹炵幇鍙洃鍚?end/error 瀵艰嚧 promise 姘镐笉缁撶畻锛屽鐞嗗櫒姘镐箙鎸傝捣涓?socket 娉勬紡銆?- 閲嶆瀯涓哄崟娆＄粨绠楅棬锛岃秴闄愪互 `REQUEST_BODY_TOO_LARGE` 鎷掔粷锛團ail-Fast锛夊苟鏂板 close 鍏滃簳锛沞nd/error/close 浠讳竴璺緞閮藉彧缁撶畻涓€娆°€?- 鏂板鐪熷疄 HTTP server 鍥炲綊娴嬭瘯瑕嗙洊鍥涙潯缁堟璺緞锛涘叏濂?104/104 銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.46 -> 1.2.47` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.47`銆?
## v1.2.46 鏈湴鏇插簱澧為噺鎵弿鎴柇鍥為€€淇
- `v1.2.46` 淇鏈湴鏇插簱澧為噺鎵弿鍦ㄦ湰娆￠亶鍘嗚揪鍒拌闂笂闄愶紙鎴柇锛夋椂鏈洖閫€鍏ㄩ噺鐨勭己闄凤細娈嬬己澧為噺缁撴灉浼氭妸鎴柇涓㈠け鐨勯」璇垽涓哄垹闄わ紝瀵艰嚧褰撳墠浼氳瘽涓㈡瓕骞惰鐩栨寔涔呭揩鐓с€?- 澧為噺鎵弿鏈 `listed.truncated` 涓虹湡鏃舵敼鐢ㄥ叏閲忚涔夎繑鍥炲凡閬嶅巻缁撴灉锛堜笉閲嶅 IO锛夊苟閫忎紶 `truncated=true`锛屼笌 `previous.truncated` 鍒嗘敮鍚屾簮澶勭悊銆?- 鏂板鍥炲綊娴嬭瘯瑕嗙洊鎴柇鍥為€€涓庢湭鎴柇淇濇寔澧為噺涓ゆ潯璺緞锛涘叏濂?102/102 銆乣node --check`銆丄ST 闂ㄧ銆乣git diff --check` 鍧囩豢銆?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.45 -> 1.2.46` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.46`銆?
## v1.2.45 鏈湴鏂囦欢浠ｇ悊瓒婃潈璇诲彇淇
- `v1.2.45` 淇鏈湴鏂囦欢 HTTP 浠ｇ悊 `/api/local-file` 瓒婃潈璇诲彇锛氫唬鐞嗘鍓嶅彧鏍￠獙闅忔満浠ょ墝锛屾湭寮哄埗鐩爣浣嶄簬宸叉巿鏉冩洸搴撴牴鐩綍鍐咃紝鎸佷护鐗岀殑鏈満璇锋眰鍙鎺堟潈鐩綍浠ュ浠绘剰鏂囦欢锛堝惈 `..` 绌胯秺锛夈€?- 浠ｇ悊鏀逛负涓?IPC 閫氶亾涓€鑷寸殑鎺堟潈妯″瀷锛氫富杩涚▼娉ㄥ叆 `resolveAuthorizedLocalFile`锛屼唬鐞嗚鍙栧墠寮哄埗鐩爣钀藉湪宸茬櫥璁版洸搴撴牴鐩綍鍐咃紱鏈敞鍏ユ巿鏉冨嚱鏁版椂缂虹渷鎷掔粷锛團ail-Closed锛夈€?- 鏂板绔埌绔洖褰掓祴璇曪紙缂虹渷鎷掔粷銆佹巿鏉冨唴鏀捐銆佹巿鏉冨鎷掔粷銆乣..` 绌胯秺鎷掔粷銆佷护鐗岄敊璇嫆缁濓級锛涘潙鐐规矇娣€浜?`.context/pitfalls/mineradio-local-file-proxy-authorization.md` 骞跺湪 `AGENTS.md` 寤虹储寮曘€?- 鏈鍙戝竷涓婁紶瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?`1.2.44 -> 1.2.45` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.45`銆?
## v1.2.44 鏈湴璧勪骇涓庢闈㈢姸鎬佸唴瀛樹紭鍖?- `v1.2.44` 缁х画鍥寸粫鏈湴澶ф洸搴撱€侀暱鏃堕棿鎾斁鍜屾闈㈣鐩栧眰椹荤暀鍋氬唴閮ㄥ唴瀛樹紭鍖栵紝涓嶆敼鍙?UI銆佸竷灞€銆佹枃妗堛€佺幓鐠冭川鎰熴€佺數褰辫瑙夋垨鎾斁鍏ュ彛銆?- 鏈湴姝岃瘝鍘熸枃閲囩敤绮剧‘褰撳墠瀵硅薄鎾斁绉熺害锛涘垏姝屻€佹竻绌洪槦鍒椼€佽繜鍒版枃浠惰鍙栧拰缂撳瓨姘村悎涓嶄細璁╂棫姝屾洸鍓湰閲嶆柊鎸佹湁闀挎枃鏈紝閲婃斁鍚庣殑 `ready` 绱㈠紩鎽樿浠嶅彲鎸夊崟鏇叉仮澶嶃€?- 绌烘洸搴撳拰鍒囧簱鍚庡彴璧勪骇浠诲姟浣跨敤浠ょ墝涓庨槦鍒楁墍鏈夋潈闅旂锛涙湰鍦板皝闈€丱bject URL銆佸唴宓?Blob銆佽寖鍥磋鍙栧瓧鑺傚拰姝屽崟/鑺傚缂撳瓨鍧囨寜娑堣垂鑰呯敓鍛藉懆鏈熻鍓€?- 妗岄潰姝岃瘝銆佸绾搞€佽糠浣犳挱鏀惧櫒鍜屼腑閿疆璇㈠鍔犵獥鍙?杩涚▼鎵€鏈夋潈閲婃斁闂ㄧ锛涚鐢ㄦ垨涓荤獥鍙ｆ仮澶嶅悗涓嶄繚鐣欓噸鍨嬭浇鑽凤紝閿佸睆鏈熼棿涓嶅畨鎺掓仮澶嶄换鍔°€?- 鏈鍙戝竷鍙笂浼犲畬鏁村畨瑁呭櫒銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.43 -> 1.2.44` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.44 鏈湴璧勪骇涓庢闈㈢姸鎬佸唴瀛樹紭鍖栫増`銆?
## v1.2.43 鏈湴闊宠川涓枃妗ｄ綅
- `v1.2.43` 闊宠川灞曠ず鍏ㄩ潰瀵规爣缃戞槗浜戜腑鏂囨。浣嶏紝涓嶆敼鍙?UI 甯冨眬涓庢挱鏀鹃摼璺€?- `localAudioQualityText()` 浣跨敤 `localBitrateTierLabel()`锛氭棤鎹熷鍣ㄤ负鏃犳崯/楂樿В鏋愬害锛屾湁鎹熸牸寮忔渶楂樻瀬楂橈紝骞跺惈杈冮珮/鏍囧噯/娴佺晠銆?- 闊宠川鎸夐挳涓庤彍鍗曠煭鏍囩涓枃鍖栵紱缂撳瓨閿姞 `tier-v1` 鍓嶇紑锛屽崌绾у悗鑷姩澶辨晥鏃?kbps 鏂囨銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.42 -> 1.2.43` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.43 鏈湴闊宠川涓枃妗ｄ綅浼樺寲鐗坄銆?
## v1.2.42 鏈湴瀵煎叆鎺掑簭 Collator 澶嶇敤
- `v1.2.42` 缁х画闄嶄綆澶ф洸搴撳鍏ユ椂鐨勬帓搴忓紑閿€锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佸鍏ョ粨鏋滈『搴忚涔夋垨鎾斁鍏ュ彛銆?- 鍓嶇 `buildLocalCoverMaps()` / `createLocalSongsFromFiles()` 澶嶇敤妯″潡绾?`Intl.Collator`锛屼笌涓昏繘绋?`LOCAL_LIBRARY_NAME_COMPARE` 瀵归綈銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.41 -> 1.2.42` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.42 鏈湴瀵煎叆鎺掑簭 Collator 澶嶇敤浼樺寲鐗坄銆?
## v1.2.41 鏇存柊鍊欓€夐摼璺笌鎵嬪娍甯т綆鍒嗛厤浼樺寲
- `v1.2.41` 淇杞欢鍐呮洿鏂伴暅鍍忓€欓€夐噸澶嶅睍寮€涓庨暅鍍忔爣璁颁涪澶憋紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹墜鍔胯緭鍑烘垨鎾斁鍏ュ彛銆?- 瀹屾暣鍖呭拰蹇€熻ˉ涓佷繚鐣欑粨鏋勫寲鍊欓€夊厓鏁版嵁锛涢粯璁?3 鏉￠暅鍍忓姞 GitHub 鐩磋繛鍘婚噸鍚庝繚鎸?4 鏉★紝骞跺吋瀹规棫 manifest銆乁RL 瀵硅薄涓庡洓绫婚暅鍍忔ā鏉裤€?- 闀滃儚鍊欓€夌户缁彈鎽樿鏍￠獙淇濇姢锛屾棤鎽樿闀滃儚涓嶈兘缁曡繃 `ensureMirrorCanBeVerified()`銆?- 瀹屾暣瀹夎鍖呬笌蹇€熻ˉ涓佺粺涓€浣跨敤 12 绉掑搷搴斿ご瓒呮椂鍜?30 绉掓鏂囩┖闂?watchdog锛涙崲绾块噸缃姸鎬侊紝鎴愬姛銆佸紓甯稿拰闀滃儚鍒囨崲鍧囨竻鐞嗚鏃跺櫒銆?- 瀹屾暣鍖呭紓姝ヨ惤鐩樹細澶勭悊閮ㄥ垎鍐欏叆銆佸啓鐩樺け璐ュ拰鍝嶅簲瓒呴噺锛涙湰鍦扮鐩?鏉冮檺閿欒涓嶅啀閲嶅涓嬭浇鍒板叾浠栭暅鍍忥紱蹇€熻ˉ涓佸湪鏁寸粍鏍￠獙/澶囦唤鍚庡簲鐢紝涓€斿け璐ユ仮澶嶅師鏂囦欢骞舵竻鐞嗕复鏃舵枃浠讹紝搴旂敤闃舵閿欒涓嶅啀鍒囨崲闀滃儚閲嶈瘯銆?- 瀹屾暣瀹夎鍖呰竟涓嬭竟绱鎽樿锛岃惤鐩樺悗璧?`verifyStreamedUpdatePayload()` 娴佸紡鏍￠獙锛岀紦瀛樺鐢ㄨ矾寰勪粛鐢?`verifyUpdateFile()`锛涙牎楠岃缂撳啿澶嶇敤 1MB 鍧楋紝`closeUpdateFileHandle()` 淇濈暀涓婚敊璇€?- MediaPipe 鎵嬪娍甯у鐢ㄦ帉蹇?scratch 鍜屽浐瀹?tips 鏁扮粍锛屾帉蹇冨彧璁＄畻涓€娆″苟浼犵粰寮犲紑搴︿笌楠ㄦ灦缁樺埗锛涙崗鍚堛€佹彙鎷炽€佹棆杞€丠UD 鍜?Canvas 杈撳嚭淇濇寔涓嶅彉銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.40 -> 1.2.41` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.41 鏇存柊鍊欓€夐摼璺笌鎵嬪娍甯т綆鍒嗛厤浼樺寲鐗坄銆?
## v1.2.40 妗岄潰姝岃瘝涓庢洿鏂伴摼璺綆鍒嗛厤/鎶楀崱姝讳紭鍖?- `v1.2.40` 缁х画闄嶄綆妗岄潰姝岃瘝鍜屽皝闈㈠彇鑹蹭氦浜掍腑鐨勭煭鍛藉璞″垎閰嶏紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹瓕璇嶈緭鍑烘垨鎾斁鍏ュ彛銆?- 灏侀潰鍙栬壊鏀惧ぇ闀滃湪鎵撳紑鏃剁紦瀛樹竴娆?canvas JPEG/CSS 鑳屾櫙锛宍mousemove` 鍙洿鏂板潗鏍囷紱鍏抽棴鏃堕噴鏀?canvas 涓?Base64 寮曠敤銆?- `normalizeDesktopLyricText()` 鎸夊師鏂囧拰 single/double 琛屾暟妯″紡缂撳瓨鏈€缁堝瓧绗︿覆锛屾寔缁珮甯х巼鍚屾涓嶉噸澶嶅垱寤烘竻娲楁暟缁勩€?- 蹇€熻ˉ涓侀鍖呬繚鎸?12 绉掕秴鏃讹紝姝ｆ枃璇诲彇浣跨敤 30 绉掔┖闂?watchdog锛屽苟鍦ㄦ垚鍔熴€佸紓甯稿拰闀滃儚鍒囨崲璺緞娓呯悊璁℃椂鍣ㄣ€?- 鏇存柊閿欒鍒嗙被浼氬綊涓€鍖?`AbortError` / `TimeoutError`锛屽苟妫€鏌?Node `fetch` 鐨勫祵濂楀師鍥狅紝閬垮厤鎶婅繛鎺ユ嫆缁濊鎶ヤ负 DNS 鏁呴殰銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.39 -> 1.2.40` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.40 妗岄潰姝岃瘝涓庢洿鏂伴摼璺綆鍒嗛厤/鎶楀崱姝讳紭鍖栫増`銆?
## v1.2.39 妗岄潰姝岃瘝瑕嗙洊灞傝浇鑽蜂綆鍒嗛厤浼樺寲
- `v1.2.39` 缁х画闄嶄綆妗岄潰姝岃瘝/澹佺焊瑕嗙洊灞傞珮甯х巼鍚屾鐨勭煭鍛藉璞″垎閰嶏紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹瓕璇嶈緭鍑恒€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 澶嶇敤姝岃瘝蹇収銆佸姩鏁?鎾斁瀛愯浇鑽枫€侀鑹插璞°€佸畬鏁存闈㈡瓕璇?payload 鍜?wallpaper payload锛沗beatMap` 棣栨鍙戦€併€佸己鍒跺埛鏂般€佺鍚嶅垽閲嶅拰鏃犲湴鍥炬竻鐞嗚涔変繚鎸佸師鏍凤紝IPC 蹇収鍙栧緱鍚庨噴鏀捐妭濂忓浘涓庡绾稿皝闈㈠紩鐢ㄣ€?- 澶嶇敤瀵硅薄鍙湪褰撳墠鍚屾璋冪敤鍐呰鍙栵紝preload 閫氳繃 `ipcRenderer.invoke` 绔嬪嵆搴忓垪鍖?payload锛涗唬鐮佹梺鏄庣‘鏍囨敞涓嶈兘璺ㄥ抚淇濆瓨寮曠敤銆?- 6 绫诲叧閿姸鎬佸強闅忔満浜ら敊鐘舵€佺殑鏃?鏂拌浇鑽峰拰绛惧悕閫愰」涓€鑷达紝纭瀵硅薄韬唤澶嶇敤涓旈噸澶嶅彂閫佷笉浼氭畫鐣欐棫 `beatMap`銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.38 -> 1.2.39` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.39 妗岄潰姝岃瘝瑕嗙洊灞傝浇鑽蜂綆鍒嗛厤浼樺寲鐗坄銆?
## v1.2.38 姝屽崟鏋跺竷灞€涓庣敾璐?profile 浣庡垎閰嶄紭鍖?- `v1.2.38` 缁х画闄嶄綆 3D 姝屽崟鏋跺埛鏂颁笌鐢昏川妗ｄ綅鏌ヨ璺緞鐨勭煭鍛藉璞★紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹瓕鍗曟灦甯冨眬缁撴灉銆佹挱鏀惧叆鍙ｆ垨闀滃ご浜や簰銆?- `shelfLayoutProfile()` / `shelfSettings()` 澶嶇敤鍥哄畾缂撳瓨锛沗renderQualityProfile()` 杩斿洖鍐荤粨妗ｄ綅甯搁噺锛沗renderPowerState` 灏卞湴鏇存柊銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.37 -> 1.2.38` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.38 姝屽崟鏋跺竷灞€涓庣敾璐?profile 浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.37 鑸炲彴姝岃瘝缃戞牸 tick 浣庡垎閰嶄紭鍖?- `v1.2.37` 缁х画闄嶄綆鑸炲彴姝岃瘝鎸佺画鏄剧ず鏃剁殑姣忓抚鍑芥暟鍒嗛厤锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹瓕璇嶈緭鍑恒€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- `tickStageLyricMesh()` 妯″潡绾у鐢紝甯х姸鎬佸啓鍏?`stageLyricTickCtx`锛涘綋鍓嶈涓庨€€鍦鸿浠嶈蛋鍚屼竴 tick 璺緞銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.36 -> 1.2.37` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.37 鑸炲彴姝岃瘝缃戞牸 tick 浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.36 鐢靛奖鑺傛媿闀滃ご浜嬩欢姹犱笌姝岃瘝杩涘害浣庡垎閰嶄紭鍖?- `v1.2.36` 缁х画闄嶄綆鎾斁涓數褰辫妭鎷嶉暅澶翠簨浠躲€乴ive 璋冨害 payload 鍜岃垶鍙版瓕璇嶈繘搴﹁矾寰勭殑鐭懡瀵硅薄锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€侀暅澶磋緭鍑恒€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- `beatCam.events` 浣跨敤瀵硅薄姹狅細`acquireBeatCamEvent()` / `releaseBeatCamEvent()` / `clearBeatCamEvents()` / `removeBeatCamEventAt()` / `trimBeatCamEventsFront()`锛涗簨浠跺瓧娈典笌杩囨湡璇箟淇濇寔涓嶅彉銆?- live 鑺傛媿 `scheduleBeatCamera` 涓?`mergeRealtimeBeatCamera` tone 澶嶇敤鍥哄畾瀵硅薄锛涘抚鍘嬮噰鏍蜂笌姝岃瘝 intro/fallback 琛屼篃鏀逛负 scratch 澶嶇敤銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.35 -> 1.2.36` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.36 鐢靛奖鑺傛媿闀滃ご浜嬩欢姹犱笌姝岃瘝杩涘害浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.35 瀹炴椂鑺傛媿涓庣數褰辩敾鍍忎綆鍒嗛厤鎬ц兘浼樺寲
- `v1.2.35` 缁х画闄嶄綆鎾斁涓煶棰戝垎鏋愪笌鐢靛奖闀滃ご鏇茬洰鐢诲儚鐑矾寰勭殑鐭懡瀵硅薄涓庡嚱鏁板垎閰嶏紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佽妭鎷嶈瘑鍒緭鍑恒€佺數褰遍暅澶村弬鏁般€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- `processRealtimeBeatEngine()` 鐨勬寚鏁板寘缁滆窡闅忓嚱鏁版彁鍗囦负妯″潡绾?`beatFollow()`锛屽懡涓?鏈懡涓粨鏋滃鐢ㄥ浐瀹氬璞★紱鍏紡銆佹椂闂村父鏁板拰 DJ/鏅€氭ā寮忓垎鏀繚鎸佷笉鍙樸€?- 鍒嗘瀽甯у悜 `updateCinemaTrackProfile()` 浼犲叆澶嶇敤 sample锛岀嚎鎬ф贩鍚堟敼涓烘ā鍧楃骇 `mixToward()`锛涙洸鐩垎鏋?profile 浣跨敤鍥哄畾甯搁噺瀵硅薄锛屼笉鍐嶆瘡甯?姣忔鍛戒腑鏂板缓銆?- 鏅€?DJ 妯″紡鍚勮窇 720 甯ц妭鎷嶆ā鍨嬪苟瑕嗙洊 20+ 娆″懡涓紝瀵硅薄澶嶇敤绋冲畾锛涚數褰?profile 720 甯ф柊鏃ц矾寰勭姸鎬佸畬鍏ㄤ竴鑷淬€?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.34 -> 1.2.35` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.35 瀹炴椂鑺傛媿涓庣數褰辩敾鍍忎綆鍒嗛厤鎬ц兘浼樺寲鐗坄銆?
## v1.2.34 姝岃瘝鍏夌矑涓庢洿鏂扮紦瀛樺苟鍙戞€ц兘浼樺寲
- `v1.2.34` 缁х画闄嶄綆楂樺埛灞忚垶鍙版瓕璇嶃€佸畨榄傝瑙夊拰杞欢鏇存柊缂撳瓨澶嶇敤璺緞鐨勬棤鏁堝伐浣滐紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹瓕璇嶈緭鍑恒€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 姝岃瘝鍏夌矑鐪熸涓嶅彲瑙佸悗涓嶅啀姣忓抚閲嶇畻 132 涓矑瀛愮殑 396 涓?Float32 鍧愭爣鎴栬姹備綅缃紦鍐蹭笂浼狅紱鏃嬭浆浠嶈繛缁疮绉紝娣″嚭涓庨噸鏂板紑鍚甯ф寜褰撳墠缁濆鏃堕棿瀹屾暣閲嶇畻銆?- 涓诲惊鐜Щ闄ゆ案涔呴殣钘忓皬灏侀潰鐨?transform 鍐欏叆鍜岀┖ Float 灞傝皟鐢紱Home 娉㈠舰澶嶇敤宸叉煡璇㈣妭鐐癸紝闊抽鍖呯粶鍑芥暟涓嶅啀鍦ㄥ垎鏋愬抚鍐呴噸澶嶅垱寤恒€?- 瀹夐瓊鍛煎惛鍋忕Щ涓庢瓕璇嶉暅澶磋竟鐣屽鐢ㄥ悓姝?scratch 瀵硅薄锛涚浉鏈哄Э鎬佸彧鏇存柊浣嶇疆鍜屾湞鍚戞椂锛屼笉鍐嶇揣鎺ヤ富鐩告満鏇存柊鍚庨噸澶嶉噸绠楁姇褰辩煩闃点€?- 缂撳瓨瀹夎鍖呮牎楠屾寜鏂囦欢銆佺増鏈€佸ぇ灏忓拰鎽樿鎵ц singleflight锛?6 璺湰鍦板苟鍙戜笅杞借姹傞獙璇佷负涓€娆℃枃浠舵墦寮€/鍝堝笇銆佷竴涓?ready 浠诲姟锛屽け鏁堝拰寮傚父璺緞缁撴潫鍚庝細娓呯悊鍦ㄩ€旇褰曘€?- 闅忔満鐘舵€佹ā鍨嬭鐩栧厜绮掑垵濮嬪叧闂€佸紑鍚€佹贰鍑恒€佽法涓嶅彲瑙侀槇鍊煎拰闀挎椂闂村叧闂悗閲嶅紑锛涙墍鏈夊彲瑙佸抚 396 涓潗鏍囧強鏃嬭浆閫愬€间竴鑷淬€?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.33 -> 1.2.34` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.34 姝岃瘝鍏夌矑涓庢洿鏂扮紦瀛樺苟鍙戞€ц兘浼樺寲鐗坄銆?
## v1.2.33 娓叉煋绌洪棽涓庢洿鏂版牎楠屾€ц兘浼樺寲
- `v1.2.33` 闄嶄綆楂樺埛灞忕┖闂叉覆鏌撱€佽垶鍙版瓕璇嶆寔缁姩鐢诲拰瀹屾暣瀹夎鍖呮牎楠岀殑 CPU銆丟PU 涓婁紶涓庡唴瀛樻姈鍔紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹瓕璇嶈緭鍑恒€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 娑熸吉绾圭悊鏀逛负瑙﹀彂鏃舵爣鑴忋€佹椿鍔ㄦ湡闂村悓姝ャ€佹渶鍚庝竴甯ф竻闆讹紱5,000,000 涓函绌洪棽鍚堟垚甯т腑锛屼笂浼犺姹備粠 `5,000,000` 娆￠檷涓?`1` 娆★紝鏃?鏂版贩鍚堣Е鍙戝簭鍒楅€愬抚鏁版嵁涓€鑷淬€?- 鑸炲彴姝岃瘝澶嶇敤涓夌粍璇︽儏 profile銆侀瑙ｆ瀽 glow 鍩鸿壊鍜屽抚绾?spark 棰滆壊锛涙槦娌充袱缁?uniform 棰滆壊鍙湪璋冭壊鏉垮彉鍖栨椂閲嶇畻锛屼繚鐣欏師棰滆壊浜害涓嬮檺鍜屾潗璐?copy 璇箟銆?- 瀹屾暣瀹夎鍖呮敼涓哄紓姝ュ浐瀹氱紦鍐插垎鍧楀崟閬嶅搱甯岋紱Electron 42 瀵瑰疄闄?`v1.2.32` 绾?`99.87MiB` 瀹夎鍖呬笁杞熀鍑嗕腑锛屼腑浣嶈€楁椂绾︿笅闄?`15%`锛屼簨浠跺惊鐜渶澶у欢杩熺害涓嬮檷 `98%`锛岄澶?RSS 绾︿笅闄?`98%`銆?- 鏍￠獙閾捐矾瑕嗙洊 SHA256銆丼HA512 Base64/Hex銆佸弻鎽樿銆佷粎澶у皬銆佹憳瑕?澶у皬涓嶇銆佹枃浠剁己澶便€佺紦瀛樺鐢ㄥ拰闀滃儚鍥為€€锛涗笅杞戒换鍔″彧鏈夋牎楠屾垚鍔熷悗鎵嶈繘鍏?ready銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.32 -> 1.2.33` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.33 娓叉煋绌洪棽涓庢洿鏂版牎楠屾€ц兘浼樺寲鐗坄銆?
## v1.2.32 姝岃瘝娓告爣涓庢洸搴撴帓搴忔€ц兘浼樺寲
- `v1.2.32` 浼樺寲鎾斁涓殑姝岃瘝褰撳墠琛屽畾浣嶅拰鏈湴澶ф洸搴撶洰褰曟帓搴忥紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 鑸炲彴姝岃瘝椤哄簭鎾斁鏃跺彧浠庝笂娆℃父鏍囧悜鍓嶆帹杩涳紱鍒囨瓕銆佽烦鎾拰姝岃瘝鏁扮粍鍙樺寲鏃朵娇鐢?upper-bound 浜屽垎鍥為€€锛屼繚鐣欏師 `50ms` 鎻愬墠閲忎笌鍚屾椂闂存埑璇箟銆?- 300 琛屻€?80 绉掋€?44Hz 鍚堟垚鎾斁楠岃瘉涓紝姝岃瘝鏃堕棿鎴宠鍙栦粠 `2,372,940` 娆￠檷鍒?`52,026` 娆★紝绾﹀噺灏?`45.6` 鍊嶏紱`72,840` 娆￠殢鏈轰笌杈圭晫瀹氫綅缁撴灉鍜屾棫绠楁硶瀹屽叏涓€鑷淬€?- 鏈湴鏇插簱鏂囦欢鍚嶆帓搴忓鐢?`Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })`锛?0,000 椤瑰悎鎴愬熀鍑嗕粠绾?`1,680.9ms` 闄嶅埌 `59.9ms`锛屾帓搴忕粨鏋滈€愰」涓€鑷淬€?- 鍚屾淇鏇存柊闈㈡澘閬楃暀鐨?`APP_VERSION = 1.2.27`锛屽墠绔€佹湇鍔＄涓庢瀯寤虹増鏈粺涓€涓?`1.2.32`銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.31 -> 1.2.32` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.32 姝岃瘝娓告爣涓庢洸搴撴帓搴忔€ц兘浼樺寲鐗坄銆?
## v1.2.31 鎾斁瀹氭椂鍣ㄦ寜鐘舵€佷紤鐪犱紭鍖?- `v1.2.31` 灏嗘挱鏀捐繘搴?鍚瓕缁熻浠庢案涔?`280ms setInterval` 鏀逛负鎸夌湡瀹炴挱鏀剧姸鎬佽繍琛岀殑鍗曚换鍔¤嚜璋冨害锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 鏆傚仠銆佺粨鏉熴€佺┖闃熷垪鍜屾櫘閫氶殣钘忕姸鎬佹病鏈夋挱鏀?tick锛涙挱鏀惧紑濮嬩笌鎭㈠鍙鏃剁珛鍗抽噸鍚€?- 杩炵画 `play` / `playing` 浜嬩欢涓嶄細鍙犲姞瀹氭椂鍣紱鏆傚仠銆佺粨鏉熷拰绌烘簮浼氭竻鐞嗗敮涓€浠诲姟銆?- 鈥滅洿鎾悗鍙颁繚鎸佲€濆紑鍚椂闅愯棌鎾斁缁х画浣跨敤鍘?`280ms` 棰戠巼锛屽惉姝岀粺璁″拰杩涘害鏇存柊璇箟淇濇寔涓嶅彉銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.30 -> 1.2.31` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.31 鎾斁瀹氭椂鍣ㄦ寜鐘舵€佷紤鐪犱紭鍖栫増`銆?
## v1.2.30 闀块煶棰戞椂闀夸笌杩涘害鍒锋柊浣庢姈鍔ㄤ紭鍖?- `v1.2.30` 淇闀挎湰鍦版瓕鏇层€侀暱褰曢煶鍜屾湁澹板唴瀹圭殑鏃堕暱鍗曚綅璇垽锛屽苟缁х画闄嶄綆鎾斁杩涘害涓?Windows Media Session 鐨勫父椹诲埛鏂板紑閿€锛涗笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 鏈湴 `song.duration` 鎸夌澶勭悊锛宍durationMs` / `dt` 鎸夋绉掑鐞嗭紱鏃犳晥鎴栨棤闄愭椂闀夸細缁х画鍥為€€鍒版湁鏁堝瓧娈点€?- 杩涘害鏂囨湰鍙湪鏁存暟绉掓垨鎬绘椂闀垮彉鍖栨椂閲嶆柊鏍煎紡鍖栵紝杩涘害鏉′粛鎸夊師绮惧害骞虫粦鏇存柊锛涜妭鐐归噸寤哄悗浼氬己鍒惰ˉ鍐欏綋鍓嶈繘搴﹀拰鏃堕棿銆?- Media Session 鐨?900ms 鑺傛祦鎻愬墠鍒版椂闀裤€佷綅缃拰鎾斁閫熺巼璇诲彇涔嬪墠锛屽懡涓妭娴佹椂鐩存帴杩斿洖銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.29 -> 1.2.30` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.30 闀块煶棰戞椂闀夸笌杩涘害鍒锋柊浣庢姈鍔ㄤ紭鍖栫増`銆?
## v1.2.29 姝岃瘝缁樺瓧涓庤繘搴︽嫋鍔ㄤ綆鎶栧姩浼樺寲
- `v1.2.29` 缁х画鍥寸粫姝岃瘝璐村浘缁樺埗銆佽繘搴︽嫋鍔ㄥ拰绮掑瓙娓呯悊鍋氫綆椋庨櫓鎬ц兘涓庣ǔ瀹氭€т紭鍖栵紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 姝岃瘝瀛楄窛娴嬮噺/缁樺埗浣跨敤 Unicode code point 娓告爣锛屼繚鐣?Emoji銆佹墿灞曟眽瀛楀拰鍘熷瓧璺濊緭鍑猴紝涓嶅啀鍒涘缓 `Array.from` 瀛楃鏁扮粍銆?- 杩涘害鎷栧姩鍙鍙栦竴娆¤建閬撳竷灞€骞剁粦瀹氬彂璧锋寚閽堬紱蹇界暐鍙抽敭鍜屽叾浠栨寚閽堬紝闆跺杞ㄩ亾銆佸垏姝岀珵鎬佸強鎹曡幏涓㈠け鏃朵細瀹夊叏鎭㈠鐘舵€併€?- 姣忚疆涓変釜鎷栧姩绮掑瓙鏀逛负鍗曟 DOM 鎻掑叆鍜屽崟涓竻鐞嗕换鍔★紝绮掑瓙鏁伴噺銆佷綅缃€佸姩鐢绘椂闀垮拰璐ㄦ劅淇濇寔涓嶅彉銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.28 -> 1.2.29` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.29 姝岃瘝缁樺瓧涓庤繘搴︽嫋鍔ㄤ綆鎶栧姩浼樺寲鐗坄銆?
## v1.2.28 鍒楄〃绛惧悕涓庤繘搴︾儹璺緞浼樺寲
- `v1.2.28` 缁х画鍥寸粫鍒楄〃绛惧悕銆佹湰鍦伴煶璐ㄧ紦瀛橀敭銆佹挱鏀捐繘搴︽椂闂存牸寮忓寲鍜屽紩瀵煎熬杩硅鍓仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 姝屾洸鍓爣棰?鏈湴闊宠川缂撳瓨閿€?D 姝屽崟鏋?draw/rebuild 绛惧悕銆侀槦鍒楁覆鏌撴寚绾广€佹湰鍦版洸搴撻潰鏉跨鍚嶅拰鏈湴蹇収/璁板綍绛惧悕鏀逛负鐩存帴瀛楃涓叉嫾鎺ャ€?- 鎾斁杩涘害鏃堕棿鏍煎紡鍖栧幓鎺夌儹璺緞 `padStart`锛涘紩瀵煎熬杩归暱搴︿笌杩囨湡鐐规敼涓烘壒閲?`splice` 娓呯悊銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.27 -> 1.2.28` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.28 鍒楄〃绛惧悕涓庤繘搴︾儹璺緞浼樺寲鐗坄銆?
## v1.2.27 鍙屽昂瀵歌糠浣犳挱鏀惧櫒
- `v1.2.27` 鍦ㄤ繚鐣欏師 `360 脳 84` 鏍囧噯杩蜂綘鎾斁鍣ㄧ殑鍩虹涓婏紝鏂板鐙珛 `268 脳 58` 鏋佺畝杩蜂綘鎾斁鍣ㄣ€?- 鏋佺畝鐗堜笉鍒涘缓灏侀潰鑺傜偣銆佷笉鍔犺浇灏侀潰锛屼繚鐣欐瓕鏇插悕銆佹瓕鎵嬨€佷笂涓€棣栥€佹挱鏀?鏆傚仠銆佷笅涓€棣栧拰杩斿洖涓荤晫闈€?- 璁剧疆闈㈡澘涓庢墭鐩樿彍鍗曢兘鍙垏鎹⑩€滄爣鍑嗭紙甯﹀皝闈級/ 鏋佺畝锛堟棤灏侀潰锛夆€濓紝閫夋嫨鐢变富杩涚▼鎸佷箙鍖栥€?- 鏍囧噯鐗堝拰鏋佺畝鐗堝垎鍒繚瀛樻嫋鍔ㄤ綅缃紱鏋佺畝绐楀彛鐨勭姸鎬?IPC 涓嶆惡甯﹀皝闈㈠瓧娈点€?- 鏈鍙戝竷鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.26 -> 1.2.27` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.27 鍙屽昂瀵歌糠浣犳挱鏀惧櫒鐗坄銆?
## v1.2.26 杩蜂綘鎾斁鍣ㄧǔ瀹氭€т慨澶?- `v1.2.26` 淇杩蜂綘鎾斁鍣ㄨ繍琛屼竴娈垫椂闂村悗琚叾浠栫獥鍙ｈ鐩栥€佸啀娆″叧闂富鐣岄潰浠嶆棤娉曢噸鏂版樉绀虹殑闂銆?- 杩蜂綘绐楀彛鏄剧ず鏃堕噸鏂扮‘璁ゅ師鐢熺疆椤剁姸鎬侊紱鍋ュ悍绐楀彛鍙埛鏂?Z 搴忥紝琚郴缁熼殣钘忋€佹渶灏忓寲鎴栨樉绀哄櫒鍙樺寲鍚庤嚜鍔ㄦ媺鍥烇紝閿佸睆/浼戠湢鏈熼棿鏆傚仠鎭㈠瀹氭椂鍣ㄣ€?- 鐢ㄦ埛鎷栧姩浣嶇疆浼氭寔涔呭寲骞跺湪閲嶅惎鍚庢仮澶嶏紝绋嬪簭鏍℃涓庣敤鎴风Щ鍔ㄥ垎绂伙紝鍚屼竴鍧愭爣涓嶉噸澶嶅啓鐩樸€?- 鎾斁鐘舵€佸悓姝ヤ笉鍐嶉噸澶嶈В鏋愭瓕鏇插拰灏侀潰锛汭PC 杩斿洖澶辫触浼氭寜瀛楁澶辨晥缂撳瓨骞堕噸鍙戯紝绌洪槦鍒楀拰灏侀潰鍔犺浇澶辫触鐘舵€佸彲姝ｇ‘鎭㈠銆?- 娓叉煋杩涚▼棣栨宕╂簝浼樺厛閲嶈浇锛屾垚鍔熷姞杞藉墠鍐嶆宕╂簝浼氬崌绾т负绐楀彛閲嶅缓锛涙棫绐楀彛鍥炶皟涓嶄細璇竻鐞嗘柊瀹炰緥銆?- 浼樺寲鏃犳瓕璇嶅崰浣嶆娴嬶紝鍑忓皯 LRC/YRC/鑷畾涔夋瓕璇嶈繃婊ゆ椂鐨勪复鏃跺瓧绗︿覆鍒嗛厤銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.25 -> 1.2.26` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.26 杩蜂綘鎾斁鍣ㄧǔ瀹氭€т慨澶嶇増`銆?
## v1.2.25 绱у噾杩蜂綘鎾斁鍣?- `v1.2.25` 鏂板鍙紑鍏崇殑绱у噾杩蜂綘鎾斁鍣紝涓荤獥鍙ｆ渶灏忓寲鎴栧叧闂悗鏄剧ず `360 脳 84` 灏忕獥锛屾仮澶嶄富鐣岄潰鏃惰嚜鍔ㄩ殣钘忋€?- 灏忕獥鏄剧ず褰撳墠灏侀潰銆佹瓕鏇插悕鍜屾瓕鎵嬶紝骞舵彁渚涗笂涓€棣栥€佹挱鏀?鏆傚仠銆佷笅涓€棣栦笌杩斿洖涓荤晫闈紱绐楀彛鍙嫋鍔ㄣ€佺疆椤讹紝骞跺湪鏄剧ず鍣ㄥ彉鍖栧悗淇濇寔鍦ㄥ彲瑙佸伐浣滃尯銆?- 璁剧疆闈㈡澘鍜屾墭鐩樿彍鍗曞悓姝ユ彁渚涜糠浣犳挱鏀惧櫒寮€鍏筹紝涓昏繘绋嬫寔涔呭寲閫夋嫨锛涘叧闂紑鍏冲悗淇濇寔鍘熸湁鏈€灏忓寲銆佹墭鐩樺拰閫€鍑鸿涓恒€?- 鎾斁鎺у埗澶嶇敤鐜版湁鎾斁鍣ㄥ嚱鏁帮紝鍏冩暟鎹€佸皝闈㈠拰鎾斁鐘舵€佹寜瀛楁澧為噺鍚屾锛屼笉鏂板鍚庡彴杞锛岄伩鍏嶆殏鍋?缁х画鏃堕噸澶嶈法杩涚▼澶嶅埗灏侀潰銆?- 鏈鍙戝竷缁х画鍙笂浼犲畨瑁呭櫒鐩稿叧璧勪骇锛氬畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.24 -> 1.2.25` 蹇€熻ˉ涓侊紱Portable ZIP 璺宠繃銆?- Release 鏍囬浣跨敤 `Mineradio v1.2.25 绱у噾杩蜂綘鎾斁鍣ㄧ増`銆?
## v1.2.24 鎾斁涓庢瓕璇嶅悗鍙颁綆鎶栧姩浼樺寲
- `v1.2.24` 缁х画鍥寸粫鏈湴姝岃瘝瑙ｇ爜銆佹挱鏀句腑楂橀鐘舵€併€佸亸濂芥寔涔呭寲鍜屾闈㈡瓕璇嶅悓姝ュ仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹瓕璇嶆晥鏋溿€佹挱鏀惧叆鍙ｆ垨 3D 姝屽崟鏋朵氦浜掋€?- 鏈湴姝岃瘝/鏂囨湰瑙ｇ爜澶嶇敤 `TextDecoder` 缂撳瓨锛屼贡鐮佹浛鎹㈠瓧绗﹀拰 YRC 鍓嶅绌虹櫧鏀逛负鍗曟璁℃暟锛屽噺灏戦暱姝岃瘝瑙ｆ瀽鏃剁殑涓存椂鏁扮粍銆?- 闊抽噺鎷栧姩淇濇寔鍗虫椂鐢熸晥锛屽瓨鍌ㄥ啓鍏ユ敼涓哄仠鎵嬪悗鍚堝苟锛涙挱鏀句細璇濆父瑙勪繚瀛樼Щ鍒扮┖闂叉椂娈碉紝閫€鍑烘椂浠嶅己鍒惰惤鐩橈紝鍑忓皯鍚屾瀛樺偍鎿嶄綔瀵瑰姩鐢诲抚鐨勫共鎵般€?- 鎾斁鍥炬爣銆佹帶鍒舵爮鑺傜偣銆佹瓕鏇蹭俊鎭拰 Windows Media Session 鍏冩暟鎹鍔犵姸鎬佸垽閲嶏紝杩炵画闊抽浜嬩欢涓嶅啀閲嶅閲嶅缓鐩稿悓 DOM 鎴栫郴缁熷獟浣撳厓鏁版嵁銆?- 褰撳墠姝屾洸妗岄潰鍏冩暟鎹€佸皝闈㈢鍚嶅拰妗岄潰姝岃瘝 IPC 绛惧悕澶嶇敤缂撳瓨/鍥哄畾缂撳啿鍖猴紝鑺傚鍥惧瓧娈电洿鎺ュ啓鍏ユ渶缁堣浇鑽凤紝闄嶄綆妗岄潰姝岃瘝楂樺抚鐜囧悓姝ユ椂鐨勭煭鍛藉璞′笌鏁扮粍鍒嗛厤銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.23 -> 1.2.24` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.24 鎾斁涓庢瓕璇嶅悗鍙颁綆鎶栧姩浼樺寲鐗坄銆?
## v1.2.23 姝岃瘝瑙ｆ瀽涓庡崱鐗囩粯瀛椾綆鍒嗛厤浼樺寲
- `v1.2.23` 缁х画鍥寸粫鎾斁涓瓕璇嶅姞杞藉拰 3D 姝屽崟鏋跺崱鐗囬噸缁樺仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佸乏渚ф瓕鍗曘€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- LRC/YRC/鑷畾涔夋瓕璇嶅師鏂囨寜琛屽鐞嗘敼涓?`forEachNewlineRow()` 鍗曟鎹㈣鎵弿锛屼繚鐣?CRLF銆佸熬绌鸿銆佸弻璇悎骞躲€佺┖姝岃瘝杩囨护鍜岄€愬瓧鏃堕棿杞磋涔夛紝鍑忓皯闀挎瓕璇嶅姞杞芥椂鐨勬暣娈佃鏁扮粍鍒嗛厤銆?- 3D 姝屽崟鏋跺崱鐗囨爣棰?鍓爣棰樼粯鍒朵粠 `split('')` 鏀逛负瀛楃娓告爣鎵弿锛屼繚鎸佸師娴嬮噺鍜屾崲琛岀粨鏋滐紝闄嶄綆鍗＄墖閲嶇粯鏃剁殑鐭懡鏁扮粍鍒嗛厤銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.22 -> 1.2.23` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.23 姝岃瘝瑙ｆ瀽涓庡崱鐗囩粯瀛椾綆鍒嗛厤浼樺寲鐗坄銆?
## v1.2.22 妗岄潰姝岃瘝鍚庡彴杞浣庡垎閰嶄紭鍖?- `v1.2.22` 缁х画鍥寸粫妗岄潰姝岃瘝鍜屾闈㈠３鐘舵€佸悓姝ュ仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佸乏渚ф瓕鍗曘€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 妗岄潰姝岃瘝涓敭閿佸畾杞鐨?stdout 瑙ｆ瀽鏀逛负娴佸紡鍗曟鎵弿锛屼繚鐣?`MMB` 瑙﹀彂璇箟鍜屽崐琛岀紦瀛樿涓猴紝鍑忓皯鍚庡彴杞灏忓垎閰嶃€?- 妗岄潰 UI 鐘舵€佽ˉ涓佸啓鍏ユ敼鐢?`for...in` 閬嶅巻瀛楁锛屼繚鎸佺櫧鍚嶅崟銆佸垹闄ょ┖鍊煎拰瓒呭ぇ鍊艰烦杩囪涔変笉鍙橈紝闄嶄綆杩炵画鎷栧姩璁剧疆鏃剁殑鐭懡鏁扮粍銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.21 -> 1.2.22` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.22 妗岄潰姝岃瘝鍚庡彴杞浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.21 姝岃瘝鏂囨湰浣庡垎閰嶄紭鍖?- `v1.2.21` 缁х画鍥寸粫鎾斁涓珮棰戞枃鏈鐞嗗拰璇︽儏椤垫覆鏌撳仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佸乏渚ф瓕鍗曘€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 鑸炲彴姝岃瘝鎹㈣浠?`split/filter/slice` 涓存椂鏁扮粍鏀逛负鍗曟鎵弿锛屼繚鐣欏師鏈夎嫳鏂囨寜璇嶃€佷腑鏂囨寜瀛楃鐨勬崲琛岃涔夈€?- 鑸炲彴姝岃瘝鍜屾闈㈡瓕璇嶇殑琛屽綊涓€鍖栧鐢ㄨ交閲?helper锛屼繚鎸佺┖鐧藉帇缂┿€佺┖琛岃繃婊ゃ€佹渶澶ц鏁板拰鏄剧ず鏂囨涓嶅彉銆?- 姝屾墜璇︽儏椤佃瘎璁哄拰鐑棬姝屾洸鍒楄〃鏀逛负寰幆鎷兼帴 HTML锛屽噺灏戞墦寮€璇︽儏椤垫椂鐨勪腑闂存暟缁勫垎閰嶏紝鎸夐挳鍜岀偣鍑昏涓轰笉鍙樸€?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.20 -> 1.2.21` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.21 姝岃瘝鏂囨湰浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.20 鏇存柊闈㈡澘杞浣庢姈鍔ㄤ紭鍖?- `v1.2.20` 缁х画鍥寸粫杞欢鍐呮洿鏂伴摼璺仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 鏇存柊闈㈡澘鏂板鍐呭銆佺姸鎬佸拰杩涘害绛惧悕锛屼笅杞?琛ヤ竵鐘舵€佽疆璇㈡湭鍙樺寲鏃惰烦杩囬噸澶?DOM 鏂囨湰銆佹寜閽姸鎬佸拰杩涘害鏉″啓鍏ャ€?- 鏇存柊涓嬭浇杩涘害鍊兼湭鍙樺寲鏃朵笉鍐嶉噸澶嶅啓 `width` 鍜?SVG ring offset锛屽噺灏戞洿鏂伴潰鏉挎墦寮€鎴栦笅杞芥椂鐨勭粏纰庢牱寮忛噸绠椼€?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.19 -> 1.2.20` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.20 鏇存柊闈㈡澘杞浣庢姈鍔ㄤ紭鍖栫増`銆?
## v1.2.19 鏇存柊浠诲姟鐘舵€佷綆鍒嗛厤浼樺寲
- `v1.2.19` 缁х画鍥寸粫鏈湴鎾斁鍣ㄥ悗鍙扮淮鎶ゅ拰杞欢鍐呮洿鏂伴摼璺仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 鏇存柊涓嬭浇/琛ヤ竵鐘舵€佹帴鍙ｆ敼涓哄崟娆℃壂鎻忔渶鏂颁换鍔★紝涓嶅啀涓轰簡杞鐘舵€佸垱寤哄畬鏁翠换鍔℃暟缁勫苟鎺掑簭銆?- 鏇存柊浠诲姟瑁佸壀鍙淮鎶?8 鏉℃渶鏂颁换鍔＄殑灏忕獥鍙ｏ紝閬垮厤鍏ㄩ噺鎺掑簭銆乣slice` 鍜岄澶栧洖璋冦€?- 瀹夎鍖呬笅杞藉拰蹇€熻ˉ涓佷笅杞界殑浠诲姟澶嶇敤鍒ゆ柇缁熶竴璧拌交閲?helper锛屼繚鎸佸師鏈夌姸鎬佽涔夈€?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.18 -> 1.2.19` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.19 鏇存柊浠诲姟鐘舵€佷綆鍒嗛厤浼樺寲鐗坄銆?
## v1.2.18 鏈湴缂撳瓨娓呯悊浣庡垎閰嶄紭鍖?- `v1.2.18` 缁х画鍥寸粫鏈湴鎾斁鍣ㄩ暱鏃堕棿杩愯銆佸悗鍙扮紦瀛樻竻鐞嗗拰澶ф洸搴撶淮鎶ゅ仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 杩愯鏃剁紦瀛樼粺璁℃敼涓虹洿鎺ヨ鏁帮紝閬垮厤瀹氭湡鎬ц兘蹇収涓?playlist cover銆乥eat map 绛夌紦瀛樺垱寤?key 鏁扮粍銆?- 鏈湴璧勪骇鍐呭瓨缂撳瓨瑁佸壀鍏堣鏁板啀鏀堕泦鍙垹闄ゅ€欓€夛紝淇濇姢椤逛笉鍐嶅弬涓庢帓搴忥紝鍑忓皯鍚庡彴 trim 闃舵鐨勪复鏃跺璞″拰鏌ヨ〃銆?- IndexedDB 缂撳瓨娓呯悊鍦ㄦ爣璁板垹闄ゆ椂鍚屾缁存姢 id 鍒楄〃锛屾湯灏句笉鍐嶅 drop set 鍋?`Object.keys()` 鍏ㄩ噺鍙栭敭銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.17 -> 1.2.18` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.18 鏈湴缂撳瓨娓呯悊浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.17 鏈湴灏侀潰缂撳瓨闃熷垪浣庢姈鍔ㄤ紭鍖?- `v1.2.17` 缁х画鍥寸粫鏈湴鎾斁鍣ㄩ暱鏃堕棿杩愯鍜屽ぇ鏇插簱婊氬姩鍋氫綆椋庨櫓鎬ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 鏈湴灏侀潰缂╃暐鍥剧粨鏋滅紦瀛樸€佺缉鐣ュ浘鐢熸垚骞跺彂缂撳瓨鍜屽皝闈㈡繁搴︾紦瀛樼殑闃熼瑁佸壀鏀逛负 head 娓告爣鎺ㄨ繘锛岄伩鍏嶉绻?`shift()` 甯︽潵鐨勬暟缁勬惉绉汇€?- 姝岃瘝 fetch 灏忕紦瀛樿鍓悓姝ユ敼涓烘父鏍囧紡缁存姢锛岀粺涓€鍚岀被缂撳瓨闃熷垪鐨勪綆鍒嗛厤瀹炵幇銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.16 -> 1.2.17` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.17 鏈湴灏侀潰缂撳瓨闃熷垪浣庢姈鍔ㄤ紭鍖栫増`銆?
## v1.2.16 鏈湴瀵煎叆涓庡厓鏁版嵁瑙ｆ瀽浣庡垎閰嶄紭鍖?
- `v1.2.16` 缁х画鍥寸粫鏈湴鏂囦欢瀵煎叆銆佹洸搴撴壂鎻忓拰鏍囩鍏冩暟鎹В鏋愬仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 姝岃瘝/灏侀潰鍖归厤绱㈠紩鐩存帴閬嶅巻浼犲叆鏂囦欢闆嗗悎锛屽噺灏戝ぇ鏂囦欢澶瑰鍏ユ椂鐨勯噸澶嶆暟缁勫鍒躲€?- 鏈湴璧勪骇绛惧悕銆佹洸搴撴枃浠剁鍚嶅拰鏈湴姝屾洸 key 鏀逛负鐩存帴鎷兼帴锛宐asename 瑙ｆ瀽涓嶅啀浣跨敤 `split().pop()`銆?- MP3/FLAC 鍏冩暟鎹鍙栧鐢?`TextDecoder`锛孖D3 鏂囨湰甯?key 鏀逛负 `switch`锛屽噺灏戞爣绛炬壂鎻忔湡闂寸殑涓存椂瀵硅薄銆?- 涓昏繘绋嬫湰鍦版洸搴?stat worker 鏀逛负鏄惧紡寰幆鍒涘缓锛岄伩鍏嶆壂鎻忓紑濮嬪墠棰濆 `Array.from` 鍒嗛厤銆?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.15 -> 1.2.16` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.16 鏈湴瀵煎叆涓庡厓鏁版嵁瑙ｆ瀽浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.15 鏈湴鎾斁鍣ㄧ紦瀛樹笌姝岃瘝浣庡垎閰嶄紭鍖?
- `v1.2.15` 缁х画鍥寸粫鏈湴鎾斁鍣ㄥ垏姝屻€佹瓕璇嶈В鏋愩€佽妭濂忕紦瀛樸€佸皝闈㈡繁搴︾紦瀛樺拰鏇存柊鐘舵€佸仛浣庨闄╀紭鍖栵紝涓嶆敼鍙?UI銆佽瑙夎川鎰熴€佹挱鏀炬帶鍒舵垨 3D 姝屽崟鏋朵氦浜掋€?- 鏈湴搴撱€佹瓕鍗曞拰姝屾墜璇︽儏鐨勬暣闃熸挱鏀炬敼鐢ㄦ樉寮忓惊鐜壒閲忓厠闅嗭紝鍑忓皯澶ф洸搴?澶ф瓕鍗曞叆闃熸椂鐨勫洖璋冨垎閰嶃€?- LRC/YRC銆佽嚜瀹氫箟姝岃瘝鍜屾湰鍦版瓕璇嶅姞杞借矾寰勫噺灏?`map/filter/forEach` 涓棿鏁扮粍锛岄檷浣庡垏姝岃鍙栭暱姝岃瘝鏃剁殑涓荤嚎绋嬫姈鍔ㄣ€?- 鏈湴鑺傚缂撳瓨鎵撳寘/瑙ｅ寘銆佸皝闈㈡繁搴︾紦瀛樿鍓拰鎼滅储鐜荤拑璐村浘鍙樻洿妫€娴嬫敼涓烘洿杞荤殑寰幆璺緞锛屽噺灏戝悗鍙扮淮鎶や换鍔″拰鎼滅储鍖哄煙鍒锋柊鏃剁殑鐭懡瀵硅薄銆?- 杞欢鍐呮洿鏂伴潰鏉块粯璁ゅ綋鍓嶇増鏈慨姝ｄ负 `1.2.15`锛屾病鏈夊彲鐢ㄦ洿鏂版椂淇濇寔鏄剧ず褰撳墠鐗堟湰锛屽苟鏀逛负缁熶竴鍓嶇鐗堟湰甯搁噺锛岄伩鍏嶅悗缁彂甯冩紡鏀规棫鐗堟湰鍙枫€?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.14 -> 1.2.15` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.15 鏈湴鎾斁鍣ㄧ紦瀛樹笌姝岃瘝浣庡垎閰嶄紭鍖栫増`銆?
## v1.2.14 鏈湴鎾斁鍣ㄤ綆鍒嗛厤鎬ц兘浼樺寲

- `v1.2.14` 缁х画鍥寸粫鏈湴鎾斁鍣ㄥ惎鍔ㄣ€佹悳绱€丠ome 棣栧睆銆佸惉姝岀粺璁°€両ndexedDB 缂撳瓨娓呯悊鍜屽ぇ鏇插簱鎭㈠鍋氫綆椋庨櫓鎬ц兘浼樺寲锛屼笉鏀瑰彉 UI銆佽瑙夎川鎰熸垨鎾斁浜や簰鍏ュ彛銆?- 鏈湴璧勪骇缂撳瓨璇诲彇銆佹洸搴撳揩鐓х鍚嶃€佺储寮?lookup 鍜岀储寮曞悓姝ュ噺灏戜腑闂存暟缁勪笌鍥炶皟鎵弿锛岄檷浣庡ぇ鏇插簱鎭㈠鍜屽悗鍙扮紦瀛樿ˉ姘存椂鐨勪富绾跨▼鍒嗛厤銆?- 鎼滅储鍘嗗彶銆佹悳绱㈢粨鏋滅紦瀛樺懡涓拰 Home 棣栧睆椹禌鍏嬪皝闈㈡敹闆嗘敼涓洪檺閲忓惊鐜垨鐩存帴澶嶇敤锛屽噺灏戣繛缁墦寮€鎼滅储鍜屽惎鍔ㄩ灞忕殑鐭懡瀵硅薄銆?- 鍚瓕缁熻缁撶畻鏀逛负鍗曟寰幆鍚堝苟鍘嗗彶骞惰交閲忔媶鍒嗘瓕鎵嬪悕锛岄檷浣庡垏姝岃矾寰勯澶栧垎閰嶃€?- IndexedDB 缂撳瓨娓呯悊鍏堢粺璁℃湰鍦板簱鏂囦欢澶规渶鏂版椂闂村啀鎺掑簭锛岄伩鍏嶅湪鎺掑簭姣旇緝鍣ㄤ腑閲嶅鎵弿瀹屾暣璁板綍琛ㄣ€?- 鏈鍙戝竷鎸夊綋鍓嶇敤鎴峰亸濂藉彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml` 鍜?SHA256 鏍￠獙鏂囦欢锛汸ortable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.14 鏈湴鎾斁鍣ㄤ綆鍒嗛厤鎬ц兘浼樺寲鐗坄銆?
## v1.2.13 鎾斁鍚姩涓庢湰鍦板鍏ユ€ц兘浼樺寲

- `v1.2.13` 缁х画鍥寸粫鎾斁鍣ㄥ惎鍔ㄣ€佺偣姝屽埌鍑哄０銆佹湰鍦版悳绱€?D 姝屽崟璇︽儏鍜屽ぇ鏇插簱瀵煎叆鍋氫綆椋庨櫓鎬ц兘浼樺寲锛屼笉鏀瑰彉瑙嗚銆佹挱鏀炬帶鍒跺拰姝屽崟鏋朵氦浜掕璁°€?- 鏈湴姝屾洸鍒囨瓕璺緞鍏堣缃煶棰戞簮骞跺埛鏂伴槦鍒楃姸鎬侊紝鏍囩鍏冩暟鎹敼涓哄悗鍙拌ˉ榻愶紝鍑忓皯澶?FLAC銆佸喎缂撳瓨鎴栨満姊扮‖鐩樹笅鐨勬挱鏀惧惎鍔ㄧ瓑寰呫€?- 3D 姝屽崟璇︽儏鎵撳紑鏈湴搴撴椂澶嶇敤鍘熸瓕鏇叉暟缁勶紝鍙湁鎾斁鍏ラ槦鏃舵墠鍏嬮殕瀵硅薄锛涙湰鍦版瓕鏇插彲鎾斁鍒ゆ柇璇嗗埆 `localKey`锛屼笉鍐嶅彧渚濊禆鍦ㄧ嚎 `id`銆?- 鍒楄〃鐑矾寰勬敼涓虹函瀛楃涓?HTML 杞箟锛屽苟缂撳瓨姝屾洸鍓爣棰樺拰鏈湴闊宠川鏂囨湰锛岄檷浣庨槦鍒椼€佹悳绱㈠拰姝屽崟鏋堕噸澶嶆牸寮忓寲寮€閿€銆?- 鏈湴绌烘悳绱㈤粯璁ょ粨鏋滃拰澶ф枃浠跺す瀵煎叆缁х画鍑忓皯涓棿鏁扮粍锛屽皝闈㈢储寮曚笌姝屾洸鏋勯€犳敼鐢ㄦ樉寮忛檺閲忓惊鐜拰鍗曟鏋勯€犮€?- 鏈鍙戝竷鎸夌敤鎴疯姹傚彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.12 -> 1.2.13` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.13 鎾斁鍚姩涓庢湰鍦板鍏ユ€ц兘浼樺寲鐗坄銆?
## v1.2.12 鎼滅储涓庡垪琛ㄤ綆鍒嗛厤浼樺寲

- `v1.2.12` 缁х画鍥寸粫鎾斁鍣ㄥ惎鍔ㄣ€佹悳绱㈣緭鍏ャ€佸乏渚ф湰鍦版洸搴撻潰鏉垮拰 3D 姝屽崟鏋跺埛鏂板仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉瑙嗚銆佹挱鏀惧拰姝屽崟鏋朵氦浜掗€昏緫銆?- 鏈湴鎼滅储绱㈠紩鏂囨湰鎷兼帴鏀逛负鐩存帴鎷兼帴瀛楁锛屾悳绱㈠拰绱㈠紩棰勭儹鏃朵笉鍐嶄负姣忛姝屽垱寤哄瓧娈垫暟缁勫拰 `filter` 鍥炶皟銆?- 宸︿晶鏈湴鏇插簱闈㈡澘鍙鍗＄墖鏀逛负鍗曟寰幆鐢熸垚 HTML锛屾粴鍔ㄥ姞杞芥洿澶氭椂鍑忓皯 `slice/map/join` 涓棿鏁扮粍銆?- 3D 姝屽崟鏋堕潪闃熷垪鏁版嵁绛惧悕鏀逛负鐩存帴閲囨牱澶村熬椤癸紝鍑忓皯 rebuild 鍒ゆ柇鏃剁殑涓存椂鏁扮粍鍜屽洖璋冨垎閰嶃€?- 鏈鍙戝竷鎸夌敤鎴疯姹傚彧涓婁紶瀹屾暣瀹夎鍣ㄧ浉鍏宠祫浜э細瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.11 -> 1.2.12` 蹇€熻ˉ涓侊紱Portable ZIP 鏈璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.12 鎼滅储涓庡垪琛ㄤ綆鍒嗛厤浼樺寲鐗坄銆?
## v1.2.11 鏈湴鏇插簱浣庡垎閰嶆€ц兘浼樺寲

- `v1.2.11` 缁х画鍥寸粫鏈湴澶ф洸搴撴仮澶嶃€佸鍏ュ拰鍚庡彴灏侀潰/姝岃瘝琛ラ綈鍋氫綆椋庨櫓鎬ц兘浼樺寲锛屼笉鏀瑰彉宸︿晶姝屽崟鏄剧ず/闅愯棌銆佸浐瀹氭寜閽拰 3D 姝屽崟鏋垛€滆嚜鍔ㄩ殣钘?/ 甯搁┗鈥濋€昏緫銆?- 鏈湴璧勪骇缂撳瓨琛ユ按鏀逛负鎸夎寖鍥磋鍙栵紝鍒嗗潡闃舵涓嶅啀鍙嶅 `slice` 鐢熸垚涓存椂鏁扮粍锛屽惎鍔ㄦ仮澶嶅拰澶ф洸搴撳鍏ュ悗鏇村皯涓荤嚎绋嬪垎閰嶃€?- 鍚庡彴璧勬簮棰勮浇鍊欓€夈€佹挱鏀鹃槦鍒椾綅缃槧灏勫拰鎺掑簭闃熷垪鏀逛负鍗曟寰幆鐢熸垚锛屽苟澶嶇敤鍚屼竴杞€欓€夌粨鏋滐紝鍑忓皯灏侀潰/姝岃瘝琛ラ綈鍚姩鍓嶇殑閲嶅鎵弿銆?- 鎼滅储缁撴灉銆侀槦鍒楀拰姝屽崟璇︽儏绛夊垪琛ㄥ叆鍦哄姩鐢诲彧鏀堕泦瀹為檯闇€瑕佸姩鐢荤殑鍓嶅嚑椤癸紝閬垮厤瀹屾暣 NodeList 杞暟缁勫悗鍐嶆埅鏂€?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.10 -> 1.2.11` 蹇€熻ˉ涓併€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.11 鏈湴鏇插簱浣庡垎閰嶆€ц兘浼樺寲鐗坄銆?
## v1.2.10 澶氱淮鎬ц兘浼樺寲

- `v1.2.10` 缁х画鍥寸粫鍚姩銆佹悳绱€侀槦鍒椼€?D 姝屽崟鏋跺拰鏈湴澶ф洸搴撴仮澶嶅仛浣庨闄╂€ц兘浼樺寲锛屼笉鏀瑰彉宸︿晶姝屽崟鏄鹃殣鍜?3D 姝屽崟鏋跺父椹?鑷姩闅愯棌閫昏緫銆?- 鑷畾涔夊皝闈€佽嚜瀹氫箟姝岃瘝銆佺敤鎴疯瑙夊瓨妗ｃ€佹悳绱㈠巻鍙插拰 Home 鍚瓕鐢诲儚鏀逛负鎸夐渶璇诲彇鎴栧鐢ㄥ唴瀛樼紦瀛橈紝鍑忓皯棣栧睆鍚屾 `localStorage` JSON 瑙ｆ瀽銆?- 3D 姝屽崟鏋堕槦鍒楀崱鐗囨敼涓哄彲瑙佺獥鍙ｆ噿鏋勯€狅紝闃熷垪銆佹悳绱㈢粨鏋滃拰姝屽崟璇︽儏 HTML 鏀逛负寰幆鎷兼帴锛岄檷浣庡ぇ闃熷垪鍜岃繛缁悳绱㈡椂鐨勫垎閰嶅帇鍔涖€?- 鏈湴鎼滅储姹犮€佹悳绱㈢储寮曢鐑€佹洸搴撶储寮曚繚瀛樺拰鏇插簱蹇収淇濆瓨鍑忓皯涓棿鏁扮粍锛岃秴澶ф洸搴撳鍏ャ€佹仮澶嶅拰鍚庡彴鍒锋柊鏃朵富绾跨▼鏇寸ǔ銆?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.9 -> 1.2.10` 蹇€熻ˉ涓併€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.10 澶氱淮鎬ц兘浼樺寲鐗坄銆?
## v1.2.9 鍚姩涓庢瓕鍗曟灦鎬ц兘浼樺寲

- `v1.2.9` 缁х画浼樺寲鎾斁鍣ㄥ惎鍔ㄩ€熷害鍜屾挱鏀句腑浜や簰娴佺晠搴︼紝閲嶇偣鍑忓皯棣栧睆鍓嶅悓姝?JSON 瑙ｆ瀽鍜?3D 姝屽崟鏋堕珮棰戝懡涓紑閿€銆?- 鏈湴鑺傚缂撳瓨鍜岃妭濂忓亸濂芥敼涓烘寜闇€璇诲彇锛屽彧鏈夋墦寮€鑺傚鍒嗘瀽闈㈡澘鎴栧疄闄呰鍐欑紦瀛樻椂鎵嶈В鏋愭湰鍦版暟鎹€?- 娓呯悊鐢ㄦ埛瑙嗚瀛樻。鐨勯噸澶嶅嚱鏁板０鏄庯紝閬垮厤鍚庡０鏄庤鐩栧墠澹版槑閫犳垚缁存姢璇垽锛屽苟鍑忓皯鍓嶇鑴氭湰瑙ｆ瀽璐熸媴銆?- 鍚屼竴娆℃寚閽堜簨浠跺唴澶嶇敤 Raycaster 涓庡崱鐗囧懡涓粨鏋滐紝璇︽儏琛屻€侀潰鏉垮拰鍗＄墖灞忓箷鍛戒腑澶嶇敤涓存椂鏁扮粍锛屽噺灏戦珮棰戜氦浜掓湡闂寸殑瀵硅薄鍒嗛厤銆?- 榧犳爣绉诲姩鍙湪闈㈡澘鍙鎴栫‘瀹為渶瑕佹椂璇诲彇鐭╁舰锛屾瓕鍗曟灦闃熷垪绛惧悕鏀逛负鍥哄畾灏忚寖鍥撮噰鏍凤紝閬垮厤澶ч槦鍒楁寔缁挱鏀炬椂鍙嶅鍏ㄩ噺鎵弿銆?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.8 -> 1.2.9` 蹇€熻ˉ涓併€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.9 鍚姩涓庢瓕鍗曟灦鎬ц兘浼樺寲鐗坄銆?
## v1.2.8 鍏ㄦ柟闈㈡€ц兘缁嗚妭浼樺寲

- `v1.2.8` 缁х画鍑忓皯鎾斁涓崱椤垮拰鎺夊抚锛岄噸鐐逛紭鍖栨湰鍦版悳绱㈠喎鍚姩銆佸悗鍙板皝闈?姝岃瘝琛ラ綈銆佹闈㈡瓕璇?IPC銆佹挱鏀捐繘搴︿繚瀛樺拰涓昏繘绋嬫壂鐩樸€?- 鏈湴鏇插簱鎭㈠鍚庝細绌洪棽棰勭儹鎼滅储绱㈠紩锛屽悗鍙扮礌鏉愪换鍔′細鎸夊抚鍘嬪姏鍚堝苟杩涘害涓庡垪琛ㄥ埛鏂帮紝鍑忓皯澶ф洸搴撲笅杩炵画 DOM 閲嶇粯銆?- 妗岄潰姝岃瘝鍜屽绾告ā寮忓湪鍘嬪姏楂樻垨鍚庡彴鏃惰嚜鍔ㄩ檷棰戯紝姝ｅ父鍙鎾斁浠嶄繚鎸佸師鏉ョ殑瑙嗚鐏垫晱搴︺€?- 妗岄潰澹?UI 鐘舵€佸浠芥敼涓虹煭寤惰繜鍚堝苟鍐欏叆锛岃繛缁嫋鍔ㄨ瑙夋粦鏉℃垨鍒囨崲璁剧疆鏃跺噺灏?IPC 涓庡啓鐩樻姈鍔紝閫€鍑哄墠浼氳嚜鍔?flush銆?- 涓昏繘绋嬬洰褰曢亶鍘嗗鍔犲畾鏈熻姝ワ紝瓒呭ぇ鏇插簱 stat 骞跺彂鏇翠繚瀹堬紝闄嶄綆瀵煎叆鍜屽悗鍙板埛鏂版湡闂寸殑鎶栧姩銆?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.7 -> 1.2.8` 蹇€熻ˉ涓侊紱Portable ZIP 鍙寜闇€璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.8 鍏ㄦ柟闈㈡€ц兘缁嗚妭浼樺寲鐗坄銆?
## v1.2.7 鎾斁鍣ㄥ崱椤挎帀甯х患鍚堜紭鍖?
- `v1.2.7` 缁х画鍑忓皯鎾斁涓崱椤垮拰鎺夊抚锛岄噸鐐逛紭鍖栭槦鍒椼€佹湰鍦版洸搴撳垪琛ㄣ€佹瓕鍗曡鎯呫€佹悳绱㈣緭鍏ュ拰鍚庡彴鏈湴绱犳潗浠诲姟銆?- 鍒楄〃娓叉煋銆佹悳绱?debounce銆佸垪琛ㄥ姩鐢诲拰婊氬姩鎳掑姞杞戒細璺熼殢杩愯鏃跺抚鍘嬪姏鑷姩闄嶈浇锛屾挱鏀剧晫闈㈡洿绋炽€?- 澶ф洸搴撴仮澶嶅拰瀵煎叆鍏堟樉绀洪灞忛槦鍒椾笌鎾斁鐘舵€侊紝鍐嶅悗鍙板垎鍧楄鍙栧皝闈?姝岃瘝缂撳瓨锛岄檷浣庡惎鍔ㄥ拰瀵煎叆鏃剁殑鍗￠】銆?- 涓昏繘绋嬫湰鍦板簱鎵弿瀵硅秴澶ф洸搴撻檷浣?stat 骞跺彂锛屽苟瀹氭湡璁╁嚭浜嬩欢寰幆锛屽噺灏戞壂鐩樻湡闂寸殑涓昏繘绋嬫姈鍔ㄣ€?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.6 -> 1.2.7` 蹇€熻ˉ涓侊紱Portable ZIP 鍙寜闇€璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.7 鎾斁鍣ㄥ崱椤挎帀甯х患鍚堜紭鍖栫増`銆?
## v1.2.6 鎾斁鐣岄潰鎺夊抚淇濇姢浼樺寲

- `v1.2.6` 閲嶇偣浼樺寲鎾斁鐣岄潰鍗￠】鍜屾帀甯э紝鏂板杩愯鏃跺抚鍘嬪姏妫€娴嬶紝鎸佺画闀垮抚鏃朵复鏃堕檷浣庨潪鏍稿績浠诲姟瀵嗗害銆?- 鍚庡彴灏侀潰/姝岃瘝琛ラ綈銆佽妭濂忓垎鏋愩€佸皝闈㈤鑹插埛鏂般€侀槦鍒楅潰鏉垮拰姝屽崟鏋堕噸寤轰細鍦ㄥ帇鍔涙湡闂磋嚜鍔ㄨ璺紝鍑忓皯鍚屼竴甯?UI/Canvas/DOM 鎶㈠崰銆?- 鍙鎾斁榛樿浠嶄繚鎸侀珮鍒?VSync 鍜屾棦鏈夎瑙夎川鎰燂紝鍙湪鎸佺画鎺夊抚鏃剁煭鏆傞檺甯т繚鎶わ紝鍘嬪姏鎭㈠鍚庤嚜鍔ㄥ洖鍒板師鐘舵€併€?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.5 -> 1.2.6` 蹇€熻ˉ涓侊紱Portable ZIP 鍙寜闇€璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.6 鎾斁鐣岄潰鎺夊抚淇濇姢浼樺寲鐗坄銆?
## v1.2.5 灏侀潰娓叉煋鎬ц兘浼樺寲

- `v1.2.5` 閲嶇偣鍑忓皯闃熷垪銆佹悳绱㈢粨鏋滃拰鏈湴鏇插簱鍒楄〃閲岀殑灏侀潰閲嶅璁＄畻锛岄檷浣庢挱鏀剧晫闈㈠崱椤垮拰鎺夊抚銆?- 灏侀潰婧愬拰灏侀潰绛惧悕浼氭寕鍦ㄦ瓕鏇插璞′笂鍋氳交閲忕紦瀛橈紝鍚屼竴甯у澶勬覆鏌撲笉鍐嶅弽澶嶅鐞?data URL 鍜屽瓧绗︿覆绛惧悕銆?- 鏈湴灏侀潰鍒楄〃鏄剧ず浼樺厛浣跨敤缂╃暐鍥撅紝閬垮厤澶у浘 data URL 鐩存帴杩涘叆鎼滅储缁撴灉銆侀槦鍒楀拰鏇插簱鍒楄〃銆?- 闀垮垪琛ㄥ鍔犲彲瑙佹€ц鍓紝鎼滅储杩炵画杈撳叆鏃惰妭娴佸叆鍦哄姩鐢伙紝骞堕伩鍏嶆櫘閫氭悳绱㈢粨鏋滃彉鍖栬Е鍙戠幓鐠?SVG 璐村浘閲嶇畻銆?- 鏈鍙戝竷涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.4 -> 1.2.5` 蹇€熻ˉ涓侊紱Portable ZIP 鍙寜闇€璺宠繃銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.5 灏侀潰娓叉煋鎬ц兘浼樺寲鐗坄銆?
## v1.2.4 鏈湴鎼滅储鎬ц兘浼樺寲

- `v1.2.4` 閲嶇偣浼樺寲鏈湴澶ф洸搴撴悳绱㈣緭鍏ユ椂鐨勪富绾跨▼鍗犵敤銆?- 鍚屼竴鏇插簱鍜屽悓涓€鍏抽敭璇嶄細澶嶇敤涓婃鎼滅储缁撴灉锛岄伩鍏嶉噸澶嶆壂鎻忋€?- 褰撲笂涓€娆℃悳绱㈠凡缁忓畬鏁存壂瀹屾椂锛岀户缁緭鍏ユ洿闀垮叧閿瘝浼氬湪涓婃缁撴灉涓閲忕瓫閫夛紝鍑忓皯杩炵画杈撳叆鏃剁殑鍏ㄩ噺閬嶅巻銆?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP銆丼HA256 鏍￠獙鏂囦欢鍜?`1.2.3 -> 1.2.4` 蹇€熻ˉ涓併€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.4 鏈湴鎼滅储鎬ц兘浼樺寲鐗坄銆?
## v1.2.3 鏈湴鏇插簱澧為噺鎵弿浼樺寲

- `v1.2.3` 閲嶇偣浼樺寲鏈湴澶ф洸搴撶殑閲嶅鎵弿鍜岄暱鏈熺紦瀛樺崰鐢ㄣ€?- 鏂囦欢澶规湭鍙樺寲鏃跺鐢ㄦ棫绱㈠紩锛屽彧鎵弿鏂板鎴栧彉鏇寸洰褰曪紝鍑忓皯鍚庡彴鍒锋柊鏃剁殑閲嶅 `stat`銆?- 鍚姩鎭㈠鍏堟樉绀哄凡缂撳瓨鏇插簱蹇収锛屽啀鍚庡彴澧為噺鍒锋柊锛岄檷浣庢墦寮€杞欢鍚庣殑绛夊緟鍜屽崱椤裤€?- IndexedDB 澧炲姞璧勪骇缂撳瓨瀹归噺銆佽繃鏈熸椂闂村拰鏇插簱蹇収鏁伴噺娓呯悊锛岄伩鍏嶉暱鏃堕棿鎾斁鍜屽ぇ鏇插簱娴忚鍚庣紦瀛樻寔缁啫鑳€銆?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.3 鏈湴鏇插簱鎬ц兘浼樺寲鐗坄銆?
## v1.2.2 鎾斁鍣ㄩ暱鏃堕棿杩愯鎬ц兘浼樺寲

- `v1.2.2` 缁х画浼樺寲闀挎椂闂存挱鏀惧拰澶ф洸搴撴祻瑙堟椂鐨勪富绾跨▼涓庡唴瀛樺崰鐢ㄣ€?- 鏈湴灏侀潰缂╃暐鍥剧紦瀛樻敼鐢ㄧ煭绛惧悕 key锛屽苟鎸変及绠楀瓧鑺傛暟闄愬埗鎬婚噺锛岄伩鍏嶅畬鏁?data URL 浣滀负缂撳瓨 key 闀挎椂闂撮┗鐣欍€?- 妗岄潰姝岃瘝鍓嶇鍙戦€佺澧炲姞缁熶竴 payload 绛惧悕锛岄厤鍚堜富杩涚▼绛惧悕鍒ら噸鍑忓皯閲嶅 IPC銆?- 鐜荤拑浣嶇Щ鍥惧埛鏂板悎骞跺埌鍛藉悕 `requestAnimationFrame`锛屽噺灏戞帶鍒舵爮鍜屾悳绱㈠尯灏哄/鍐呭鍙樺寲鏃剁殑閲嶅 SVG 鐢熸垚銆?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.2 鎾斁鍣ㄦ€ц兘浼樺寲鐗坄銆?
## v1.2.1 鎾斁鍣ㄦ€ц兘缁嗚妭浼樺寲

- `v1.2.1` 寤剁画鎾斁鍣ㄦ€ц兘浼樺寲锛岄噸鐐归檷浣庢挱鏀剧晫闈㈤珮棰戝埛鏂般€佹闈㈡瓕璇嶅悓姝ュ拰鏈湴鏇插簱鍒楄〃閲嶅缓寮€閿€銆?- 妗岄潰姝岃瘝涓昏繘绋嬪悓姝ュ鍔犵姸鎬佺鍚嶏紝鐘舵€佹湭鍙樺寲鏃朵笉鍐嶉噸澶嶅悜瑕嗙洊灞傚彂閫?IPC锛屽苟缂撳瓨绐楀彛閫忔槑搴﹂伩鍏嶉噸澶嶅師鐢熻皟鐢ㄣ€?- 鎾斁杩涘害 UI 鍒锋柊鍚堝苟鍒板懡鍚?`requestAnimationFrame`锛屽噺灏?`timeupdate`銆佹挱鏀句簨浠跺拰瀹氭椂 tick 鍚屽抚閲嶅鍐?DOM銆?- 鏈湴鏇插簱宸︿晶鍒楄〃澧炲姞 DOM 绛惧悕锛屽綋鍓嶅彲瑙佹瓕鏇叉湭鍙樺寲鏃惰烦杩囧垪琛ㄩ噸寤猴紝鏀瑰杽澶ф洸搴撴仮澶嶅悗鐨勬粴鍔ㄥ拰鍒囨崲娴佺晠搴︺€?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.1 鎾斁鍣ㄦ€ц兘浼樺寲鐗坄銆?
## v1.2.0 鎾斁鍣ㄦ€ц兘浼樺寲

- `v1.2.0` 閲嶇偣浼樺寲鎾斁鍣ㄥ惎鍔ㄩ€熷害銆佹湰鍦版洸搴撳姞杞介€熷害鍜屽ぇ鏇插簱鎭㈠鏃剁殑棣栧睆娴佺晠搴︺€?- 涓昏繘绋嬫湰鍦版洸搴撴壂鎻忓拰蹇収鍒锋柊鏀逛负鏈変笂闄愬苟鍙戣鍙栨枃浠跺厓鏁版嵁锛屽噺灏戝ぇ鐩綍閫愪釜 `stat` 鐨勭瓑寰呮椂闂淬€?- 鏈湴搴撴仮澶嶆椂鍏堟覆鏌撻槦鍒楀苟鎭㈠鎾斁浼氳瘽锛屽皝闈?姝岃瘝 IndexedDB 缂撳瓨璇诲彇寤跺悗鍒扮┖闂叉椂鍚庡彴鎵ц銆?- 鎴愬姛鐢熸垚鐨勬湰鍦板皝闈㈢缉鐣ュ浘浼氫繚鐣欑煭鏈熺粨鏋滅紦瀛橈紝鍑忓皯闃熷垪銆佹悳绱㈠拰姝屽崟鏋朵箣闂寸殑閲嶅缂╂斁銆?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.2.0 鎾斁鍣ㄦ€ц兘浼樺寲鐗坄銆?
## v1.1.9 妗岄潰姝岃瘝鍏ュ彛涓庢挱鏀惧櫒鎬ц兘寰皟

- `v1.1.9` 灏嗘闈㈡瓕璇嶅紑鍏虫斁鍒版挱鏀剧晫闈㈠簳閮ㄦ帶鍒舵爮锛岀敤鎴蜂笉闇€瑕佽繘鍏ヨ瑙夋帶鍒跺彴涔熻兘鐩存帴寮€鍚?鍏抽棴銆?- 鎾斁鐣岄潰妗岄潰姝岃瘝鍥炬爣浼氫笌瑙嗚鎺у埗鍙伴噷鐨勬闈㈡瓕璇嶅紑鍏冲悓姝ラ珮浜€乣aria-pressed` 鍜屾彁绀烘枃鏈€?- 妗岄潰瑕嗙洊灞傚叧闂椂閲婃斁鏃у悓姝?key 鍜屾瓕璇嶆父鏍囷紝閬垮厤閲嶅紑鍚庡鐢ㄨ繃鏈熺姸鎬併€?- 鏈鍙戝竷缁х画涓婁紶瀹屾暣瀹夎鍖呫€乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.9 妗岄潰姝岃瘝鍏ュ彛浼樺寲鐗坄銆?
## v1.1.8 鎾斁鍣ㄦ€ц兘浼樺寲

- `v1.1.8` 浼樺寲鎾斁鍣ㄨ繍琛屾椂鎬ц兘锛岄檷浣庨珮鍒峰睆棰戣氨鍒嗘瀽銆侀槦鍒楀埛鏂般€佹湰鍦板簱缂撳瓨鍜屾闈㈣鐩栧眰鍚屾鐨勪富绾跨▼寮€閿€銆?- 鏈湴鏇插簱蹇収鍜岀储寮曡縼绉诲埌 IndexedDB锛屾棫 localStorage 鏁版嵁淇濈暀鑷姩杩佺Щ鍥為€€銆?- 闃熷垪闈㈡澘鍜岃糠浣犻槦鍒楀埛鏂颁細鍚堝苟鍚屽抚浠诲姟锛屽苟鍦ㄥ彲瑙佸唴瀹规湭鍙樺寲鏃惰烦杩?DOM 閲嶅缓銆?- 鏈鍙戝竷闇€瑕佷笂浼犲畬鏁村畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.8 鎾斁鍣ㄦ€ц兘浼樺寲鐗坄銆?
## v1.1.7 鏇存柊妫€娴嬩笌涓嬭浇绋冲畾鎬т紭鍖?
- `v1.1.7` 浼樺寲杞欢鏇存柊妫€娴嬶細鑷姩妫€鏌ュ鐢?5 鍒嗛挓缂撳瓨锛屽苟鍚堝苟骞跺彂妫€娴嬭姹傘€?- 鐢ㄦ埛涓诲姩鎵撳紑鏇存柊闈㈡澘鏃朵細寮哄埗鍒锋柊涓€娆★紝閬垮厤闀挎椂闂磋繍琛屽悗缁х画鏄剧ず鏃ф娴嬬粨鏋溿€?- 鏇存柊涓嬭浇澧炲姞璇绘祦绌洪棽瓒呮椂锛涚嚎璺搷搴斿悗濡傛灉闀挎椂闂翠笉浼犺緭鏁版嵁锛屼細涓褰撳墠绾胯矾骞跺垏鎹笅涓€鏉°€?- 鏈鍙戝竷闇€瑕佷笂浼犲畬鏁村畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.7 鏇存柊绋冲畾鎬т紭鍖栫増`銆?
## v1.1.6 鏇存柊鍏ュ彛涓庡厤瀹夎鐗堜慨澶?
- `v1.1.6` 淇绾湰鍦版ā寮忎笅鏇存柊鍏ュ彛涓嶅彲瑙佺殑闂锛屾洿鏂版鏌ュ欢鍚庡埌鍚姩鍔ㄧ敾鍜屾湰鍦板簱鎭㈠涔嬪悗鎵ц銆?- 妗岄潰绔?`window.open` 鍙厑璁告墦寮€ `https://github.com/oirge/Mineradio` 浠撳簱閾炬帴锛岄伩鍏嶆覆鏌撳眰璇Е鍙戜换鎰忓閮ㄥ崗璁€?- Windows 鏋勫缓鍚屾椂鐢熸垚 NSIS 瀹夎鍖呭拰 Portable ZIP銆?- 鏈鍙戝竷闇€瑕佷笂浼犲畬鏁村畨瑁呭寘銆乥lockmap銆乣latest.yml`銆丳ortable ZIP 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.6 鏇存柊鍏ュ彛淇鐗坄銆?
## v1.1.4 鐣岄潰鐘舵€佹寔涔呭寲淇

- `v1.1.4` 淇姣忔鎵撳紑杞欢鐣岄潰鍍忚閲嶇疆鐨勯棶棰樸€?- 閲嶇偣楠岃瘉锛氬惎鍔ㄥ墠浠庝富杩涚▼ `desktop-ui-state.json` 鍥炵亴鍏抽敭 localStorage 鐘舵€侊紱宸叉湁鐢ㄦ埛閰嶇疆鏃朵笉鍐嶅己鍒跺惎鍔ㄦ槦娌抽瑙堛€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.4 鐣岄潰鐘舵€佷慨澶嶇増`銆?
## v1.1.3 鎾斁鍚姩鐑慨

- `v1.1.3` 鏄?`v1.1.2` 鐨勬湰鍦版挱鏀惧惎鍔ㄧ儹淇増銆?- 閲嶇偣淇 `/api/local-file` 鏈湴鏂囦欢浠ｇ悊杩愯鏃剁己灏?MIME 绫诲瀷瑙ｆ瀽瀵艰嚧闊抽璇锋眰 500锛屼互鍙婃墜鍔ㄦ挱鏀捐矾寰勬湭浼犻€?manual 鏍囪鐨勯棶棰樸€?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.3 鎾斁鍚姩鐑慨鐗坄銆?
## v1.1.2 绾湰鍦板彂甯?
- `v1.1.2` 鏄函鏈湴鎾斁鍣ㄧ増鏈紝绉婚櫎 QQ / 缃戞槗浜?/ 鎾鍦ㄧ嚎闊充箰閾捐矾锛屽彧淇濈暀鏈湴闊充箰搴撱€佹洿鏂版鏌ャ€佽妭鎷嶇紦瀛樺拰鏈湴鏂囦欢璇诲彇鎺ュ彛銆?- 鏈鍙戝竷闇€瑕佷笂浼犲畬鏁村畨瑁呭寘銆乥lockmap銆乣latest.yml` 鍜?SHA256 鏍￠獙鏂囦欢銆?- Release 鏍囬寤鸿浣跨敤 `Mineradio v1.1.2 绾湰鍦扮増`銆?- Release 姝ｆ枃閲嶇偣璇存槑鏈湴搴撶储寮曘€佸皝闈㈢缉鐣ュ浘缂撳瓨銆佹瓕璇?灏侀潰鍚庡彴闃熷垪鍜屽湪绾块仐鐣欎唬鐮佹竻鐞嗐€?
## v1.1.0 鍙戝竷杈圭晫

- `v1.1.0` 鏄函鍑€瀹夎鍙戝竷鐗堬紝浠庡綋鍓?`resources/app` 鍙俊婧愮爜閲嶆柊鏋勫缓銆?- 涓嶅鐢ㄦ棫 `dist/`銆佹棫瀹夎鍖呫€佹棫 `node_modules`銆佹棫澶囦唤鍖呮垨浠讳綍鍘嗗彶 packaged build銆?- 涓嶇敓鎴?`v1.0.10 -> v1.1.0` 蹇€熻ˉ涓併€?- 涓嶆妸 `v1.1.0` 璁剧疆涓烘棫鐗堣蒋浠跺唴鏇存柊閫氶亾鐨?latest锛沗v1.0.10` 鐢ㄦ埛闇€瑕佹墜鍔ㄤ笅杞芥柊鐗堝畨瑁呭寘骞剁函鍑€瀹夎銆?- GitHub Release 闇€瑕佹槑纭彁绀猴細`v1.0.10` 鍙婃洿鏃╁畨瑁呭寘鏈夐闄╋紝璇烽殧绂绘棫 `.exe` 瀹夎鍖咃紝涓嶈缁х画瀹夎鎴栬浆鍙戙€?- 瀹夎鍖呮牱寮忕户缁部鐢?`docs/INSTALLER_STYLE.md` 鐨勪腑鏂囨瀬绠€榛戠櫧钃濇牸寮忋€?
## 鍙戝竷鍓嶆鏌?
- 纭 `package.json` 鍜?`package-lock.json` 鐗堟湰鍙锋纭€?- 纭 `mineradio.update.owner/repo` 鎸囧悜姝ｅ紡浠撳簱銆?- 纭 `.cookie`銆乣.qq-cookie`銆乣updates/`銆乣node_modules/`銆佹棫 `dist/` 娌℃湁杩涘叆 git銆?- 纭 README/SECURITY/CHANGELOG/Release 姝ｆ枃鍖呭惈 `v1.0.10` 鏃у畨瑁呭寘闅旂璇存槑銆?- 杩愯璇硶妫€鏌ワ細`git diff --check`銆乣node --check server.js`銆佸墠绔唴鑱旇剼鏈В鏋愩€?- 杩愯 Git 璺熻釜椋庨櫓娈嬬暀妫€鏌ワ紝纭娌℃湁璺熻釜 `.exe/.dll/.scr/.bat/.cmd/.ps1/.vbs/.jse/.wsf/.hta/.xlsm` 绛夊彲鎵ц/鑴氭湰娈嬬暀銆?- 浠庡綋鍓嶆簮鐮佹墽琛?`npm run build:win` 鐢熸垚 Windows 瀹夎鍖呫€?- 瀵规柊鐢熸垚鐨勫畨瑁呭寘鍜屽綋鍓嶆簮鐮佹墽琛屽畨鍏ㄦ壂鎻忋€?- 鐢熸垚骞惰褰曟柊瀹夎鍖?SHA256銆?
## GitHub Release

Release tag锛?
```text
v1.1.0
```

Release 鏍囬锛?
```text
Mineradio v1.1.0 绾噣瀹夎鐗?```

寤鸿涓婁紶璧勪骇锛?
- `dist/Mineradio-1.1.0-Setup.exe`
- `dist/Mineradio-1.1.0-Setup.exe.blockmap`锛堝彲閫夛紱鏈涓嶄綔涓烘棫鐗堣蒋浠跺唴鏇存柊浣跨敤锛?- `dist/Mineradio-1.1.0-SHA256SUMS.txt`

鏈涓嶈涓婁紶锛?
- `latest.yml`
- `v1.0.10 -> v1.1.0` 蹇€熻ˉ涓?
## 鏇存柊妫€娴?
搴旂敤浼氳姹?GitHub Releases latest銆備负浜嗛伩鍏?`v1.0.10` 鏃у鎴风閫氳繃杞欢鍐呮洿鏂扮洿鎺ユ媺鍒?`v1.1.0`锛屾湰娆?GitHub Release 涓嶅簲璁句负鏃ф洿鏂伴€氶亾鐨?latest銆?
鏈湴楠岃瘉鏇存柊閾捐矾鏃讹紝鍙互鐢ㄤ复鏃?manifest锛?
```json
{
  "latestVersion": "1.1.0-test",
  "release": {
    "name": "Mineradio v1.1.0-test",
    "downloadUrl": "http://127.0.0.1:3144/Mineradio-1.1.0-Setup.exe",
    "notes": ["鏈湴鍦ㄧ嚎鏇存柊閾捐矾娴嬭瘯"]
  }
}
```
## v1.2.66 歌单详情可见行渲染低分配优化

- 3D 歌单详情页复用可见窗口时，将歌曲引用同步和条件重绘合并为单次索引循环，减少连续滚动、加载动画和曲库刷新时的回调遍历与短命闭包分配。
- 保持可见歌曲窗口、中心行判定、加载动画刷新、绘制顺序和 UI/交互语义不变；新增可见行热路径回归测试。
- 发布资产：`Mineradio-1.2.66-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.65→1.2.66.patch.json` 和 `Mineradio-1.2.66-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104841126` 字节；快速补丁大小：`2298812` 字节；校验值以 `Mineradio-1.2.66-SHA256SUMS.txt` 为准。
- Release 标题使用 `Mineradio v1.2.66 歌单详情可见行渲染低分配优化版`，目标为 GitHub Latest Release。

## v1.2.65 本地搜索预热与空查询缓存优化

- 本地搜索候选池筛选结果直接复用给索引预热任务，避免大曲库刷新时重复遍历同一批歌曲。
- 空搜索结果按曲库签名缓存，重复打开搜索区或恢复本地库时不再反复复制最多 80 个歌曲引用；搜索排序、数量上限和结果 DOM 保持不变。
- 混合队列回归覆盖首个非本地项之前的本地歌曲保留；全量测试、版本检查、语法检查和 `git diff --check` 在构建前执行。
- 发布资产：`Mineradio-1.2.65-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.64→1.2.65.patch.json` 和 `Mineradio-1.2.65-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104841037` 字节；快速补丁大小：`2298583` 字节；校验值以 `Mineradio-1.2.65-SHA256SUMS.txt` 为准。
- Release 标题使用 `Mineradio v1.2.65 本地搜索预热与空查询缓存优化版`，目标为 GitHub Latest Release。

## v1.2.64 本地资产缓存与封面流式读取优化

- IndexedDB 从 v2 升级到 v3，新增独立 `lyrics` store。升级过程使用 cursor 逐条迁移旧 `assets` 记录，并移除旧记录中的歌词字段，避免一次性载入全部歌词原文。
- 资产缓存写入、按需歌词水合、释放后原文合并和 IndexedDB 裁剪均按资产与歌词双 store 处理；两个 store 共用当前歌曲保护键和容量裁剪，所有事务保留完成、错误、中止结算。
- 桌面本地曲库的外置封面优先复用 `/api/local-file` 授权流 URL。URL 图片解码前设置跨源属性，缩略图和当前封面应用不再调用主进程整图 base64 读取；普通浏览器 File 仍使用原有回退路径。
- 本轮验证：全量 `node --test --test-concurrency=1` 共 `150/150` 通过；`server.js`、`desktop/main.js`、`desktop/preload.js` 语法检查通过；`git diff --check` 通过。
- 发布资产：`Mineradio-1.2.64-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.60→1.2.64.patch.json`、`Mineradio-1.2.61→1.2.64.patch.json`、`Mineradio-1.2.62→1.2.64.patch.json`、`Mineradio-1.2.63→1.2.64.patch.json` 和 `Mineradio-1.2.64-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104840914` 字节；补丁大小依次为 `2546840`、`2394486`、`2394486`、`2297783` 字节；校验值以 `Mineradio-1.2.64-SHA256SUMS.txt` 为准。
- Release 标题使用 `Mineradio v1.2.64 本地资产缓存与封面流式读取优化版`，目标为 GitHub Latest Release。
## v1.2.67 舞台歌词与歌单架帧更新低开销优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.67`。
- 运行全量 Node 回归测试、主进程与前端内联脚本语法检查、`git diff --check` 后再构建 Windows 安装器。
- 发布资产：`Mineradio-1.2.67-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.66→1.2.67.patch.json` 和 `Mineradio-1.2.67-SHA256SUMS.txt`；Portable ZIP 按既有流程跳过。
- 安装器大小：`104841092` 字节；快速补丁大小：`2299088` 字节；校验值以 `Mineradio-1.2.67-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`e346de8c5d9ae8bd6b959de8a84160ba590ee9cc126e5c6612aa7d7a238a4a6b`；blockmap：`4da7eda9e19d2a27dc05e7f4013425bb51491b8f8ae77e272108ab46a7148e8f`；快速补丁：`59b5c10bac8c910eb2d143f1db72434c922ff765bae29ee29312b609445f7597`；`latest.yml`：`b68d92e67641a1baf96379eaa7e7e223d32d3b9dcc8680c3b451c421f8a71497`。
- Release 标题使用 `Mineradio v1.2.67 舞台歌词与歌单架帧更新低开销优化版`，目标为 GitHub Latest Release。

## v1.2.71 实时节拍分析低卡顿优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.71`。
- 实时节拍分析复用主频谱分析已计算的时域 RMS，缓存频段采样桶边界，并删除持续播放中无消费者的相位误差计算；直接调用节拍引擎仍保留时域扫描回退。
- 空 Home 波形先执行已有时间节流，再查询 DOM；保持播放视觉、UI、布局、文案、玻璃质感、电影视觉、播放控制和交互语义不变。
- 新增 `tests/audio-analysis-hot-path.test.js`；完整 Node 回归测试、主进程语法检查、前端内联脚本解析和 `git diff --check` 在构建前执行。
- 当前已生成：`dist/Mineradio-1.2.71-Portable-win-x64.zip`（147491934 字节，SHA256 `8c49554192d4d11ee5e24f3c33bb48a8ff7f4df07e8c531c539c2cae29b4eee9`）和 `dist/Mineradio-1.2.70-to-1.2.71.patch.json`（2305532 字节，SHA256 `d4352b2b22417bd7feafc9a5da98566ea64291d2d0250be6fb84ee8e6cba0d93`）。
- NSIS 完整安装器连续构建未产出 `Setup.exe`、`.blockmap` 或 `latest.yml`，本轮不创建 GitHub Latest Release，避免发布不可用的更新元数据；安装器构建链恢复后再补齐正式发布资产。

## v1.2.70 队列可见行快照复用低卡顿优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.70`。
- 队列面板与底部迷你队列复用同一轮可见行快照，避免签名和 HTML 生成重复读取副标题、封面、喜欢状态等字段；保持排序、当前高亮、懒加载、文案与交互语义不变。
- 新增 `tests/queue-render-hot-path.test.js`；完整 Node 回归测试、前端内联脚本解析和 `git diff --check` 在构建前执行。
- 发布资产：`Mineradio-1.2.70-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.69→1.2.70.patch.json` 和 `Mineradio-1.2.70-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104758713` 字节；快速补丁大小：`2302429` 字节；校验值以 `Mineradio-1.2.70-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`1883a7f74c592af9f74372154466ae216e7e48e2c6eaa61f1c983293ac0e7af5`；blockmap：`3ab785de3acec0d8f3dc7f45b236893aecac67b96826008b65b88ccb66fab971`；快速补丁：`50b1e86806d57b537e238d4730eecfa5eedeaf47ab4f17df021cc5fc1eabfa33`；`latest.yml`：`8c01f7b36989dc3bda1a036305cfed47f31d8f2cbfb1aa4b468e3b6f749a0ef6`。
- Release 标题使用 `Mineradio v1.2.70 队列可见行快照复用低卡顿优化版`，目标为 GitHub Latest Release。

## v1.2.69 Home 首屏快照复用低分配优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.69`。
- `renderHomeDiscover()` 将同一轮已计算的本地歌曲池和听歌统计摘要传给 `renderHomeTiles()`，避免 Home 卡片渲染重复扫描曲库与统计记录；保持卡片顺序、封面、文案、布局和交互语义不变。
- 新增/扩展 `tests/frame-hot-path.test.js`，锁定 Home 刷新只计算一次歌曲池和听歌统计摘要。
- 发布资产：`Mineradio-1.2.69-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.68→1.2.69.patch.json` 和 `Mineradio-1.2.69-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104841228` 字节；快速补丁大小：`2299420` 字节；校验值以 `Mineradio-1.2.69-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`9f7fc7b532dc267fac165ea02936314d100a9433cfcb1470648ba56e7ce9de13`；blockmap：`053644d4779bd3453fdb7dc6e4d859137c3ad248fac22e60cf0af602b1077a2e`；快速补丁：`00326da00858ac1b7e2596832daf4ae6b22de9e077430de064b944728b42ed2e`；`latest.yml`：`6e60ef5b8e479eacf5ea3caf146e02894de7c1caaa83f59b70cf164faf837bad`。
- Release 标题使用 `Mineradio v1.2.69 Home 首屏快照复用低分配优化版`，目标为 GitHub Latest Release。

## v1.2.68 3D 歌单架卡片帧状态复用优化

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.2.68`。
- `placeCard()` 直接复用 `shelfManager.update()` 帧头缓存的内容打开状态和常驻显示状态，减少可见卡片循环中的重复状态查询；保持卡片布局、层级、透明度、详情遮罩、UI 和交互语义不变。
- 新增/扩展 `tests/frame-hot-path.test.js`，锁定歌单架帧状态只查询一次且卡片布局函数不再重复查询。
- 发布资产：`Mineradio-1.2.68-Setup.exe`、对应 `.blockmap`、`latest.yml`、`Mineradio-1.2.67→1.2.68.patch.json` 和 `Mineradio-1.2.68-SHA256SUMS.txt`；Portable ZIP 按既有发布流程跳过。
- 安装器大小：`104841201` 字节；快速补丁大小：`2299236` 字节；校验值以 `Mineradio-1.2.68-SHA256SUMS.txt` 为准。
- 安装器 SHA256：`213e23771c5e8cec0892fb5131809f019a2f9b31ee51ce3753d50f71624f45f3`；blockmap：`67dd719758cef577034bd7281341d4074753f9e12179e8a6b216d9c1ed497a76`；快速补丁：`656e1d7d5a3cbfc0e32a4fb5950470e58a633924b5211771145e2a298807f9cb`；`latest.yml`：`3b1bf61c6ef116d70fc344d2bd5b236fee8019d1ea2c8c90dd797d8118b82fae`。
- Release 标题使用 `Mineradio v1.2.68 3D 歌单架卡片帧状态复用优化版`，目标为 GitHub Latest Release。
