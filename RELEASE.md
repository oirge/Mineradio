# 发布流程

## v1.9.1 修好音域回响壁纸版没在放歌时糊成一片惨白

- 正式发布版本从 `1.9.0` 提升为 `1.9.1`；五处版本钉（`package.json`、`package-lock.json` 两处、`public/app.js` 的 `APP_VERSION`、发布工作流默认 tag）一起动，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。走 patch 是因为这一版只修一个回归、不加功能、没动任何常量。
- **起因是用户的一句话：「「音域回响 Wallpaper Engine」（原作 CmzYa）这个预设无法正常显示」。这是 v1.9.0 自己引入的回归**，不是 v1.8.9 那份 vendor 产物的问题。
- **根因：`public/sonic-workshop-preset.js` 里 `workshopCoverHex` 的取色链末尾留着歌词文字三色。** v1.9.0 的差异 ⑤ 把预设 8 从「歌词那份可读性调整过的颜色」改成吃 `rawArea*` / `raw*` 是对的，但每条角色链的末尾照抄了上游的 `pal.primary || pal.highlight || pal.secondary` —— **上游拿同一份调色板既画歌词又画地形，本仓库不是**：这三个字段是**歌词文字色**，为了压在封面上读得清一律抬过亮度，而 `stageLyrics.coverPalette` 的**初值**（`public/app.js:5706`，`palette` 在 `:5699`）本身就是近白的 `#d6f8ff` / `#9cffdf` / `#eef7ff`。于是**没在放歌 / 这首歌不带封面 / 封面取色还没跑完**这三种常态下，八个壁纸 uniform 一起被顶到近白：`uBaseColor2` 亮度 `0.91`，`uCoolCore` / `uRippleColor` / `uPeakColor` 三个还挤成同一个 `#eef7ff` —— 画面彻底没了明暗层次，就是用户看到的那片没有内容的惨白雾。**这条链只在有封面色时被 `rawArea*` / `raw*` 抢先，所以 v1.9.0 发版时肉眼看播放中的画面是正常的，缺陷藏在停播态**，这也是 v1.9.0「没在真实窗口里逐帧核对观感」那条已知边界真正的代价。
- **修法是最小的一刀：链尾只留 `rawArea*` → `raw*`，一个都没有就落在原作自己的字面量上** —— `base #16060f` / `cool·peak #99c4ff` / `ripple #f8d8ff` / `primary·warm #cb6c89`，正好复现原作 `project.json` 的默认主题 `coral-mirage`。**有封面色时的取色顺序与上游逐项一致，播放中的画面和 v1.9.0 完全一样**，改动只影响「拿不到封面色」这一支。模块文件头的「本机适配」清单同步补成两条（没有上游那块设置面板，所以 `sonicWorkshopBaseColor` 等 fx 键只在别处写入时才生效；取色链不含歌词三色），`gridSize`、音频整形系数、推送节奏仍是上游原值。
- **返工两次，两个坑都写进测试了。** ① 第一版顺手把 `|| pal.rawAreaPrimary || pal.rawPrimary` 这类**合法**的 raw 尾巴也删了，单色封面于是退不到主色（`single.uCoolCore` 从 `#7ef9ff` 掉回兜底 `#99c4ff`）——角色链只砍歌词那一档。② 想用「所有 uniform 亮度 ≤ 0.9」这条通用断言当护栏，结果被 `uRippleColor #f8d8ff`（亮度 ≈ `0.902`）判红 —— 那是原作的合法亮色，通用亮度上限在这里是错的判据。
- **回归结果 `988/988` 全绿**（`npm test`，`node --test --test-concurrency=1`），`tests/sonic-workshop-preset.test.js` 新增 1 例「歌词文字色永远不许当地形色」：把 `public/app.js` 里 `coverPalette` 初值的五个字面量逐字钉住（初值哪天改成深色，这条会红，提醒一起复核兜底），断言「近白歌词调色板」与「空调色板」产出**完全相同**的 uniform，再用有针对性的判据代替通用亮度上限 —— `uBaseColor1 < 0.05`、`uBaseColor2 < 0.4`（惨白现场 `0.91`）、cool≠ripple 与 warm≠cool 的撞色检查、`uCoolCore` 与 `uBaseColor1` 至少 `0.3` 的亮度落差，最后加一条源码级 `doesNotMatch(/pal\.primary|pal\.highlight|pal\.secondary/)` 防它长回来。另修正 `single.uRippleColor` 的旧期望值：它原先等于 `#7ef9ff` 只是因为走了那条歌词兜底，现在正确地等于原作的 `#f8d8ff`。
- **预设 7「移植 Ajin」有同样的歌词兜底，但没这个病，这一版故意没动。** `public/sonic-topography-preset.js:181-197` 的 `sonicCoverGroundTheme` 也写着 `palette.groundPrimary || palette.primary`，可它的 `base1 = primary.clone().lerp(new THREE.Color(DEFAULT_GROUND_BASE_COLOR), 0.84)` 把基面强行往深色拉 84%，歌词色顶不亮基面，最多掉点饱和 —— 不是同一个缺陷，别顺手一起改。
- **排障顺序留个记录，下次再遇到「预设 8 不显示」从最后一条开始最快。** 依次核过并**排除**：vendor 四文件在包里且 MIME 正确、`assets/index-Z-j1MQ-r.js` 确实带着 `mineradio-custom` 的两处补丁且未知主题会退 `Sd.nocturnal`、全仓库没有 CSP 也没改 `webSecurity`、渲染器走 HTTP 所以 `type="module"` 能加载、`#sonic-workshop-layer` 的 `z-index:0` 在 `#canvas-container`（`1`）之下且主渲染器 `alpha:true` + `setClearColor(0x000000,0)` + `scene.background = null`、iframe 尺寸靠 bundle 自带的 `ResizeObserver` 自愈、脚本顺序正确、全 `public/` 只有 `:8733` 一处写 `coverPalette`。**最快的一步是把推下去的 8 个 uniform 读回来看**，一眼就能看出它们全挤在近白。修完读回的一组正常值：`uBaseColor1 #040103`、`uBaseColor2 #3e1c2a`、`uCoolCore #99c4ff`、`uCoolEdge #495e7a`、`uWarmCore #cb6c89`、`uWarmEdge #723c4d`、`uRippleColor #f8d8ff`、`uPeakColor #99c4ff`、`uGlowIntensity 0.758`。
- 复现环境上的两条坑（不是产品缺陷）：预览窗格切后台会把 `document.hidden` 置真 → `body.render-deep-sleep`（`public/app.css:121`）把整层算成 `opacity:0`，且 iframe 画布卡在 `300×150`；`!important` 强改不管用，因为 `update()` 每帧重写 `layer.style.opacity`、`ensureLayer()` 还会重置成 `'0'` —— 办法是先截一次图把窗格拉到前台，再等那 `520ms` 淡入跑完，画布自己长回 `1280×720`。另外**用户的播放器正开着 5 个 `Mineradio.exe`，`desktop/main.js:245` 的 `requestSingleInstanceLock()` 让 Electron 侧复现走不通，不能杀进程腾位置**。
- **这一版的画面是在真实渲染里看过的**（停播态与注入封面色两种情形都看了，并把推下去的 uniform 读回来核过），不像 v1.9.0 那样只有源码比对；但仍**没有跟原作在同一屏上逐帧比过观感**，「像不像」这件事的边界和 v1.9.0 一样照实留着。

## v1.9.0 两个音域回响预设对齐原项目

- 正式发布版本从 `1.8.9` 提升为 `1.9.0`；五处版本钉（`package.json`、`package-lock.json` 两处、`public/app.js` 的 `APP_VERSION`、发布工作流默认 tag）一起动，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。走 minor 是因为这一版新增了一个模块层（`public/sonic-audio-monitor.js`）并改了两个预设的观感，不只是修 bug。
- **起因是用户的一句话：「两个音域回响视觉预设效果和原项目的不太一样」。** 上一版（v1.8.9）把两条实现都搬齐了，但搬得不够忠实。对着上游 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)（commit `89c0d23`，`/tmp/upstream-mineradio`）逐项核，差异一共五处，全部改成上游行为：
- **差异 ①（最大的一处）：预设 7 一直吃不到细粒度音频。** 上游的地形层读的是 `public/js/modules/03-beat/06-sonic-audio-monitor.js` 产出的八段帧，本仓库没有这一层，`app.js` 只喂了 5 个粗粒度值（`bass/mid/treble/energy/beat`），八段是反推的、鼓点只有一个笼统脉冲 —— 地形起伏的分布和涟漪的时机因此和原项目差得最明显。这一版把那层整个移植成 `public/sonic-audio-monitor.js`（IIFE 挂 `window.MineradioSonicAudio`，导出 `{BAND_EDGES, BASE_BINS, BEAT_WINDOWS, reset, settings, snapshot, step}`），上游常量一个不改：八段边界 `subBass 32–58` / `bass 58–118` / `lowMid 118–260` / `mid 260–720` / `highMid 720–1800` / `presence 1800–4200` / `brilliance 4200–9000` / `air 9000–16000` Hz，六个鼓点窗口 `Deep 36–82 ×1.04` / `Club 46–118 ×1.22` / `Kick 54–142 ×1.16` / `Punch 68–156 ×1.02` / `Body 86–190 ×0.86` / `Wide 38–155 ×0.78`，`BASE_BINS = 512`，默认设置 `{sensitivity 100, bandStart 1, bandEnd 4, threshold 32, pulseStrength 62}`。频段按**赫兹**换算 bin，`sampleRate` / `fftSize` 由调用方注入，换设备（48kHz / fftSize 4096）也对得上。
- 接线三条，缺一不可：`public/index.html` 里 `<script src="sonic-audio-monitor.js"></script>` **必须排在两个预设脚本和 `app.js` 之前**；`app.js` 侧 `sonicAudioMonitorModule()` 用 `typeof MineradioSonicAudio !== 'undefined'` 取模块（插件裁过 `public` 时安静退化，不许让主循环炸掉）；`sonicTopographyCtx.audio = sonicAudioFrame || sonicTopographyCoarseAudio;` —— 监视器缺席或被 `fx.sonicAudioMonitorEnabled === false` 关掉时才退回粗粒度壳。停播不硬切静音，按上游的 `0.08^dt` 指数衰减收回去。
- **差异 ②：喂给地形层的鼓点被放大了 `1.35` 倍**（`sonicTopographyCoarseAudio.beat = beatPulse * 1.35`），涟漪整体比原项目触发得早。上游是原值直给，这一版去掉倍率，并在测试里加了 `doesNotMatch(/beatPulse \* 1\.35/)` 防它长回来。
- **差异 ③：拖进度 / 换歌不清瞬态。** 上游在 `currentTime` 往回跳超过 `0.30s` 时 `resetTransientState()` 并 `state.prev.fill(0)`，所以新曲子的第一拍不会被上一首的自适应噪声底压住（代价是拖完那一帧确实读成一次满频段起拍，这是上游行为，不是 bug）。往前跳不清。
- **差异 ④：预设 7 的地形配色发暗发灰。** 根因是调色板代际差：上游拿同一份颜色既画歌词又画地形，而本仓库的 `lyricTextPaletteFromHsl` 是更早一代（`avgL > 0.82 && chroma < 0.12` 的亮封面改深青色字、`lightText = avgL < 0.52` 才用亮字、饱和度夹在 `0.42~0.78`），地形跟着这份颜色走就必然比原项目暗一档、灰一档。**不能直接把歌词配色换成上游那版** —— 那会把歌词的可读性一起改掉，属于「能不动 UI 就不动 UI」的红线。做法是在同一次封面扫描上**并行**算第二份调色板：新增 `lyricGroundPaletteFromHsl()`（逐项照抄上游现行公式，内部走 `lyricHighImpactTextHsl(hsl, {minS: 0.90})`，饱和度顶到 `0.90`、亮度顶到 `0.90`），结果只写进 `groundPrimary` / `groundSecondary` / `groundHighlight` 三个新字段，`public/sonic-topography-preset.js` 只读这三个（`palette.groundPrimary || palette.primary` 兜底）。**歌词那五个字段 `primary/secondary/highlight/shadow/glow` 一个字节没动。**
- 兜底门槛也照上游七条：`monochrome === true` / `avgL < 0.16` / `sampleChroma < 0.055` / `avgChroma < 0.026` / `maxChroma < 0.095` / `colorfulRatio < 0.014` / `hsl.s < 0.060` 任意一条踩到就退 `silverBlueLyricPalette()`，另加暗色调红紫封面那一条（`avgL < 0.30` 且 hue 落在红紫区）。这一支拿的是**真彩度**，而歌词那一支历史上拿的是 `best.score`（打分值当彩度用），所以灰封面下歌词照旧算出偏红的暖灰、地形正确地退银蓝 —— 这个差别是有意保留的，测试把两边的确切输出都钉住了。
- **差异 ⑤：预设 8 的配色喂错了源。** 上游给壁纸层的是原始封面取色，本仓库喂的是给歌词做过可读性调整的颜色（抬亮、压饱和），整幅画面因此偏灰偏亮。这一版 `updateLyricPaletteFromCover` 追加输出 `rawPrimary` / `rawWarm` / `rawCool` / `rawLight` / `rawDark` / `rawAccent` / `rawAverage`，再加一层按**占地面积**取色的 `rawAreaPrimary` / `rawAreaBase` / `rawAreaWarm` / `rawAreaCool` / `rawAreaLight` / `rawAreaAccent`（`24` 一档把采样点丢进颜色桶，桶里点数就是面积权重，六个角色按上游的 test/avoid 规则挑），`public/sonic-workshop-preset.js` 的 `workshopCustomThemeForRegions` 按 `rawArea* → raw* → 歌词色` 的顺序取。同时**壁纸层不再读 `visualTintColor`**：配色只跟封面走，和原作一致（测试 `doesNotMatch(/visualTint/)`）。
- **差异 ⑥（并入 ⑤ 一起改）：预设 8 的 `gridSize` 跟画质档位联动是本机适配，不是原作。** 原作的地形密度、涟漪半径、流星尺度都是照 `320` 调的，一改网格数整幅画面比例就变。删掉 `QUALITY_GRID_SIZE`，固定回原作 `project.json` 的 `320`（`workshopid 3747222633`），五个画质档都一样。**v1.8.9 的 RELEASE 记录里那条「本机适配只有三处」到这一版全部作废**，现在只剩「`showPlayerController` 保持 `false`」这一条外加地形基色自压暗。
- **回归结果 `987/987` 全绿**（`npm test`，`node --test --test-concurrency=1`），新增 21 例：`tests/sonic-audio-monitor.test.js` 12 例（八段边界按赫兹换算、`BEAT_WINDOWS` 自动跟踪与自适应噪声底、`reset()` 清瞬态、停播衰减、`sampleRate`/`fftSize` 变化、`settings` 默认值），`tests/lyric-cover-palette-split.test.js` 9 例（歌词那五个字段的逐字节回归、地形三字段走上游公式、七条兜底门槛、`lyricHighImpactTextHsl` 的 `minS` 与钳位、面积桶取色与 10 色上限、纯色封面端到端、灰封面双路分叉、`lyricColorMode: 'custom'`、源码级分工守卫）。另有 `tests/sonic-topography-preset.test.js`（14 例）与 `tests/sonic-workshop-preset.test.js`（29 例）扩写，三条负向守卫 `doesNotMatch(/QUALITY_GRID_SIZE/)`、`doesNotMatch(/visualTint/)`、`doesNotMatch(/beatPulse \* 1\.35/)` 专门防本机适配长回来。`node --check` 过了四个改动过的 `public/*.js`。
- **已知边界（照实说）：** 这一版是**逐项对着上游源码核**改出来的 —— 常量、公式、接线顺序、兜底分支都比对过并写进测试；但**没有在真实窗口里逐帧对着原项目比过观感**。「像不像」这件事最终只能人眼判，如果哪一处仍然不像，需要的是具体描述（哪个预设、哪个部位、快歌还是慢歌）而不是再核一遍源码。

### 发布记录（v1.9.0）

- 单分支写法：`fix/sonic-preset-upstream-parity`。这一版**只有一个提交** `7e5702a fix: 两个音域回响预设对齐原项目（v1.9.0）` —— 代码（新文件 `public/sonic-audio-monitor.js`、`public/app.js` 的调色板拆分与接线、两个预设脚本、`public/index.html` 的脚本顺序）、新测试（`tests/sonic-audio-monitor.test.js`、`tests/lyric-cover-palette-split.test.js`）、五处版本钉与全部文档压在同一个提交里。**没有沿用 v1.8.9 那种「功能提交留旧 `APP_VERSION` + 紧随一个 `chore(release)`」的两段写法**，因为这一版没有「功能可以单独 checkout」的需求，五处钉子一次动完更省事；tag 直接打在这个功能提交上。
- PR [#55](https://github.com/oirge/Mineradio/pull/55) → **合并提交** `a05b162`（CI `Verify` run `33953815152` 过 PR、`33953830715` 过 push）。绝不 squash，否则打在 `7e5702a` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.9.0` 打在 `7e5702a` 且是 **annotated**（tag object `9f666f9d72f47ca6765a14433737eb7dda78adf7`），`git describe origin/main` 回 `v1.9.0-1-ga05b162`。
- `Build and Release` run `33953854308` 成功（`--ref v1.9.0 -f tag=v1.9.0`，`07:55:14Z` 起 `07:57:27Z` 止，2 分 13 秒）。**electron-builder 的双草稿第九次复现**：`383176263` 四项资产齐全、`383176264` 只有 `latest.yml` 与安装器两项；删掉资产不全的 `383176264` 后发布 `383176263`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.9.0` 复验 tag object 仍在），PATCH 时带 `make_latest="true"`。
- 发布前 `releases/latest` 是 `v1.8.9`，发布后指向 `v1.9.0`（`target_commitish` = `main`）。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.9.0-Setup.exe` | 102608205 | `f64cb13eb4ea96c178064c025a3b8e17ae4c3269c36d8e7f28ea6eee053169d6` |
| `Mineradio-1.9.0-Setup.exe.blockmap` | 106644 | `ef0b5af5e032c464e1be08e2099062f92cf97c0bf42aeb61717a24e88722dd3b` |
| `Mineradio-1.9.0-SHA256SUMS.txt` | 273 | `774b5bdd7712b1950fd8a434d80024078b031afdd48d01bdb0d797bf65ab32ba` |
| `latest.yml` | 347 | `6770229f62a1b49a46f695d65a3a02aeddd34ceb171ea23b2d40b8bd6e4ea42c` |

- 清单 `Mineradio-1.9.0-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机 `sha256sum -c` 全中；`latest.yml` 的 `sha512` = `EuTZ9vRNk0UCPxve/Ohld4olVn63ISgQ62nxdoofnHFhoXTP9fg0Zg3saMcg4jWH3hsuQfk51vGWIuJEAZC5Ig==` 与 `size` = `102608205` 与安装器实测一致（`sha512sum` 的十六进制先 `xxd -r -p` 再 `base64 -w0` 才能和 `latest.yml` 直接比），`releaseDate` `2026-09-05T07:57:14.308Z`。
- 安装器只比 v1.8.9 大了 `13,748` 字节（102,594,457 → 102,608,205），跟 v1.8.9 那次 `+284,909` 的量级完全不同 —— **这一版是纯代码改动，没有新 vendor 任何第三方产物**，体积增量对得上。
- 遗留未修（自 `v1.7.26` 记到现在，本轮仍未动）：`SHA256SUMS.txt` 行尾是 **CRLF**，`sha256sum -c` 直接跑会报 `'…Setup.exe'\r': No such file or directory`，必须先 `tr -d '\r' < Mineradio-1.9.0-SHA256SUMS.txt > /tmp/sums.lf && sha256sum -c /tmp/sums.lf`。**只是 CRLF，没有 BOM**：清单 273 字节、去掉 3 个 `\r` 正好 270，首字节就是哈希的 `f`（工作流第 75 行 `Out-File -Encoding utf8` 跑在 GitHub Actions 的 PowerShell 7 上，`utf8` 不带 BOM；换成 Windows PowerShell 5.1 才会多出 `EF BB BF`）。
- **v1.8.8 那条 NSIS 静默安装坑仍然有效**（`allowToChangeInstallationDirectory: false` 的 `/S` 装进「上次记住的目录」、真实目录读注册表 `UninstallString`、`/D=` 必须最后且不加引号、快捷方式要自己改 `TargetPath`），见 v1.8.8 的发布记录。本轮**没有**动本机安装（`D:\Mineradio` 与 `D:\222\Mineradio` 都还停在 `1.8.8`，用户没要求这一版跟着更）。
- 补记上一版的尾巴：v1.8.9 的资产记录分支 `docs/release-assets-v189` → PR [#54](https://github.com/oirge/Mineradio/pull/54) → **合并提交** `2ea0b50`（记录提交 `f08ff35`，CI `Verify` run `33948589177` / `33948652747`）。
- 资产记录分支 `docs/release-assets-v190`（本条记录自己就在这个分支上，PR 与合并提交号下一版补记）。

## v1.8.9 音域回响补上 Wallpaper Engine 原作

- 正式发布版本从 `1.8.8` 提升为 `1.8.9`；五处版本钉（`package.json`、`package-lock.json` 两处、`public/app.js` 的 `APP_VERSION`、发布工作流默认 tag）一起动，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。
- **这一版结掉的是 v1.8.8 留下的那条待定项。** 用户的指令是「把我没有的原项目有的视觉预设都移过来」，对着上游 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)（commit `89c0d23`）逐个比对，缺口只有一个：它的 `public/sonic-workshop-preset.js` + `public/vendor/sonic-workshop/`，也就是 CmzYa 的 Wallpaper Engine 作品《音域回响》本体（Workshop 物品号 `3747222633`）。上游那份 three.js 重写已在 v1.8.8 落成预设 7，这一版落的是预设 8，**两个预设是同一件作品的两条实现，不是重复功能**。
- **预设 8 不是着色器，是 iframe 里的一份第三方构建产物。** `public/vendor/sonic-workshop/` 四个文件（`mineradio-bridge.html` 13,909 B、`project.json` 8,615 B、`assets/index-Z-j1MQ-r.js` 1,262,837 B、`assets/index-Bhwp8mwk.css` 9,754 B，合计约 1.3 MB）**逐字节复制自上游、一个字节都没改**，发版前用 `sha256sum` 对着 `/tmp/upstream-mineradio` 的同名文件逐个核过。版权属 CmzYa，出处链补在 `NOTICE.md` 的 `## Community Contributions`（拆成「预设 7 / 预设 8」两块）与 `public/sonic-workshop-preset.js` 的文件头——**上游自己的 NOTICE 里既没有这份产物的出处、也没有 Ajin 的名字，两条都由本仓库补记。**
- **vendor 第三方产物前先做了安全审计，并把结论钉成了回归测试。** 1.26 MB 那份 JS 里 `XMLHttpRequest` / `fetch` 的网络出口、`WebSocket` / `EventSource` / `sendBeacon` / `importScripts` / `eval(` / `new Function` / `localStorage` / `sessionStorage` / `indexedDB` / `document.cookie` / `navigator.geolocation` 共 12 个记号零命中，外链主机只有 `w3.org` / `react.dev` / `tailwindcss.com` / `jcgt.org` / `github.com` / `docs.pmnd.rs` 六个文档域名。`tests/sonic-workshop-preset.test.js` 把这 12 个记号与这份主机白名单都写成断言，**将来重新 vendor 一份会联网的包，是 CI 失败而不是静默发货**。
- **宿主侧只有 `public/sonic-workshop-preset.js`（845 行，IIFE 挂 `window.MineradioSonicWorkshop`，导出 `{INDEX, isActive, update, clear, pushProperties, onPresetChange}`）。** 桥接页把 Wallpaper Engine 的宿主 API 整套 shim 掉（`wallpaperRegisterAudioListener` / `…MediaPropertiesListener` / `…ThumbnailListener` / `…PlaybackListener` / `…TimelineListener` / `wallpaperMediaIntegration` / `wallpaperReady` / `wallpaperPropertyListener.applyUserProperties`），并暴露 `__mineradioApplyAudio` / `__mineradioApplyMedia` / `__mineradioApplyProperties` 三个入口；模块优先直调这三个函数，`contentWindow` 上没有时才退回 `frame.postMessage({type,…}, '*')`。**这两条路都被测试走过一遍，postMessage 那条还断言了三种消息类型的名字确实出现在桥接页里**，免得改了一边忘了另一边。
- **`#sonic-workshop-layer` 插在 `#canvas-container` 前面的同一个父节点里，位置是有讲究的**：两者都在 `z-index:0/1` 这一层，DOM 里作为最后一个 `z-index:0` 兄弟，画面上就压在 `#wallpaper-board` / `#custom-bg` / `#album-bg` / `#theme-bg-tint` 之上、粒子画布之下。整层与层内每个后代都是 `pointer-events:none !important`，另加 `inert` / `aria-hidden="true"` / `tabIndex=-1` / `draggable=false`，鼠标、拖拽、键盘焦点、读屏全部穿过去；`body.sonic-workshop-active` 再给上层界面让路。深度睡眠时这一层跟着隐藏。
- 选中这个预设时封面粒子整层收起（`particles.visible = !skullPresetActive && !workshopPresetActive`，`bloomParticles` / `floatGroup` / `backCoverGroup` 同步），和上游一致——壁纸本身是一幅完成品，叠粒子会脏。`skullBackdropDim` 在预设 8 下取 `0.82`，与预设 7 同一档。
- **推送分三档节流，全部保持上游原值**：音频 `33ms`、媒体 `250ms`、属性 `1000ms`，各自按内容键去重，所以换歌或改配色是**当场**推一次、不等窗口到点。淡入速率 `7.5`、淡出 `5.0`，透明度 `≤0.01` 时整层从 DOM 摘掉。音频整形系数（`TARGET_MAX_SAMPLE 0.52` / `BODY_GAIN 0.33` / `PEAK_GAIN 0.12` / `GAMMA 1.55` / `MIN_FLOOR 0.035` / `LOW_LIFT 0.035` / 暂停 `×0.12`）也一个都没动，只有输入增益暴露成设置项（默认 82，夹在 40~100）。
- **本机适配只有三处，都写在模块文件头**：① 配色取 `stageLyrics.coverPalette` 的 `primary/secondary/highlight`，角色分工与预设 7 对齐（冷色=主色、暖色=副色、涟漪与峰值=高光色），认不出颜色退回原作深蓝配暖橙；② 地形基色自己压暗，不跟封面副色走——本仓库的调色板是给歌词用的，没有暗部区域色；③ `gridSize` 跟画质档位联动 `{eco:224, balanced:288, high:320, ultra:384}`，**默认档 `high` 取 320 = 原作 `project.json` 的默认值，开箱即与原作一致**，省电档降下来护住弱机（壁纸在 iframe 里自带一套 three.js，和主渲染器叠着吃 GPU）。`showPlayerController` 保持 `false`：播放器 UI 是本仓库自己的，原作那套不显示。（后续：① 和 ③ 在 v1.9.0 都改掉了 —— 配色换成吃原始封面取色 `rawArea*` / `raw*`，`gridSize` 固定回 `320` 不再跟档位联动；只剩 ② 和 `showPlayerController` 还算本机适配，详见文首 v1.9.0 小节。）
- 预设数量是数据驱动的，**这一版没有改任何数字**：夹取用的是 `presetMeta.length - 1`（`public/app.js:6149`、`:35036`），加第 9 条 `presetMeta` 就够。面板文案 `presetMeta[7] = 移植 Ajin`、`presetMeta[8] = 原作 CmzYa`，`presetDisplayOrder` 改成 `[0, 7, 8, 6, 5, 4, 2, 1, 3]`，两条并排。
- 打包不用动：`build.files` 本来就是 `public/**/*`，vendor 目录自动进包（测试也断言了这一条）。`public/index.html` 里 `<script src="sonic-workshop-preset.js"></script>` **必须排在 `app.js` 之前**，`app.js` 用 `typeof MineradioSonicWorkshop !== 'undefined'` 取模块。
- 验证：全量回归 `965/965` 通过（v1.8.8 基线 `939`，新增 `tests/sonic-workshop-preset.test.js` 26 例）。新测试不是读源码字符串凑数——它用 `vm` + 一套假 DOM **真跑一遍 `update()`**，钉住插入位置、点不穿、淡入淡出生命周期、三档节流（在假时钟上走 10ms → 无推送、+40ms → 音频、+300ms → 媒体、+800ms → 属性）、以及整形后的确切采样值（全 255 频谱 → `(0.28+0.12)×0.82 = 0.328`，静音恒 `0`）。顺带修了 `tests/sonic-topography-preset.test.js` 里被预设 8 接线打红的 4 条断言（预设名单、图标数、`skullBackdropDim`、`isSoftFlowPreset`），16/16 恢复。
- **已知边界：壁纸层的实际观感没有在真实窗口里逐帧核对过。** 逻辑由 26 例测试钉住、`node --check` 干净、`965/965` 全绿，但「壁纸跟着封面换色好不好看」「频谱幅度合不合适」这类只能靠肉眼，发版时仍是未确认状态。用户的指令是「更新好后发布新版」，所以按移植的忠实度发出去。

### 发布记录（v1.8.9）

- 单分支写法：`feat/sonic-workshop-we-original`。功能提交 `b7527d6 feat: 补上音域回响的 Wallpaper Engine 原作（视觉预设 8）` 带新文件 `public/sonic-workshop-preset.js`、vendor 目录 `public/vendor/sonic-workshop/` 四个文件、`public/app.js` / `public/app.css` / `public/index.html` 的接线、新测试 `tests/sonic-workshop-preset.test.js`、修好的 `tests/sonic-topography-preset.test.js` 与 `NOTICE.md`，`APP_VERSION` 仍留 `1.8.8`（保证单独 checkout 也自洽）；五处版本钉与全部文档压在紧随其后的 `e6b2d16 chore(release): 1.8.9` 里。
- PR [#53](https://github.com/oirge/Mineradio/pull/53) → **合并提交** `93fb6ab`（CI `Verify` run `33948043742` 过 PR、`33948050983` 过 push）。绝不 squash，否则打在 `e6b2d16` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.8.9` 打在 `e6b2d16` 且是 **annotated**（tag object `f6c0d70131985bea87a44af7fa0c11044635bd2d`），`git describe origin/main` 回 `v1.8.9-1-g93fb6ab`。
- `Build and Release` run `33948090282` 成功（`--ref v1.8.9 -f tag=v1.8.9`）。**electron-builder 的双草稿第八次复现**：`383148827` 四项资产齐全、`383148828` 只有 blockmap 一个；删掉资产不全的 `383148828` 后发布 `383148827`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.9` 复验 tag object 仍在），PATCH 时带 `make_latest="true"`。
- 发布前 `releases/latest` 是 `v1.8.8`，发布后指向 `v1.8.9`；停在 `1.8.6` 的客户端（v1.8.7 的 Release 已不在线）仍是一步跳到最新。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.8.9-Setup.exe` | 102594457 | `a5e669a2bdaf2a8c18b9aa69fe093f777f0196a49aeb35b86ac1b9bc45b6570e` |
| `Mineradio-1.8.9-Setup.exe.blockmap` | 106601 | `60b833c358c3c76bd6db32435292bbfeff2f0b77c6dbd333f37d3ff9067335ad` |
| `Mineradio-1.8.9-SHA256SUMS.txt` | 273 | `fec43c4126a765d32ed0a9381712cbe26159ab316032a3b5283af4cea433403f` |
| `latest.yml` | 347 | `1cd12ee7c9bf7d24db120a9586849549951c192439dd9b72c9359e4922a96fc2` |

- 清单 `Mineradio-1.8.9-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机复算全中；`latest.yml` 的 `sha512` = `gq0VMwxaeeYw1CIRA0xnMS6WZfmomHb06lOw04EavfYoWKTYRkvg1i27+dd1bgaSwVg+Gnexwr/0IBy406WNJA==` 与 `size` = `102594457` 与安装器实测一致，`releaseDate` `2026-09-05T05:49:43.701Z`。
- 安装器比 v1.8.8 大了 `284,909` 字节，正好是 vendor 进来的那份 WE 产物（约 1.3 MB 源文件，asar 压缩后的增量）——**vendor 第三方产物会直接抬高安装包体积，这一项以后要一起看**。
- 遗留未修（自 `v1.7.26` 记到现在，本轮仍未动）：`SHA256SUMS.txt` 行尾是 **CRLF**，`sha256sum -c` 直接跑会报 `'…Setup.exe'\r': No such file or directory`，必须先 `tr -d '\r' < Mineradio-1.8.9-SHA256SUMS.txt > /tmp/sums.txt && sha256sum -c /tmp/sums.txt`。
- **v1.8.8 那条 NSIS 静默安装坑仍然有效**（`allowToChangeInstallationDirectory: false` 的 `/S` 装进「上次记住的目录」、真实目录读注册表 `UninstallString`、`/D=` 必须最后且不加引号、快捷方式要自己改 `TargetPath`），见下一节 v1.8.8 的发布记录。本轮**没有**动本机安装（`D:\Mineradio` 还停在 `1.8.8`，用户没要求这一版跟着更）。
- 资产记录分支 `docs/release-assets-v189`（本条记录自己就在这个分支上，PR 与合并提交号下一版补记）。

## v1.8.8 音域回响改成移植上游的地形实现

- 正式发布版本从 `1.8.7` 提升为 `1.8.8`；五处版本钉（`package.json`、`package-lock.json` 两处、`public/app.js` 的 `APP_VERSION`、发布工作流默认 tag）一起动，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。**注意 v1.8.7 的 GitHub Release 已经不在了**（tag `v1.8.7` 仍在远端、`releases/tags/v1.8.7` 返回 404、草稿 0 个），所以本版发布时 `releases/latest` 是从 `v1.8.6` 直接跳到 `v1.8.8`；停在 `1.8.6` 的客户端会一步更新到这里。
- **v1.8.7 那一版的判断错在「原项目」指谁。** 我把它读成 CmzYa 的 Wallpaper Engine 作品，扫盘找不到 Workshop 目录就断定「源码不在本机、只能做原创致敬」。用户纠正：「和原项目的回响不一样这是原项目 https://github.com/XxHuberrr/Mineradio」——原项目是本仓库的上游社区分支，它的 `public/sonic-topography-preset.js` 是公开源码，GPL-3.0，和本仓库同许可，本来就该直接移植。
- 现在预设 7 的地形层是**照上游那份 1081 行模块逐段移植**的，落在新文件 `public/sonic-topography-preset.js`（1083 行）。出处链写在文件头与 `NOTICE.md`：上游 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)（commit `89c0d23`）→ 它标注的 [yin-yizhen/sonic-topography](https://github.com/yin-yizhen/sonic-topography) 1.1.1（commit `3ff303e`）→ 原始创意 CmzYa 的 WE 作品（Workshop 物品号 `3747222633`）。
- **移植成独立兄弟脚本、不塞进 `app.js`，是为了不碰着色器字符串机器。** `bloomVs` 由 `vs` 做两次逐字节精确替换派生（锚点 `'uniform float uMouseActive, uPixel, uColorMixT, uLoading;'` 与 `'gl_PointSize = sz * uPixel * uPointScale;'`），地形层用自己的 `ShaderMaterial`，那两句一个字节都不用动。`public/index.html` 在 `app.js` 之前多一行 `<script src="sonic-topography-preset.js"></script>`——必须在前，`window.MineradioSonicTopography` 要先注册。
- 渲染结构：四个 `InstancedMesh`，地形 `BoxGeometry(boxWidth,1,boxWidth)` × gridSize²、悬浮方块 80、流星 20、尾迹 200，全部 `frustumCulled = false`，每帧只写实例矩阵。精度按画质档位封顶 `{省电 112, 均衡 160, 高 192, 极致 224}`，默认密度 46 算出 156×156；`spacing = 168 / gridSize`，柱宽 = `spacing * (0.9/1.05)`。
- **音频量纲是唯一需要适配的地方。** 上游有一套细粒度频谱监听，本项目只有 `{bass, mid, treble, beat, energy}` 五个标量，所以回落成 `readMineradioAudio` 从这五个值里推 8 段频谱与 `kickEnvelope`。上游的涟漪阈值是 `kickEnvelope > 0.58`（0.32 复位）、流星 `> 0.62 且 random < 0.045`，而本项目 `beatPulse` 峰值大约 `0.62~0.92`，所以帧循环里传 `beat: Math.min(1, beatPulse * 1.35)`，不改模块里的阈值。
- **帧钩子的位置是有讲究的：必须排在 `updateSkullParticleLayer(dt, frameShelfState);` 之后**，也就是 `particles.rotation.x/y +=` 已经加完的地方，地形才跟主粒子层共用同一帧的旋转，和上游的顺序一致。每帧传入的 ctx 是模块外预分配、逐帧填字段的（`scene` 1739 行、`orbit` 1951 行、`particles` 4812 行都声明在 ctx 之后，所以声明处只能留空壳），60fps 下不造垃圾。
- 涟漪的 uniform 打包沿用上游：`vec4(x, z, start, ±strength)`，**w 取负号表示白色细涟漪**（军鼓与高频），正号是底鼓的蓝涟漪。`RIPPLE_MAX 10`、`RIPPLE_LIFETIME 4.8`、软淡出从 `2.1` 秒起——这两个常量是插值进 GLSL 的（着色器里出现 `2.10,4.80`）。`syncRippleUniforms` 排在 `updateAudioTriggers` 之前，所以第 N 帧新增的涟漪要到第 N+1 帧才进 uniform，测试把这条也钉住了。
- **画布上单击（不是拖动）会打一道涟漪**：`mouseup` 里判 `!mouseDownAt.hadDrag && !isPointerOverUi(e)`，按压时长换强度（`0.25 + 秒数*2.6`，上限 `3.0`），屏幕坐标映射到 ±17 的世界范围。点界面元素、拖视角都不触发。
- 背景星河在这个预设下压到 `0.82`（`skullBackdropDim`），和上游一致——地形本身够亮，不压会糊成一片。转场谓词 `isSoftFlowPreset` 仍覆盖 5 与 7；相机基线改成 radius `8.4` / phi `0.18`（原来是 `8.6` / `0.16`）。
- **删干净了上一版的自研子系统**：`SPECTRUM_ECHO_PRESET_INDEX`、`updateSpectrumEchoField`、64×64 `DataTexture`（`spectrumEchoTex`）、`uSpectrumTex` uniform 与 sampler 声明、着色器里 `uPreset > 6.5` 的两处分支全部移除，`else if (uPreset < 6.5)` 放宽成 `else`。`grep -n 'spectrumEcho|SPECTRUM_ECHO|uSpectrumTex'` 零命中。`presetMeta[7]` 的说明从 `频谱回响 · 致敬 CmzYa` 改成 `音域地形 · 移植 CmzYa`。
- 打包不用改：`build.files` 本来就是 `public/**/*`，新脚本自动进包；没有任何测试去扫 `index.html` 的 script 标签，新测试把这条也写成断言。
- 验证：全量回归 `939/939` 通过（v1.8.7 基线 `932`，新增 `tests/sonic-topography-preset.test.js` 16 例，删掉已经失效的 `tests/spectrum-echo-preset.test.js` 9 例）。测试用一份 THREE stub 直接读实例矩阵，钉住的是行为而不是数值凑数：流星未激活时藏在 `y = -1000` 且缩放 0、落地正好撒 10 粒尾迹、尾迹一秒内过期、切走预设整层显存释放、冷启动在预设 5 时一个实例都不分配。
- **已知边界：地形的实际观感没有在真实窗口里逐帧核对过。** `node --check` 干净、逻辑由 16 例测试钉住、`939/939` 全绿，但涟漪强度、配色跟封面的搭配这类观感项目只能靠肉眼，发版时仍是未确认状态——用户的指令是「更新好后发布新版」，所以按移植的忠实度发出去，观感问题留待反馈再调。
- 待定：上游仓库里还带着一份 CmzYa 的 WE 打包产物（约 1.26 MB，没有署名文件）与一个桥接页。本轮**没有**把它 vendor 进来，只搬了原生地形层。（后续：这条已在 v1.8.9 结掉，产物按字节 vendor 进来落成预设 8，见文首小节。）

### 发布记录（v1.8.8）

- 单分支写法：`feat/sonic-topography-port`。功能提交 `2d05d20 feat: 音域回响改为移植上游地形实现` 带新文件 `public/sonic-topography-preset.js`、`public/index.html` 那一行 script、`public/app.js` 的删旧 + 接钩子、新测试 `tests/sonic-topography-preset.test.js`，同时删掉 `tests/spectrum-echo-preset.test.js`，`APP_VERSION` 仍留 `1.8.7`（保证单独 checkout 也自洽）；五处版本钉与全部文档压在紧随其后的 `e8c0c9a chore(release): 1.8.8` 里。
- PR [#51](https://github.com/oirge/Mineradio/pull/51) → **合并提交** `77d2302`（CI `verify` run `33944120388` 通过）。绝不 squash，否则打在 `e8c0c9a` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.8.8` 打在 `e8c0c9a` 且是 **annotated**（tag object `f68b0e6c9ee7e13a9b6f666b4d99d978c63f92b4`），`git describe origin/main` 回 `v1.8.8-1-g77d2302`。
- `Build and Release` run `33944212605` 成功（`--ref v1.8.8 -f tag=v1.8.8`）。**electron-builder 的双草稿第七次复现**：`383131750` 四项资产齐全、`383131751` 不全；删掉资产不全的 `383131751` 后发布 `383131750`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.8` 复验 tag object 仍在），PATCH 时带 `make_latest="true"`。
- **发布前 `releases/latest` 停在 `v1.8.6`**（v1.8.7 的 Release 已不在线，见本节第 1 条），所以这一版对外是 `1.8.6 → 1.8.8` 的直跳；发布后 `releases/latest` 指向 `v1.8.8`。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.8.8-Setup.exe` | 102309548 | `2318b503d461c9e265212abf76e036c72d9cbf45d525f691bbf5551c976af352` |
| `Mineradio-1.8.8-Setup.exe.blockmap` | 106576 | `9c8add6b67ba16898c1ccb17dac6b97ebb400dff3994aa87ec3e43c251b9bf30` |
| `Mineradio-1.8.8-SHA256SUMS.txt` | 273 | `97edd918a7ef542ed7c45d065c25bb2d9688cb456f7a1c8c397d6f0c8ccba80f` |
| `latest.yml` | 347 | `e66bde4f8809c34c2fa467eb0e598867624d67b15959c1bc8ea7ab4f7a177cf2` |

- 清单 `Mineradio-1.8.8-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机复算全中；`latest.yml` 的 `sha512` = `sPc4LaBS1j3I11s8QrUbmAmcnxX6OmqP3WzuBGNa/Q3vjW6viRssPbHk5e6lxSSZCCgAflBJLEUN3JWmdW1y2w==` 与 `size` = `102309548` 与安装器实测一致，`releaseDate` `2026-09-05T04:21:14.957Z`。
- 遗留未修（自 `v1.7.26` 记到现在，本轮仍未动）：`SHA256SUMS.txt` 行尾是 **CRLF**，`sha256sum -c` 直接跑会报 `'…Setup.exe'\r': No such file or directory`，必须先 `tr -d '\r' < Mineradio-1.8.8-SHA256SUMS.txt > /tmp/sums.txt && sha256sum -c /tmp/sums.txt`。
- **本地安装踩坑（用户要求把 `D:\Mineradio` 更到最新版时发现）：`allowToChangeInstallationDirectory: false` 的 NSIS 静默安装会装到「上次记住的目录」，不是你以为的那个目录。** `Mineradio-1.8.8-Setup.exe /S` 连跑三次都 `exitCode=0`，而 `D:\Mineradio\Mineradio.exe` 的 `ProductVersion` 一直是 `1.8.7`——因为它实际装进了 `D:\222\Mineradio`。**判断办法是读注册表卸载项**：`HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\<guid>` 的 `DisplayVersion` 已经是 `1.8.8`，`UninstallString` 指向的才是真实目录（`InstallLocation` 是空的，别指望它）。要指定目录得加 `/D=`，且**它必须是最后一个参数、不能加引号**：`Setup.exe /S /D=D:\Mineradio`。
- **`/D=` 从 Git Bash 直接传会被 MSYS 改写路径**，稳的写法是把 `@echo off` + 整条命令写进一个 `.bat`，再用 `cmd //c '<绝对 Windows 路径>\x.bat'` 跑；`cmd //c x.bat` 配 `cd` 到该目录**找不到文件**（工作目录没传过去），必须给绝对路径。
- 装完还要**自己把快捷方式改回来**：`createDesktopShortcut: true` 只在快捷方式不存在时创建，已经指向旧目录的桌面 / 开始菜单 `Mineradio.lnk` 不会被重写，得用 `WScript.Shell` 改 `TargetPath` / `WorkingDirectory` / `IconLocation`。
- 资产记录分支 `docs/release-assets-v188` → PR [#52](https://github.com/oirge/Mineradio/pull/52) → **合并提交** `2d1d76a`。

## v1.8.7 音域回响视觉预设 + 全屏退出不再黑屏卡顿

> 补记（后于本节写下）：**本节关于「音域回响」的判断是错的，见文首 v1.8.8 一节。** 「原项目」指的是上游社区分支 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)，源码公开且同为 GPL-3.0；v1.8.7 发出去的是自研频谱环，已在 v1.8.8 里整体换成移植实现。下面第 5～12 条（`**新数据通路是这一版的技术核心。**` 那条起到 `转场与相机` 那条止）关于 `DataTexture` / `uSpectrumTex` / `uPreset > 6.5` 的实现细节，以及最后一条验证记录里 `uSpectrumTex` 是 ACTIVE_UNIFORM 那半句，都只作为历史记录保留，源码里已经没有了。第 4 条（WE 集成那条路）仍然有效。全屏退出那半（本节倒数第 5 条到倒数第 2 条）不受影响，仍然有效。

- 正式发布版本从 `1.8.6` 提升为 `1.8.7`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:622`）与发布工作流默认 tag 保持一致，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。
- 用户原话（issue 形状，两件事）：「增加视觉预设：希望增加音域回响视觉预设（Wallpaper Engine)(作者CmzYa）。全屏模式退出时，有明显的黑屏卡顿问题。」建议里写的是「可以从原项目的项目代码去接入实现」。
- ~~**原壁纸源码不在本机，所以这一版不是移植。**~~（**这条判断错了**：用户说的「原项目」是上游社区分支 `XxHuberrr/Mineradio`，不是 Workshop 作品本体，那份地形源码一直是公开的。）后台把 `/c /d /e /f` 全盘扫过一遍找 Steam Workshop 目录 `431960`，零匹配；WebSearch 也没能定位到这件作品。加上直接搬 Workshop 作品的代码/素材本身有授权与署名问题，最终在 Mineradio 自己的 shader 框架里做了一个原创的同名同气质预设，`presetMeta` 里写成 `频谱回响 · 致敬 CmzYa`（致敬，不是移植）。**开发版已改为移植上游实现。**
- 另一条路本来就通：项目已有 Wallpaper Engine 集成（`desktop/wallpaper-engine-library.js`，`WALLPAPER_ENGINE_APP_ID = '431960'`，扫 `steamapps/workshop/content/431960` 与 `steamapps/common/wallpaper_engine/projects/myprojects`），用户在 WE 里装了「音域回响」就能直接把真作品当桌面壁纸层或播放器背景板跑。两条路互不影响。
- **新数据通路是这一版的技术核心。** 着色器原本只拿到 `uBass/uMid/uTreble/uBeat/uEnergy` 五个标量，做不出「音域」，所以加了一张 64 频段 × 64 历史行的 RGBA8 `DataTexture`（`spectrumEchoTex`，16 KB，60fps 下约 1 MB/s 上传）：每次推进先 `copyWithin` 把旧行整体下移一行，再把当前频谱写进第 0 行。**故意不用环形索引**——`LinearFilter` 会在环绕处插出一道缝。`DataTexture.flipY = false`，所以纹理 `v = 0` 就是最新行。四个通道：R 归一幅度、G 起振快收尾慢的包络、B 瞬态、A 该行的节拍能量。
- 着色器把角度当音域（`bandN = abs(aUv.x * 2 - 1)`，低音在正下方、两侧升到高音、首尾无缝）、半径当时间（`age = lane / 0.86`），直接用半径去采样这张历史图，于是当下的频谱会一圈圈向外扩散、`decay = pow(1 - age, 1.35)` 衰减、`pos.z = -age * 3.9 + ...` 沉成漏斗纵深。外圈 14% 的 lane 留给只吃高频的空气尘，避免画面边缘硬切。
- 分频是对数桶：`ensureSpectrumEchoBins` 从 bin 2 起、以 `len * 0.55` 为上界按几何步长铺 64 段，保证严格递增且每段至少一个 bin，低频窄高频宽。行推进 `SPECTRUM_ECHO_PUSH_INTERVAL = 1/48`（64 行 ≈ 1.33s 回响），**掉帧时最多补一行、不做追赶式连推**，否则回响会突然抽一下。
- 其他 7 个预设一分开销都没有：`updateSpectrumEchoField` 第一行就是 `if (!fx || fx.preset !== SPECTRUM_ECHO_PRESET_INDEX) return;`；进出这个预设都 `resetSpectrumEchoField()`，否则再次进入会先闪一帧上次残留的频谱。停播后不再取样但历史继续推进，旧回响一路走到外圈自然散尽，而不是冻在最后一帧。
- 着色器分支的三条硬约束：① 星河/安魂那支收成 `else if (uPreset < 6.5)`，预设 7 用最后的 `else`；② `vBright` 与 `gl_PointSize` 里 `uPreset > 6.5` 的分支**必须排在 `> 4.5` 之前**，否则会被星河那一支吃掉；③ 唱片专属的 `vinylHiResGuard` 用 `step(3.5, uPreset) * (1.0 - step(4.5, uPreset))` 夹住，不许溢到 7。
- **新 sampler 只能挂在 `uniform sampler2D uCoverTex, uPrevCoverTex, uEdgeTex, uRippleTex, uSpectrumTex;` 那一行。** `bloomVs` 是由 `vs` 做两次精确字符串替换派生的（`'uniform float uMouseActive, uPixel, uColorMixT, uLoading;'` 与 `'gl_PointSize = sz * uPixel * uPointScale;'`），这两句必须保持逐字节不变。
- **本轮唯一真实踩坑：`var len = frequencyData.length;` 在 `public/app.js` 里必须唯一。** `tests/audio-analysis-hot-path.test.js:139` 拿它当切片起锚，我第一版在 `updateSpectrumEchoField` 里也声明了同名局部变量、而且位置更靠前（4242 行 vs 43278 行），`indexOf` 直接切到我的函数上，那条常驻测试的「单次扫描只能有一个 for」当场变成 2。改名 `binCount` 才修好。**帧循环钩子也因此只放在 `uniforms.uEnergy.value = audioEnergy;` 之后**，绝不进被钉住的单次扫描区。
- 转场与相机：`wallpaperFlow` 提成共享谓词 `isSoftFlowPreset(preset)`（覆盖 5 和 7），铺满视野的连续场只给极轻的一下（`duration 0.30`、`uBurstAmt 0.05`、`camPunch 0.04`），硬炸开会撕碎整片粒子。`setPreset` 给 `p === 7` 的基线是 radius `8.6` / phi `0.16` / theta `0`（`orbit.baselineTheta` 那行没动）。
- **全屏退出黑屏卡顿的根因是遮罩被后到的信号一路顺延。** 退出时窗口尺寸跳变、边界还原、`leave-full-screen` 状态推送会连发好几轮，原本每一轮都重排回亮计时器，等于让遮罩一直等最后一个信号，看上去就是一段黑屏。现在 `scheduleFullscreenTransitionReveal` 只允许提前（`if (revealDue && due >= revealDue) return;`），resize 或尺寸已跳变用 50ms、只有状态推送用 110ms。
- 硬上限 `FULLSCREEN_TRANSITION_MAX_COVER_MS = 320` **独占 `deadlineTimer` 一个计时器槽**，resize/state 只能重排 `revealTimer`、抢不掉它，所以遮罩时长有确定上界。动作前摇 110ms（遮罩铺好才调原生退出）、收尾 220ms；降低动效偏好下是 20 / 90 / 30 / 80。
- `desktop/main.js` 的 `applyWindowedBounds` 边界已经到位时不再重复 `setBounds`（`const settled = current.x === target.x && ...`），但仍然 `sendWindowState(mainWindow)`；`leave-full-screen` 与 `leave-html-full-screen` 都立刻把状态推给渲染层。
- CSS 只动了必须动的：**窗口壳过渡不能带 `filter`**（`#desktop-window-shell` 承载 WebGL 画布，加 filter 会让整窗每帧重新合成），只留 `will-change:transform`；遮罩层 `#fullscreen-transition-layer` 用 `rgba(0,0,0,.62)`，回亮 `transition:opacity .2s`。
- 验证：全量回归 `932/932` 通过（v1.8.6 基线 `916`，本轮新增 16 例：`tests/spectrum-echo-preset.test.js` 9 例 + `tests/fullscreen-exit-transition.test.js` 7 例）。着色器**在真实 GLSL 编译器上编译链接过**——Electron + SwiftShader 跑了一遍 vs/fs/bloomVs/bloomFs，两个 program 都 link 成功，`uSpectrumTex` 是 ACTIVE_UNIFORM（证明它真的被用上、没被优化掉）。**但这个预设和重调后的全屏过渡都没有在真实窗口里肉眼看过。**

### 发布记录（v1.8.7）

- 单分支写法：`feat/spectrum-echo-preset`。功能提交 `b9c0a73 feat: 新增音域回响视觉预设并消除全屏退出黑屏卡顿` 带 `public/app.js`、`public/app.css`、`desktop/main.js` 与两个新测试文件、`APP_VERSION` 仍是旧值（保证单独 checkout 也自洽）；版本钉与全部文档压在紧随其后的 `c0b1b1e chore(release): 1.8.7` 里。两件事共用一个功能提交是因为它们在 `public/app.js` 里各占一段、拆提交要靠交互式暂存，本环境不支持 `git add -i`。
- PR [#49](https://github.com/oirge/Mineradio/pull/49) → **合并提交** `ba9cf40`（CI `verify` run `33938412938` 通过）。绝不 squash，否则打在 `c0b1b1e` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.8.7` 打在 `c0b1b1e` 且是 **annotated**（tag object `929ed72`），`git describe origin/main` 回 `v1.8.7-1-gba9cf40`。
- `Build and Release` run `33938522336` 成功（`--ref v1.8.7 -f tag=v1.8.7`）。**electron-builder 的双草稿第六次复现**：`383104376` 四项资产齐全、`383104377` 只有 `Mineradio-1.8.7-Setup.exe.blockmap` 一项，两份都记在 `2026-09-05T02:14:24Z`；草稿在 `releases/tags/<tag>` 上会 404，只能枚举 `releases?per_page=8` 比资产清单。删掉资产不全的 `383104377` 后发布 `383104376`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.7` 复验，tag object 仍是 `929ed72`），PATCH 时带 `make_latest=true`，`releases/latest` 已指向 `v1.8.7`。
- **新踩坑：`gh api` 没有 `--output` 参数**（那是 `gh release download` 的），回下资产只能把 stdout 重定向到文件（`subprocess.check_call([...], stdout=fh)`）。第一版校验脚本用了 `--output`，直接吐 usage 退 1。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.8.7-Setup.exe` | 102299619 | `cee716c827b0cb2e6f3dfcf78ed6b18f65c83ea4683292d6200acea4c8709781` |
| `Mineradio-1.8.7-Setup.exe.blockmap` | 106442 | `5ea176942f8852d66f4a8b4352c2a9c8a852c32eb3d2139305c3850706f27c39` |
| `Mineradio-1.8.7-SHA256SUMS.txt` | 273 | `61dfd378a169b8c469a4f47e21a93e76f584a7e9a1cb62c03ae4a950a6ebcfcc` |
| `latest.yml` | 347 | `460c556845359366b338feb26e4fb9f174adce16a5001bc949ae3e7da1fa5e91` |

- 清单 `Mineradio-1.8.7-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机复算全中；`latest.yml` 的 `sha512` = `SKgjuXuFfQX8YGCvU5MRx8rGTD1z8cyM/+NQzLSTL5PoyarCfJvivwPsQa0a3wjfISkn08+cXTyziCkcfmE77Q==` 与 `size` = `102299619` 与安装器实测一致，`releaseDate` `2026-09-05T02:16:49.212Z`。
- Release 正文照旧写短：预设三条 + 全屏三条 + 安装说明，并明确写了「这是原创预设、不是移植原壁纸」与「装了原作可以走现有壁纸功能」，工程细节留在本文件与 `docs/PROJECT_MEMORY.md`。
- 资产记录分支 `docs/release-assets-v187` → PR [#50](https://github.com/oirge/Mineradio/pull/50) → 合并提交 `5965b3a`。

## v1.8.6 左下小封面接上歌曲详情
- 正式发布版本从 `1.8.5` 提升为 `1.8.6`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:622`）与发布工作流默认 tag 保持一致，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。
- 用户原话：「你加上一个这个封面可点击进入歌曲详情界面就行了」，指左下角 `#thumb-wrap` 里那张 64px 小封面。改动只有两行：`public/index.html` 的 `#thumb-cover` 加 `onclick="openTrackDetailModal('song')"` 与 `title="歌曲详情"`，`public/app.css` 里 `#thumb-cover` 那条规则加 `cursor:pointer`。
- **一行 JS 都没新增。** `openTrackDetailModal` 自带 `if (!song) { showToast('先播放或选择一首歌'); return; }`，而且 `#thumb-wrap` 在拿到 `.visible` 之前是 `pointer-events:none`，所以空闲状态下这张封面根本点不到，不需要额外守卫。
- 中途试过的另一版被用户推翻，已完整还原：原本先把 `#thumb-artist` / `#control-artist` 的 `openTrackDetailModal('artist')` 改成 `'song'`（让上下两行一致），用户回「这个不用改了」，两处现在仍然是歌手详情。**歌名进歌曲详情、歌手行进歌手详情这个分工是设计，不要再顺手改。**
- 底部控件的 `#control-cover` 没有一起改：它是 `aria-hidden="true"` 的装饰性 `div`，挂点击要连带处理无障碍语义，用户这次只点了左下那张，不扩范围。
- `#thumb-cover` 规则里那句 `transition:transform .15s ease` 是历史遗留、当前没有任何 `:hover` 规则触发它，本轮**故意没有**补 hover 缩放，`tests/now-playing-detail-click.test.js` 用 `assert.doesNotMatch(appCss, /#thumb-cover:hover/)` 把这个「不加」也钉住了。
- 验证：全量回归 `916/916` 通过（上一版基线 `912`），新增 `tests/now-playing-detail-click.test.js` 4 例。**四例先在改前源码上对跑过**，封面 `onclick` 与 `cursor:pointer` 两条判红。`public/app.css` 只动了一行（第 573 行加 `cursor:pointer`）；**真实窗口里没有肉眼点过。**

### 发布记录（v1.8.6）

- 单分支写法：`feat/thumb-cover-song-detail`。功能提交 `9d8c90a feat: 左下小封面可点击进入歌曲详情` 只带 `public/index.html`、`public/app.css` 与新测试、`APP_VERSION` 仍是旧值（保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `56789cf chore(release): 1.8.6` 里。
- PR [#46](https://github.com/oirge/Mineradio/pull/46) → **合并提交** `c5daf7c`（CI `verify` run `33858115753`，8m9s 通过）。绝不 squash，否则打在 `56789cf` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.8.6` 打在 `56789cf` 且是 **annotated**（tag object `482e668`），`git describe origin/main` 回 `v1.8.6-1-gc5daf7c`。
- `Build and Release` run `33858921728` 成功（`--ref v1.8.6 -f tag=v1.8.6`）。**electron-builder 的双草稿第五次复现**：`382615797` 四项资产齐全、`382615798` 只有 `latest.yml` 与安装器两项，同一秒创建（两份的安装器字节数还完全一致，只能靠资产条数区分）；草稿在 `releases/tags/<tag>` 上会 404，只能枚举 `releases?per_page=8` 比资产清单。删掉资产不全的 `382615798` 后发布 `382615797`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.6` 复验，tag object 仍是 `482e668`），PATCH 时带 `make_latest=true`，`releases/latest` 已指向 `v1.8.6`。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.8.6-Setup.exe` | 102296745 | `c3f0689db4363945299aa393c238757e80644eba2afd7ce06536bef1f4ad953f` |
| `Mineradio-1.8.6-Setup.exe.blockmap` | 106455 | `efc90bc824cc3a0f3f32b1be88f35508d1d4b7b566cd0589acb95b9358b87d42` |
| `Mineradio-1.8.6-SHA256SUMS.txt` | 273 | `a993748d29a52d1045f280f747b951c235f38da4cdfad4ba89e8bdbccc3c28a6` |
| `latest.yml` | 347 | `5f053cfba1e5921aa95d96f4dc2d92f7c48a4b1b12eae31bac1c8d096b9de71f` |

- 清单 `Mineradio-1.8.6-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机复算全中；`latest.yml` 的 `sha512` = `rwNH3m4Kk1YWCguYz2yuKTWNNuOkWJ86z/LwCXyYyhKbrTESXLjn1ct4SuZ1lfFOr9lMCbHMD6OFhBR+A/cn2w==` 与 `size` = `102296745` 与安装器实测一致，`releaseDate` `2026-09-04T09:40:31.496Z`。
- Release 正文照旧写短：三条行为说明 + 一句「歌名 / 歌手两行未改」+ 安装说明，工程细节留在本文件与 `docs/PROJECT_MEMORY.md`。
- 资产记录分支 `docs/release-assets-v186` → PR [#47](https://github.com/oirge/Mineradio/pull/47) → **合并提交** `e2b10ce`。

## v1.8.5 播放统计漏账：结算点、防抖写入、无时长文件、最小化空档
- 正式发布版本从 `1.8.4` 提升为 `1.8.5`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:622`）与发布工作流默认 tag 保持一致，`tests/version-consistency.test.js` 与 `tests/github-actions-ci.test.js` 各钉一半。
- 用户原话：「修复一下」，指的是歌曲详情里「播放统计」对很多歌一直是空的。查出三个真漏账点加一个连带的持久化漏洞。**45 秒 / 一半进度 / 听完这三条结算门槛是设计，一字未动** —— 跳过的歌不记账，修完之后仍然会有歌显示空态。
- **`flushPersistentVisualState` 原本不结算听歌会话。** 它绑在 `beforeunload` / `pagehide` 上，只存歌词布局、自由相机、音量和播放会话，退出前正在听的那一首永远不进统计。补上 `finalizeListenSession(false)`，照既有 `public/app.js:22425` 的写法套 `typeof` 守卫。`finalizeListenSession` 内部会把 `listenSession` 置空，所以两个事件都触发也只结算一次。
- **顺着查出更前面一层：结算写的那份必然丢。** `scheduleLocalUserStateWrite` 是 120ms 防抖，页面卸载时那个 `setTimeout` 不会再执行。拆出 `runLocalUserStateWrite(id)`（立即执行一条并取消定时器）与 `flushLocalUserStateWrites()`（冲全部），待写载荷改存进 `localUserStatePendingWrites`（原来只活在定时器闭包里，外面冲不出来）。**`function scheduleLocalUserStateWrite(id, value, legacyKey)` 这行签名不能改**，`tests/complete-optimization-gates.test.js:58` 钉着。自定义封面 / 歌词 / 歌词候选 / 节拍图 / 节拍偏好 / 音效档案同一个漏法，一起好了。
- **不能靠改 hydrate 的取值优先级来兜这个洞。** `hydrateLocalUserStateRecord` 是 IndexedDB 记录优先、legacy `localStorage` 兜底，所以卸载时同步写 `localStorage` 是白写：下次启动照旧读到那份更旧的 IDB 记录。唯一正确的做法是把 IDB 写入本身提前发起。
- **`updateListenStatsTick` 第一行的 `!audio.duration` 让结算门里的 30 秒兜底成了死代码。** APE/DSF 走虚拟 WAV、元数据没解析出来时 `audio.duration` 是 NaN，一旦在这里早退 `listenMs` 恒为 0，`(!audio || !audio.duration ? session.listenMs >= 30000 : false)` 这条永远不可能成立。门槛改成只看 `audio.paused`，`maxProgress` 那行自己用 `isFinite(duration)` 兜。
- **最小化空档原本一次只补 4200ms。** `schedulePlaybackTickTimer` 在 `document.hidden && !isLiveBackgroundKeepMode()` 时直接不排 tick，回前台那一次的增量被 `Math.min(..., 4200)` 吃掉，后台听三分钟只记 4.2 秒，等于后台听歌只能靠 `maxProgress >= 0.5` 兜。改成音频与墙钟推进量对得上（差值不超过 `max(1500, paired * 0.25)`）才整段补回，上限 `LISTEN_TICK_CATCHUP_MAX_MS = 1800000`。**关键性质：补账基数始终是 `Math.min(deltaByAudio, deltaByWall)`，两个时钟对得上只提高上限、绝不抬高基数** —— 所以拖进度条（音频跳、墙钟不跳）、卡顿（墙钟跳、音频不跳）、长时间暂停三种情形都不可能被记成收听。原来那句 `delta < 8000` 在 4200 上限下恒真、本就是死代码，跟着去掉。
- 测试切片锚点：`tests/listen-stats-accounting.test.js` 切 `var LISTEN_TICK_CATCHUP_MAX_MS = ` 到换行加 `var appPerfMarks`（上限从源码里切出来，测试不硬编码）、`function beginListenSession(` 到 `function mostPlayedSong(`（计时与结算拼在同一个 realm 跑，listenMs 是真算出来的）、`function flushPersistentVisualState() {` 到 `window.addEventListener('beforeunload'`、`function runLocalUserStateWrite(` 到 `function hydrateLocalUserStateRecord(`，**重命名或拆分这四处前先 grep 一遍 tests 里的锚点字符串**。
- 验证：全量回归 `912/912` 通过（上一版基线 `905`），新增 7 例。**新增的七例先在修前源码上对跑过一遍、七例全红**，确认钉子真的拦得住回归。界面零改动，`public/index.html` 与 `public/app.css` 一行未动；**真实窗口里的播放统计本轮没有肉眼验证过**。


### 发布记录（v1.8.5）

- 单分支写法：`fix/listen-stats-accounting`。修复提交 `368cbf6 fix: 播放统计漏账（关窗口不结算 / 无时长文件不计时 / 最小化空档只补 4.2 秒）` 只带代码与测试、`APP_VERSION` 仍是旧值（保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `cf39700 chore(release): 1.8.5` 里。
- PR [#44](https://github.com/oirge/Mineradio/pull/44) → **合并提交** `eec04ed`（CI `verify` run `33853860300`，3m5s 通过）。绝不 squash，否则打在 `cf39700` 上的 tag 会离开 `main` 的可达历史。
- tag `v1.8.5` 打在 `cf39700` 且是 **annotated**（tag object `726c1e2`），`git describe origin/main` 回 `v1.8.5-1-geec04ed`。
- `Build and Release` run `33854258862` 成功（`--ref v1.8.5 -f tag=v1.8.5`）。**electron-builder 的双草稿第四次复现**：`382584070` 四项资产齐全、`382584071` 只有 `latest.yml` 与安装器两项，同一秒创建；草稿在 `releases/tags/<tag>` 上会 404，只能枚举 `releases?per_page=8` 比资产清单。删掉资产不全的 `382584071` 后发布 `382584070`（**只删 Release、绝不碰 git tag**，删完用 `git ls-remote --tags origin v1.8.5` 复验，tag object 仍是 `726c1e2`），PATCH 时带 `make_latest=true`，`releases/latest` 已指向 `v1.8.5`。
- 四项资产全部回下本机复算核对：

| 资产 | 字节 | SHA256 |
| --- | --- | --- |
| `Mineradio-1.8.5-Setup.exe` | 102298702 | `ba121bc4512593f930ca62c538ab507cfc191e25644023c034f50c1b54026e04` |
| `Mineradio-1.8.5-Setup.exe.blockmap` | 106442 | `5a63b07b658bfcee63a3222ae5da39f4ffa3c77e7f7b9ef7a098bb4336ebdd43` |
| `Mineradio-1.8.5-SHA256SUMS.txt` | 273 | `87bc49834370070d5588f349eb470d56e7af9d1df3ed9546bc93f4500455c7b8` |
| `latest.yml` | 347 | `09714f16d4e9552baf14ec44752498a7354f88a8315fbaa11516233518389545` |

- 清单 `Mineradio-1.8.5-SHA256SUMS.txt` 里三条（安装器 / blockmap / `latest.yml`）与本机复算全中；`latest.yml` 的 `sha512` = `3FEp9sFr73b2Hv7ErGoA/lvJUJfKms8o0hYmBiakTQxlYOattjl6xqOGPeEQzTz/lgXZ+5D1Dn2a/5IRSLa1pw==` 与 `size` = `102298702` 与安装器实测一致，`releaseDate` `2026-09-04T08:41:35.537Z`。
- Release 正文按用户「更新介绍简单明了不要说废话」的要求写短：四条修复 + 一句「三条门槛不变、界面无改动」+ 安装说明，没有展开工程细节（细节在本文件与 `docs/PROJECT_MEMORY.md` 里）。
- 资产记录分支 `docs/release-assets-v185` → PR [#45](https://github.com/oirge/Mineradio/pull/45) → **合并提交** `3d996df`。

## v1.8.4 音乐库维护：拿不准的结论必须单独报，不能塞进名单也不能咽掉
- 正式发布版本从 `1.8.3` 提升为 `1.8.4`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:595`）与发布工作流默认 tag 保持一致。`tests/version-consistency.test.js` 钉前三处，`tests/github-actions-ci.test.js` 钉 `release.yml` 里的 `description` 与 `default` 必须等于 `v` 加 `package.json` 版本，**漏一处就会红**。
- 用户原话：「继续更新发布v1.8.4」加一棵树：`音乐库维护` 下挂 `重复检测` / `失效文件` / `无封面` / `无歌词` / `标签异常`。**五项被当成明确的验收清单**，每项各自配了断言。
- **本轮最重要的一条设计结论：三态判定，拿不准的单独报。** 无封面 / 无歌词 / 标签异常都可能在「还没扫到」的状态下被问，二值判定只有两条路 —— 报成异常（整库刚导入时会把所有歌都报一遍）或算成正常（真缺封面的歌会被永久漏掉），两条都错。所以每条结论是 `has` / `none` / `unknown` 三态，`unknown` 的数量单独摊在卡片副标题上写成「N 首待扫描」，既不许并进缺失数，也不许悄悄咽掉。
- **`localCoverLoaded` / `localLyricLoaded` 为真且没有内容，本身就是「确认没有」的定论，不需要再查格式能不能读。** 因为后台扫描与轻扫描落空时，**只有可截断格式才置 `localCoverLightScanned` / `localLyricLightScanned`，否则直接置 `localCoverLoaded` / `localLyricLoaded`**。原本设计里要用的 `canReadTruncatableEmbeddedCover` / `canReadTruncatableEmbeddedLyrics` 因此整个去掉了，少了两处跨切片依赖。判定顺序里 **`localLyricLoaded` 必须排在「同目录有同名歌词文件」之前**，否则一个空的或解密失败的 `.lrc` 会被永远算成「有歌词」。
- **重复检测归一化不剥 `(Live)` / `(Remix)`。** 剥掉会把现场版和录音室版判成同一首 —— 这类误报比漏报难受得多。归一化只做 `toLowerCase` 加去空白加去成对符号。分组键是 `归一标题 + String.fromCharCode(1) + 归一艺术家`，**用控制字符当分隔符是因为归一后的标题里绝不会剩下控制字符**；源码写成 `String.fromCharCode(1)` 而不是裸控制字符（`public/app.js:7101` 那处既有的裸 `\x01` 是老代码，没有跟着改）。撞键之后 `localLibraryMaintenanceDuplicateLike` 复核：体积相同直接算重复，时长都大于 0 且相差超过 2 秒的摘掉，**时长还没读出来时返回 `true`（不摘）**，免得扫描进度改变结论。标题空到连文件名都兜不出来时分组键为空串，那些歌只进「待扫描」，不然会挤成一大组假重复。
- **失效文件不跟着曲库现算。** 它必须问磁盘，而 `invalidateLocalLibraryCategoryIndex()` 每次歌单查表都会被调用 —— 把探测结果挂在同一份缓存上，那份磁盘结论活不过一次渲染。所以 `localLibraryMaintenanceProbe` 单独存活、**故意不被 `invalidateLocalLibraryMaintenanceIndex()` 清掉**；结果按 `localKey` 记，改过标签的歌 `localKey` 会变、自然匹配不上、自己掉出名单。
- **新增 IPC `mineradio-local-music-probe-entries`，主进程只回状态码。** 之前没有任何按文件问存在性的通道（`refreshLocalMusicFileEntries` 只从快照回灌、根本不 stat 磁盘）。新的 `probeAuthorizedLocalFiles` 套 `trustedMainFrameHandler`，逐条先走 `resolveAuthorizedLocalFile` 再 `fs.promises.stat`，回一个与入参**等长且同序**的 `states` 数组，取值只有 `ok` / `missing` / `blocked`，返回体只有 `states` / `checked` / `ok` / `truncated` 四个键，**任何文件内容都不出主进程**。**`blocked` 必须和 `missing` 分开** —— 授权失败不等于文件被删，混成一个会把一整批误报成丢失。单次上限 `LOCAL_LIBRARY_PROBE_MAX = 2000` 且截断如实回 `truncated: true`，并发宽度 `LOCAL_LIBRARY_PROBE_CONCURRENCY = 8`。渲染层按 `LOCAL_LIBRARY_MAINTENANCE_PROBE_BATCH = 400` 切批，每批回来刷一次面板；**回来的 `states` 长度和这一批对不上就整批作废抛 `PROBE_STATES_MISMATCH`**，绝不按位置错配（错配的表现是把还在的歌报成失效）。
- **资产扫描不改 `localKey`，所以「长度 + 首尾键」的签名认不出内嵌封面 / 歌词刚读完。** 另加一个 `localLibraryMaintenanceEpoch`，在 `syncLocalSongAssetFields`（资产结论的唯一汇流点）顶上用 `typeof` 守卫着加一 —— 守卫是必需的，`tests/local-cover-full-residency.test.js` 与 `tests/local-lyric-cache-residency.test.js` 会把那个真函数切进 vm。
- 桶表查询一律走 `localLibraryMaintenanceBucket()` 的 `hasOwnProperty` 闸门，和 v1.8.3 那个 `constructor.mp3` 的坑同源：`library-fix:constructor` 这种 kind 不能把 `Object.prototype` 上的东西取出来当名单。
- 界面零改动：五项是 `localLibraryCategoryHomeCardsHtml()` 里的第三段卡片，点进去复用整套既有的分类列表渲染器，**`public/index.html` 与 `public/app.css` 一行未动**。失效文件那一项抬头把「播放全部」换成「重新检测」（文件已经不在了，播只会一路报错），卡片上也不给 ▶。
- 测试切片锚点：`tests/library-maintenance.test.js` 切 `function normalizeLocalPlaylistKind(kind)` 到 `function localSongIndexByKey(songs, key)`（模型段）、`function localLibraryCategoryHeadHtml(view, count)` 到 `/* 分组项也走面板的懒加载额度`（渲染段，与模型段拼在同一个 realm 跑，卡片上的数字是真算出来的）、`function renderLocalLibraryPlaylistPanel(opts)` 到 `function toggleLocalLibraryLike(index)`（空态源码断言）、`desktop/main.js` 的 `async function probeAuthorizedLocalFiles(paths)` 到 `async function refreshLocalMusicFileEntries(folderPath, snapshotOrFiles)`（主进程探测），**重命名或拆分这些函数前先 grep 一遍 tests 里的锚点字符串**。
- 顺带改了一处既有测试：`tests/local-library-categories.test.js` 原来钉 `selectLocalPlaylist(libraryKindCard.getAttribute(...))` 一整个表达式，点击钩子为了拿 kind 判断要不要起首次探测拆成了 `var libraryKind = …;` 两行，断言跟着改成钉这两行的组合，语义没变。
- 验证：全量回归 `905/905` 通过（上一版基线 `881`），新增 `tests/library-maintenance.test.js` 24 例。**五张卡片与检测结果在真实窗口里的观感本轮没有肉眼验证过**，结论全部来自 `node:vm` 跑真实源码加源码断言。
- 发布链路：单分支 `feat/library-maintenance`，功能提交 `0600945 feat: 音乐库维护（重复检测 / 失效文件 / 无封面 / 无歌词 / 标签异常）`（只带代码与测试，`APP_VERSION` 仍是旧值，保证单独 checkout 也自洽），版本钉与全部文档压在紧随其后的 `chore(release): 1.8.4`（`3db1947`）→ PR #42 → **合并提交** `00c3c42`（绝不 squash，否则打好的 tag 会离开 `main` 的可达历史）。CI `verify` 5m37s 通过。
- tag `v1.8.4` 打在 `3db1947` 上且是 **annotated**（tag object `f30c41b`），`git describe origin/main` 回 `v1.8.4-1-g00c3c42`，说明它确实在 `main` 的可达历史里。
- `Build and Release` run `33844427366` 成功（`--ref v1.8.4 -f tag=v1.8.4`，约 2 分钟）。**electron-builder 的双草稿第三次复现**：`382519938`（四项资产齐全）与 `382519939`（只有 `latest.yml` 与 `Setup.exe` 两项）同一秒创建，草稿在 `releases/tags/v1.8.4` 上会 404，只能用 `gh api "repos/oirge/Mineradio/releases?per_page=8"` 枚举出来比资产清单。删掉资产不全的 `382519939`（**用 `gh api -X DELETE .../releases/<id>` 只删 Release，绝不碰 git tag**，删完 `git ls-remote --tags origin v1.8.4` 复验 tag 还在），发布 `382519938`。
- 标题与正文照旧手工设：Python 拼 UTF-8 JSON 管进 `gh api -X PATCH .../releases/382519938 --input -`，带 `{name, body, draft:false, prerelease:false, make_latest:"true", tag_name}`；`releases/latest` 复验回 `v1.8.4`。**中文绝不走 argv**。
- 四项资产已全部回下本机复算核对（`Mineradio-1.8.4-Setup.exe` `102297421` 字节 SHA256 `c97e040a0caea82f7cc2e67d2d724f97d492c6f57a8cc3b668a47689b3de0f4a`、`Mineradio-1.8.4-Setup.exe.blockmap` `106477` 字节 SHA256 `2555d1ba5b17c651a7a61bd0f51ad3f8470a5c4b364725212b6600a8c30c71ab`、`latest.yml` `347` 字节 SHA256 `c622e60706e68d0b965c5120c9fc337c9e93ed3f2c4e4f50fc2b966d27aa412d`、`Mineradio-1.8.4-SHA256SUMS.txt` `273` 字节 SHA256 `5aa29dcf9eac62bfd2d112f9d2fe3d9eff1aa2cf7ebf00a1312f4f2b190fa031`）：清单里三条自校验全中，`latest.yml` 的 `sha512` `CNrRZTMi3ECGc0XDJ5bNxVVw3NdnpKoR/ReqvZ5/KSqQcEgSYkBKaMScF3T8/k4DxLqP6AnzHJdZAcqjZQ/2TQ==` 与 `size` 也和安装器实测一致。
- 资产记录分支 `docs/release-assets-v184` → PR [#43](https://github.com/oirge/Mineradio/pull/43) → **合并提交** `7d7b50d`。

## v1.8.3 QRC 加密歌词：非标准 3DES 只能靠已知答案钉住
- 正式发布版本从 `1.8.2` 提升为 `1.8.3`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:595`）与发布工作流默认 tag 保持一致。`tests/version-consistency.test.js` 钉前三处，`tests/github-actions-ci.test.js` 钉 `release.yml` 里的 `description` 与 `default` 必须等于 `v` + `package.json` 版本，**漏一处就会红**。
- 用户原话：「1.8.3 做成：QRC 加密歌词支持 + 歌词格式兼容增强例如QRC 加密 / 歌词优先级 / 同名多歌词选择 / 歌词编码自动识别 / 歌词时间轴异常修复 更新好后发布新版」。五件事都在这一版里，`v1.8.2` 明确留下的「加密 QRC 本轮不解密」与「同名多份歌词按枚举顺序取第一个」两条已知边界正好是前两件。
- **QRC 用的 3DES 不是标准 3DES，这是本轮最重要的一条结论。** QQ 音乐在野那份 DES 移植里至少有五处与规范不同：S 盒里两组笔误（`15,2,8,15` 与 `10,10`）、PC-2 用了 `pos - 27` 的偏移量、密钥按**小端** 32 位字取、跑 15 轮之后再补一个半轮、末轮**不交换**左右半边。任何一处照规范写都会得到完全不同的密文。**所以 `node:crypto` 的 `des-ede3` 不能当参考实现** —— 一开始想用它交叉验证，输出对不上才回头逐位读在野实现。
- **既然没有权威参考，就自己造一个独立的：** 用 `BigInt` 按位重写了一份同语义的 DES（临时脚本，不进版本库），与生产里的 `Int32Array` 位运算版逐轮比对，两份独立写法给出同一个答案才算数。**这比「加密再解密能还原」有意义得多** —— 往返测试对一个写错了的置换表同样成立。
- **测试里钉的是已知答案向量，不是往返。** 六组 KAT（三个密钥 × 加解密，输入固定 `0011223344556677`）加一段全链密文：`plain = '[1000,2000]密(1000,500)文(1500,500)'` ↔ `cipher = 'B5B302E9D93FE91A…'`。密文是用移植版自己的反向链 `E(K1) → D(K2) → E(K3)` 加 `node:zlib` deflate 造出来的，再走生产的 `qrcDecryptedLyricBytes` / `decodeLyricFileBuffer` / `readLocalLyricText` 三条入口解回明文。六组输出还额外断言**互不相同**，防止哪天密钥表被写成同一个值也照样绿。
- **解密链方向：`D(K3) → E(K2) → D(K1)`**，注意中间那一步是加密。密钥 `"!@#)(*$%"` / `"123ZXC!@"` / `"!@#)(NHL"` 是格式公开常量、不是凭据，源码注释里写明了，免得以后被当硬编码密钥清掉（和 `v1.8.2` 的 `KRC_XOR_KEY` 同一处理）。
- **密文识别只看内容，且必须先排除明文。** 两种载体：十六进制文本（大小写、CRLF 都无所谓，空白跳过后**半字节数必须是 16 的整数倍**）与二进制密文（**必须含控制字符且长度对齐 8 字节**）。带 BOM 的直接判成文本 —— 否则一份 UTF-8 BOM 开头的歌词有机会碰巧满足「含控制字符 + 长度对齐」。纯 ASCII 的明文 LRC 天然被十六进制分支挡住（含非十六进制字符），但**它同时也不含控制字符**，两条都不成立才安全。`decodeLyricFileBuffer` 里 KRC 的 `krc1` 魔数判定排在 QRC 之前，因为魔数是强特征、代价也更低。
- **解密或解压失败一律返回空歌词，不抛异常。** 沿用 `v1.8.2` 的取舍：歌词坏了不该把整首歌的播放流程带崩。
- **`.qrc` 的 MIME 必须改成 `application/octet-stream`（`server.js` 与 `desktop/main.js` 两处）。** `v1.8.2` 给的是 `application/xml; charset=utf-8` —— 那时 `.qrc` 只可能是明文，现在它可能是二进制密文，挂着 charset 走一遍文本解码就废了。改之前先 grep 过 tests，没有测试钉住旧值。
- **歌词格式优先级动的是既有行为，所以规则要能复现。** `LOCAL_LYRIC_FORMAT_RANK` 把逐字（`qrc`/`krc`/`ttml`/`yrc`）排 0、`lrc` 排 1、字幕（`ass`/`srt`/`vtt`）排 2、`txt` 排 3、认不出的后缀排 4，同级用既有的 `compareLocalFilePath` 破平。**「精确路径 → 同目录同名 → 模糊名」三级匹配层次没有变**，优先级只在同一层内比 —— 否则一个隔了三层目录的 `.qrc` 会抢掉同目录的 `.lrc`，那是另一种意义上的错。
- **候选桶查表必须验自有属性，这是本轮唯一一个自己撞出来的真缺陷。** 桶的键直接来自用户磁盘上的文件名，所以 `maps.byPath['constructor']` 会取出 `Object` 构造函数本身；它有 `.length === 1`，于是被当成「长度 1 的候选数组」，`bucket[0]` 是 `undefined`，一个空候选就这么混进去了 —— 表现是 `findLocalLyricFile` 返回 `undefined` 而不是 `null`。写入侧原先已经挡过 `__proto__`，读取侧漏了。现在统一走 `localLyricCandidateBucket()`，`hasOwnProperty` 一道闸。**能被这条路径撞到的键只有小写形式**（`constructor` / `toString` / `valueOf` / `__proto__`），因为键都过了 `toLowerCase`。
- **`localLyricPickForSong` 里的 `picks[key]` 没有跟着改，是查过之后的决定。** 那里的键一律由 `songCustomCoverKey` 生成、必带 `local:` / `local-id:` / `meta:` 前缀，原型键构造不出来；跟着改等于给不存在的问题加代码，也会和旁边 `getCustomLyricEntry` 的既有写法不一致。
- **编码识别的关键取舍：合法 UTF-8 绝不重猜。** `isStrictUtf8Bytes` 逐字节验编码长度、连续字节、overlong、代理区与超出 U+10FFFF，通过就直接返回 —— 现有 UTF-8 歌词必须一个字节都不变。**它对「结尾截断在多字节字符中间」返回 `true`**（`i + need >= len` 就放过），这是有意的：歌词会走范围读取，尾巴被切断不代表编码不是 UTF-8。副作用是流中间的单个坏字节仍会让它判否、进候选打分环节 —— 那正是想要的。BOM-less UTF-16 靠零字节分布嗅（`oddZero > evenZero * 8 && oddZero * 10 >= pairs * 3`，反向同理），少于 8 字节不猜。候选打分数的是 U+FFFD 加 C1 控制符（`0x80`–`0x9f`）与私用区（`0xe000`–`0xf8ff`），因为 GBK 文本按 `windows-1252` 解出来不会产生替换字符、只会产生一片 C1 —— **光数 U+FFFD 是选不出正确编码的**。
- **时间轴那五处修的都是「在野写法」而不是规范写法。** 原来的正则是 `\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]`，问题有三个：分钟只到两位（一小时以上的长音频整行丢掉）、小数位只到三位、`[mm:ss:cc]` 这种拿冒号当小数点的老写法完全不认。新正则 `\[(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,6}))?\]` 配 `lyricLineTagToSeconds` 的三段判断：**三段全是冒号时按 `mm:ss:cc` 算，小时字段只出现在带小数点的四段形式里** —— `[01:02:03.400]` 是 `hh:mm:ss.fff`，`[01:02:50]` 是 `mm:ss:cc`。小数位改成**按实际位数缩放**（`digits / 10^len`，超过 6 位截断），否则 `[00:01.1234]` 会被当成 `1.234` 秒。
- **`[offset:±N]` 的符号方向是规范定的、和直觉相反：正值表示歌词提前出现**，所以换算成负的秒数增量。偏移过头的行 `shiftLyricTagTime` 夹到 0 而不是留负数 —— 负时间会把 `lines.sort((a,b) => a.t - b.t)` 之后的高亮定位带乱。Enhanced LRC 的逐字标记也要跟着偏移，所以 `parseEnhancedLrcBody` 多收了一个 `offsetSeconds` 参数。
- **同名多歌词的手动选择：`syncLocalSongAssetFields` 不传播 `localLyricFile`，所以另写了 `propagateLocalLyricPick`。** 前者被 `tests/local-lyric-cache-residency.test.js` 钉着字段清单，往里加字段等于改那条驻留契约；单独写一个只跨 `localLibrarySongs` / `playQueue` / `playlist` 按 `localKey` 复制歌词文件与候选清单，风险局限在本功能内。切换时要清的状态有六项（`localLyricText` / `localLyricTagName` / `localLyricLoaded` / `localLyricLightScanned` / `localLyricCacheHydrated` / `localLyricResidencyReleased`），其中 **`localLyricCacheHydrated` 要置 `true`**（不是 `false`）—— 置 `false` 会让下一次 `ensureLocalLyricsForSong` 先回头读一遍磁盘缓存，把刚被用户换掉的那份又灌回来。
- **界面沿用「能不动 UI 就不动 UI」：** `public/index.html` 只在已有的自定义歌词弹窗里多一个 `<div id="local-lyric-pick-row" class="btn-row" style="display:none">`，复用现成的 `btn-row` / `modal-btn` 样式类，候选按钮运行时生成，**`public/app.css` 一行未动**。候选少于两个时整行隐藏并 `textContent = ''` 清空。
- 已知边界：**手上没有一个真实的加密 QRC 文件。** 结论全部来自源码逐条断言加两份独立实现互证；真实文件在窗口里的逐字高亮、桌面歌词窗口与双行布局下的表现本轮没有肉眼验证过。真实的 GBK 歌词、UTF-16 歌词同理。
- 验证：全量 Node 回归 `881/881` 通过（`main` 基线 `871`），新增 `tests/lyric-format-hardening.test.js` 10 例，全部用 `node:vm` 跑生产源码切片。`node --check` 过了 `public/app.js`、`desktop/main.js`、`server.js`，两个 JSON 可解析。
- **测试写法上踩的坑（会再遇到，记一下）：`vm.runInNewContext` 建的是新 realm，往沙箱里注入 `Object` / `Array` 只是遮住全局绑定 —— vm 里用字面量造出来的对象和数组仍然继承 vm realm 的原型。** 所以 `assert/strict` 的 `deepEqual`（等于 `deepStrictEqual`）对着 vm 产物一定失败。解法是先 `{ ...obj }` / `Array.from(arr)` 搬进宿主 realm，或者从 vm 里把 realm 内建原型显式导出来（`this.objectPrototype = Object.getPrototypeOf({})`）再断言。这一轮在格式优先级表和候选清单两处各撞了一次。
- **另一个坑：Edit 工具的匹配会把反斜杠 u 转义和真实字符看成同一个东西**，所以「把注释里误写的转义序列改回中文」这类修复用它做不了（会报 old/new 完全相同），得用 Python 直接改文件。往源码里写不可见字符（U+FEFF）同理，用 `String.fromCharCode(0xfeff)` 而不是字面量。**在这台机器上，走 bash heredoc 的文本里连续两个反斜杠会被折叠成一个**，所以带反斜杠的正则文本要么单写、要么绕开 Python 源码（本轮的文档片段都是先 `cat` 成文件、再用只含 ASCII 的 Python 拼接）。
- 发布链路：一个分支 `feat/qrc-lyrics-and-format-hardening` 带两个提交 —— `12a6dec feat: QRC 加密歌词与歌词格式兼容增强`（只带代码与测试，`APP_VERSION` 仍留在 `1.8.2`，因为版本闸只校验传入 tag 与 `package.json` 是否一致，功能提交本身不必先动版本）、`bb55abd chore(release): 1.8.3`（10 个文件 `+103/-11`，五处版本钉一起动）。PR #39 的 CI `verify` 通过（2m9s），走**合并提交** `02ad7a6e5ba31b95004983fa564d9d9ec3f59fa2` 并入 `main`，`git merge-base --is-ancestor bb55abd origin/main` 为真。
- **tag `v1.8.3` 打在 `bb55abd81af73d585583a668fead95d165837158`，是 annotated tag（tag object `3f5df0bb46e9976fdca02499c240d7bba76f9a6e`，`git cat-file -t v1.8.3` 回 `tag`）。** 打完 `git describe origin/main` = `v1.8.3-1-g02ad7a6`，多出来的那一个提交就是合并提交本身。
- **`Build and Release` 只对着刚打出来的 `v1.8.3` 派发**（`--ref v1.8.3 -f tag=v1.8.3`），run `33835548298` 成功。
- **electron-builder 的双草稿又原样来了一次**（`v1.8.2` 已经记过，这轮完全复现）：同一秒 `2026-09-04T04:04:57Z` 建出两个草稿 —— `382473294` 四个资产齐全，`382473295` 只有一份逐字节相同的 `.blockmap` 副本，两个的 `body` 都是 `null`。`gh api repos/oirge/Mineradio/releases/tags/v1.8.3` 对草稿一律返回 404，**只有 `releases?per_page=8` 枚举才看得见它们**。确认 `382473295` 没有任何独占内容后只删这一个 Release，git tag ref 复查仍是 `3f5df0b`，**tag 一个字节都没碰**。
- 发布动作照旧手工：把 `{name, body, draft:false, make_latest:"true", tag_name}` 在 Python 里拼成 JSON 管给 `gh api -X PATCH repos/oirge/Mineradio/releases/382473294 --input -`，**中文不经 argv**。标题 `Mineradio v1.8.3 QRC 加密歌词能读了，同名多份歌词自己挑`，正文沿用 `v1.8.2` 的三段式（`## 下载` / `## 变更` / `## 歌词怎么放`）。发布后 `releases/latest` 回 `v1.8.3`、`draft=false`。
- 这一轮**四个资产同样全部回下本机复算过**：四个 SHA256 与 Release API 的 `digest` 逐一相同，`Mineradio-1.8.3-SHA256SUMS.txt` 自校验三行全 `OK`，`latest.yml` 里的 `sha512` 与本机对 exe 复算的一致，合起来 `ALL OK`。
  - `Mineradio-1.8.3-Setup.exe` `102292559` 字节 `89f13540d9513786b78cccb27834e481935ace7df3848517c61be5f67bf4d81c`
  - `Mineradio-1.8.3-Setup.exe.blockmap` `106465` 字节 `b5eb09dde6303389b9b5db31f38ead74c54de817b3784ec94f69d6b082108688`
  - `latest.yml` `347` 字节 `0407cefff30159b63abe32479706a96a2c794e4dffb56aeea256aa0d8e41bc88`
  - `Mineradio-1.8.3-SHA256SUMS.txt` `273` 字节 `54636485ac71cbd23c63fdec0407b286c27bada546bb3a08ac59b72c7242f17f`
  - `latest.yml` 里的 exe `sha512` = `+Y1GEec2Y9I8kv6hZV3rHkT4eAKyWSsqrTGOwZXJbjoWxWpSlFQJ3PBfuAawVVst89Hu3AZog5k0DcaGi5+glA==`，`releaseDate` `2026-09-04T04:14:49.248Z`。
- 遗留未修（自 `v1.7.26` 记到现在，本轮仍未动）：`release.yml` 的 `Generate SHA256 checksums` 用 pwsh 写清单，行尾仍是 **CRLF**，所以在 Linux / Git Bash 下校验必须先 `tr -d '\r'`。
- **本轮新教训：`json.load(sys.stdin)` 在这台 Windows 上按本地代码页解码，不是 UTF-8。** `gh pr view --json title` 的中文因此显示成乱码，一度让人误判「PR 标题写坏了」；换成 `subprocess.run(...).stdout.decode('utf-8')` 复核后标题一直是对的。核对任何中文字段都别经 `sys.stdin`，`v1.8.2` 那次 PR #38 的「乱码」也是同一个假警报。

## v1.8.2 多格式歌词 KRC / QRC / TTML：分流顺序就是语义
- 正式发布版本从 `1.8.1` 提升为 `1.8.2`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:591`）与发布工作流默认 tag 保持一致。`tests/version-consistency.test.js` 钉前三处，`tests/github-actions-ci.test.js` 钉 `release.yml` 里的 `description` 与 `default` 必须等于 `v` + `package.json` 版本，**漏一处就会红**。
- 用户原话：「在最新版的基础上继续更新目前歌词： 有显示即可 升级： 多格式歌词 支持： LRC KRC QRC TTML等」。
- **「有显示即可」被当成明确的范围界定，不是随口一句。** 三种新格式解析进播放器原有的 `{t, duration, text, words, charCount, source}` 歌词行就算完成，不为它们做任何新界面 —— 逐字高亮、桌面歌词窗口、双行歌词、翻译自动识别全部沿用现成实现。合本仓「能不动 UI 就不动 UI」。LRC 早已支持，本轮真正新增的是 KRC / QRC / TTML。
- **`parseTimedLyricText` 的分流顺序本身就是语义，不是随手排的：** TTML 标签 → QRC XML 容器 → LRC → **KRC → QRC** → YRC → WebVTT → ASS → SRT。前两步认标记语言，所以 TTML 正文里的方括号不会被 LRC 的时间轴正则抢走。
- **最关键的一条：KRC 与 QRC 的嗅探绝对不能排在 `parseYrcText` 之后。** 三种逐字格式的行头长得一模一样（`[起点,时长]`），唯一的区别是词项分隔符 —— KRC 是 `<偏移,时长,0>正文`、QRC 是 `正文(起点,时长)`、YRC 是 `(起点,时长,0)正文`。而 `parseYrcText` 认到行头就收，**找不到自己那种词项也照样吐一个 `yrc-line` 整行**，只把 `(\d+,\d+,\d+)` 剥掉。所以排在它后面的表现不是报错，而是「歌词显示出来了、但没有逐字，正文里还夹着 `<0,400,0>` 这种标记」—— 一个只能靠肉眼发现的静默降级。第一版就是把两个嗅探写在 YRC 之后，靠去读 `parseYrcText` 的回退分支才发现；测试里已经钉了一条专门的顺序断言（`'KRC 必须排在 YRC 之前，否则会被当成无逐字的整行'`）。
- **教训一般化：往「多个解析器按顺序试、谁返回非空算谁的」这种分流里加新成员时，先去读排在前面那些解析器的兜底分支，而不是只读它们的正例。** 排前面的有多宽容，决定了排后面的还有没有机会被叫到。
- **分流认格式自身特征，不认后缀名。** 用户手里的歌词文件后缀经常和内容不符（下载工具乱改、手动改名）。TTML 认 `<tt[\s>]…<p[\s>]`、QRC 容器认 `LyricContent=` 属性、KRC 加密二进制认 `krc1` 魔数。附带好处是改过后缀的加密 KRC 也读得出来，而且四处后缀清单只管「这个文件要不要当歌词看」，不参与选解析器。
- **KRC 明文与 `krc1` 加密二进制走同一条入口。** 头 4 字节是 `krc1`，其后整段按格式公开的 16 字节常量循环异或（源码注释里写明了**这是公开的格式常量、不是凭据**，免得以后被当硬编码密钥清掉），还原出来是 deflate 流：`0x78` 开头先试 `'deflate'`、否则先试 `'deflate-raw'`，两种都试一遍。解压用 `DecompressionStream` + `Response` —— 这两个在 Chromium 和 Node 18+ 都是全局对象，所以**没有引入任何新依赖**，同一份代码在渲染层跑、在 `node:vm` 测试里也跑。**解压失败返回空字符串而不是抛异常**：歌词坏了不该把整首歌的播放流程带崩。
- **KRC 的词项时间是相对行首的偏移，读进来必须加上行起点换成绝对时间**（YRC / QRC 写的是绝对毫秒）。这是三种格式里唯一一处语义差异，看错就是逐字高亮整行往左漂。
- **QRC 两种载体都收：** `<Lyric_1 LyricType="1" LyricContent="…"/>` 的 XML 容器（属性值里的 `&#10;`、`&amp;` 这类实体要展开）和把正文直接落成文本的裸 body。少数导出工具漏写最后一个词项的时间标记，正文剩一截在标记之外 —— 补成「从上一个词项结束到行尾」，**「宁可时间粗一点也不丢字」是本轮明确定下的取舍**，静默丢字比时间不准严重得多。
- **`reg.lastIndex` 必须在 `while ((m = reg.exec(s)))` 的循环体里就地取，不能等循环结束后再读。** `exec` 返回 `null` 的那一次会把 `lastIndex` 归零，循环外读到的永远是 `0` —— 上一条那个补尾逻辑第一版没生效就是这个原因，也是本轮唯一一个纯 JS 语义坑。
- **TTML 的词项 span 用负向前查只匹配最内层**（`<span\b([^>]*)>((?:(?!<span\b)[\s\S])*?)<\/span\s*>`），否则外层那个包整行的 span 会把正文再吃一遍、行文本直接翻倍（测试里有一例嵌套 span 钉着）。`ttm:role="x-translation"` / `x-roman"` 的译文与罗马音不进正文，**剔的时候要连它在 `plainBody` 里的那一段一起去掉**，否则整行回退路径又把译文捡回来。时间既认 `hh:mm:ss.fff` / `mm:ss.fff` 时钟，也认 `12.5s` / `500ms` / `1.5m` / `1h` 偏移量；帧和 tick 没有帧率信息，按无效处理。只写了 `begin` 的词项按下一个词项的开始收尾，最后一个退到整行的 `end`。
- **整段 TTML 用扫描而不是 `DOMParser`**，因为解析逻辑要能在没有 DOM 的 `node:vm` 切片里跑 —— 本仓的测试全靠切生产源码进 vm，用 DOM API 等于这段代码没法单测。
- **`finalizeLyricLineDurations` 的第二个参数决定「格式明确写出来的时长」保不保得住。** 传 `true` 才跳过 `[0.45, 12]` 那道 LRC 时代的钳制。KRC / QRC 的行头时长是格式写死的，和字幕 cue 同等对待，所以两个都传 `true`；LRC / YRC 的时长是从下一行推断出来的，继续走钳制。测试里用一条 20 秒的行钉死这件事。
- **读文件从「顺手返回字符串」拆成「先拿字节、再决定怎么解码」，这是能加二进制格式的前提。** 原来的 `readLocalTextFile` 三条读取通道（`file.arrayBuffer` / 桌面 `readLocalFileRange` / `FileReader`）都直接吐文本；抽出 `readLocalTextFileBytes` 之后，歌词走 `readLocalLyricText`（字节 → 认魔数 → 必要时解密 → 解码），其它调用方行为一字不变，既有内存测试断言的零拷贝性质也保住（字节视图直通 `decodeLocalTextBuffer`）。
- **这一改会挪动「按锚点切源码」的既有测试的边界，两处都是改完跑测试才红出来的：** `tests/local-file-range-memory.test.js` 的切片起点要跟着改成 `'async function readLocalTextFileBytes('`（旧边界会把新函数留在切片外、`ReferenceError`），`tests/local-lyric-cache-residency.test.js` 里的桩函数名要从 `readLocalTextFile` 改成 `readLocalLyricText`。**凡是重命名或拆分被 vm 切片覆盖的函数，先 grep 一遍 tests 里的锚点字符串。**
- **`.krc` / `.qrc` / `.ttml` 必须同时进四处清单，少一处是「某条路径下歌词读不到」而不是报错：** `public/app.js` 的 `LOCAL_LYRIC_FILE_RE`、`desktop/main.js` 的 `LOCAL_LIBRARY_EXTS` + `LOCAL_LIBRARY_MIME`、`server.js` 的 `LOCAL_FILE_MIME`、`public/index.html` 的两个导入 `accept`（单文件与文件夹各一个）。新测试直接遍历后缀数组去断言这四处，以后加第十种格式漏一处就会红。**`.krc` 的 MIME 必须是 `application/octet-stream` 且不挂 charset** —— 加密二进制被当文本走一遍解码就废了。
- 界面一行未动：`public/index.html` 只有两个 `accept` 属性各多三个后缀（`:888` / `:889`），**`public/app.css` 没有改动**。
- 已知边界：**加密的 QRC 网络负载（三重 DES + zlib）本轮不解密** —— 落到磁盘的 `.qrc` 通常已经是明文 XML 或裸 body，这两种都能直接读；同名多份歌词文件（`歌.lrc` 与 `歌.qrc` 并存）仍按文件枚举顺序取第一个，**没有引入按后缀排优先级的规则**，那会改掉现有 `.lrc` / `.txt` 的既有行为、超出本轮范围。
- 验证：全量 Node 回归 `871/871` 通过（`main` 基线 `864`），新增 `tests/multi-format-lyrics.test.js` 7 例，全部用 `node:vm` 跑生产源码切片；其中 KRC 加密二进制那一例用 `node:zlib` 反向打包出真实的 `krc1` 文件（zlib 头与 raw deflate 两种）再走生产解码链往返，并单独钉了「损坏数据返回空串不抛异常」。`node --check` 过了 `public/app.js`、`desktop/main.js`、`server.js`，两个 JSON 可解析。
- **仍未肉眼验证的是新格式自己那条链：** 三种真实歌词文件在窗口里的逐字高亮、桌面歌词窗口与双行布局下的表现，以及真实加密 KRC 文件的读取，本轮都没有在本机 Electron 里看过；结论全部来自源码逐条断言。
- 发布链路：一个分支 `feat/multi-format-lyrics` 带三个提交 —— `78eb3c6 docs(release): 勘误 v1.7.27 资产被重新构建覆盖`（与本轮功能无关的独立勘误，见本节最后一条）、`4876f55 feat: 歌词支持 KRC / QRC / TTML，逐字时间轴进原有歌词行结构`（只带代码与测试，`APP_VERSION` 仍是 `1.8.1`，所以这个提交自身版本一致、单独 checkout 也不会红）、`59cf556 chore(release): 1.8.2`（五处版本钉点 + 全部文档一次性改完）。**这个「功能提交只带代码、版本与文档全压在 `chore(release)` 里」的切法是照 `v1.8.1` 的 `94c22c6` / `d61dfc6` 逐个 `git show --stat` 数出来的**，第一次把文档误并进功能提交，重切了一次。PR #37 以**合并提交** `b044893` 合入 `main`（不能 squash，否则 tag 脱离 `main` 祖先链）。PR 上 `verify` 通过（run `33767748657`，1m25s）。
- **tag `v1.8.2` 打在 `59cf556`，是 annotated tag（tag object `5321ce4a`，`git cat-file -t v1.8.2` 回 `tag`）。** 这轮一次就打对了 —— `v1.8.1` 那次先打成 lightweight 被 `git describe` 跳过，教训直接照用 `git tag -a`；打完 `git describe origin/main` 回 `v1.8.2-1-gb044893`，是仓库惯例的形状。派发前先确认 `59cf556` 已是 `origin/main` 的祖先。
- **`Build and Release` 只对着刚打出来的 `v1.8.2` 派发**（`--ref v1.8.2 -f tag=v1.8.2`），run `33768025814` 成功（2m50s，`2026-09-03T14:38:17Z` → `14:41:07Z`，`headBranch` 是 tag `v1.8.2`）。Release 非草稿非预发布、`target_commitish` 为 `main`，`repos/oirge/Mineradio/releases/latest` 回 `v1.8.2`（`gh release view --json isLatest` 本机 `gh` 没这个字段，会报 `Unknown JSON field`，用 `gh api …/releases/latest --jq .tag_name` 代替）；四项 Windows x64 资产远端 `state=uploaded`：`Mineradio-1.8.2-Setup.exe` `102282675` 字节 / SHA256 `28cb1ed7268b16f7af953668da7bd19a20efd761c194c6f1ddfe1ef0ede32707`；`.blockmap` `106455` 字节 / `28a9f75976316ef920d3109045b5c2e1321eddf85d995541283439a0a2a084eb`；`latest.yml` `347` 字节 / `8d1a43bff01dfb9024394fffc66c22d9e9284831a1158d7a6d7bf00a821dc513`（`version: 1.8.2`，`releaseDate: '2026-09-03T14:40:53.233Z'`）；`Mineradio-1.8.2-SHA256SUMS.txt` `273` 字节 / `e555d53f44b0ec88efc3d7ecc00878a3f7dd22d4ee11cf3dc120e767ab42d3bd`。不生成 Portable ZIP。
- 这一轮**四个资产全部回下本机复算过**：四个 SHA256 与 Release API 的 `digest` 逐一相同，`tr -d '\r' < Mineradio-1.8.2-SHA256SUMS.txt | sha256sum -c -` 三行全 `OK`，`latest.yml` 里的 `sha512`（`N81WW4WAGp/1lI4QC2RmaAqQdwsO5QKylReK+rPpt5O5tWClGcVd7xhGAJrfCsJVWsHpaMaUKSDY8CN2SlpkWw==`）与 `size`（`102282675`）对着下回来的安装包逐字节对上。**102 MB 的安装包一次 `curl` 拉到 83 MB 超时**，改成先单独拉三个小资产、再用 `curl -sSL -C - --retry 5` 断点续传补完 exe。
- **新教训：`release.yml` 从来不创建 Release，只 `gh release upload --clobber`；Release 是 `npm run build:win` 那步带了 `GH_TOKEN` 之后 electron-builder 的自动发布器建的草稿 —— 而它按资产并发上传时会抢出两个草稿。** 本轮 `v1.8.2` 就同时躺了 `382099367`（四个资产齐全、正确）与 `382099368`（只有一个字节相同的重复 `.blockmap`，`body` 为 `null`），两个都是 `draft:true`、同一秒创建、同名 `1.8.2`、同 tag。草稿不对外可见，但**同一个 tag 上多出一个草稿会让下一次 `gh release upload` 认错目标**，所以发布前必须先枚举一遍：`gh api "repos/oirge/Mineradio/releases?per_page=8" --jq '.[]|select(.tag_name=="vX.Y.Z")|{id,draft,assets:(.assets|length)}'`。**草稿不能用 `gh api …/releases/tags/vX.Y.Z` 查**，那条路径不返回草稿、只会给 404。确认多出来那个没有独有内容（`body` 为 `null`、资产 digest 与正式那个重复）之后删掉它；删 Release 不会动 git tag，删完 `git/ref/tags/v1.8.2` 仍在。
- 发布动作本身也是手工的：`gh api -X PATCH repos/oirge/Mineradio/releases/382099367 -f name=… -F draft=false -F make_latest=true -f body="$(cat 说明文件)"`。标题与正文按 `v1.8.1` 的三段式写（`## 下载` 点名四个资产、`## 变更` 对齐 CHANGELOG、`## 歌词怎么放` 列全九个后缀），正文先落到一个不进版本库的临时文件里再喂进去，发完删掉。
- 遗留未修（自 `v1.7.26` 记到现在）：`release.yml` 的 `Generate SHA256 checksums` 用 pwsh `Out-File -Encoding utf8` 写清单，行尾仍是 **CRLF**，所以在 Linux/Git Bash 下校验必须先 `tr -d '\r'`，直接 `sha256sum -c` 会报格式错。改法是 `[IO.File]::WriteAllText($path, ($lines -join "`n") + "`n")`。
- **本轮另有一条独立勘误已先行提交（`78eb3c6`）：** 对着旧 tag `v1.7.27` 重新派发过一次 `Build and Release`，`release.yml` checkout 的是传入 tag 而不是 `main`，版本闸因此放行、四个资产被重新构建并 `--clobber` 覆盖。**`Build and Release` 只许对着刚打出来的新 tag 派发**，详见 v1.7.27 小节的勘误段。

## v1.8.1 整机备份 mineradio.backup：身份存 {folder, rel}，换机重算
- 正式发布版本从 `1.7.29` 提升为 `1.8.1`（**中间的 `1.7.30` 与 `1.8.0` 都没有发布过安装包**：`1.7.30` 是本轮功能开发期间的内部续版号，用户在发布时点名要 `1.8.1`，于是五处钉点一次性改到 `1.8.1`，两个空号不打 tag、不建 Release）；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:591`）与发布工作流默认 tag 保持一致。`tests/version-consistency.test.js` 钉前三处，`tests/github-actions-ci.test.js` 钉 `release.yml` 里的 `description` 与 `default` 必须等于 `v` + `package.json` 版本，**漏一处就会红**。
- 用户原话：「再最新版的基础上继续更新增加：导出：`mineradio.backup` 包含：`{ version:2, database: { songs, playlists, favorites, history }, config: { theme, eq, player }, paths: { musicFolders } }` 默认不备份：❌ 音频 ❌ 大封面缓存 ❌ 临时文件 然后：新电脑导入。」
- **需求给的四段结构一字未改照搬成落盘格式**（`version` / `database` / `config` / `paths`），只多一段 `meta`（`app` / `appVersion` / `exportedAt` / `counts`）用来在导入前肉眼确认这文件是哪台机器哪一版导的。`tests/mineradio-backup-export-import.test.js` 用 `assert.deepEqual(Object.keys(payload), …)` 钉死顶层与每段的键序，往里加字段会红。
- **「新电脑导入」这一句才是整个设计的约束源头：备份里一处绝对路径都不能有。** 本机歌曲身份 `localKey` = `绝对路径:size:mtime`，歌单 / 收藏的引用键是 `local-key:` + 它，SQLite 的 `song_key` 也是它 —— 直接存下来，换机后盘符一变全体扑空（文件明明在，只是路径不同）。所以每首歌、每条歌单引用、每条历史记录都改存 `{folder, rel, size, mtime}`（`folder` 是音乐文件夹下标，`rel` 是相对路径），导入时按新根重新拼绝对路径、重算 `localKey` / `pathKey` / 引用键 / `song_key`。
- **`rel` 必须保留原始大小写，所以不能直接用 `normalizeLocalLibraryPathKey` 的结果切。** 那个函数会 `toLowerCase()`，拿它切出来的 `rel` 拼回去会得到全小写路径 —— Windows 上还能打开，但 `localKey` 逐字符对不上原值，同机导入就复不出原来的身份。`mineradioBackupRelPath` 的写法是「用归一化后的串算长度、从原始串尾部切」，两边长度天然相同（归一化只做分隔符替换 + 小写，不改长度）。
- **拼回去要用目标机器的原生分隔符，不能一律用 `/`。** `mineradioBackupPathSeparator` 看根路径：含 `\` 或形如 `X:` / `X:\` / `X:/` 的判为 Windows 用 `\`，其余用 `/`。`localKey` 是逐字符比较的，分隔符错一个就等于换了一首歌。
- **判断「备份里的音乐文件夹在不在这台机器上」踩了一次死路：不能用 `readLocalFileRange` 去探文件。** `desktop/main.js` 的 `resolveAuthorizedLocalFile` 要求目标路径已经在**之前某次扫描登记过的授权根**之下，全新会话里授权表是空的，探任何备份里的路径都必然 `LOCAL_FILE_NOT_AUTHORIZED` —— 用它做存在性判断会把「同机导入」也误判成「换机导入」，每次都弹选择框。改用 `api.refreshLocalMusicFiles(folder, [])`：主进程侧 `refreshLocalMusicFileEntries` 先 `rememberLocalMusicRoot`（不是目录就抛），再只重建传进去的那批记录 —— 传空数组等于「只验目录、不走盘」，顺带把根登记进授权表，代价接近零。
- **换机分支的三态要分清：** 探到了 → 用探回来的 `folderPath`（主进程归一化过的写法）；探不到但用户选了新目录 → 用新目录；探不到且用户取消 → **返回 `null`，整个导入放弃、一个字节都不写**（返回 `[]` 会被当成「没有音乐文件夹」继续往下覆盖歌单，这是本轮最容易写错的一处）。
- **播放次数与收藏不需要给 SQLite 加新方法。** `bumpPlayStat` 是累加语义（`play_count = play_count + excluded.play_count`、`last_played_at = MAX(...)`），新机器上是空表所以累加等于赋值；`setFavorite` 只动 `favorite` / `favorite_at`、保留播放列。两个方法都不依赖 `files` 表，所以曲库还没扫描就能先把统计灌进去。**代价是同机重复导入会把次数翻倍** —— 这正是导入要两步确认的原因，写在代码注释里。
- **`lastPlayedAt` 传 `0` 会被主进程当成「现在」**（`toInt(input.lastPlayedAt) || Date.now()`），那样「有播放次数但没有最近播放时间」的歌会集体假装刚刚听过、污染最近播放列表。统一垫 `1`（1970 年那一毫秒）：次数保住，排序上仍然排在所有真实记录之后。
- **导入策略是「写全部存储 → 抹掉换机后无效的临时文件 → 重启」，不做热重载。** 歌单、收藏、入库时间、听歌统计、主题、音效、播放器设置分散在 localStorage / `desktop-ui-state.json` / IndexedDB 用户态 / SQLite 四层，逐个子系统热重新应用等于把启动流程重写一遍。直接重启（`api.restartApp()`，浏览器下 `location.reload()`）让曲库重扫与引用解析走原本的启动路径。
- **抹掉的临时文件是：** `mineradio-local-library-snapshot-v1`、`mineradio-local-library-index-v1`（走 `localStorage.removeItem`，它们本来就不在持久镜像白名单里）、`mineradio-queue-snapshots-v1`、`mineradio-playback-session-v1`、`mineradio-song-resume-v1`（走 `removePersistentLocalStorageItem`，要连 `desktop-ui-state.json` 里的镜像一起清，否则重启后旧值会被镜像顶回来）。
- **`config.player` 是白名单，不是「把 localStorage 全存下来」。** 导出时按 `MINERADIO_BACKUP_PLAYER_KEYS`（16 个键，与 `app.js` 里的常量逐一对齐，有测试钉住）逐个读；导入时也只认这 16 个键 —— 否则一个手改过的备份文件就能往 localStorage 里塞任意键值。`null` 值跳过，不写成字符串 `"null"`。测试里专门用手写 JSON 塞了一个 `"__proto__"` 键（`JSON.parse` 会把它变成真正的自有属性），确认白名单挡得住。
- **音效档案的真身在 IndexedDB 用户态（`user-fx-archives`），localStorage 里那份是旧版遗留。** 导出优先读用户态、读不到才回落 `readUserFxArchives()`；导入写用户态并删掉 localStorage 旧键，否则启动时旧档案会把刚导入的顶回去。听歌统计同理（`listen-stats` 用户态 + `mineradio-listen-stats-v1` 旧镜像）。
- **历史记录里的 `cover` 一律清成 `''`。** 那是 base64 dataURL，一条几十 KB，几百条就把「几 MB 的备份」吹成几十 MB —— 属于用户点名不要的「大封面缓存」。历史条数上限 `MINERADIO_BACKUP_HISTORY_LIMIT = 180`，取的就是本机听歌记录自己的上限（`normalizeListenStatsState` 里 `compactListenStatsHistory(null, data.history, 180)`）—— 备份存得比本机能留的更多没有意义。
- **两步确认没有做弹窗，遵「能不动 UI 就不动 UI」。** 第一次点「导入」只 `showToast` 一句并记下时间戳，`12s` 内再点才真的走；在途时用 `mineradioBackupImportPending` 挡住重复点击，并留 `120s` 过期逃生门 —— 浏览器的文件选择框在用户直接关掉窗口时不会回调，没有这道逃生门按钮会永久卡死。
- 主进程两个新 handler（`mineradio-export-backup-file` / `mineradio-import-backup-file`）都套 `trustedMainFrameHandler`，**并且特意插在 `mineradio-export-json-file` 之前**：`tests/import-json-file-size-limit.test.js` 是按 `ipcMain.handle('mineradio-import-json-file'` → `ipcMain.on('mineradio-ui-state-read-sync'` 这对锚点切源码的，插进那段里会污染它的切片。导入侧先 `statSync` 卡 `64 MiB` 再读，保存对话框的 filters 是 `['backup']` + 所有文件。
- 界面只在 `public/index.html` 的 `fx-plugin-fold` 与 `fx-advanced` 之间加一个同构折叠区 `fx-backup-fold`（两行 `lyric-color-row` + 两行 `mini-player-collapse-hint`，全部复用既有类名），**`public/app.css` 一行未动** —— 查过 `.fx-fold` 那一族规则全是通用选择器，没有按 id 或 `nth-child` 写死的地方。
- 验证：全量 Node 回归 `864/864` 通过（`main` 基线 `846`），新增 `tests/mineradio-backup-export-import.test.js` 18 例；`node --check` 过了 `public/app.js`、`desktop/main.js`、`desktop/preload.js`、`server.js`，`git diff --check` 干净。
- 本机启动过一次 Electron 冒烟（发布前补的，`npm start` 起本地壳、只杀自己那个 PID，不用 `taskkill /IM electron.exe`，否则会连带杀掉用户其它 Electron 应用）：干净开到首页，`script-start 1896ms` → `dom-content-loaded 3989ms` → `splash-ready 9334ms` → `splash-dismiss 9757ms` → `home-revealed 10963ms`，**`app.js` 没有报任何错**。日志里唯一那条 `Uncaught (in promise) TypeError: Failed to construct 'URL': Invalid URL` 的 source 是 `node:electron/js2c/renderer_init`，属于 Electron 自己的渲染器初始化，本轮 diff 产不出它 —— 查过 `public/app.js` 与 `desktop/preload.js` 里 `new URL(` 出现 `0` 次，只有点击才触发的 `URL.createObjectURL`。
- **仍未肉眼验证的是备份功能自己那条链：** 备份折叠区在真实窗口里的落位、真实的保存/打开文件对话框、导入后的重启，以及真机换机（`D:\Music` → 另一台机器另一个盘）；这些结论全部来自 `node:vm` 跑真实源码 + 源码逐条断言。
- 发布链路：本轮**只用一个分支** `feat/machine-backup` 带两个提交（不像 `v1.7.29` 分成功能分支 + `release/` 分支）—— `94c22c6 feat: 整机备份，导出 mineradio.backup 到新电脑一键搬家` 与 `d61dfc6 chore(release): 1.8.1`，PR #35 以**合并提交** `a608505` 合入 `main`（不能 squash，否则 tag 脱离 `main` 祖先链）。PR 上 `verify` 通过（run `33736311936`，1m12s）。
- **版本号五处钉点必须留在 `chore(release)` 那一个提交里跳，功能提交自己得是版本一致的。** `public/app.js:591` 的 `APP_VERSION` 本来跟着功能一起写成了 `1.8.1`，而 `package.json` 还是 `1.7.29` —— 单独 checkout 功能提交时 `tests/version-consistency.test.js` 会红。改法是提交功能前把那一行临时按回 `'1.7.29'`、`git show HEAD:public/app.js` / `HEAD:package.json` 回读确认两边都是 `1.7.29`，再恢复 `'1.8.1'` 交给发布提交。注意这套动作做到一半时跑 `version-consistency` 必然红（它读工作区而不是索引），属于预期。
- **tag `v1.8.1` 打在 `d61dfc6`，而且必须是 annotated tag（tag object `29c4a07`）。** 第一次用 `git tag v1.8.1 d61dfc6` 打成了 lightweight，`git describe origin/main` 直接跳过它回了 `v1.7.29-6-ga608505` —— `v1.7.28` / `v1.7.29` 都是 annotated（`git cat-file -t` 回 `tag`），而 `git describe` 不带 `--tags` 只认 annotated。改成 `git tag -f -a v1.8.1 d61dfc6 -m "Mineradio v1.8.1 …"` 再 `git push --force origin v1.8.1`（同一个提交、tag 刚打几秒、Release 与工作流都还没引用它，所以这次强推是安全的）之后才是仓库惯例的 `v1.8.1-1-ga608505`。
- GitHub Actions `Build and Release` run `33737896819` 成功（2m26s，`2026-09-03T09:16:10Z` → `09:18:36Z`，`headBranch` 是 tag `v1.8.1`），Release 非草稿非预发布、`target_commitish` 为 `main`，`repos/oirge/Mineradio/releases/latest` 回的就是 `v1.8.1`（`gh release view --json isLatest` 这个字段在本机 `gh` 上不存在，会报 `Unknown JSON field`，用 `gh api …/releases/latest --jq .tag_name` 代替）；四项 Windows x64 资产远端 `state=uploaded`：`Mineradio-1.8.1-Setup.exe` `102278645` 字节 / SHA256 `75b47cf7c054e3a98553ec17c95fbc9113639b3fe269622aeecfa1e4fd5f65be`；`.blockmap` `106376` 字节 / `84fb7f86e2d8ede82b5509f38dbc41370d36a5526a7bd4817b149b2aec0668eb`；`latest.yml` `347` 字节 / `b1e0e764a12418ed7e5ee809046200ce402474cfb5f43bd7ea9a05f11a54f4f3`（`version: 1.8.1`）；`Mineradio-1.8.1-SHA256SUMS.txt` `273` 字节 / `433c8e9e7bd9f13822d3b1f182cf2c02a272bd8914f73fac2ae08ec8477f70ae`。不生成 Portable ZIP。
- 这一轮**四个资产全部回下本机复算过**：四个 SHA256 与 Release API 的 `digest` 逐一相同，`tr -d '\r' < Mineradio-1.8.1-SHA256SUMS.txt | sha256sum -c -` 三行全 `OK`，`latest.yml` 里的 `sha512`（`rGLGVhw07yc5yzx1Z0bZ+ww1vFNlTEuEn0iaCxYlUX9bLoseCu2dNlpqGhPQqVOvsci+i7gWM83/vvcGNgqMbw==`）与 `size`（`102278645`）在本机对着下回来的安装包逐字节对上。
- 遗留未修（自 `v1.7.26` 记到现在）：`release.yml` 的 `Generate SHA256 checksums` 用 pwsh `Out-File -Encoding utf8` 写清单，行尾仍是 **CRLF**（`file` 确认），所以在 Linux/Git Bash 下校验必须先 `tr -d '\r'`，直接 `sha256sum -c` 会报格式错。改法是 `[IO.File]::WriteAllText($path, ($lines -join "`n") + "`n")`。

## v1.7.29 同步指示器移到搜索框下面并接上主题插件令牌
- 正式发布版本从 `1.7.28` 提升为 `1.7.29`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:591`）与发布工作流默认 tag 保持一致，`1.7.28` → `1.7.29`。`tests/version-consistency.test.js` 钉前三处，`tests/github-actions-ci.test.js` 钉 `release.yml` 里的 `description` 与 `default` 必须等于 `v` + `package.json` 版本，**漏一处就会红**。
- 用户原话：「已同步xx歌曲位置改动一下再搜索框下面，显示的要符合主题插件」，随后「发布新版」。
- **位置方案定为「挂进 `#search-stack` 用 `top:100%` 贴底边」，而不是重算一组固定坐标。** `#search-stack` 补一条 `position:relative` 当定位祖先，`#local-sync-badge` 改成 `position:absolute;top:100%;right:0;margin-top:8px`（`margin-top` 与 `#search-results` 完全同值）。这样 `#search-area.stage-mode #search-stack{width:min(360px,52vw)}`、`body.simple-mode #search-stack{width:100%}`、桌面壳/移动端那几套 `top` 变体全部自动跟上，一处都不用再算；绝对定位不占流，任何模式下都不推挤原有布局，也不会和固定居中的 `#toast` 打架。
- **千万别按 `.search-mode-tabs` 的行高去算死坐标。** 第一版想写 `top:66px`（搜索框 58px + 8px 间距）之外再加一段 tabs 行高，但 `LOCAL_ONLY_MODE` 在 `public/app.js:74` 是**硬编码 `true`**，`app.css:184` 的 `body.local-only-mode #search-mode-tabs{display:none}` 因此恒成立 —— 按 tabs 存在算出来的坐标正好落在搜索结果列表第一行上。`top:100%` 是唯一不用关心这一族显隐的写法。
- **代价是「顶部搜索区只在鼠标 `y<66` 时才探头」，挂进去等于跟着它一起隐身**，所以显示的那 `4200ms` 必须主动把 `.peek` 按住（`holdLocalLibrarySyncBadgePeek`）。四条边界都要守：① 用户自己划开的不接管（先读 `.peek`）、也不替他关掉；② `setPeek` 自己有拒绝的理由（沉浸模式一律不给开搜索区），所以叫完要**回读 `.peek` 再决定记不记按住状态**，否则会记下一个假的「按住」并在放开时替用户关掉本来开着的搜索区；③ 放开时只在「那条全局 mousemove 自己也会收」的情况下才收 —— 查 mousemove 写下的 `localLibrarySyncBadgeSearchZoneHot`、`emptyHomeActive`、输入框焦点、`#search-results.show`、`#upload-tip.show`；④ mousemove 的收起分支要加按住豁免，否则鼠标一离开顶部，指示器刚露头就被连着搜索区一起收掉。
- **主题合规只有两条通道，这次只能用令牌通道。** 主题插件要么设 `--th-*` 令牌，要么在 `css` 段里点名某个选择器加 `!important`（`v1.7.26` 那一轮的教训）。指示器不在任何现成主题的选择器清单里，所以走令牌：底色 `--th-search-bg` → `--th-chip-bg` → `--saved-panel-glass-bg` 三级回落（`--th-search-bg` 语义上就是主题给搜索区那一族的底色，且 `app.css` 从不自己引用它），描边 `--th-chip-border` → `transparent`，阴影 `--th-row-shadow` → `--saved-panel-glass-shadow`，文字 `--th-text-strong`（雪昼白这类浅色主题也读得清），语义色只留在那颗 `--fc-accent-rgb` 圆点上。
- **没有把指示器塞进 `app.css:1617` / `:1624` 那两条长 `!important` 选择器列表。** 那两条列表（`#search-box,#search-results,.search-mode-tabs,#fx-panel,#toast,…`）是黄金玻璃的统一入口，往里加名字等于让主题令牌永远赢不过 `!important`。改成在指示器自己的 id 规则里把 `--saved-panel-glass-*` 当**回落值**用（id 选择器本来就赢过那些类），再单独加一条 `html.control-glass-svg-ok #local-sync-badge` 跟邻居一起升级到同一支玻璃 SVG 滤镜。**没有降级成普通毛玻璃**。
- 删掉了 `body.controls-visible #local-sync-badge{bottom:190px}` —— 那是右下角时代为了给抬起的播放控制条让位的补偿，新位置在顶部，留着就是一条永远不生效的死规则。
- `public/index.html` 一行未动：指示器一直是 `localLibrarySyncBadgeElement()` 运行时懒建的，只把父节点从 `body` 换成 `#search-stack`（取不到时仍退回 `body`，那条退路有测试钉着）。
- 测试从 12 例扩到 23 例（`tests/local-library-auto-sync.test.js`）。harness 侧新增 `createDocumentShim().mount(id)`（登记节点但**不**推进 `body.children`，否则退回 `body` 那条测试的 `children.length` 断言会被污染）与 `createSandbox({searchDom, peeking, peekRefused})`，`peekRefused` 专门还原「叫了 `setPeek` 但没开起来」的沉浸模式。CSS 断言用换行锚定的 `cssRule()`（`\n#local-sync-badge{`），否则 `#search-area.stage-mode #search-stack{` 会先命中。
- **`assert.doesNotMatch(badge, /top:\d/)` 这条断言写崩了两次**：`margin-top:8px` 里有 `top:8`，收紧成 `(?:^|;)top:\d` 又被 `top:100%` 的 `top:1` 命中，最终写成 `(?:^|;)top:[\d.]+px` —— 只禁「硬编码像素 `top`」这一件事。CSS 属性名互为后缀时，正则一定要连分隔符一起锚。
- **本轮发布 PR 上的 `verify` 先红了一次，红出来一个真缺陷，不是抖动。** `tests/local-library-sqlite-store.test.js` 的 `完整扫描剔除删除文件而截断扫描不剔除` 在 CI 上 `removed` 应为 `1` 却是 `0`（run `33716635422`，844/845）。根因：`desktop/local-library-store.js` 的清理是 `DELETE FROM files WHERE root_id=? AND seen_at<>?`，也就是把 `Date.now()` 当「本轮扫描代号」用；Windows 上时钟粒度可能有十几毫秒，三次同步落在同一刻时上一轮留下的行 `seen_at` 与本轮完全相同，于是被当成「本轮见过」躲过删除 —— **用户删掉的歌会一直留在音乐库里**。本机把 `Date.now()` 冻死后一次复现（`full.removed = 0`、`c.mp3` 还在）。
- 修法是给每个曲库根一个严格递增的扫描代号（`nextSyncStamp`）：进程内第一次同步该根时探一次 `MAX(seen_at)`（那次本来就要重写整根，一条聚合查询可以忽略），之后只在内存里 `max(now, 高水位 + 1)` 递增，时钟回拨也不会撞车；`close()` 里跟着清掉高水位表。**没有加索引也没有动 schema** —— `idx_files_seen` 是上几版特意删掉的（清理条件走不了索引，留着只是给每行加一次索引写）。新增 `两次扫描落在同一时钟刻度时完整扫描仍然剔除删除文件`：把 `Date.now()` 冻成常量跑完整三步，**先确认这条测试在旧实现下会红**再提交。
- 验证：`node --check` 过了 `public/app.js`、`server.js`、`desktop/main.js`、`desktop/local-library-store.js`，`git diff --check` 干净，全量 Node 回归 `846/846`（`main` 基线 `834`）。功能提交 `2a1b1c0`，PR #32 以**合并提交** `3ef1146` 合入 `main`，PR 上 `verify` 工作流通过（run `33716042507`，1m8s）。
- 本轮未启动本机 Electron，**指示器在真实窗口里的落位与主题切换效果没有肉眼验证过**，全部结论来自源码/CSS 的逐条自动化断言；发布用的安装包由 GitHub Actions 远程构建，本地未做安装冒烟。
- 发布链路：功能提交 `2a1b1c0`（PR #32 → 合并提交 `3ef1146`）先进 `main`，再由发布分支 `release/v1.7.29` 带两个提交 —— `4fb706d chore(release): 1.7.29`（十文件版本号 + 文档）与 `bd357ad fix: 曲库清理不能用毫秒时间戳当扫描代号`，PR #33 以**合并提交** `12ab850` 合入（不能 squash，否则 tag 脱离 `main` 祖先链）。PR 上 `verify` 通过（run `33717519050`，1m29s；前一次 `33716635422` 红出来的就是上面那个清理缺陷）。tag `v1.7.29` 打在 `bd357ad`（发布分支末端的功能提交，与 `v1.7.28` 同一做法），`git describe origin/main` = `v1.7.29-1-g12ab850`。
- GitHub Actions `Build and Release` run `33717753412` 成功（2m43s，`2026-09-03T05:10:12Z` 触发），Release 非草稿非预发布、`target_commitish` 为 `main`，`repos/oirge/Mineradio/releases/latest` 回的就是 `v1.7.29`；四项 Windows x64 资产远端 `state=uploaded`：`Mineradio-1.7.29-Setup.exe` `102273765` 字节 / SHA256 `555d4431b6c85ce266a131dabf75277cf7b850b5337a6d43bc4aa9caabd6e15d`；`.blockmap` `106465` 字节 / `71d7006b9c7e45d2c835f7ddb38c6736f56c893fab95037291d6b9d5990663c1`；`latest.yml` `350` 字节 / `45c75b90073f84aa6fd174c63bf2ea51d19c8f29bd30ddbec55ed528896af828`（`version: 1.7.29`）；`Mineradio-1.7.29-SHA256SUMS.txt` `275` 字节 / `0421ed17aa51f469498bbe42c3f1ce59800abd98ff77f587eb8ac25143ee636e`。不生成 Portable ZIP。
- 这一轮**四个资产全部回下本机复算过**（不像 `v1.7.27` 只回下两个小文件）：四个 SHA256 与 Release API 的 `digest` 逐一相同，`tr -d '\r' < Mineradio-1.7.29-SHA256SUMS.txt | sha256sum -c -` 三行全 `OK`，`latest.yml` 里的 `sha512`（`272TG9xseh0A+n0Q9glkSZtAsOyPox+CowacpHu9nt1ZDayYd79vOSG8h3WkB1WU4rpJNQLvZ583R4qyjSoz/w==`）与 `size`（`102273765`）在本机 `openssl dgst -sha512` 下逐字节对上。
- 遗留未修（自 `v1.7.26` 记到现在）：`release.yml` 的 `Generate SHA256 checksums` 用 pwsh `Out-File -Encoding utf8` 写清单，行尾仍是 **CRLF**，所以在 Linux/Git Bash 下校验必须先 `tr -d '\r'`，直接 `sha256sum -c` 会报格式错。改法是 `[IO.File]::WriteAllText($path, ($lines -join "`n") + "`n")`。

## v1.7.28 无缝播放（Gapless）与 0~10 秒交叉淡入淡出（Crossfade）
- 正式发布版本从 `1.7.27` 提升为 `1.7.28`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:591`）与发布工作流默认 tag 保持一致，`1.7.27` → `1.7.28`。
- 用户原话：「再最新版的基础上继续给 Mineradio 增加无缝播放和 Crossfade。要求：1. 新增 Gapless 开关。2. 支持相邻歌曲无明显停顿。3. 新增 Crossfade，支持 0~10 秒。4. Crossfade = 0 时保持原来的播放逻辑。5. 不影响手动切歌、上一首、下一首。6. 不影响随机播放和自动播放。7. 播放器状态切换时不能出现爆音、重复播放或突然静音。8. 保持现有 UI 风格，只增加必要设置。9. 增加播放切换和边界情况测试。 更新好后发布新版」。
- **架构定为「双 deck 音频池 + 会移动的全局 `audio` 指针」，因为规范层面别无选择。** `createMediaElementSource(el)` 建好的节点永久绑死那一个 `<audio>`，既不能改指向也不能 disconnect 后换元素，所以只要想让两首歌同时出声，就必须要第二个 `<audio>` 配第二个 source。`audioDeckList` 里常驻两个 deck，各自永久接好 `deck.source → deck.gain → analyser`（`deck.gain` 另并一条到 `beatAnalyser`），共享尾链 `analyser → replayGainNode → audioChain.input → audioChain.output → gainNode → destination` 一行未动。全局 `var audio` 被重指向到当前可闻那个 deck，所以 UI、进度条、听歌统计、media session、桌面歌词、迷你播放器这些消费方**零改动**跟着走。
- **`deck.gain` 与 `gainNode.gain` 的分工是死规矩。** `gainNode.gain` 继续独占 `targetVolume` 与全部既有淡入淡出（启动 `460ms`、暂停、seek），`deck.gain` 只做接续与交叉，中性值恒为 `1.0`（IEEE754 下位精确透明，所以依旧满足「整条链常驻音频图、绝不运行时改接线」）。第一版把交叉斜坡也写到 `gainNode.gain` 上，两边的 `cancelScheduledValues` 互相削，当场爆音——以后任何新的淡入淡出都要先想清楚该落在哪一层。
- **需求 2 的「无明显停顿」其实不是解码问题，是淡入问题。** 相邻两首之间那段能听出来的空档 = 自动续播时重跑的 `460ms` 主淡入。预解码只解决延迟那一小半，真正让停顿消失的是接管时不再重跑主淡入（deck 斜坡只有 `HANDOFF_RAMP_SECONDS = 0.012`）。所以「无缝开 + 交叉 0」这一档听起来才是连着的，而它任何时刻都**只有一路出声**。
- 三档行为契约，改动时逐档确认：无缝关 + 交叉 `0` = 100% 老逻辑（不预取、不换 deck、保留主淡入）；无缝开 + 交叉 `0`（出厂默认）= 预取 + `12ms` deck 斜坡接管；交叉 `> 0` = 等功率 `sin/cos` 交叠。**等功率不能改回线性**，线性交叉在中点会掉约 `3 dB`。
- **需求 5 / 6 靠「谁有资格接管预取 deck」这一道门实现：** 只有 `opts.autoAdvance` / `opts.autoRepeat` 允许接管，手动切歌 / 上一首 / 下一首一律不接管（否则用户点了别的歌却播出预取那首）；随机播放待洗牌时 `gaplessShufflePending()` 为真则连预取都不做，因为洗牌结果没定、预取必然预错；播完即停时释放预取。
- **需求 7 里「重复播放」的防线是提交时序：** 起播 → 等 `play()` 真的 resolve → `commitCrossfadeHandoff` 才对交、推进队列、移动 `audio` 指针。`play()` 在 Chromium 里可能 reject（autoplay 策略、解码失败、blob 失效），也可能在某些实现里不返回 Promise，三条分支都走 `abortCrossfadeStart` 原样退回、当前那首继续播、失败 URL 进黑名单不再重试。先推进队列再起播 = 用户看到歌单跳了却没有声音。
- **「突然静音」的防线是定时器序号守卫。** 交叉进行中用户手动切歌，上一轮的收尾定时器还在飞，不守卫就会把刚接管的那个 deck 停掉或静音（本轮最难复现的一个 bug）。所有收尾定时器都带自增序号，回调里先比序号再动 deck；手动切歌时先把两路都压到 0 再停，不留直角。
- **`setValueCurveAtTime(curve, now, span)` 在 `now` 已有别的自动化事件时会抛 `NotSupportedError`**，而且这套曲线 API 在某些实现里干脆不存在。`rampAudioDeckGain` 的写法固定为 cancel → curve，抛了再 cancel 一次并退回 `setValueAtTime` + `linearRampToValueAtTime`。
- 设置存独立 `GAPLESS_STORE_KEY = 'mineradio-gapless-v1'` 并登记进 `PERSISTENT_UI_STATE_KEYS`，**绝不写进视觉预设 `fx`**（`fx` 会随预设与用户档案导入导出，写进去等于别人的预设能改你的播放行为）；`gapless-crossfade` 滑杆不进 `bindFxPanel` 的显式 `ids` 白名单，所以不可能被写成 `fx` 字段。
- 需求 8：界面只在 `public/index.html` 的 `fx-volume-fold` 与 `fx-eq-fold` 之间新增一个同构折叠区 `fx-gapless-fold`（一个 `fx-toggle` + 一个 `fx-slider` + 两行 `mini-player-collapse-hint`，全部复用既有类名），`fxPanelTargetForNode` 里归到 `advanced`、`organizeFxPanel` 的数组里登记，**`public/app.css` 一行未动**。
- 已知取舍：`replayGainNode` 只有一个且在 `analyser` 之后，也就是均衡增益作用在两路求和之后，**交叉那几秒两首歌共用同一个 ReplayGain 增益**。要做 per-deck 均衡就得把 `replayGainNode` 拆成两个塞到各自 `deck.gain` 前面，本轮按「够用就不动」没做。
- 引擎块整段夹在 `var GAPLESS_CROSSFADE_MIN_SECONDS` 与 `var REPLAY_GAIN_PREAMP_MIN` 之间，`tests/gapless-crossfade.test.js` 按这对锚点切进 `node:vm`，所以这段里新增任何裸标识符都会在 vm 里 `ReferenceError`、被调用方的 `.catch` 吞掉（测试全绿但行为错），跨切片调用一律 `typeof x === 'function'` 守卫。两条 vm 老规矩又各踩一次：ES6 简写方法不可 `new`，桩 `new Audio()` 必须写成 `Audio: function () {}`；`require('node:assert/strict')` 把 `deepEqual` 别名成 `deepStrictEqual`，跨 realm 容器断言前必须 `Object.assign({}, x)` / `Array.from` 拷回本 realm。
- **每加一个启动初始化函数都要去放宽 `tests/auto-playback-startup.test.js` 那条启动顺序正则**（ReplayGain、音效链、无缝各一次，已经第三回）。本轮加的是可选组 `(?:initGaplessControls\(\);\s*)?`，启动顺序现在是 `initAutoPlaybackControls(); initReplayGainControls(); initAudioChainControls(); initGaplessControls();` 再接 `if (LOCAL_ONLY_MODE) scheduleSavedLocalMusicFolderRestore(700);`。`tests/replay-gain-normalization.test.js` 的链路断言也按双 deck 更新（`deck.source.connect(deck.gain)` / `deck.gain.connect(analyser)`）。
- 需求 9：新增 `tests/gapless-crossfade.test.js` 27 例，覆盖交叉秒数按短歌与脏时长封顶、交叉 `0` 时任何时刻只有一路声音、交叉主路径（确认出声后再对交并推进队列）、预起播被拒时原样退回并进黑名单、`play()` 抛错与不返回 Promise 两条分支、交叉中手动切歌先压到 0 再停、作废的收尾定时器不会停掉新接管的 deck、下一首是自己时预取照做但不交叉、随机待洗牌时既不预取也不交叉、播完即停释放预取、交叉中改秒数不截断正在跑的斜坡、关掉开关立刻释放预取、秒数展示与三档说明文案、面板事件只绑一次且拖动不刷屏、没有 WebAudio 时退回元素音量、等功率曲线不可用时退回线性斜坡、双 deck 接线与各条切歌路径。
- 发布前全量 Node 回归 `834/834`（`main` 基线 `807`）。`node --check` 过了 `public/app.js`，`git diff --check` 干净。
- 本轮未启动本机 Electron，**交叉与接续的实际听感未在本机 Electron 里试听过**，全部结论来自桩 AudioContext 下的逐条自动化断言；发布用的安装包由 GitHub Actions 远程构建，本地未做安装冒烟。
- tag `v1.7.28` 打在 `7054fab`（功能提交本身），PR #30 以**合并提交** `28813aa` 合入 `main`（不能 squash，否则 tag 脱离 `main` 祖先链），`git describe origin/main` = `v1.7.28-1-g28813aa`。PR 上 `verify` 工作流通过（run `33711338098`：`npm ci --ignore-scripts` → `node --test --test-concurrency=1` → `node --check desktop/main.js`）。
- GitHub Actions `Build and Release` run `33711517784` 成功（2m17s，`2026-09-03T03:29:03Z` → `03:31:20Z`），Release 已标记 Latest、非草稿非预发布、`target_commitish` 为 `main`，`repos/oirge/Mineradio/releases/latest` 回的就是 `v1.7.28`；四项 Windows x64 资产远端 `state=uploaded`：`Mineradio-1.7.28-Setup.exe` `102271454` 字节 / SHA256 `8eea3500b19fea50a9d15223daead090b745489c375670b19f9576a95bbb5167`；`.blockmap` `106473` 字节 / `a893c275d0b49ecd90fc6f6f8fccb929c64df222976ae6791bf4e348eadc042c`；`latest.yml` `350` 字节 / `ef4180fce2afd9e6a06af28128e2b15abfb3b6516618a2b05a184ce09b456d6b`（`version: 1.7.28`）；`Mineradio-1.7.28-SHA256SUMS.txt` `275` 字节 / `6c59ee0de6a33e53203b00d993f059f1cd4286b0eb13cb7f4587c8ec36e27c1c`。不生成 Portable ZIP。
- 四项资产已全部**回下本机**逐个复算核对：本地 `sha256sum` 与 Release API 的 `digest` 字段两两一致，清单文件里的三行 `sha256sum -c` 全 `OK`；`latest.yml` 的 `sha512`（`0UH73DWDAZ156g9gkz0gZWTQohlJqLvjq/BdiL7WbqbqvM0CF53wAihgt2EbtGaS2tTOZmBPw31r/NgxAfhUtQ==`，本地 `sha512sum | xxd -r -p | base64 -w0` 复算）与 `size`（`102271454`）也与实际安装包一致，自动更新清单没有对错文件。
- **`SHA256SUMS.txt` 仍是 CRLF 换行**（`release.yml` 里那句 pwsh `Out-File` 本轮没动），所以校验必须先 `tr -d '\r' < Mineradio-1.7.28-SHA256SUMS.txt | sha256sum -c -`，直接 `sha256sum -c` 会因文件名尾部的 `\r` 报 `No such file or directory`。这条从 `v1.7.26` 记到现在**还没修**，要修就把那句 `Out-File` 换成 `[IO.File]::WriteAllText($path, ($lines -join "\n") + "\n")`；资产本身没有问题，只是校验文件的换行符。

## v1.7.27 播放统计与断点续播，全局热键接上鼠标中键 / 侧键
- 正式发布版本从 `1.7.26` 提升为 `1.7.27`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:585`）与发布工作流默认 tag 保持一致，`1.7.26` → `1.7.27`。
- 用户原话：「继续更新加：最近播放时间 / 累计播放时长 / 播放次数 / 最后播放位置 / 断点续播 /「继续上次播放」/ 最近播放记录清空 / 单曲播放统计　全局快捷键支持鼠标侧键 更新好发布新版本」。九项里前八项是同一套本地收听数据的不同切面，最后一项是独立的输入层改造。
- **`v1.7.23` 就已经埋好了大半基础，先查再写省了一大截。** `HOME_LISTEN_STATS_KEY`（`mineradio-listen-stats-v1`）里的 `songs` / `artists` / `history` 三张表、`finalizeListenSession` 的有效播放判定、以及「最近播放 / 播放最多 / 未播放」三个智能分类都是既有的。本轮真正新增的是：把统计**显示**出来（列表摘要 + 详情段）、单曲断点（`mineradio-song-resume-v1`）、「继续上次播放」的三级回落、两档清空，以及鼠标热键那一整条链路。
- **有效播放的门槛写在 `finalizeListenSession`：** `completed || listenMs >= 45000 || maxProgress >= 0.5 || (读不到 duration 时 listenMs >= 30000)`。不要因为「用户抱怨次数涨得慢」就把它调低——这条门槛的作用是让「切歌前手滑点开两秒」不进统计，调低就等于把最常播放榜变成最常误触榜。
- **断点的两条时间门槛也不要随手动：** `SONG_RESUME_MIN_SECONDS = 15`（听不到 15 秒不记）与 `SONG_RESUME_MIN_REMAIN_SECONDS = 20`（离结尾不足 20 秒不记，否则「续播」会把用户丢到片尾）。上限 `SONG_RESUME_MAX_ENTRIES = 400`，超出按最后记录时间淘汰。断点位置与会话记录共用 `writePlaybackSession` 里那条 2.2 秒节流（`recordSongResumeTick()` 就挂在它开头），别再另开一条定时器。
- **「继续上次播放」的三级回落顺序是有意的：** `pendingPlaybackSessionResume`（本次启动待恢复的会话）→ `readPlaybackSession()`（磁盘会话）→ 最近播放里第一首还在当前队列的歌。第三档在几万首的队列里不能做嵌套循环：先把 `history` 的 key 收成 `order` 表，再对 `playQueue` 做一次单遍扫描，命中 `order === 0` 立刻 break。这个函数不看自动播放开关——那个开关管的是「启动要不要自动出声」，而按钮是用户当下按下的明确意愿。
- **两档清空的语义差别必须落到每一处存储上。** `recent` 只清 `history` 并把 `songs[*].lastPlayedAt` / `artists[*].lastPlayedAt` 归零，次数与累计时长留着；`all` 才删表、清断点、`clearPlaybackSession()` 并把 `pendingPlaybackSessionResume` 归零。传进来的未知字符串一律当 `recent`，因为误判成 `all` 是不可逆的。
- **本轮补掉的一个真缺陷：清空只清了 localStorage。** 播放统计有两份——界面读的 `localStorage`，和 `desktop/local-library-store.js` 里 `song_stats` 表那份镜像（`syncLocalLibraryDbPlayStat` 每次结算都写，是 `v1.7.23` 就有的写入方向）。渲染层目前从不读回镜像，所以视觉上看不出来，但用户按了「全部清空」，本机数据库里还整整齐齐留着一份同样的播放次数、累计时长和最近播放时间。新增链路：`clearListenHistory` → `syncLocalLibraryDbListenHistoryClear(scope)` → `callLocalLibraryDb('clearLocalLibraryDbPlayStats')` → IPC `mineradio-local-library-db-clear-play` → `store.clearPlayStats({scope})`。
- **`clearPlayStats` 是 `UPDATE` 而不是 `DELETE`：** `song_stats` 同一行里还存着 `favorite` / `favorite_at`（「特别喜欢」歌单靠它），删行会顺手清掉用户的收藏。所以 `all` 把 `play_count` / `listen_ms` / `completed` / `last_played_at` 四列归零，`recent` 只归零 `last_played_at`，两档都留着行，`getStatus().stats` 的计数不掉。SQLite 打不开（没有 `node:sqlite`）时清空照常完成，只是镜像那份留着——不能因为镜像写不动就让用户当场按下的清空整个失败。
- **Electron 的 `globalShortcut` 只收键盘，这是鼠标热键必须走原生模块的唯一原因。** 系统级鼠标键要装低层输入钩子（Windows 上 `WH_MOUSE_LL`，libuiohook 同时也装 `WH_KEYBOARD_LL` 来跟踪修饰键状态），所以引入 `uiohook-napi@1.5.5`——**这是项目第一个运行时依赖**。
- **libuiohook 是 listener，不是 filter：拦不掉浏览器/资源管理器原本的后退前进动作。** 这不是实现没做好，是这套 API 本身给不了「吞掉事件」的能力。所以这句话直接写进了热键面板的说明（`public/app.js:33422` 附近），别在后续版本里当成 bug 去「修」，也别删掉那句提示。想要不受影响就只绑「局内」一栏——局内绑定只用浏览器事件。
- **三个可绑键位和它们的双份编号：** `HOTKEY_MOUSE_TOKENS = { MouseMiddle:{dom:1,uio:3}, MouseBack:{dom:3,uio:4}, MouseForward:{dom:4,uio:5} }`，另有一张反查表 `HOTKEY_MOUSE_TOKEN_BY_DOM_BUTTON`。DOM 编号给渲染层的 `mousedown` 用，uIOhook 编号给主进程用，两套不通用，改动时必须同时改两张表（测试有一条互逆断言钉着）。左键（DOM 0）与右键（DOM 2）永不开放。
- **`HOTKEY_KEY_MAP` 里鼠标条目的 `accel` 是空串，`hotkeyToAccelerator` 必须显式挡掉它们。** 少了那道 `if (info && info.mouse) return '';` 守卫，`Ctrl+MouseBack` 会拼出 `'Control+'` 这种真值垃圾串，然后被当成键盘加速键送去 `globalShortcut.register`。`bare:true` 是让鼠标键不带修饰键也能注册。
- **渲染层挂了两个 capture 阶段监听，缺一不可。** `mousedown` 负责录入与局内触发；`auxclick` 只为了掐掉中键的自动滚动——`mousedown` 上的 `preventDefault` 挡不住随后的 `auxclick`。测试用 `listeners.split('}, true);').length - 1 === 2` 钉住「两个都得是 capture」。
- **前台去重靠一份 `local` 表，不是靠 `action` 字段。** `registerGlobalHotkeys()` 把局内鼠标绑定整理成一个不带 `action` 的 `localMouse` 列表一起发给主进程；`handleGlobalMouseHotkeyEvent` 只在「签名在 local 表里」**且**「主窗口有焦点」时跳过派发，所以同一个组合同时绑局内和全局，前台按一次只响一次，窗口失焦后全局那份照常工作。签名格式是 `mouseHotkeySignature` 的 `(C)(A)(S)(W)#button`。
- **原生模块是惰性加载的，而且失败要能报出来。** `loadMouseHookModule()` 里那句 `require('uiohook-napi')` 是全文件唯一一处（测试用 `split(...).length - 1 === 1` 钉住），只有确实存在全局鼠标绑定时才会走到；绑定清空时 `stop()` 一次。模块加载失败返回 `{ok:true, available:false}` 并给每个动作一条 `unsupported`，`start()` 抛异常时是 `{ok:false, available:true}`——两种失败的含义不同，别合并。
- **打包上有两个坑。** 一是 `build.files` 是白名单，而白名单里的相对依赖扫描只认 `./` / `../`，bare `require('uiohook-napi')` 它看不见，所以 `node_modules/uiohook-napi/**/*` 与 `node_modules/node-gyp-build/**/*`（uiohook 的入口就是 `require('node-gyp-build')`）必须手写进去。二是 `.node` 二进制在 asar 里 `dlopen` 不了，得进 `asarUnpack`——`tests/complete-optimization-gates.test.js` 那条 `asarUnpack` 是全量 `deepEqual`，加条目要同步改它。
- **锁文件里的源地址要盯住。** 本机 npm 默认走 `registry.npmmirror.com`，混进 `package-lock.json` 就会让 CI 上的 `npm ci` 去拉一个跟 integrity 对不上的地址。本轮用 `npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/` 生成，`git diff --stat` 只有 `+25` 行；`tests/packaging-file-whitelist.test.js` 新增一条断言，扫全文件不许出现非 `registry.npmjs.org` 的 `resolved`。
- **许可要一起补。** uiohook-napi 本体是 MIT，但它静态链接的 libuiohook 是 LGPL-3.0-or-later；按 LGPL v3 第 2 条可以在 GPL-3.0 项目里分发，所以组合是相容的，但必须披露。`THIRD-PARTY-NOTICES.md` 新增两节（uiohook-napi + libuiohook、node-gyp-build），并写明安装包里随附的是预编译 `prebuilds/win32-x64/uiohook-napi.node`、版本在 `package.json` / `package-lock.json` 钉死，照该版本重编译替换该文件即可完成再链接。**注意别写成「安装包里附了完整编译源码」**——electron-builder 的默认 node_modules 排除规则会剥掉 `binding.gyp` 和 `.h/.cc/.cpp`，那样写是不实的。
- `PRIVACY.md` 同步：新增「系统级鼠标钩子」一节（只在存在全局鼠标绑定时加载、删掉绑定立刻停、只读按键与修饰键状态、不记录不落盘不上传、键盘全局热键走 `globalShortcut` 不经过这个钩子、部分杀毒软件会报警），本地数据清单补上播放次数 / 累计时长 / 断点，并写明统计存在 `localStorage` 与 SQLite 两处、清空会一起清。
- **`node:vm` 切片测试的两条老规矩这轮又各踩了一次。** 一是切片外声明的标识符必须由 harness 供上并用正则钉住，否则生产代码的 `try/catch` 会把 `ReferenceError` 咽掉、测试静默假通过（本轮给 `tests/listen-history-clear.test.js` 补 `callLocalLibraryDb` 桩就是这条）。二是 `let` / `const` 在 vm 顶层**不是** context 对象的属性，`desktop/main.js` 的 `globalMouseHotkeyMap` / `GLOBAL_MOUSE_HOTKEY_BUTTONS` 从宿主 realm 完全看不见，所有主进程断言只能走返回值、`requires`、`hookCalls`、`dispatched` 这些记录。
- 默认热键表自带九组键盘全局绑定，routing 类断言会被它们淹掉，`tests/mouse-side-button-hotkeys.test.js` 里用一个 `onlyBindings(ctx, scope, map)` 先把整个 scope 清空再设待测项。
- 发布前全量 Node 回归 `807/807`（`main` 基线 `712`）：新增 `tests/song-resume-playback.test.js` 27 例、`tests/listen-history-clear.test.js` 25 例、`tests/mouse-side-button-hotkeys.test.js` 40 例；扩写 `tests/packaging-file-whitelist.test.js`（+2：原生模块进包、锁文件源地址）、`tests/local-library-sqlite-store.test.js`（+1：两档清空只归零播放列、留行留收藏）、`tests/complete-optimization-gates.test.js`（`asarUnpack` 白名单同步）。`node --check` 过了 `public/app.js` / `desktop/main.js` / `desktop/preload.js` / `desktop/overlay-preload.js` / `desktop/local-library-store.js` / `server.js`，`git diff --check` 干净。
- 本轮未启动本机 Electron，未合成鼠标键盘输入，未做安装冒烟；`uiohook-napi` 的预编译二进制只在本机裸 Node 下实测加载过（`EventType.EVENT_MOUSE_PRESSED = 7`，`uIOhook.start/on/stop` 均为函数），**Electron 运行时里的实际钩子行为未经本机验证**。
- tag `v1.7.27` 打在**合并提交** `8930fd2` 上（PR #29 的 merge commit，和 `v1.7.28` 把 tag 打在功能提交上的做法不同，两种都能保证 tag 在 `main` 可达历史里，前提同样是不能 squash）。PR 上 `verify` 工作流通过（run `33656515299`）。
- GitHub Actions `Build and Release` run `33702428318` 成功（2m36s，`2026-09-03T01:08:18Z` → `01:10:54Z`），Release 非草稿非预发布，当时四项 Windows x64 资产远端 `state=uploaded`：`Mineradio-1.7.27-Setup.exe` `102261543` 字节 / SHA256 `2cd88f3cba3b155ba2f9225e861de7cc82101b09903ebb4493dbd1ba3bf197d7`；`.blockmap` `106577` 字节 / `a902a4f520a13541902bbeed93853bb026001b0b20aa8be471e5d6c8acce7502`；`latest.yml` `350` 字节 / `cf1796d25fa048f72681bc9126b9ff4e912a2954f7af7729af90ba5d71de6f8a`（`version: 1.7.27`，`sha512: UL5flsHWpmcs+Spe7qc6wafQfWWpfeu9Jo7nrm2esQAn4/XgKTD3BZZx+zq5lADU6bJJ4NFFwSeaDYtT1m+gpA==`，`size: 102261543` 与安装包字节数一致）；`Mineradio-1.7.27-SHA256SUMS.txt` `275` 字节 / `c74b3f852e5c22af8feec9b279143b4b5ee8c08176749c7d826c08683c061efa`。不生成 Portable ZIP。
- 这一节是发 `v1.7.28` 时补记的（当时只留了占位注释）。补记时只把 `latest.yml` 与校验清单两个小文件回下本机复算，**安装包本体没有再回下**，所以 `.exe` 与 `.blockmap` 的 SHA256 取自 Release API 的 `digest` 字段，并与清单文件里的三行逐一核对一致；安装包的 `sha512` 未在本机复算。
- **勘误（2026-09-03 补）：上面那一组校验值已经不是这个 Release 上现在挂着的文件了。** `2026-09-03T13:33` 我误对着 `tag=v1.7.27` 重新派发了一次 `Build and Release`（run `33761618486`）。`.github/workflows/release.yml` **checkout 的是传入的那个 tag 而不是 `main`**，所以 `tag == "v" + package.json 版本` 这道闸对任何旧 tag 都会放行，四个资产被同一提交重新构建并 `--clobber` 覆盖上传。Electron 构建不是逐字节可复现的，所以文件内容变了：`Mineradio-1.7.27-Setup.exe` 现在是 `102261716` 字节 / `14208e518feab9e8807f43a0ffa998b1851833a134656d81cde3fad0d0d73a4f`；`.blockmap` `106488` 字节 / `51b7a6871f529e90400f3af1ba43f8780227a6f64329eb202176dc1e4dc3bc41`；`latest.yml` `350` 字节 / `7fed2a61f28393a34b70989a0eb900aeb8cf78540471487eb0f52e54ad0f54e8`（`sha512: MbRnBTX2uTos/LfQIXSTvbkOjQwTpvJXZ8iP2BZVOC+spdE0zOX6bq2h1g5EmP+VINrH83vr0gpxBiD9OTzSZQ==`，`size: 102261716`）；`Mineradio-1.7.27-SHA256SUMS.txt` `275` 字节 / `249faf91a248205ed18b904e0fa1aff899f65e1f12866946cc634c059e5ddfb1`。三个校验载体（Release API 的 `digest`、清单里的三行、`latest.yml` 自己的 `size`/`sha512`）互相一致，`repos/oirge/Mineradio/releases/latest` 仍然指向 `v1.8.1`，所以自动更新没有受影响；代码没有任何变化，变的只是安装包字节。
- **教训：`Build and Release` 只能对着刚打好的新 tag 派发。** 它不校验「这个 tag 是不是最新一次发布」，重跑旧 tag 会静默作废那次发布已经记下来的校验值。要重跑先确认 tag，别凭记忆当前版本号——用 `gh api repos/oirge/Mineradio/releases/latest --jq .tag_name` 读。

## v1.7.26 热键设置面板换成播放器自己的皮，主题插件终于带得动它
- 正式发布版本从 `1.7.25` 提升为 `1.7.26`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:566`）与发布工作流默认 tag 保持一致，`1.7.25` → `1.7.26`。
- 用户原话：「热键界面ui不符合我播放器ui啊而且主题插件这个热键界面不生效 你改一下」，随附热键设置弹窗截图（扁平深灰方框、纯白文字、右上角裸 `×`、方角行、绿色「可用」文字）。随后「发布新版」。
- **两个抱怨是同一个根因。** 主题插件只有两条通道能作用于一个控件：插件 `theme.vars` 灌到 `:root` 的 `--th-*` 令牌，或者 `theme.css` 那段 `!important` 规则里点名的类名（`.modal,.track-detail-modal,#fx-panel,#playlist-panel,.home-card,…`）。原来的 `.hotkey-*` 两条都不占——48 条规则里 0 个 `--th-*`，类名也不在任何主题的选择器表里。既然颜色全是写死的深灰字面量，它当然既不像播放器、也换不动主题。**新增控件要想「自动跟主题」，必须复用兼容层点名过的类名，或者自己走 `--th-*` 令牌，最好两条都占。**
- 改法是两条通道一次补齐：外壳换成 `.modal-mask hotkey-modal` + `<div class="modal hotkey-dialog">`（主题的 `css` 段按 `.modal` 选，直接命中），分段用 `.panel-tab`、按键/默认按钮用 `.fx-mini-btn`（`.ghost`）、底部 `.btn-row` + `.modal-btn`（这些类名都在 `public/app.css` 兼容层的胶囊列表里，`--th-chip-*` 自动灌进来）；剩下的热键专属颜色改走 `--th-row-*` / `--th-chip-*` / `--th-text-strong` / `--th-text-dim` / `--champagne`，强调色统一 `rgba(var(--fc-accent-rgb),…)`。**故意没有改 `public/plugin-builtin-themes.js`**：既然外壳戴上了 `.modal`，内置主题的 `css` 段已经覆盖到，改那个文件还得同步改 `examples/plugins/*.json`（被 `tests/plugin-system.test.js` 钉住），而且令牌这条路对第三方主题一样有效。
- `.hotkey-modal` 这个类名**必须继续留在遮罩元素上**：`tests/global-hotkeys.test.js` 有一条 `/\.hotkey-modal\.warn \.hotkey-capture-tip\{/` 的 CSS 断言。所以是遮罩 `modal-mask hotkey-modal`、卡片 `modal hotkey-dialog`，不是把 `.hotkey-modal` 整个删掉。
- 删掉的旧规则（现在靠继承）：`.hotkey-modal{position:fixed;inset:0;z-index:1450;…}`、`.hotkey-modal.show`、旧 `.hotkey-dialog` 自带的渐变/边框/阴影、`.hotkey-head`、`.hotkey-title`、`.hotkey-close`、`.hotkey-tabs button`。层级从 `1450` 落回 `.modal-mask` 的 `50`，**这顺带修掉一个真 bug**：`1450` 压在自绘标题栏（`#desktop-titlebar` 是 `500`）之上，弹窗开着时窗口控制按钮点不到；`#toast`（`200`）现在也能像其它弹窗那样浮上来。
- **浅色主题下语义色不能直接当文字色。** 「可用」原本是 `#7ee2a8`，在「雪昼白」（`--th-text-strong: rgba(27,49,65,0.96)`、卡片是白的）下白底薄荷字基本看不见。现在写成 `color:var(--th-text-strong,#7ee2a8)`——令牌没设时回落语义色，默认深色主题外观不变，主题在时跟主题正文色走；绿/黄的语义信息移到 `::before` 色点和 `.source-icon` 实心琥珀圆点上，颜色不依赖底色。`.hotkey-kicker` 同理改成 `color:var(--champagne)` + `opacity:.82`（各主题的 `--champagne` 都是可读色，浅色主题是 `#2f718e`）。
- **主题兼容层的 `!important` 会吃掉状态类。** `.pl-card,.queue-item,.mini-queue-item,.pl-detail-row` 那条把 `border` 和 `box-shadow` 都写成 `!important`，所以 `.queue-item.drop-before` / `.drop-after` / `.dragging` / `.next-up` 只要不带 `!important` 就会被整块盖掉——开主题后拖动队列看不到插入位置线。这四条已补 `!important`（同为 `!important` 时按特异性判，`.queue-item.next-up` 的 `0,2,0` 压过 `0,1,0`），并在浏览器里读 `getComputedStyle` 逐条确认过。
- v1.7.25 新增的队列样式是同一个毛病（0 个令牌、写死 `rgba(0,245,212,…)`），一并改掉：`.queue-chip` / `.queue-mode-btn` / `.queue-next-up-*` / `.qi-drag i` / `.queue-archive-*`。`.queue-next-up-row` 是虚线框，所以兼容层那种 `border:1px solid` 的写法不能套上去，它自己走 `var(--th-row-border,…)` 只换颜色不换线型。
- 因为改写后的规则本身就引用 `var(--th-*)`，**没有往 `public/app.css` 的兼容层新增选择器**：兼容层的作用是给「样式里没提令牌」的控件补令牌，重复列一遍只会多一份 `!important` 冲突面。
- 视觉验收方式记录下来备用：起一个只有 `<link href="app.css">` 的临时静态页面，把 `ensureHotkeyModal()` 的真实 markup 贴进去，并用 `?theme=light` 把「雪昼白」那套 `--th-*` 与 `css` 段注入 `:root`，再截图对比两种主题。本轮未启动本机 Electron，未合成鼠标键盘输入。临时页面用完已删除。
- 发布前全量 Node 回归 `712/712`（`main` 基线 `709`）：`tests/global-hotkeys.test.js` 新增 2 例（外壳必须是 `.modal-mask` + `.modal`、tabs 是 `.panel-tab`、按钮是 `.fx-mini-btn`，且 `.hotkey-close` / `.hotkey-head` / `.hotkey-title` 不许残留；`.hotkey-*` CSS 必须覆盖 7 个 `--th-*` 令牌、不许有 `rgba(0,245,212` 与 `z-index:1450`），`tests/playback-queue-power.test.js` 新增 1 例（队列样式同样的令牌与字面量约束，外加三条落点提示 `!important` 断言）。切片锚点：`function ensureHotkeyModal() {` → `function hotkeyStatusMarkup(`、`function renderHotkeyScope(` → `function renderHotkeySettings(`、CSS 从 `.hotkey-dialog{` 到 `/*  歌单/队列面板`、`.queue-chip{` 到 `.pl-card{`。
- 其中一轮 `node --test` 打过一条 `ERR_ASSERTION`（`actual: 0, expected: 1`，栈在 `processPendingSubtests`）但不报失败测试名，之后连跑 6 轮都是 `fail 0`、抓不到复现，判为既有的时序抖动，与本轮 CSS 改动无关；如后续复现再定位。
- tag `v1.7.26` 打在 `c642134`，PR #28 以**合并提交** `16a75b1` 合入 `main`（不能 squash，否则 tag 脱离 `main` 祖先链），`git describe origin/main` = `v1.7.26-1-g16a75b1`。PR 上 `verify` 工作流通过（run `33636144003`）。
- GitHub Actions `Build and Release` run `33636768856` 成功（1m41s），Release 已标记 Latest、非草稿非预发布，四项 Windows x64 资产：`Mineradio-1.7.26-Setup.exe` `101624263` 字节 / SHA256 `26e47a252e9c8b0283fe944e96821aa84a513d568f20ccb8a44c7e826af5d3b7`；`.blockmap` `106108` 字节 / `e390612b249155efd6046961c261e1f71c26a9b65d41ec289bf9f92e2fbf4585`；`latest.yml` `350` 字节 / `a4e1fc09c2b1df97865ace688a769e6158410f7b01dd53a48e83908d89fc4006`（`version: 1.7.26`）；`Mineradio-1.7.26-SHA256SUMS.txt` `275` 字节。不生成 Portable ZIP。三项校验值均已把资产**回下**后逐个复算核对通过，`latest.yml` 里的 `sha512`（`SAfKSn9OK+fsDxQyD/Vv1dBJGMuuJ9cbn7FO4udzDmAWB0jqnID7X2OzlgbRA0i4HNB5FoLj3TmDiGYq8/+d0Q==`）与 `size` 也与实际安装包一致，自动更新清单没有对错文件。
- **`SHA256SUMS.txt` 是 CRLF 换行**（工作流里 pwsh 的 `Out-File` 写出来的），所以在 Linux / macOS / Git Bash 里直接 `sha256sum -c` 会报 `No such file or directory`（文件名尾部多一个 `\r`），要先 `tr -d '\r' < …SHA256SUMS.txt | sha256sum -c -`。资产本身没问题，只是校验文件的换行符；下一版如要改，把 `release.yml` 里那句 `Out-File` 换成 `[IO.File]::WriteAllText($path, ($lines -join "\n") + "\n")` 即可。
- 本轮未启动本机 Electron，未合成鼠标键盘输入，未改动 `_src` / `asar` 重打包；发布用的安装包由 GitHub Actions 远程构建，本地未做安装冒烟。


## v1.7.25 全局快捷键可自定义 + 播放队列升级成队列工作台
- 正式发布版本从 `1.7.24` 提升为 `1.7.25`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:566`）与发布工作流默认 tag 保持一致，`1.7.24` → `1.7.25`。
- 用户原话：「在最新版的基础上更新全局快捷键 比如：Ctrl + Alt + ← 上一首 / Ctrl + Alt + → 下一首 / Ctrl + Alt + ↓ 播放/暂停 / Ctrl + Alt + ↑/↓ 音量 / 用户可自定义快捷键」，随后「更新好快捷键之后再更新更强的播放队列……当前播放队列 / 下一首预览 / 拖动调整队列 / 从队列移除 /「播放完当前歌曲后停止」/「单曲循环」/「队列循环」/ 队列保存/恢复」，最后「全部更新好之后发布新版」。
- **需求自身有一处冲突并已裁定：** `Ctrl+Alt+↓` 同时被列为「播放/暂停」和「音量降低」，一个组合键只能绑一个动作。播放/暂停保留在既有默认 `Ctrl+Alt+Space`，`↑/↓` 留给音量；九个动作都能在设置里改键，想换成方向键的用户先改音量键再把播放/暂停设成 `Ctrl+Alt+↓` 即可。后续版本不要把播放/暂停默认改成 `Ctrl+Alt+↓`。
- **先查再写省了大半工作量。** 全局快捷键系统连默认绑定都已经和需求逐字一致（`HOTKEY_ACTIONS` 的 `Ctrl+Alt+ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` / `Space`），队列侧的「当前播放队列」面板、`removeFromQueue`、`playMode='single'`（单曲循环）、`playMode='loop'`（队列循环）也都已存在。真正新增的是：加速键语法校验与失败分类回报、下一首预览、拖动重排、播完即停、队列存档。
- 快捷键侧的硬化点：录制时先跑 `globalHotkeyRejectReason`，不受支持的键位当场给中文原因，不再先写进配置再静默注册失败；主进程 `isSupportedAccelerator` 按 `ACCELERATOR_MODIFIER_TOKENS` / `ACCELERATOR_NAMED_KEY_TOKENS` / `ACCELERATOR_LITERAL_KEYS` 校验，`globalShortcut.register` 失败按 `conflict.kind: 'unsupported' | 'occupied'` 回报，渲染层用 `scheduleGlobalHotkeyFailureNotice` 把多个失败合成一条提示。`Comma` **不是**合法加速键词元，字面形式是 `,`；专用媒体键（`MediaPlayPause` / `MediaNextTrack` / `MediaPreviousTrack` / `MediaStop` / `VolumeUp` / `VolumeDown` / `VolumeMute`）在 `HOTKEY_KEY_MAP` 里带 `bare:true`，允许不带修饰键单独注册。`MAIN_PROCESS_HOTKEY_ACTIONS` 里的动作（显示/隐藏主窗口）走主进程执行，不依赖窗口焦点。
- **队列存档只存身份、不存内容。** 本地歌曲带不可序列化的 `localFile` File 句柄，所以每首只写 `{key, localKey, pathKey, name, artist}`，恢复时按「localKey → 路径键 → 曲名+歌手」三级回落到活的 `localLibrarySongs` 重新解析，重扫曲库或换盘符后仍能对上，缺失曲目在提示里报数。上限 12 份 / 每份 3000 首。存档键 `mineradio-queue-snapshots-v1` 必须同时进 `public/app.js` 的 `PERSISTENT_UI_STATE_KEYS` 与 `desktop/preload.js` 的同名白名单，且 `var QUEUE_SNAPSHOT_STORE_KEY` 的声明要排在 `PERSISTENT_UI_STATE_KEYS` 数组字面量**之前**，否则数组求值时拿到 `undefined`。
- 恢复随机存档时必须 `shuffledPlayQueueArrays.add(playQueue)`，否则 `playQueueAt` 会把它当新队列再洗一次，存档里的顺序白存。
- `nextQueueIndexPreview()` 每轮渲染只算一次（不是每行一次），并且必须进 `queueVisibleDomSignature`，否则切播放模式或开关播完即停不会重绘——热路径测试 `tests/queue-render-hot-path.test.js` 把「每轮一次」和「模式进签名」两条都钉死了。
- 两个容易漏的副作用：队列内部拖动会冒泡到 `document`，全局「拖文件进来」遮罩要用 `if (queueDragState || !dragEventHasFiles(e)) return;` 挡掉，否则每次调顺序都闪一下；队列为空时有两处会把面板自动切去歌单页（`togglePlaylistPanel` 的 `scheduleUiWarmTask` 与 `renderQueuePanel` 的空队列分支），都要加 `&& !queueSnapshots.length`，否则用户想「恢复队列」反而找不到入口。
- 顺手修掉一个老缺陷：`removeFromQueue` 删除位于 `currentIdx` 之前的条目时没把指针前移，「正在播放」高亮会错位到别的歌上。
- UI 只在 `#queue-pane` 内部增量：`.queue-mode-row` 四个按钮、`#queue-next-up`、行内 `.qi-drag` 握把、`.queue-archive` 存档区；工具条把原来的「切换模式」换成「存队列」（`cyclePlayMode` 保留，仍由 `#play-mode-btn` 触发）。`public/app.css` 新增约 40 行，全部复用既有 `rgba(0,245,212,…)` 青与 `rgba(255,183,94,…)` 警示色。`v1.7.24` 的三标签栏（`当前队列 / 歌单 / 音乐库`）在 `#queue-pane` 之上，未被动到。
- **发布流程上踩的坑：开工前先 `git fetch`。** 本轮先在 `v1.7.18` 的旧本地分支上把两块功能做完并本地提交，才发现远端已经发到 `v1.7.24`（`v1.7.19` 就是那条 OGG/APE/WAV/DSF 提交发的版）。改法是从 `origin/main` 开新分支 `feat/global-hotkeys-and-queue-power` 再 `git cherry-pick`：`public/app.js` 只在 `APP_VERSION` 一行冲突，`public/index.html` / `public/app.css` / `desktop/main.js` / `desktop/preload.js` 全部自动合上，其余冲突只是版本号与文档。旧分支状态留在本地 `backup/queue-power-on-1718`。
- 发布前全量 Node 回归 `709/709`（`main` 基线 `655`）：新增 `tests/global-hotkeys.test.js` 18 例、`tests/playback-queue-power.test.js` 36 例，扩写 `tests/queue-render-hot-path.test.js`、`tests/playback-shuffle-order.test.js`。跨 realm 断言注意：`vm` 里用 `.filter()` / `.map()` 造出来的数组留在 vm realm，`assert.deepEqual`（strict）会判「结构相同但引用不等」，需要先 JSON round-trip。
- tag `v1.7.25` 打在 `3fa7d49`，PR #27 以**合并提交** `9fc73f4` 合入 `main`（不能 squash，否则 tag 脱离 `main` 祖先链），`git describe origin/main` = `v1.7.25-1-g9fc73f4`。
- GitHub Actions `Build and Release` run `33629076628` 成功，Release 已标记 Latest，四项 Windows x64 资产：`Mineradio-1.7.25-Setup.exe` `101624015` 字节 / SHA256 `bc79d2daeb87dc94bd5f6db435ababc7fedbc94c80fdaab0c26ecaee3ab7289d`；`.blockmap` `106037` 字节 / `6bb7108ba4b5554690c8ef9a0e5cc9261c0398ce25142d36e9ac3b6f5433d833`；`latest.yml` `350` 字节 / `b58ca16f86f3015032195a99e2b828c5e7bdab56531eb5c9cf74a521e21a0cae`（`version: 1.7.25`）；`Mineradio-1.7.25-SHA256SUMS.txt` `275` 字节。不生成 Portable ZIP。
- 本轮未启动本机 Electron，未合成鼠标键盘输入，未改动 `_src` / `asar` 重打包。

## v1.7.24 音乐库升级成外层标签页（当前队列 / 歌单 / 音乐库）
- 正式发布版本从 `1.7.23` 提升为 `1.7.24`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:499`）与发布工作流默认 tag 保持一致，`1.7.23` → `1.7.24`。
- 用户原话是「音乐课放外面 当前队列 歌单 音乐库 这样排放」（音乐课＝音乐库的笔误）：上一版把智能分类做成「歌单」页里的第一张卡，用户找不到，本版把它提到与「当前队列」「歌单」并排的外层标签。这是用户明确点名的界面改动，所以覆盖「能不动 UI 就不动 UI」的默认。
- 实现上没有新增第三个面板，而是让「音乐库」与「歌单」共用同一个 `#pl-pane` / `#pl-list` 和同一份 `localLibraryPlaylistSelection`，只在 `switchPlaylistTab` 里做一次选中项迁移：切到 `library` 且选中不是分类 → `LOCAL_LIBRARY_CATEGORY_HOME_KIND`，切回 `playlists` 且选中是分类 → `'library'`（全部音乐），两种迁移各跟一次 `resetPlaylistPanelRenderLimit()`；切到 `queue` 一律不动选中项，所以停在某位艺术家上看一眼当前队列再回来仍在原来那一层。
- **注意 tab 名 `'library'` 与播放列表 kind `'library'`（全部音乐）不是同一层概念**，前者是外层那一整页智能分类、后者是 `normalizeLocalPlaylistKind` 认的一个选中项。
- 最容易踩的坑是递归：`selectLocalPlaylist` 内部会 `safeSwitchPlaylistTab`，而 `switchPlaylistTab` 又会 `refreshUserPlaylists()` → `renderLocalLibraryPlaylistPanel()`，所以 `switchPlaylistTab` 只允许改状态 + 渲染，选中项迁移必须是直接赋值、绝不能反过来调 `selectLocalPlaylist`。
- 第二个坑是「面板正在铺卡片列表」的判断散在四处（3D 歌单架 `currentItems()` 的 `showPlaylists`、`toggleLikeSong` 的刷新、面板打开时的入场动画分支、`switchPlaylistTab` 自己的 `#pl-pane` 显隐与动画），原来全写成 `queueViewTab === 'playlists'`，漏一处音乐库那页就静默不刷新；现在统一收口到新增的 `isPlaylistListTab(tab)`。其中 `toggleLikeSong` 那处必须保留 `typeof isPlaylistListTab === 'function' ? … : queueViewTab === 'playlists'` 守卫——`tests/special-liked-playlist.test.js` 把该函数单独切进 `node:vm` 且只注入 `queueViewTab`，裸调会 `ReferenceError`（第一版改完就红在这里）；为免这条回落被当成先例，`tests/local-library-categories.test.js` 里的断言改成按行过滤，只放过带 `typeof isPlaylistListTab` 的那一行。
- 工具条也是共用的：`applyPlaylistPaneToolbarMode(tab)` 按标签切 `#pl-pane-chip` 文案（`音乐库智能分类` / `本地音乐与独立歌单`）并在音乐库页隐藏 `#pl-pane-create-btn`（「新建」只对独立歌单有意义，「导入」两页都保留）。提到外层后「音乐库」不能出现两遍，所以根视图那张「音乐库」卡删掉（歌单页恢复成 特别喜欢 → 独立歌单 → 全部音乐）、分类首页不再画 `view-head`（`mode === 'home'` 直接只铺 `localLibraryCategoryHomeCardsHtml()`）。
- 顺手纠正一处旧文档措辞：`localLibraryCategoryHeadHtml` 是 `directory ? '' : 播放全部`，**只有歌曲层有「播放全部」**，首页与分组层从来没有；`v1.7.23` 的 README/发布说明写成「每层都带返回与播放全部」并不准确，本版起改用「分组层与歌曲层都带返回按钮，歌曲层还有播放全部」。
- UI 改动面：`public/index.html` 只新增一个 `id="tab-library"` 按钮与两个 id（`pl-pane-chip` / `pl-pane-create-btn`），**`public/app.css` 一行未动**——`.panel-tab` 是 `padding:6px 12px` / `font-size:11px`、`.panel-tabs` 是 `gap:8px`，三个标签合计约 187px，面板 340px 去掉内边距还有 304px，量过装得下才直接加第三个按钮。`queueViewTab` 不持久化、默认 `'queue'`，冷启动仍从当前队列进。
- 发布前全量 Node 回归 `655/655`（`tests/local-library-categories.test.js` 22 → 25 例，新增两例用 `node:vm` 跑真实标签逻辑，切片锚点 `function normalizePlaylistPanelTab(tab)` → `function setMiniQueueOpen(open)`，桩齐 `tab-queue` / `tab-pl` / `tab-library` / `queue-pane` / `pl-pane` / `pl-list` / `queue-list` / `playlist-panel` / `pl-pane-chip` / `pl-pane-create-btn` 十个节点，覆盖两向迁移、`library-value:artist:周杰伦` 经队列标签往返不丢、`local-playlist:abc` 切音乐库落首页、`special-liked` 不被动、`LOCAL_ONLY_MODE` 下 `podcasts` 折成 `playlists` 时选中项归 `'library'`）。
- 资产为**本机** `npm run build:win` 产出后 `gh release create` 一次性上传（`node_modules` 已含 `electron-builder 26.15.3`，`electron 43.4.0` 走系统代理 `127.0.0.1:7897`）；工作流 `Build and Release` 本轮未 dispatch，其默认 tag 已同步为 `v1.7.24` 备用。Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 与 SHA256 清单，不生成 Portable ZIP；四项资产远端 `state=uploaded`。
- 资产大小：`Mineradio-1.7.24-Setup.exe` `101618629` 字节；`.blockmap` `106000` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.24-SHA256SUMS.txt` `272` 字节（远端 API 报告的四项大小与本机产物逐一一致）。
- SHA256：安装器 `15ae98850dbb46ba53124e7eadd13fa0800deafa341a3df9436bf37dec9ae2bc`；`.blockmap` `c7d60d471b3394d94348fec23387b5d91eb93642e45b43ebcac39beae955d1d4`；`latest.yml` `1e68efb998e3a7ca6f66cc0d8ef3094d12a56929b518ecb3507537f0f3c0cab9`。
- `latest.yml` 的版本为 `1.7.24`，`path` 与 `size`（`101618629`）与实际安装器一致；其 Setup SHA512 `W0PVEZPj6Ez2uETRziwd29r9U5y+k6+aoKpe7sn0nbGlr7Ef+gqym6sIhfcs5tUpHofUHCFpm9XvpHmARGc3pg==` 与安装器实测 SHA512 一致。
- 回下载复核范围如实记录：`latest.yml` 与 `Mineradio-1.7.24-SHA256SUMS.txt` 两项已从 Release 下载回来与本机产物逐字节比对（`cmp`）一致；`Setup.exe`（约 `96.9 MiB`）与 `.blockmap` 本轮只核对远端 API 报告的大小，未整包回下载。
- asar 核对：直接在 `dist/win-unpacked/resources/app.asar` 里比对标记串，`var APP_VERSION = '1.7.24'`、`function normalizePlaylistPanelTab(tab)`、`function isPlaylistListTab(tab)`、`function applyPlaylistPaneToolbarMode(tab)`、`id="tab-library"`、`pl-pane-chip`、`pl-pane-create-btn` 全部命中，且 `APP_VERSION = '1.7.23'` 零命中、`queueViewTab === 'playlists'` 只剩 1 处（就是那条 vm 守卫回落）——装进安装器的确实是本版代码。
- 安装器未做代码签名（`build.win.signAndEditExecutable` 为 `false`，仓库未配置证书），`Get-AuthenticodeSignature` 实测 `NotSigned`，与历次发布一致。
- 提交 `c43d0a5 feat: promote the library to a top-level panel tab` 直接落在 `main`（推送为快进，无强推），附注 tag `v1.7.24 音乐库升级成外层标签页（当前队列 / 歌单 / 音乐库）`。
- 发布标题使用 `v1.7.24 音乐库升级成外层标签页（当前队列 / 歌单 / 音乐库）`。

## v1.7.23 音乐库智能分类（艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代 / 播放记录）
- 正式发布版本从 `1.7.22` 提升为 `1.7.23`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:499`）与发布工作流默认 tag 保持一致，`1.7.22` → `1.7.23`。
- 本版把用户点名的十项分类落成三层导航：`library-cat:home` 是音乐库首页，`library-cat:<id>` 是五个歌曲视图（`all` / `recent-added` / `recent-played` / `most-played` / `never-played`），`library-group:<field>` 是五个分组目录（`artist` / `album` / `albumArtist` / `genre` / `decade`），`library-value:<field>:<value>` 是分组里的某一项。所有新 kind 共用 `library-` 前缀并只经 `normalizeLocalPlaylistKind` 一道门，认不出的一律回落 `'library'`，所以浏览状态、播放来源、面板渲染、底部来源按钮与来源选择器都不需要新增第四种选择模型。
- 最关键的两个硬约束：一是 `localPlaylistSongs` 的分支顺序必须是 特别喜欢 → 独立歌单 → 智能分类 → `return localSearchPool()`，因为 `tests/special-liked-playlist.test.js:117` 用 `strictEqual` 钉死 `localPlaylistSongs('library')` 与 `localSearchPool()` 是同一个数组；二是分类模块整段必须落在 `function normalizeLocalPlaylistKind(kind)` → `function localSongIndexByKey(songs, key)` 这对锚点之间，因为三个测试都按这对锚点把真实源码搬进 `node:vm`，切片里出现未注入的裸标识符会抛 `ReferenceError`。跨切片调用（`ensureListenStatsState` / `queueItemKey` / `LOCAL_LIBRARY_NAME_COMPARE`）一律 `typeof` 守卫；`setLocalPlaybackPlaylistSelection` 的持久化门写成内联 `nextSelection.indexOf('library-') !== 0`，因为 `tests/special-liked-playlist.test.js:211` 从这个函数本身起切片、上面的常量切不进来。
- 智能分类只在内存里当播放来源，三处一起兜：`setLocalPlaybackPlaylistSelection` 跳过 `LOCAL_PLAYBACK_SOURCE_STORE_KEY` 写入、`readSavedLocalPlaybackPlaylistSelection` 把历史遗留值读成 `'library'`、`openLocalLibraryQueue` 在分类为空时落回全部音乐。理由是冷启动顺序：播放来源在曲库水合之前被读出，分类那时算出来是 `[]`，会误弹「导入本地音乐」引导。
- 「最近添加」需要入库时间，而 SQLite 曲库表给不了（`FILE_INDEX_COLUMNS` 丢未知字段、`FILE_UPSERT_SQL` 的 keep 分支在指纹变化时清列、`files.seen_at` 每次同步重写、`desktop/local-library-store.js` 无任何迁移代码），所以时间戳放渲染层 `mineradio-local-added-at-v1`，键用 pathKey 而不是含大小与 mtime 的 `localKey`，上限 `4000` 条按时间从新到旧裁。只给 `stats.hasIndex` 为真时的 `localLibraryChangeState === 'new'` 盖章——首次整库导入不盖，否则两万首同一时刻会让这个分类退化成「所有歌曲」；没盖过的回落 `localFileLastModified`。监控路径用 `stampLocalLibraryAddedAtSong` 逐首盖章、`finishLocalLibraryAutoSync` 收尾 `flushLocalLibraryAddedAtMap()` 一次落盘，两处都 `typeof` 守卫因为 `tests/local-library-auto-sync.test.js` 会执行到那段；这个模块**故意插在 `function localLibraryAssetStatus(` 之前**，避开 `tests/local-lyric-cache-residency.test.js` 的切片。
- 性能按既有约定办：五个分组与三个播放统计列表在同一次遍历里算完并存进单槽 `localLibraryCategoryCache`（签名 `length|首localKey|末localKey|listenStats.updatedAt`），`invalidateLocalPlaylistSongLookup()` 末尾追加 `invalidateLocalLibraryCategoryIndex()` 覆盖导入/恢复/自动同步/监控四条路径；分组卡片按 `playlistPanelRenderLimit` 分页并复用面板既有的 `data-pl-load-more`，`localLibraryPlaylistPanelItemCount()` 同时喂给 `growPlaylistPanelRenderLimit` 与 `schedulePlaylistPanelLazyCheck`。`renderLocalLibraryPlaylistPanel` 的 `domSignature` 末尾必须带 `localLibraryCategoryDomSignature(selectedCategory)`，否则早退分支会吃掉重绘。
- UI 改动面：按「能不动 UI 就不动 UI」，根视图只在最上面多一张「音乐库」卡（音乐库 → 特别喜欢 → 独立歌单 → 全部音乐的顺序不变），分类视图复用 `.local-playlist-view-head` / `.local-playlist-view-actions` / `.pl-card`，**`public/app.css` 与 `public/index.html` 一行未动**；`#pl-list` 的点击链里 `data-library-kind-play` → `data-library-kind` → `data-library-back` 必须排在 `closest('.pl-card')` 兜底之前，否则分类卡会被 `openPlaylistPanelDetail` 抢走。
- 发布前全量 Node 回归 `652/652`（新增 `tests/local-library-categories.test.js` 22 例：三层 kind 归一化与非法值回落、带冒号的分组值只切第一处、年代归档与排序、专辑艺术家回落、三个播放统计分类的排序与分区、入库时间盖章条件与裁剪上限、缓存失效、动态分类不落盘、渲染层卡片顺序与点击优先级、`added_at` 不许进 SQLite）。vm 跨 realm 断言前必须 `Array.from` 复制容器，否则 `deepStrictEqual` 会因原型不同判不等；分组顺序断言要显式注入 `Intl.Collator('zh-Hans-CN')`，不注入时 `localLibraryGroupNameCompare` 退成码点比较、顺序与界面不同。
- 资产为**本机** `npm run build:win` 产出后 `gh release upload --clobber` 上传（`node_modules` 已含 `electron-builder 26.15.3`，`electron 43.4.0` 走系统代理 `127.0.0.1:7897`）；工作流 `Build and Release` 本轮未 dispatch，其默认 tag 已同步为 `v1.7.23` 备用。Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 与 SHA256 清单，不生成 Portable ZIP；四项资产远端 `state=uploaded`。
- 资产大小：`Mineradio-1.7.23-Setup.exe` `101616342` 字节；`.blockmap` `106071` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.23-SHA256SUMS.txt` `272` 字节（远端 API 报告的四项大小与本机产物逐一一致）。
- SHA256：安装器 `ec9b1f69f34c59936bd18b07bf3ba2189d9748af87daab8ec6bd323e00031024`；`.blockmap` `51d30498bef59ec2cb40c4a15c89613cb0661b73fbec0cae92bbd52acd421394`；`latest.yml` `ab03bc459703878da13cad3365aaaadf51ac30b385b87648c2ab7380837d3bf8`。
- `latest.yml` 的版本为 `1.7.23`，`path` 与 `size`（`101616342`）与实际安装器一致；其 Setup SHA512 `hEqK5HBQnf0y5PKeOtYWMZ+Xno1DUNotnJdtY277xBDIFpbjxY32aAi/BUwUZfPL1GxGrlWjcbeM8civz/BB3Q==` 与安装器实测 SHA512 一致。
- 回下载复核范围如实记录：`latest.yml` 与 `Mineradio-1.7.23-SHA256SUMS.txt` 两项已从 Release 下载回来与本机产物逐字节比对（`cmp`）一致；`Setup.exe`（约 `96.9 MiB`）与 `.blockmap` 本轮只核对远端 API 报告的大小，未整包回下载。
- asar 核对：直接在 `dist/win-unpacked/resources/app.asar` 里比对标记串，`var APP_VERSION = '1.7.23'`、`library-cat:home`、`mineradio-local-added-at-v1`、`localLibraryCategoryStore`、`LOCAL_LIBRARY_RECENT_ADDED_LIMIT`、`data-library-kind-play` 全部命中——装进安装器的确实是本版代码。
- 安装器未做代码签名（`build.win.signAndEditExecutable` 为 `false`，仓库未配置证书），`Get-AuthenticodeSignature` 实测 `NotSigned`，与历次发布一致。
- 提交 `cc321ee feat: add smart library categories to the local music library` 直接落在 `main`（推送为快进，无强推），附注 tag `v1.7.23 音乐库智能分类`。
- 发布标题使用 `v1.7.23 音乐库智能分类（艺术家 / 专辑 / 专辑艺术家 / 流派 / 年代 / 播放记录）`。

## v1.7.22 真正的音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）
- 正式发布版本从 `1.7.21` 提升为 `1.7.22`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:499`）与发布工作流默认 tag 保持一致，`1.7.21` → `1.7.22`。
- 本版把用户点名的链路顺序 `预设 → EQ → Preamp → Limiter → Spatial → Output` 逐级实现，整段挂在音量均衡之后、`gainNode` 之前：`source → analyser → replayGainNode → audioChain.input …… audioChain.output → gainNode → destination`。可视化与节拍频谱仍取原始电平（画面不会跟着 EQ 忽明忽暗），`gainNode.gain` 继续独占 `targetVolume` 与全部淡入淡出；`initAudio()` 末尾补一次 `applyAudioChainToNodes(true)`，理由与 ReplayGain 那次相同——`attemptAudioPlay` 先 `playLocalQueueItem` 再 `initAudio()`，不补位重建节点后第一下会漏掉音效链。
- 这一版最关键的决定是**整条链常驻音频图、绝不在运行时改接线**，因为每一级都有数学上精确透明的中性值：biquad `gain=0` 是恒等；`DynamicsCompressorNode` 在 `ratio=1` 时压缩曲线退化成直线，且 Blink 的补偿增益 `fullRangeGain = saturate(1.0, k)` 在 slope=1 时 `k→0` 恒等于 `1.0`（查过实现才敢用——若它会补偿，关掉音效链会让所有人的音量默默变化）；`width=1` 的中/侧矩阵逐样本精确还原 L/R。所以关闭音效链不需要断开任何节点，切开关不可能有咔哒声，也不存在「重连时正好赶上音频回调」的竞态。已知取舍并接受：`DynamicsCompressorNode` 恒带约 `6ms` 前置延迟，analyser 抽头因此比输出早约 `6ms`（60fps 下不到半帧）。
- EQ 是 10 段 ISO 频段 `[31,62,125,250,500,1000,2000,4000,8000,16000]`，两端 `lowshelf` / `highshelf` 托住整个低频与高频区、中间八段 `peaking` 且只给 peaking 设 `Q=1`，每段 `±12 dB` 按 `0.5 dB` 取整。预设不存盘、由 `matchAudioChainPreset` 从曲线反推（容差 `0.001`，对不上就是 `custom`）：存预设 id 的话用户拖一下频段 id 就和曲线脱钩，界面会显示「Rock」而声音已经不是 Rock；反推还白送一个能力——把曲线手动改回预设形状会自动认回。
- 自动预增益 `-max(gains)`（Bass Boost 抬 `8 dB` 就先垫 `-8 dB`），与用户 `preampDb` 相加后夹在 `[-24, +12]`；限幅 `ratio=20` / `knee=0` / `attack=3ms` / `release=250ms`，关闭时只把 `ratio` 推回 `1`、`thresholdDb` 归 `0`，不动接线。声场是真中/侧矩阵：`splitter` 的 0/1 都进 `mid`（`0.5`），0 进 `side`、1 经 `sideInvert(-1)` 进 `side`（`0.5`），`side → width → widthInvert(-1)`，`mid` 与 `width` 并进 `merger` 输入 0、`mid` 与 `widthInvert` 并进输入 1。**`widthInvert.gain` 必须恒为 `-1`、只自动化 `width.gain`**：第一版两个都推成 `±state.width`，而 `widthInvert` 是从 `width` 取信号的，宽度会被乘成 `w²`（设 1.5 实际听到 2.25），写代码时自查抓到，源码里留了注释防止后人改回去。
- 音效档案 `xxx.eq.json` 复用既有 `mineradio-export-json-file` / `mineradio-import-json-file` IPC，主进程零改动；导入必须 `format === 'mineradio.eq'` 且能解出频段，`{frequency, gain}` 形式按最接近的 ISO 频段归位（`3.5 kHz → 4 kHz`），纯 dB 数组也收、缺的段补 `0`，不认识的文件一律拒绝（宁可不导入，也不拿别人的格式猜着改声音）。
- 引擎块**故意放在 ReplayGain 的 `node:vm` 切片之外**（自己的锚点是 `var AUDIO_CHAIN_BAND_FREQUENCIES` → `function applyVolumeToAudio(`），`tests/replay-gain-normalization.test.js` 的切片范围一个字节没变。同一个坑长期记着：切片里新增裸标识符会在 vm 抛 `ReferenceError`、被调用方 `.catch` 吞掉（测试全绿但行为已错），所以这段刻意不用 `Array.isArray`（改判 `typeof raw.length === 'number'`）也不用 `Infinity`（改用 `bestDelta = -1` 哨兵）。
- 设置存独立键 `AUDIO_CHAIN_STORE_KEY = 'mineradio-audio-chain-v1'`（已登记进 `PERSISTENT_UI_STATE_KEYS`）而不是 `fx`：`fx` 会随预设与用户存档导入导出，EQ 写进去等于「别人一个预设就能改掉你的音色」；13 个新滑杆一律不在 `bindFxPanel` 的显式 `ids` 白名单里，结构上不可能被写成 `fx` 字段。
- UI 改动面：`public/index.html` 只在 `fx-volume-fold` 之后新增一个与既有折叠区同构的 `fx-eq-fold`（全部复用 `fx-fold` / `fx-toggle-grid` / `fx-toggle` / `fx-section-label` / `fx-seg` / `fx-slider` / `lyric-color-row` / `fx-mini-btn ghost` / `mini-player-collapse-hint`），`public/app.css` 一行未动，`fxPanelTargetForNode` 加一处 `fx-eq-fold` 归到 DIY 高级页。顺手确认一条长期误解：`public/app.css:1416`–`1421` 是无条件规则，`.fx-fold-head` 被 `display:none`、所有 `.fx-fold-body` 恒 `display:block`，`.open` 与折叠头 `onclick` 都是历史残留，所以 `organizeFxPanel` 的强制展开清单对新区块没有视觉意义，故意没加；预设按钮排三行 `fx-seg`（3/3/2）是因为 `.fx-seg{display:flex}` 下 `flex:1` 的按钮在 `11.5px` 字号挤 8 个会压扁。
- 发布前全量 Node 回归 `630/630`（新增 `tests/audio-effect-chain.test.js` 14 例：桩 AudioContext 把每条 `connect` 记成 `id>id:out/in` 字符串逐条比对整张音频图，中/侧矩阵不重写公式验算而是读链路上真实写入的增益值逐样本模拟、宽度 1 必须还原到 `1e-12` 以内，另有预设反推、频段夹取取整、自动余量、限幅与声场旁通语义、`.eq.json` 往返与非法文件拒绝；`tests/replay-gain-normalization.test.js` 的链路断言扩展到音效链两端，`tests/auto-playback-startup.test.js` 的启动链正则放宽一处），并通过 `node --check public/app.js` 与 `git diff --check`。
- 资产为**本机** `npm run build:win` 产出后 `gh release upload --clobber` 上传（`node_modules` 已含 `electron-builder 26.15.3`，`electron 43.4.0` 走系统代理 `127.0.0.1:7897`）；工作流 `Build and Release` 本轮未 dispatch，其默认 tag 已同步为 `v1.7.22` 备用。Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 与 SHA256 清单，不生成 Portable ZIP；四项资产远端 `state=uploaded`。
- 资产大小：`Mineradio-1.7.22-Setup.exe` `101611207` 字节；`.blockmap` `106062` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.22-SHA256SUMS.txt` `275` 字节（远端 API 报告的四项大小与本机产物逐一一致）。
- SHA256：安装器 `742cf3198c5508245742487eb4d97b0a4d46d2b78fc4617af9930072ed3c6fe6`；`.blockmap` `2d25ae3ba3415528658697199d60b1ae006d8f3d75e061c1f06211087e7a55e3`；`latest.yml` `958f8aaa744ecefb77777a91070c99382b429f9197356035de9a49863f31669d`；清单自身 `64feaa7c7b87c75cdf02e72bf629d16e546aa05dbf0c6e2dbe0a0de037967315`。
- `latest.yml` 的版本为 `1.7.22`，`path` 与 `size`（`101611207`）与实际安装器一致；其 Setup SHA512 `mEFxlY5aigyuZX2EkVOHqRB0wNXjPvhc0ln6g/+sFjW+5WZooG8oyoUlzoxPLC2AZSqzIhWJR24MWyDJAFxcWQ==` 与安装器实测 SHA512 一致。
- 回下载复核范围如实记录：`latest.yml` 与 `Mineradio-1.7.22-SHA256SUMS.txt` 两项已从 Release 下载回来与本机产物逐字节比对一致；`Setup.exe`（约 `96.9 MiB`）与 `.blockmap` 本轮只核对远端 API 报告的大小，未整包回下载。
- asar 核对：本机无 7z，改用 Node 直接解 `dist/win-unpacked/resources/app.asar` 的 pickle 头（叶子文件 54 个），`public/app.js` 的 `APP_VERSION` 为 `1.7.22` 且含 `createAudioEffectChain` / `replayGainNode.connect(audioChain.input)` / `audioChain.output.connect(gainNode)` / `mineradio-audio-chain-v1` / `initAudioChainControls()` / `.eq.json` 导入导出，`public/index.html` 含 `fx-eq-fold`、10 个 `eq-band-*` 滑杆与 8 个 `data-eq-preset` 按钮——装进安装器的确实是本版代码。
- 安装器未做代码签名（`build.win.signAndEditExecutable` 为 `false`，仓库未配置证书），`Get-AuthenticodeSignature` 实测 `NotSigned`，与历次发布一致。
- 提交 `83276d6 feat: add a real audio effect chain with EQ presets and .eq.json profiles` 直接落在 `main`（推送为快进，无强推），附注 tag `v1.7.22 真正的音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）` 指向同一提交；Release 先建草稿再上传资产，校验通过后 `gh release edit v1.7.22 --draft=false --latest`，`repos/oirge/Mineradio/releases/latest` 已指向 `v1.7.22`，`releases/latest/download/latest.yml` 回测 HTTP 200。
- 发布标题使用 `v1.7.22 真正的音效链（预设 → EQ → Preamp → Limiter → Spatial → Output）`。

## v1.7.21 音量均衡（ReplayGain）
- 正式发布版本从 `1.7.20` 提升为 `1.7.21`；`package.json`、`package-lock.json`（两处 `version`）、前端 `APP_VERSION`（`public/app.js:497`）与发布工作流默认 tag 保持一致，`1.7.20` → `1.7.21`。
- 本版解决「FLAC 很大声 → 下一首老歌突然很小声 → 再下一首又爆音」：只读文件里已有的 ReplayGain / R128 标签做归一化，不做实时响度分析（实时算响度要完整解码整首歌，几万首的库根本跑不起来，而 foobar2000 / mp3gain / opusenc / rsgain 早就把标签写进文件了），没有标签的歌一律保持原始电平、绝不猜一个增益。
- 音频链路插入独立增益节点 `source → analyser → replayGainNode → gainNode → destination`：必须排在 `analyser` 之后（否则可视化与节拍频谱会跟着均衡忽明忽暗，一首歌被压 `-9 dB` 画面就整首暗一截），必须排在 `gainNode` 之前（`gainNode.gain` 继续独占 `targetVolume` 与全部淡入淡出，`currentAudioOutputGain()` 语义不变）；`attemptAudioPlay` 是先 `playLocalQueueItem` 再 `initAudio()`，所以 `initAudio()` 末尾补一次 `setReplayGainNodeGain(replayGainActive.linear, true)`，否则重建音频节点后第一下没有均衡。
- 增益引擎是纯函数 `resolveReplayGain`：`linear = 10^((gain + preamp)/20)`，防削波按 `min(linear, 1/peak)` 封顶而不是插压缩器（零延迟、不改音色、可单测），峰值标签缺失时与 foobar2000 一致不额外衰减，最后夹在 `0.05`–`4`；整轨与整专辑基准在缺标签时互相回退（峰值跟着基准一起回退），两个增益都没有时 `source='none'` 保持原始电平；Preamp `±12 dB` 按 `0.1 dB` 取整，播放中改设置走 `80ms` 斜坡、切歌立即生效。
- 标签采集不新增 extractor：Vorbis comment（`parseFlacMetadataVorbisPayload` 被 FLAC 与 Ogg Vorbis / Opus / OggFLAC 共用，改一处覆盖全部）、ID3v2 `TXXX` 与新增 `readId3v2Rva2MasterGain`（RVA2 增益 = 有符号 int16 BE `/512` dB，只认主音量声道 `0x01`；`bitsRepresentingPeak` 各家 tagger 归一化不一致，取错峰值会在防削波开启时静默把整首压小，所以故意不取峰值）、APEv2、M4A `----` 加 `readM4aFreeformName`；Opus `R128_*` 按 Q7.8 `/256` 折算并补 `5 dB`（`-23 LUFS` → `-18 LUFS`），`iTunNORM` 响度参考不同故意排除，同一文件里真实 `REPLAYGAIN_*` 靠 `putReplayGainTag` 的首个可解析值胜出压过 R128 折算值；轻量扫描没读全（`_mineradioScanComplete === false`）时整块丢掉而不是写半截错增益。
- 不重扫曲库：刻意绕开 `LOCAL_METADATA_VALUE_FIELDS`（它的 hydration 是真值判定，合法的 `0 dB` 增益会被当成缺失值丢掉），交接改成 `applyLocalMetadataTags` 里两行内联赋值且不计入 `changed`；持久化走 `assets.extra` JSON 列（`mergeExtraFields` 对嵌套对象无损往返），无需数据库迁移、无需升 `LOCAL_METADATA_TAG_SCHEMA`（升版会让整库回落重解析，几万首歌等于开机卡死一轮）；升级前入库的歌由 `ensureLocalReplayGainForSong` 在首次播放惰性补齐一次并写回缓存，确认无标签的置 `localReplayGainResolved` 不再重扫。
- 归一化落在 `extractLocalMetadataTags` 出口的 `finalizeLocalMetadataReplayGain`，而不是放进 `applyLocalMetadataTags` / `ensureLocalMetadataForSong`：后两者落在多个 `node:vm` 测试切片里，切片外的新标识符会 `ReferenceError` 并被这些函数自己的 `.catch` 吞掉（然后照常置 `localMetadataLoaded = true` 并写缓存，测试全绿但行为已经错了）。
- 设置存独立键 `mineradio-replay-gain-v1`（已在 `PERSISTENT_UI_STATE_KEYS`）而不是 `fx`：`fx` 是视觉系统状态，会被预设与用户存档的导入导出带走，别人一个预设就能改掉音量设定；`rg-preamp` 也不在 `bindFxPanel` 的滑杆白名单里，所以永远不会写进 `fx`。
- UI 改动面：`public/index.html` 只在 `fx-playback-fold` 之后新增一个与既有折叠区同构的区块（复用 `fx-fold` / `fx-toggle-grid` / `fx-toggle` / `fx-section-label` / `fx-seg` / `fx-slider` / `mini-player-collapse-hint` 现成类名），`public/app.css` 一行未动；`fxPanelTargetForNode` 与 `relabelFxPanelControls` 各加一处 `fx-volume-fold` 让新区块归到 DIY 高级页，`fx-plugin-fold` 的 fall-through 结果不变、输出等价。
- 发布前全量 Node 回归 `616/616`（新增 `tests/replay-gain-tag-parsing.test.js` 10 例，自建 FLAC / ID3v2 / RIFF / APEv2 / MP4 真实字节夹具，覆盖 R128 折算、RVA2 主声道、`iTunNORM` 排除与轻量扫描未读全；新增 `tests/replay-gain-normalization.test.js` 12 例，用 `node:vm` 跑真实增益实现，最后一例用源码正则钉死链路顺序、存档键与界面入口；`tests/auto-playback-startup.test.js` 两条正则按新增折叠区放宽，仍钉死 `fx-playback-fold` 在 relabel 列表里、`initAutoPlaybackControls()` 紧接启动恢复），并通过 `node --check public/app.js` 与 `git diff --check`。
- 本轮资产改为**本机** `npm run build:win` 产出后用 `gh release upload --clobber` 上传（v1.7.19 / v1.7.20 是 GitHub Actions 远程构建）：本机 `node_modules` 已含 `electron-builder 26.15.3`，`electron 43.4.0` 走系统代理 `127.0.0.1:7897` 下载，`dist/win-unpacked` 与 NSIS 安装器一次通过；工作流 `Build and Release` 本轮未 dispatch，其默认 tag 已同步为 `v1.7.21` 备用。
- Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；四项资产远端 `state=uploaded`。
- 资产大小：`Mineradio-1.7.21-Setup.exe` `101602292` 字节；`.blockmap` `106010` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.21-SHA256SUMS.txt` `275` 字节（远端 API 报告的四项大小与本机产物逐一一致）。
- SHA256：安装器 `ef83cb37fd72f43e45eb7ee0d2af33836adaf51f7aa1b2458ed54321c692dd98`；`.blockmap` `781c1bdd93d3d1aa31820889b0e89a10e66844d7386e4c97dc05cde71bf54327`；`latest.yml` `f78b18e5eec00e6f811e5a458eab501ecf449ab7c15c8bfc12088060e487b162`；清单自身 `ae4744bca9258e33c358f263d348111a548f2f7eb19678013946e3a42cc0e116`。清单内三项与本机产物实测全部 MATCH。
- `latest.yml` 的版本为 `1.7.21`，`path` 与 `size`（`101602292`）与实际安装器一致；其 Setup SHA512 `4Cx/2RG3GCTpJF5ZGYjHihbrXA+uCNwGFaSqCvwVRz/bOfrQM2rArcJkuPptGZ2lQrSKOW8K1xl6kpydPQb3+g==` 与安装器实测 SHA512 一致。
- 回下载复核范围如实记录：`latest.yml` 与 `Mineradio-1.7.21-SHA256SUMS.txt` 两项已从 Release 下载回来与本机产物逐字节比对一致；`Setup.exe`（约 `96.9 MiB`）与 `.blockmap` 本轮只核对远端 API 报告的大小，未整包回下载。
- asar 核对：本机无 7z，改用 Node 直接解 `dist/win-unpacked/resources/app.asar` 的 pickle 头（叶子文件 54 个），内部 `package.json` 版本与 `public/app.js` 的 `APP_VERSION` 均为 `1.7.21`，`public/index.html` 含 `fx-volume-fold`、`public/app.js` 含 `replayGainNode.connect(gainNode)`——装进安装器的确实是本版代码。
- 安装器未做代码签名（`build.win.signAndEditExecutable` 为 `false`，仓库未配置证书），`Get-AuthenticodeSignature` 实测 `NotSigned`，与历次发布一致。
- 提交 `9e4bdef feat: normalize playback loudness with ReplayGain tags` 直接落在 `main`（推送前先 `git fetch` 确认与远端同点，无非快进），附注 tag `v1.7.21 音量均衡（ReplayGain）` 指向同一提交；Release 先建草稿再上传资产，校验通过后 `gh release edit v1.7.21 --draft=false --latest`，`repos/oirge/Mineradio/releases/latest` 已指向 `v1.7.21`。
- 发布标题使用 `v1.7.21 音量均衡（ReplayGain）`。

## v1.7.20 音乐文件夹自动监控
- 正式发布版本从 `1.7.19` 提升为 `1.7.20`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.19` 及更早版本可通过 `latest.yml` 自动更新。
- 本版让设置过的音乐文件夹持续受监控，四类改动即时生效、不必重启：新增歌曲自动入库、删除歌曲自动清理、修改标签自动更新、修改封面自动刷新，右下角报出 `已同步 N 首歌曲`。真正要修的行为缺口在 `applyOwnedLocalLibraryRefresh`——它启动约 `1.2s` 后已经能检测到目录变化，但只要有播放队列就只弹「下次启动会自动同步」然后把本轮扫描结果整个作废；现在改成走 `applyLocalLibraryAutoSync` 的原地增删改。
- 新增 `desktop/local-library-watcher.js`（全依赖注入）：`fs.watch(root, { recursive: true, persistent: false })` + `unref()`（不 unref 会被 watcher 吊住退出流程），防抖 `900ms` 合并整张专辑的上百个事件、最长等待 `4500ms` 不被事件重排以保证长时间拷贝也能中途上报；递归监控不可用的平台降级成 `recursive: false` 只看根目录一层；`EPERM` / `ENOENT`（权限拒绝、移动硬盘掉线）按 `5000ms → 60000ms` 指数退避重试并在设备接回后自动恢复；文件名缺失或积压超 `512` 条置 `overflow` 让渲染层退回整库比对；`normalizeWatchRoots` 去重并丢掉被父目录递归覆盖的子目录，`isWatchRootInside` 只在分隔符边界判定（`E:\Music2` 不属于 `E:\Music`）。
- 同步不打断播放：`localLibrarySongs` 只做原地增删（`playbackSource === 'library'` 时它与 `playQueue` 是同一个数组对象，换数组会让全项目的 `!==` 归属判定一起失效），改动过的歌只改字段不换对象（`currentLocalSong` / `playQueue[currentIdx]` / 迷你播放器 / 桌面歌词握着的引用继续有效），正在播放那首即使文件被删也原位保留、`currentIdx` 按 `indexOf` 重算并夹紧。接管一首时把 `customCoverMap` 从 `local:<旧 localKey>` 迁到新键（`localKey = 路径 + ':' + 大小 + ':' + 修改时间`，不迁移用户手挑的封面就会因一次改标签变成孤儿）、清空 `localUrl`（否则 `ensureLocalSongUrl` 继续返回旧 blob）、旧 blob 交既有 `revokeDiscardedLocalSongObjectUrls` 但跳过正在播放那首（它的 blob 还是 `audio.src`）；标签被删时 `album` / `albumArtist` / `genre` / `trackNumber` / `year` 如实清空而 `duration` 故意保留（避免闪 `0:00`）；有在途解析时本轮不接管、留到下一轮，以免过期结果写不回去。空扫描结果直接早退，不允许「扫到 0 首」清空曲库。
- 安全边界不变：监控根逐个走 `rememberLocalMusicRoot` 授权并原样回报 `rejected`，两个新 IPC `mineradio-local-library-watch-set-roots` / `mineradio-local-library-watch-status` 由 `trustedMainFrameHandler` 包裹，preload 侧只透传数组并返回退订函数；退出时 `closeLocalLibraryWatcher()` 排在 `closeLocalLibraryStore()` 之前。
- 顺手修掉 `.ape` / `.dsf` 一直在 `LOCAL_LIBRARY_EXTS` 扫描白名单里却漏在 `LOCAL_LIBRARY_AUDIO_EXTS` 之外、导致 APE / DSD 被扫到但不计入 SQLite 的 audio 计数与曲库签名的老问题——那正是本版要显示的那个数字。
- UI 改动面：右下角指示器由渲染层懒建 `#local-sync-badge` 挂到 `body`（千分位、`4200ms` 淡出、`role=status` / `aria-live=polite` / `pointer-events: none`），`public/index.html` 一行未动，`public/app.css` 只追加 3 条新规则、没有修改任何既有规则；布局、配色、文案与交互入口零改动。渲染层曲库仍是单根（`LOCAL_LIBRARY_FOLDER_STORE_KEY` 只存一个标量路径），watcher 模块与 IPC 已按多根设计，合并多个根需要重写快照/索引/hydrate/扫描全链路并新增文件夹列表设置面板，本轮明确未做。
- 发布前全量 Node 回归 `594/594`（新增 `tests/local-library-watcher.test.js` 19 例注入 `fs` 与定时器桩、`tests/local-library-auto-sync.test.js` 12 例用 `node:vm` 跑 `public/app.js` 的真实实现、`tests/local-library-watch-wiring.test.js` 5 例静态钉死扩展名集合与主进程/preload 接线，共 +36 例），并通过 `node --check` 对 `public/app.js`、`desktop/main.js`、`desktop/preload.js`、`desktop/local-library-watcher.js`、`server.js` 与 `git diff --check`。
- 推送时遇到 `main` 非快进：远端多出用户在 GitHub 网页上直接提交的 `864412c Update README.md`（删掉首页第一条「删除登录、在线音乐入口、更新提示和无用引导。」）。已 `git fetch` 后 rebase 到该提交之上再推，用户那行删除保留、本版新增的自动监控条目正常落位；`README_EN.md` 里对应的英文那条未动（用户只改了中文 README）。
- Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 和 SHA256 清单；GitHub Actions `Build and Release` run `33587742769` 成功，提交 `946f8b8`，注解 tag `v1.7.20` → `946f8b8` 已推送；GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.7.20` 已正式发布并标记 Latest（非 draft / 非 prerelease），四项资产已上传。发布流程先建 draft、等 workflow 把资产传完并逐项校验后才 `--draft=false --latest`，避免更新检查在没有 `latest.yml` 的窗口里看到新版本。
- 资产大小：`Mineradio-1.7.20-Setup.exe` `101597064` 字节；`.blockmap` `105990` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.20-SHA256SUMS.txt` `275` 字节。
- SHA256（四项资产已回下载逐一实测复核，清单内三项全部 MATCH）：安装器 `89efa9efa50edba9a980964e00c8165b50ba996ecded30552fc3fd62c368209e`；`.blockmap` `00b61ca8af49d10dc66e3382ffd058b7aa3e4933fa3e6cfde746fe11f42c7df4`；`latest.yml` `8ff4b7fcaf9e673b925cdd17999de18722516e5eb1c2260992555c4e2c377211`；SHA256 清单 `8ecb58c172033b6290859223dfaaff3a57d3b60748b468df2902d518e6556e26`。
- `latest.yml` 的版本为 `1.7.20`，`path` 与 `size`（`101597064`）与实际安装器一致；其 Setup SHA512 `nsJmdmSIMZX1n0eThxAiuzU8U8IMAjcwkziQ0mtchcds1MTA8soY167xFKA+teu/J8/BJukeqFp4Q/Priyvrwg==` 与回下载实测一致；Setup.exe 产品版本与文件版本均为 `1.7.20`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- 本轮补做了 asar 打包核对：本机 `npm run build:win:dir` 通过，`app.asar` 内 `version` 与 `APP_VERSION` 均为 `1.7.20`，共 61 个条目；`desktop/local-library-watcher.js` 首次进包（覆盖来自 `build.files` 已有的 `desktop/**/*` 与 `tests/packaging-file-whitelist.test.js` 守卫），watcher 的 `900` / `4500` 双阀门、主进程的 `require('./local-library-watcher')` 与两个监控 IPC、preload 的 `setLocalLibraryWatchRoots` / `onLocalLibraryWatchChanged`、`app.js` 的 `applyLocalLibraryAutoSync` / `reportLocalLibrarySyncedCount` 与 `app.css` 的 `#local-sync-badge` 全部在包内；`index.html` 内不含 badge 痕迹（确认是运行时懒建），`tests/`、`public/index.*.html`、`node_modules/` 与 `dist/` 未漏入，`resources/app.asar.unpacked` 仍只有 `server.js` 与 `package.json`。本轮未启动打包产物（远端构建已通过同一提交同一配置）。
- 发布标题使用 `v1.7.20 音乐文件夹自动监控`。

## v1.7.19 OGG / OPUS / APE / WAV / DSD(.dsf) 格式支持
- 正式发布版本从 `1.7.18` 提升为 `1.7.19`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.18` 及更早版本可通过 `latest.yml` 自动更新。
- 本版把本地播放的格式覆盖面从 MP3 / FLAC / M4A 一系扩展到 Ogg Vorbis / Ogg Opus / Ogg FLAC、WAV（含 RF64 / BW64）、APE（Monkey's Audio）与 DSF（DSD Stream File）：标签、封面、内嵌歌词与时长全部可读，`extractLocalMetadataTags`、`extractEmbeddedCoverSource` 与新增的 `extractEmbeddedLyricsText` 三个分发器按扩展名统一路由，能力判定 `canReadEmbeddedLyrics` / `canReadEmbeddedCover` 与两个可重试判定同步扩展。
- Ogg 系列按页读取并跨页拼接数据包、跳过同文件内其它逻辑流，支持 `METADATA_BLOCK_PICTURE` 与旧式 `COVERART` / `COVERARTMIME`；时长优先取 Ogg FLAC STREAMINFO 的总采样数（此时不读尾部），没有时才回读尾部 `64KB` 找最后一个 granule，Opus 额外扣掉 `pre-skip`。WAV 走 RIFF chunk 目录、`id3 ` chunk 优先且 `LIST`/`INFO` 补齐缺失字段，`RF64`/`BW64` 用 `ds64` 的 64 位 `dataSize` 替换 `0xFFFFFFFF`。APE 分 3.99+ 描述符与 3.98 及更早的推导两条路，标签按 APEv2 页脚 → 文件头 ID3v2 → 尾部 ID3v1 合并。DSF 按 `DSD ` 头部 metadata 指针读尾部 ID3v2，`metadataOffset` 为 0 视为正常无标签、不浪费一次读取。
- APE 与 DSD 现在能直接播放：Chromium 不认识这两种格式，新增 `desktop/audio/wav-stream.js` 把它们包装成「虚拟 WAV 文件」——总长度可精确计算、任意字节区间按需解码，`/api/local-file` 的 Range 请求、416 响应与 `raw=1` 原始字节通道全部照常工作。`desktop/audio/ape-decoder.js` 是纯 JS 的 Monkey's Audio 解码（3800–3990），`desktop/audio/dsf-decoder.js` 用字节查表的 FIR 抽取把 1-bit DSD 转成 PCM，两者都只接受 `read(offset, length)`、不碰文件系统。
- ID3v2 读取保留原 MP3 的 `256KB` 探针语义（探针覆盖整段标签就直接切片复用，只有超出探针才发第二次 Range 读取），MP3、WAV 的 `id3 ` chunk、APE 文件头 ID3v2 与 DSF 尾部 ID3v2 共用；标签超过本轮扫描预算（后台轻量 `4MB`、前台 `24MB`）时统一标记 `_mineradioScanComplete=false` 交前台完整重试，不返回半截结果。
- 授权：`desktop/audio/ape-decoder.js` 是 FFmpeg `libavformat/ape.c` 与 `libavcodec/apedec.c` 的逐行移植，原始条款为 `LGPL-2.1-or-later`，按 LGPL v2.1 第 3 条在本项目内以 `GPL-3.0` 分发；新增根目录 `THIRD-PARTY-NOTICES.md` 记录该声明与 three.js / music-tempo / Inter / GSAP 的条款，并把它与 `LICENSE` 一起纳入 `build.files` 随安装包分发。DST 压缩的 `.dff` 不在本版范围内。
- 发布前全量 Node 回归 `558/558`（新增 `tests/local-format-tag-parsing.test.js` 18 例，用真实字节夹具驱动 `public/app.js` 里的实际解析实现，并用 Range 请求次数钉死读取行为：Ogg FLAC 拿到 STREAMINFO 只读 1 次、Vorbis/Opus 才读 2 次、DSF 超探针只补读 1 次、超预算不发额外读），并通过 `node --check` 对 `public/app.js`、`desktop/main.js`、`server.js` 与 `git diff --check`。
- 本轮补做了 asar 重打包与启动验证：`npm run build:win:dir` 通过，`app.asar` 内 `version` 与 `APP_VERSION` 均为 `1.7.19`，七种格式的 `extractOgg/Wav/Ape/Dsf*` 解析入口与三个解码器齐全，`LICENSE` 与 `THIRD-PARTY-NOTICES.md` 首次进包，`tests/` 与 `public/index.*.html` 未漏入，`asarUnpack` 仍是 `['server.js','package.json']`；以 `MINERADIO_INSTANCE_ID` 隔离档案启动 `dist/win-unpacked/Mineradio.exe`，主进程与 5 个子进程存活、本地服务在 `127.0.0.1` 正常监听、`GET /` 与 `GET /app.js` 均 `200` 且 `APP_VERSION=1.7.19`，stderr 只有 Electron 自带的 `DEP0180 fs.Stats` 弃用警告。验证后已结束进程并删除隔离档案，未触碰主档案 `Mineradio-oirge`。
- 不带 `MINERADIO_INSTANCE_ID` 直接启动 `dist/win-unpacked` 会被判为 primary 实例、userData 落回 `%APPDATA%\Mineradio-oirge`，与已安装实例抢同一把单实例锁后立即 `app.quit()`（表现为「双击没反应」并把已运行窗口唤到前台）；本机验证打包产物必须显式给 `MINERADIO_INSTANCE_ID`，`--user-data-dir` 无效（`desktop/main.js` 启动时 `app.setPath('userData', ...)` 会覆盖该开关）。
- Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 和 SHA256 清单；GitHub Actions `Build and Release` run `33581096535` 成功（2m8s），提交 `9490fde`，注解 tag `v1.7.19` → `9490fde` 已推送；GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.7.19` 已正式发布并标记 Latest（非 draft / 非 prerelease），四项资产已上传。
- 资产大小：`Mineradio-1.7.19-Setup.exe` `101601482` 字节；`.blockmap` `105934` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.19-SHA256SUMS.txt` `275` 字节。
- SHA256（四项资产已回下载逐一实测复核，清单内三项全部 MATCH）：安装器 `602c898df68c52b53e22089dce024b66136047c33c606b373f13f6cf4c357113`；`.blockmap` `91db1311a1879f4622b6c540b7f62f197e95ca64e47c578be0eab17a3214417f`；`latest.yml` `7c6e9e2caca8e601bbf8683ab00ebd2cd76fb6a5649b79e32fdbcfe2ad99b2f6`；SHA256 清单 `6c7a5e2ce21f0491607a73f076a5d26e5a62b2fe7ff2fff6e4e89b0b78f6c5f2`。
- `latest.yml` 的版本为 `1.7.19`，`path` 与 `size`（`101601482`）与实际安装器一致；其 Setup SHA512 `iIMYjWNjn8e0fW0A9PGEaQtLPNrhP0Tzmj2OLjDN01gvj1kcjPIS/pwEGDBL7B2NVKolflK21GopH5/FDfR23Q==` 与回下载实测一致；Setup.exe 产品版本与文件版本均为 `1.7.19`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- 本机无 7z，本轮未解包安装器内 `app.asar` 做明文核对；asar 内容核对是在本地 `npm run build:win:dir` 的产物上做的（与远端同一提交同一配置）。
- 分支状态：tag 与 Release 都落在 `feat/format-support-ogg-ape-wav-dsf` 的 `9490fde`；PR #24 已用**合并提交**（非 squash）合入 `main` → `f8b40fc`，因此 `b07f1bd`（v1.7.18）与 `9490fde`（v1.7.19）两个被 tag 的提交都成为 `main` 的祖先，`git describe origin/main` = `v1.7.19-6-gf8b40fc`，发布溯源保持有效。合并后 `main` 的树与分支头 `265cd61` 逐字节相同（`git diff --stat` 为空），`README.md` / `README_EN.md` 两个 blob 与分支侧同 SHA、无冲突标记——因为 PR #25 与 PR #24 两侧的 README 内容本来就一致。`main` 上 `package.json` `1.7.19`、`APP_VERSION` `1.7.19`，本机 `npm test` `558/558`，GitHub `Verify` run `33582600303` 成功。
- 仓库首页同步（发布后追加）：GitHub 首页 README 从默认分支 `main` 渲染，而 `main` 上的 README 还停在「最新版本 v1.6.2 (2026-08-18)」，格式列表无 APE / DSD、内嵌歌词写成「仅 FLAC」、外置歌词只写 `.lrc` / `.txt`。已开纯文档 PR #25（`docs/readme-sync-1719`，只动 `README.md` / `README_EN.md`，27 个代码文件一个没碰），`verify` 检查通过后 squash 合入 `main` → `4f6e312`；`gh api repos/oirge/Mineradio/readme` 回读确认首页现在渲染的是 v1.7.19 版本的 README（blob `8f72209`）。文案口径对齐代码：内嵌歌词按 `canReadEmbeddedLyrics` 的 `/\.(mp3|flac|ogg|oga|opus|wav|ape|dsf)$/i`，外置歌词按 `LOCAL_LYRIC_FILE_RE` 的 `/\.(lrc|txt|srt|vtt|ass|yrc)$/i`。
- 仓库 About 描述同步（发布后追加）：旧值 `Mineradio 二改本地播放器，原项目: https://github.com/XxHuberrr/Mineradio` 未提任何格式，已 `gh api -X PATCH repos/oirge/Mineradio -f description=...` 换成含完整格式列表的版本并保留原项目署名；`homepage`（仍指向原项目）与 `topics`（仍为空）未改动，需要回退只用同一条命令写回旧值。
- 发布标题使用 `v1.7.19 OGG / OPUS / APE / WAV / DSD(.dsf) 格式支持`。

## v1.7.18 本地曲库改用 SQLite + 文件指纹/路径索引
- 正式发布版本从 `1.7.17` 提升为 `1.7.18`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.17` 及更早版本可通过 `latest.yml` 自动更新。
- 本版把本地曲库落到 `node:sqlite`（Electron 自带，零新增依赖、无原生模块重编译）：新增 `desktop/local-library-store.js`，用户数据目录下建 `local-library.db`，WAL 日志 + `PRAGMA user_version` 迁移 + `BEGIN IMMEDIATE` 事务；行身份由文件指纹 `pathKey|size|mtime` 决定，保存歌曲 ID、路径、大小、修改时间、时长、格式、Artist / Album / Genre / Year、封面缓存、歌词缓存、播放次数、最近播放和收藏状态。
- 扫描无快照时先问数据库走增量，只 `stat` 变化过的目录；索引改为按行 FNV-1a 摘要增量回写；解除旧快照与旧索引的 `16000` 条截断（旧逻辑超限后只计数不入库，签名仍匹配，等于静默丢歌），仅数据库不可用的回落路径保留旧上限。
- `(root_id, song_key)` / `(root_id, fingerprint)` 组合索引修掉查询计划陷阱：只有单列索引时索引回写会退化成按 `root_id` 整根扫描，两万行实测 `295,319ms` → `1,640ms`（约 180×），已用 `EXPLAIN QUERY PLAN` 断言钉死。
- 播放次数与收藏状态双写进库但只在原有有效收听门内累加一次，`localStorage` 的听歌统计与「特别喜欢」引用表仍是唯一权威来源、无回读路径，因此不存在双计数；界面布局、样式、文案与交互入口零改动。缺 `node:sqlite` 时主进程与渲染层各自一次性 latch 降级回 IndexedDB 旧路径。
- 发布前全量 Node 回归 `540/540`（新增 `tests/local-library-sqlite-store.test.js` 12 例、`tests/local-library-db-bridge.test.js` 9 例），并通过 `node --check` 对 `public/app.js`、`desktop/main.js`、`desktop/preload.js`、`desktop/local-library-store.js`、`server.js` 与 `git diff --check`；本轮不启动本机 Electron、不合成鼠标键盘输入、不修改 `Mineradio-sync`。
- Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 和 SHA256 清单；GitHub Actions `Build and Release` run `33494043918` 成功（1m49s），提交 `b07f1bd`，注解 tag `v1.7.18` → `b07f1bd` 已推送；GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.7.18` 已正式发布并标记 Latest（非 draft / 非 prerelease），四项资产已上传。
- 资产大小：`Mineradio-1.7.18-Setup.exe` `101547905` 字节；`.blockmap` `106000` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.18-SHA256SUMS.txt` `275` 字节。
- SHA256（四项资产已回下载逐一实测复核）：安装器 `544c75a1339bc285ed758ca4d8bd8e2d4abff1007a947a75a354fd0b78e7a42a`；`.blockmap` `940a2d695e80a5d6bc4b431c4e56de05f194db9ef19b2b23d435bdac3880795a`；`latest.yml` `be4152ba8bdf86a65690760c63a8d12decf86429761f67231998f33fb4b7a7bd`；SHA256 清单 `5a185d3efae5ddda7f6bf34c87310650de425f87df63d6fe1be362039b5a94ae`。
- `latest.yml` 的版本为 `1.7.18`，`path` 与 `size` 与实际安装器一致；其 Setup SHA512 `kvOE3xLL7vs4iUCbzXLY1IlPdc43zJEL9k8x7UQ+0WmUHLIxnm+SUPAtlge8an3TjN0MFFk7AQBtflueAD8LPA==` 与本地实测一致；Setup.exe 产品版本 `1.7.18`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- 新增 `desktop/local-library-store.js` 的打包覆盖来自 `build.files` 已有的 `desktop/**/*` 与 `tests/packaging-file-whitelist.test.js` 守卫，`asarUnpack` 仍是 `['server.js','package.json']`；本机无 7z，本轮未解包安装器内 `app.asar` 做明文核对。
- 发布标题使用 `v1.7.18 本地曲库改用 SQLite + 文件指纹/路径索引`。

## v1.7.17 迷你播放器封面命中与右键竞态修复
- 正式发布版本从 `1.7.16` 提升为 `1.7.17`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.16` 及更早版本可通过 `latest.yml` 自动更新。
- 本版修复收回态封面热区命中后的右键竞态：renderer 优先通过 `mineradio-mini-player-set-pointer-passthrough-sync` 同步解除原生穿透，主进程在返回前完成 `setIgnoreMouseEvents(false)`；旧异步通道仅作兼容回退，失败仍可重试。
- 两套迷你页面的 `.mini-shell` 固定为 `no-drag`，右键主要由 renderer `context-menu` 接管，窗口移动通过独立 `mineradio-mini-player-window-move-by` IPC；`system-context-menu` 仅保留为可信主 frame 的平台兜底。
- 标准收回态命中边界仍是封面热区外扩 `6px`，封面外透明区交还桌面；标准展开态与极简外壳整窗可右键，菜单继续与托盘六项一致。
- 发布前全量 Node 回归 `519/519`，并通过 `node --check desktop/main.js`、`node --check desktop/mini-player-preload.js`、`node --check server.js` 和 `git diff --check`；本轮不启动 Electron、不合成鼠标键盘输入、不修改 `Mineradio-sync`。
- Windows x64 NSIS 仍只发布 `Setup.exe`、`.blockmap`、`latest.yml` 和 SHA256 清单；GitHub Actions `Build and Release` run `33469762872` 成功，提交 `67b837e`；GitHub Release `https://github.com/oirge/Mineradio/releases/tag/v1.7.17` 已正式发布并标记 Latest（非 draft / 非 prerelease），四项资产已上传。
- 资产大小：`Mineradio-1.7.17-Setup.exe` `101533166` 字节；`.blockmap` `105929` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.17-SHA256SUMS.txt` `275` 字节。
- SHA256：安装器 `f5e8cf50a1b69cf80ef9844aaab54646a19a863f3cdabc9304d943e83ab2b0f4`；`.blockmap` `5a86cca7a3971090f84ccd7f31dc32a2a75bc4e3a2c2cea78d2f6b4364bb69e5`；`latest.yml` `046384cad50ec39a72be9ad34632a515176166828a55275ba748bb82d7087535`；SHA256 清单 `4ea69fc48eee779e5e63a0b3e01537ea8f529bb9c4305af77402e1e78cda6a5f`。
- `latest.yml` 的版本为 `1.7.17`，Setup 路径和大小匹配；Setup.exe 产品版本 `1.7.17`，其 SHA512 为 `pYtJ+djhRP2Eoin+Z6Vag9OhkXTTWVlFHSbyLmmtwQFF8scDyQxDs5P0CFLen+hcJNdMHVJNmzWfl9sC2IYNVQ==`。
- 发布标题使用 `v1.7.17 迷你播放器封面命中与右键竞态修复`。

## v1.7.16 迷你播放器右键命中与安全边界加固
- 正式发布版本从 `1.7.15` 提升为 `1.7.16`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.15` 及更早版本可通过 `latest.yml` 自动更新。
- 本版固定右键语义：标准收回态只有封面热区（外扩 `6px`）可点可右键，透明空白交还桌面；标准展开态和极简外壳整窗可右键；可交互窗口均使用与任务栏托盘一致的六项菜单。
- 本版补齐封面拖动首个增量、换边连续、跨显示器移动与显式展开方向持久化，并加固迷你页面 URL/frame/preload 信任边界；极简模式不再传输封面和脉冲负载，失败穿透 IPC 可重试。
- 发布工作流在构建前校验输入 tag 与 `package.json` 版本一致，依赖安装改用 `npm ci`；SHA256 清单和资产上传启用严格错误处理并拒绝缺失文件，避免错版或不完整资产进入 Release。
- 发布前本地 Node 回归 `514/514`；未启动本机 Electron、未合成鼠标键盘输入；Windows x64 NSIS 仍只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，正式构建与资产摘要在远程发布后补录。
- 发布标题使用 `v1.7.16 迷你播放器右键命中与安全边界加固`。

## v1.7.15 主题插件差异化与雪昼白主题
- 正式发布版本从 `1.7.14` 提升为 `1.7.15`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.14` 及更早版本可通过 `latest.yml` 自动更新。
- `深海微光`、`暗焰余晖`、`冷杉夜雾` 升级为三份独立的完整主题，分别使用蓝青、熔岩红、冷杉绿的背景、面板、文字、控件和迷你播放器变量；新增完整浅色主题 `雪昼白`。六份内置主题均默认不启用并保持互斥。
- 发布前主题专项回归 `35/35`、干净 release worktree 全量 Node 回归 `485/485`；关键 JavaScript 语法检查与 `git diff --check` 通过。Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布标题使用 `v1.7.15 主题插件差异化与雪昼白主题`。
- 本地 Windows x64 NSIS 构建产物：`Mineradio-1.7.15-Setup.exe` `101520385` 字节；`.blockmap` `105947` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.15-SHA256SUMS.txt` `275` 字节。
- SHA256：安装器 `0dfae05d4222dd176e07a29450d2849604db5673931ad336a2f4fc90a8ada4b1`；`.blockmap` `4d6ce2543f9dbfd8d099e2b0df5701ce122976cbf4ac45543eef7f4e85488b15`；`latest.yml` `3bac837fe23c1c00c36a7ed289b17b0cdaae2f1d47f8805ddc2b003c197ad1f6`。
- `latest.yml` 的 Setup SHA512：`/yEHOpyc3X00GLPOuKtdJlYm3dkRM8aM+kqqSHa6hflJUEr3XDlr9W9P9tNrsIkUogtxzmS52d/gdJoNQS5g/Q==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.15` 已正式发布（非 draft / 非 prerelease），四项资产已上传，远端 `latest.yml` 版本为 `1.7.15`；标签目标提交为 `e9a9e0b`。

## v1.7.14 收回后的迷你播放器只在封面上吃鼠标
- 正式发布版本从 `1.7.13` 提升为 `1.7.14`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.13` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是收回态命中范围回退：`shouldPassPointerThrough()` 判据从 `pointerInsideWindow` 改回 `pointerInCoverHotRegion`，收回态只有封面热区（外扩 6px）参与命中，封面以外那截透明窗体交还桌面，`pointerInsideWindow` 变量删除；展开态与极简外壳整窗仍可点可右键，v1.7.13 的托盘同构 6 项菜单不变。
- 发布前运行全量 Node 回归（483/483）、`node --check server.js` 与 `git diff --check`；`tests/mini-player-visual.test.js` 两条穿透用例已改回热区时序（收回态空白处 `mousemove` 必须保持穿透）。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.14 收回后的迷你播放器只在封面上吃鼠标`。
- 远端构建产物：`Mineradio-1.7.14-Setup.exe` `101519285` 字节；`.blockmap` `105972` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.14-SHA256SUMS.txt` `275` 字节。
- SHA256：安装器 `39f7dca466cf9c054b793b4d18dfe423b4ecfca8e526a8dd02bc4f21d176ee9d`；`.blockmap` `400ff7496b96bd193aefcef1b3faa156251ece423f20d9fe74b9271dc320e00c`；`latest.yml` `7d6b44895d86e6b0527f6fc3275b65a4e42a74d753ae38a2e84a0396bd1c453e`。
- `latest.yml` 的 Setup SHA512：`XST+mNWswps8ADEiuVbcl1Wp44YftUw9CsFzGB091v553yXvSM0GDHV82nC+f++LJnkdGHP6JMLmPqjwtsp+PA==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.14` 已标记 Latest（非 draft / 非 prerelease），四项资产齐全，远端 `latest.yml` 版本为 `1.7.14`；构建工作流 run `33243994690` success。提交 `9d9b895` 已推送，注解 tag `v1.7.14` 已推送。

## v1.7.13 迷你播放器右键菜单与任务栏托盘完全一致
- 正式发布版本从 `1.7.12` 提升为 `1.7.13`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.12` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是迷你播放器右键菜单对齐：托盘与迷你共用 `buildAppContextMenuTemplate()` 的六项菜单，勾选态实时读真实设置；新增 `win.on('system-context-menu')` + `preventDefault()` 拦掉拖拽区的窗口系统菜单（迷你窗口不可缩放/最小化/最大化，那份系统菜单只剩「关闭」可点），非拖拽区仍走 `webContents.on('context-menu')`；两套外壳共用窗口工厂，极简同样整窗可右键。
- 发布前运行全量 Node 回归（483/483）、`node --check desktop/main.js`、`node --check server.js` 与 `git diff --check`。OS 级拖拽区右键无法在禁用合成输入的前提下自动验证，靠 `system-context-menu` 类型签名与单测挂接断言兜底。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.13 迷你播放器右键菜单与任务栏托盘完全一致`。
- 远端构建产物：`Mineradio-1.7.13-Setup.exe` `101519427` 字节；`.blockmap` `105854` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.13-SHA256SUMS.txt` `275` 字节。
- SHA256：安装器 `bd04b51b47d8a0f470d9ccbbda754ce16f57207198caa82a80963b972346a1a8`；`.blockmap` `67ce19467c2433adc9b1f9fbfbb6ed24ba718f387236485f7464fddb9c6b9b98`；`latest.yml` `da76fc578157769bf7f5f03ebbf3206c38a7a1a9abd0765674c249212be35bcb`。
- `latest.yml` 的 Setup SHA512：`1TaQ2NQVad91NAwMZAvEACLMID5s5wyjXYLzoLEwLiAEMw5nYeKkqDR3nW16v6OTk87ujqqRs7Lh8CWGgYjnJQ==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.13` 已标记 Latest（非 draft / 非 prerelease），四项资产齐全，远端 `latest.yml` 版本为 `1.7.13`；构建工作流 run `33243112462` success。提交 `067ac7d` 已推送，注解 tag `v1.7.13` 已推送。

## v1.7.12 迷你播放器整窗可右键
- 正式发布版本从 `1.7.11` 提升为 `1.7.12`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.11` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是迷你播放器交互修复：收回态穿透规则改为「指针在窗口内 = 整窗可交互，离开窗口 = 恢复穿透」，任意位置都能右键弹菜单；封面热区仍负责悬停展开；极简外壳零改动。约定文档与两条穿透回归用例同步改写。
- 发布前运行全量 Node 回归（480/480）与 `git diff --check`；核验 asar 内 `public/mini-player.html` 含 `pointerInsideWindow`（5 处）。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.12 迷你播放器整窗可右键`。
- 本地构建产物：`Mineradio-1.7.12-Setup.exe` `101519159` 字节；`.blockmap` `106053` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.12-SHA256SUMS.txt` `272` 字节。
- SHA256：安装器 `ecdd30da9bbd5c87da581bc7ad5781134bea2ad79add3ec095f92cc492f714fc`；`.blockmap` `acd2dd0b31f977a73d4a0a596c3ba36888653b8136f1c70b698c2a3b8beed245`；`latest.yml` `db195a72c2c2a52eb3212cf14219b165ab559a0c41ef07299a1026598c0208f4`。
- `latest.yml` 的 Setup SHA512：见远端 `latest.yml`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.12` 已标记 Latest（非 draft / 非 prerelease），四项远端资产大小与本地构建一致、SHA256 逐项一致，远端 `latest.yml` 版本为 `1.7.12`。提交 `6589f64` 已同时推送到 `codex/mini-cover-static` 与 `main`（快进），注解 tag `v1.7.12` 已推送。

## v1.7.11 迷你播放器支持右键菜单
- 正式发布版本从 `1.7.10` 提升为 `1.7.11`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.10` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是迷你播放器交互增强：右键弹出与托盘一致的原生菜单（`显示播放器` / `迷你播放器样式` 标准/极简 radio / `退出播放器`），三种动作分别与恢复按钮、托盘样式子菜单、托盘退出完全同路径；标准与极简外壳共用 `createMiniPlayerWindow` 一处挂接；收回态穿透期间右键自然落不到窗口。迷你页面 DOM 零改动。
- 发布前运行全量 Node 回归（480/480）、`node --check desktop/main.js` 与 `git diff --check`；隔离实例冒烟：开启迷你 → 最小化主窗口 → 迷你窗口加载健康（`readyState:complete`、`#mini-shell` 存在）；核验 asar 内 `desktop/main.js` 含 `showMiniPlayerContextMenu`（2 处：定义 + 挂接）。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.11 迷你播放器支持右键菜单`。
- 本地构建产物：`Mineradio-1.7.11-Setup.exe` `101518157` 字节；`.blockmap` `105933` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.11-SHA256SUMS.txt` `272` 字节。
- SHA256：安装器 `5f58cd77f8550ad347bc5b7ef7b4668794d8f88304acf307550e47da9c46d896`；`.blockmap` `b782071635f04753fcf92f9b9eb49f3ab0a00f80913f4a7eae42d5cf30b96c89`；`latest.yml` `8f1940affde76b5074ef53780218b5e348a2d2e4045ca6c9a7d41506cf8db00c`。
- `latest.yml` 的 Setup SHA512：`1XQAIC5cv/Dr3QYtHMBe3KzOg6JlBwKY+69aE++DAx9DzJc0wr18u5AsPyTqwu0NmFApc7tKH64W/ZUcN0JeTw==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.11` 已标记 Latest（非 draft / 非 prerelease），四项远端资产大小与本地构建一致、SHA256 逐项一致，远端 `latest.yml` 版本为 `1.7.11`。提交 `009bdc9` 已同时推送到 `codex/mini-cover-static` 与 `main`（快进），注解 tag `v1.7.11` 已推送。

## v1.7.10 搜索结果面板有了入场动画
- 正式发布版本从 `1.7.9` 提升为 `1.7.10`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.9` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是交互打磨：`#search-results` 搜索结果面板原为 `display:none → block` 硬切，现挂 `search-results-in` 入场动画（260ms，opacity/transform，缓动与搜索区下滑同族）；玻璃滤镜与配色零改动，`prefers-reduced-motion` 跳过。app.js 零改动。
- 发布前运行全量 Node 回归（477/477）与 `git diff --check`；核验 asar 内 `public/app.css` 含 `search-results-in`（2 处：.show 规则 + keyframes）。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.10 搜索结果面板有了入场动画`。
- 本地构建产物：`Mineradio-1.7.10-Setup.exe` `101519374` 字节；`.blockmap` `105968` 字节；`latest.yml` `350` 字节；`Mineradio-1.7.10-SHA256SUMS.txt` `272` 字节。
- SHA256：安装器 `49bf58991e0802ffc3f269c1bc5814f7cf5e9d93c37bb611b10efe9101ce6028`；`.blockmap` `33c16557618ac7bcec328fbc6ec471c487c5359bd86b0e7bc5736f79ca1abe1e`；`latest.yml` `163def84b0febb5d0f5b32a80e5d2de222dd0a5fda2e0dcf40095e88cac62935`。
- `latest.yml` 的 Setup SHA512：`X86qauFXNg2ADPIuQLN55E+PGwz/UPLE4FE4ykSu6HpkjhEZdavPUW52CMZuZMv6a1Cl6OOAaU4Dpr1/0+FYag==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.10` 已标记 Latest（非 draft / 非 prerelease），四项远端资产大小与本地构建一致、SHA256 逐项一致，远端 `latest.yml` 版本为 `1.7.10`。提交 `3566dc6` 已同时推送到 `codex/mini-cover-static` 与 `main`（快进），注解 tag `v1.7.10` 已推送。

## v1.7.9 每次启动省掉两趟隐藏窗口空转
- 正式发布版本从 `1.7.8` 提升为 `1.7.9`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.8` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是启动优化：`migratePrimaryProfileState()` 在稳态（旧档迁移已完成 + 本地服务端口没变）下短路跳过隐藏窗口的 `localStorage` 读+写空转（微基准一趟写 `~113ms` / 读 `~20ms+`），打包版每次启动省约 `130~150ms`；新增 `ui-state-origin-marker.json` 记录上次迁移目标 `origin`。端口变化或旧档待迁移仍走完整路径，`preload` 文件兜底不变。渲染进程、界面、交互零改动。
- 发布前运行全量 Node 回归（474/474）、`node --check desktop/main.js` 与 `git diff --check`；核验 `dist/win-unpacked/resources/app.asar` 内 `desktop/main.js` 含 `readLastMigratedUiStateOrigin` 稳态短路。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.9 每次启动省掉两趟隐藏窗口空转`。
- 本地构建产物：`Mineradio-1.7.9-Setup.exe` `101520093` 字节；`.blockmap` `105906` 字节；`latest.yml` `347` 字节；`Mineradio-1.7.9-SHA256SUMS.txt` `270` 字节。
- SHA256：安装器 `099c967c35e25d2e4137b6e4fb348b51a53aff82f8423842761cb8e8f14373bf`；`.blockmap` `0d4e9011a18484ba0846fe41306e55c7dfb6c124d3e85e67a7ffe96a76feb9c0`；`latest.yml` `548a35c26e42c5fd9b7e9b2607e6f4325680747c5ec1c9ad166f09d72d840a50`。
- `latest.yml` 的 Setup SHA512：`I+ekyEfzRPpguwhGF1gKGT6zv9p/Jvu0OES7whtuq6630IRQHNfJX9bzwdbd/xFC+wNnPwDYq4BYGPY98Rvr/g==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.9` 已标记 Latest（非 draft / 非 prerelease），四项远端资产大小与本地构建一致、SHA256 逐项一致，远端 `latest.yml` 版本为 `1.7.9`。提交 `594e06e` 已同时推送到 `codex/mini-cover-static` 与 `main`（快进），注解 tag `v1.7.9` 已推送。

## v1.7.8 启动首帧不再被 vendor 脚本卡住
- 正式发布版本从 `1.7.7` 提升为 `1.7.8`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 保持一致，`1.7.7` 及更早版本可通过 `latest.yml` 自动更新。
- 本版是启动优化：`public/index.html` 的 `three.js` / `gsap.min.js` 两个阻塞脚本从 `<head>` 挪到 `</body>` 前、`app.js` 之前，相对执行顺序不变（`app.js` 顶层就实例化 `THREE` 场景）；`server.js` 对 `/vendor/*` 发 `public, max-age=604800`，其余静态文件仍 `no-cache`。默认外观与交互零改动。
- 发布前运行全量 Node 回归（473/473）、`node --check server.js`、`node --check public/app.js` 与 `git diff --check`；核验 `dist/win-unpacked/resources/app.asar` 内 `index.html` 的脚本顺序为移动后的版本。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `v1.7.8 启动首帧不再被 vendor 脚本卡住`。
- 本地构建产物：`Mineradio-1.7.8-Setup.exe` `101520204` 字节；`.blockmap` `105845` 字节；`latest.yml` `347` 字节；`Mineradio-1.7.8-SHA256SUMS.txt` `270` 字节。
- SHA256：安装器 `026e5b835795b3ec8b95b70d9ba0eda1777d5dc5efb3aca7adb86ace487f3d34`；`.blockmap` `adc7763c489e00bd999df48f8f6848c361c683bfa771d547d0636e271523ede4`；`latest.yml` `35cb2a27423e22e2c1fc8fc82bbd4e7e99b9d81bb91d1e5f0d10d145b51f1f45`。
- `latest.yml` 的 Setup SHA512：`X377s+bshHKte/fgCeGgfj1jxFcMqtnmqQfqFn4LBVhv5vzK8MwGWaw5JMksmNXh7jPFqT479MZdqn+CPoimzQ==`。本版本不生成跨版本轻量补丁和 Portable ZIP。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.7.8` 已标记 Latest（非 draft / 非 prerelease），四项远端资产大小与本地构建一致，远端 SHA256 与本地逐项一致，远端 `latest.yml` 版本为 `1.7.8`。提交 `df0fb2f` 已同时推送到 `codex/mini-cover-static` 与 `main`（快进），注解 tag `v1.7.8` 已推送。

## v1.7.5 主题可轻调背景，并新增三份背景主题
- 正式发布版本从 `1.7.4` 提升为 `1.7.5`；`package.json`、`package-lock.json`、前端 `APP_VERSION` 与发布工作流默认 tag 必须保持一致，使 `1.7.4` 及更早版本可通过 `latest.yml` 自动更新。
- 主题新增 `--th-bg-color` / `--th-bg-tint` / `--th-bg-tint-opacity` 三个默认背景变量；用户自定义纯色、图片、视频、Wallpaper Engine 与「播放器背景板」继续优先，主题不得覆盖用户背景。
- 午夜靛蓝、暖琥珀与石墨主题升到 `1.5.0`；安装包新增 `深海微光` / `暗焰余晖` / `冷杉夜雾` 三份纯背景主题，自带主题总数为五份且默认都不启用。
- 发布前运行全量 Node 回归、`node --check server.js`、`node --check public/app.js` 与 `git diff --check`，并实际检查默认背景、五份内置主题、自定义背景及 Wallpaper Engine / 播放器背景板的图层让位。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP；发布标题使用 `Mineradio v1.7.5 主题可轻调背景，并新增三份背景主题`。
- 本地构建产物：`Mineradio-1.7.5-Setup.exe` `101513979` 字节；`.blockmap` `105842` 字节；`latest.yml` `347` 字节；`Mineradio-1.7.5-SHA256SUMS.txt` `273` 字节。
- SHA256：安装器 `8c4456df71e3d19576f2770b3ce63ed40681f8b948670aa91d1ec4c5b3938998`；`.blockmap` `891b44d76812774a19d1fb77791221679b77124bcaae7f4136595608a41bd0b2`；`latest.yml` `e56a00e15788587a5de2a5e8ce1c0c09c2fe870b244f5964514e5e9254b9bbab`；SHA256 清单 `273` 字节。
- `latest.yml` 的 Setup SHA512：`h8W0CFH+vaWbOwiuCz9vWfz1wlRyHxGQtuebvnZCz/VaKuKm60MnsabHPOXE8fkWJtPZEWvP/2TQmJ3uBDNS6g==`。本版本不生成跨版本轻量补丁和 Portable ZIP。

## v1.6.2 修复搜索结果面板自动弹出
- 正式发布版本从 `1.6.1` 提升为 `1.6.2`；构建时同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.6.1` 及更早版本的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 修复本地曲库恢复、导入、清空和后台资产补水路径调用空查询渲染时自动给搜索结果加上 `show` 的问题。
- 新增 `refreshVisibleLocalLibraryResults()`，只有搜索结果面板已经由用户打开时才刷新；用户点击搜索框后仍正常显示结果。
- 移除未提交的迷你播放器实验改动，保持 `v1.6.1` 的迷你播放器、桌面歌词和窗口生命周期行为不变。
- 全量 Node 回归 `412/412`；关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 本地构建产物：`Mineradio-1.6.2-Setup.exe` `101492065` 字节；`.blockmap` `105907` 字节；`latest.yml` `347` 字节。
- SHA256：安装器 `6010b5503c37ad6bff1d3bbbc932a67141b3f75814f38979d21b1814d65e3ea7`；`.blockmap` `6e6be00b2c1cdbc7c62c38bc8ae1d14414fe4983f9a4983503fb1b01b422bfb0`；`latest.yml` `2c63ab7717e864a8248b9fd873119ec57f07ed278300aad72323944ce7380198`。
- `latest.yml` 的 Setup SHA512：`KznAhMWq6ZqDmocI10A6bVXei1a8z9cy4u5xtpdBSCiwBOMVM0bjqRnDB+bNW+yAPPOPyAaXOPi5jpUfCSTfmg==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.6.2` 已标记 Latest；annotated tag 解引用到提交 `03dfbbf1e6f168a76c25466df415cf8ae6496702`，四项远端资产均为 uploaded，大小与本地构建一致，远端 SHA256 与本地一致。

## v1.6.1 扩展本地音乐格式支持
- 正式发布版本从 `1.6.0` 提升为 `1.6.1`；构建时同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.6.0` 及更早版本的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 新增 `MP2`、`M4B`、`AIF`、`AIFF`、`AIFC` 音频后缀的播放器识别、文件夹扫描、文件选择器和本地代理 MIME 支持。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 全量 Node 回归 `411/411`，关键 JavaScript 语法检查与 `git diff --check` 通过。

## v1.6.0 修复迷你播放器封面律动与光晕无反应
- 正式发布版本从 `1.5.9` 提升为 `1.6.0`；构建时同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.9` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 根因是标准迷你播放器隐藏播放时，低平滑 `beatAnalyser` 在后台切换或 `AudioContext` 恢复瞬间可能返回全零频谱；旧逻辑仍把这帧当作有效数据，覆盖了主 `analyser` 的有效频谱，最终 `miniPlayerPulseSample`、封面缩放和光晕都归零。
- 修复逻辑只在前 96 个低频桶检测到有效信号时使用 `beatAnalyser`；没有有效信号时回退到主 `analyser`。`beatAnalyser` 读取异常也只放弃该次低平滑采样，不中断主播放链路。
- `miniPlayerPulseValue()` 和 `miniPlayerPulseTimerActive()` 同时识别 `document.hidden` 与 `desktop-window-state` 的隐藏信号；`visibilitychange` 立即调用 `syncMiniPlayerPulseTimer()`，解决隐藏事件早于窗口状态 IPC 时定时器未启动的竞态。
- 回归覆盖：空节拍频谱回退、有效节拍频谱优先、文档隐藏态定时器激活、挂起 `AudioContext` 恢复和稳态/峰值对比；不启动 Electron、不操作真实窗口、不发送全局鼠标键盘输入。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.6.0-Setup.exe` `101491154` 字节；`.blockmap` `105922` 字节；`latest.yml` `347` 字节；SHA256 清单 `273` 字节。
- SHA256：安装器 `e859cc7bbe9a00915c877742a22ef06d6400a673238ab690a1260d82b162d495`；`.blockmap` `b3a301fd1bdc184b3998604ee78914d0effad74cd2f2266835078876b7ce61a5`；`latest.yml` `bb1d470d255e9a2ca2bb7d909c3fd434a833c6b70864e7015b34a345a4843bfe`；SHA256 清单 `404c94ebe572f4300e23222749557eea855d80c9171f7e0c1b874fa19716f3f1`。
- `latest.yml` 的 Setup SHA512：`QnigLfj5ETAv+t9C0g0GlLsnf7JEF2itHpykLaffSA4m7gBUktl6RiJvgK3E/b8y7GQnHL36BDEzDn+qqsneIw==`。
- 发布标题使用 `Mineradio v1.6.0 修复迷你播放器封面律动与光晕无反应`；GitHub Release 已上传四项资产，Portable ZIP 未生成或上传。

## v1.5.9 修复本机代理线路无法取消更新
- 正式发布版本从 `1.5.8` 提升为 `1.5.9`；构建时需同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.8` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 修复对象是 `v1.5.8` 上线后实测到的真实缺陷：`route=proxy` 下载中调用 `/api/update/cancel` 后，任务状态长期停在 `downloading`，`received` 从 `18169856` 继续涨到 `23149887`，`canceled` 始终为 `false`，安装包被完整拉完。`direct` / `mirror` / `auto` 线路不受影响。
- 根因有两处：`fetchThroughUpdateProxy()` 的 `settle()` 在响应头到达时就摘掉了 abort 监听；`nodeResponseAsFetchLike()` 用 `Readable.toWeb(res)` 包装正文，而 `Readable` 不认识 `fetch` 的 `AbortSignal`。直连线路能取消只是因为 `fetch(url, { signal })` 会自己掐掉响应体。
- 第一层修复（传输无关）：安装包读取循环（`server.js` 约 `1969` 行）与补丁读取循环（约 `2332` 行）在每次 `reader.read()` 前后各调用一次 `throwIfUpdateJobCanceled(job)`；测速循环（约 `1850` 行）加 `if (job && job.canceled) break;`。
- 第二层修复（真正断连）：`nodeResponseAsFetchLike(res, signal, socket)` 自行监听 `signal` 的 `abort`，销毁响应流并销毁 `CONNECT` 隧道 socket，`res.on('close')` 时摘监听；`fetchThroughUpdateProxy()` 末尾改为 `nodeResponseAsFetchLike(response, signal, socket)`。
- 销毁必须用无参 `res.destroy()`，不能传错误对象：正文可能尚无读取端，带错误销毁会发出无人监听的 `'error'` 事件并升级为 `uncaughtException`（首次实现即因此让测试进程崩溃）。终态由下载循环两处 `settle` 分支中排在 `classifyUpdateError()` 之前的 `job.canceled` 判定收敛，不依赖流抛出的具体错误。
- 取消语义不变：`canceled` 仍是 `ok: true` 的正常终态，`error` 为空，不写失败线路、不换线，`job.applying` 期间仍然拒绝取消。
- 实测复验：`MINERADIO_VERSION=1.5.7` + `HTTPS_PROXY=http://127.0.0.1:7897` 起服务，`route=proxy` 下载至 `received 733339` 后取消，`3` 秒内即收敛为 `status canceled / canceled true / received 766107 / message 更新已取消 / error 空`，后续轮询字节不再增长。
- 本版本不改任何前端、CSS、文案与交互入口，只改 `server.js` 与回归测试。
- 全量 Node 回归 `403/403`；`tests/update-route-selection.test.js` 从 `11` 项扩到 `14` 项，新增「取消会销毁代理响应流与隧道 socket」「信号已取消时代理响应立即释放」「下载读取循环逐块检查取消而不依赖传输信号」，版本一致性、发布工作流标签与资产清单测试，以及 `node --check` 与 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.9-Setup.exe` `101488940` 字节；`.blockmap` `105851` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `a8589b51157439d7583148c0ff951892d66347607af85417376564085b037d70`；`.blockmap` `261263ccafd07b3425400fabccf3d41054cc5bd479e12a557df31efa03580966`；`latest.yml` `cc39b8727d6a06c7b634d1dcd6ddeb3dc59d0e67fdaafad0c9066e46c3248706`；SHA256 清单 `3db99ce0eaf76602a1231baaf2c381aac017ed60ac588fd0a6755330d7e897bf`。
- `latest.yml` 的 Setup SHA512：`B6pSVPHBxoynYP/W0RrlKyPo5OAJIxc/q9pTWFzM/lDzI37CG/AxvqPCqsLFxVcvUuiEXyntbiyBnuEr9g7Udw==`。
- 发布标题使用 `Mineradio v1.5.9 修复本机代理线路无法取消更新`。

## v1.5.8 更新线路手动选择、取消更新与迷你封面律动光晕强度
- 正式发布版本从 `1.5.7` 提升为 `1.5.8`；构建时需同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.7` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 更新线路模式集中在 `UPDATE_ROUTE_MODES = ['auto', 'direct', 'mirror', 'proxy']`；`normalizeUpdateRouteMode()` 只把已知值放行，未知值一律回落 `auto`。
- `filterUpdateRouteCandidates()` 在 `rankUpdateDownloadCandidates()` 之前按线路裁剪候选：`direct` 只留非镜像候选，`mirror` 只留镜像候选，`proxy` 保留全部候选但强制走代理传输。裁剪后为空时抛 `UPDATE_ROUTE_UNAVAILABLE`，不得静默回落到别的线路。
- 线路通过 `?route=` / `?proxy=` 查询参数下发，`/api/update/download` 和补丁入口都不解析请求体，前端 `updateJobStartUrl()` 负责拼参数。`/api/update/routes` 返回 `mirrorCount` 与 `proxyLabel` 供面板显示可用性。
- 代理传输手写在核心 `http` / `https` / `tls` 之上：`CONNECT` 隧道 -> `tls.connect` -> `http.request({ createConnection })`，再用 `Readable.toWeb` 伪装成 fetch 响应，`package.json` 仍然零 `dependencies`。
- `resolveUpdateProxyTarget()` 依赖 `session.defaultSession.resolveProxy(url)`，因此只有在 Electron 主进程内的 `server.js` 才能自动探测系统代理；独立 `node server.js` 返回空 `proxyLabel` 属于预期行为。
- 取消更新使用任务级 `AbortController` 与 `job.canceled`；`canceled` 是 `ok: true` 的正常终态，前端必须在 `queued` / `downloading` 之前分支判断。`job.applying` 为真时拒绝取消，避免补丁应用中途留下混合版本。
- 迷你封面律动/光晕强度：`miniPlayerPulseStrength` 与 `miniPlayerGlowStrength` 取值 `0 ~ MINI_PLAYER_EFFECT_STRENGTH_MAX(3)`，默认 `1`；主进程 `normalizeMiniPlayerVisual()` 用同一个 `MAX_MINI_PLAYER_EFFECT_STRENGTH` 夹紧。
- renderer 在 `applyState()` 里把 `signal = Math.pow(pulse, 0.72)` 与强度相乘后经 `saturateMiniEffect()`（`1 - Math.exp(-1.15 * level)`）压成 `0 ~ 1` 的 `--mini-pulse` / `--mini-glow`；CSS 系数（收回态 `0.195`、展开态 `0.125`、光晕 `14px` / `0.42`）只表示 `360 × 84` 窗口的几何上限，想加强只能调强度，不得抬高系数。
- 设置区沿用 `public/index.html` 既有 `fx-slider` / `fx-toggle-grid` / `mini-player-collapse-hint` 类，未新增 CSS，两个开关保持原位作为“关闭”入口。
- 全量 Node 回归 `400/400`；新增 `tests/update-route-selection.test.js` 11 项线路与取消测试，扩展 `tests/update-fastest-route.test.js`、`tests/mini-player-visual.test.js`、`tests/mini-player-state-cache.test.js`，版本一致性、发布工作流标签与资产清单测试，以及关键 JavaScript 语法检查与 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.8-Setup.exe` `101487553` 字节；`.blockmap` `105911` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `484e70284a1b23263fbf0ad42c494c690519ef2da7a0164f57e73d1ec587b57c`；`.blockmap` `2a42264120479e348c583e33305c917dc31f04bad1577526f9bb88b0b23ff2fd`；`latest.yml` `e39fd4c475841b328df549257cf6216c2faf7e4a9f44ac1b2a8189a417436b72`；SHA256 清单 `bdab066abae282c73dc027dd46f7b19f71085eec02a9e5913ebf0b676e3fba89`。
- `latest.yml` 的 Setup SHA512：`psjq0qrcIjuvXa+EoVsN0QUeZodpa8QleEKrC0yecKVM8zD5L485m7qasyIMces85YD7MDnr1u+gGLLwziSKmA==`。
- 发布标题使用 `Mineradio v1.5.8 更新线路手动选择、取消更新与迷你封面律动光晕强度`。

## v1.5.7 自动播放开关与迷你播放器悬浮展开错位修复
- 正式发布版本从 `1.5.6` 提升为 `1.5.7`；构建时需同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.6` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 新增自动播放开关：状态 `off` / `continue` / `shuffle` 持久化到 `mineradio-auto-playback-v1`，并登记进 `PERSISTENT_UI_STATE_KEYS`，清理运行时缓存时不会被抹掉。
- 设置区为 `public/index.html` 的 `fx-playback-fold`，复用既有 `fx-fold` / `fx-seg` / `fx-section-label` / `lyric-color-row` / `fx-mini-btn ghost` / `mini-player-collapse-hint` 类，未新增任何 CSS，归入视觉控制台“高级”页并默认展开。
- `startAutoPlayback('restore')` 挂在 `handleLocalFolderFiles` 的两条启动出口上（会话恢复分支与 `autoPlay === false` 被动队列分支），由 `autoPlaybackRestoreHandled` 保证每次启动只起播一次。
- `continue` 复用 `pendingPlaybackSessionResume`，仅在恢复点与当前索引一致时带上 `resumeAt`；`shuffle` 切到 `playMode = 'shuffle'`，队列未固定乱序时先 `shufflePlayQueueOnce` 一次，再随机取索引并清空恢复点。
- 自动播放歌单复用 `localLibraryPlaybackSelection` 与 `LOCAL_PLAYBACK_SOURCE_STORE_KEY`；`setLocalPlaybackPlaylistSelection` 会回调 `updateAutoPlaybackControls`，设置区名称与底部控制栏选择器始终一致。
- 桌面歌词 `词` 按钮改为 `.mini-shell` 直属子节点（排在 `.transport` 之后保持 Tab 顺序）：它是 `position: absolute`，落在 `.transport` 内时收回态那份 `transform` 会让 `.transport` 成为包含块，240ms 过渡中按钮被拽到面板中央并被 `overflow: hidden` 裁切。收回态改用独立的 `opacity: 0; pointer-events: none;` 淡出。
- 向左展开的收回态位移镜像为 `translateX(-10px) scale(0.94)`，与向右展开的 `translateX(10px)` 对称。
- 全量 Node 回归 `385/385`；新增 `tests/auto-playback-startup.test.js` 13 项自动播放测试，扩展 `tests/mini-player-visual.test.js` 的按钮层级与镜像位移断言，版本一致性、发布工作流标签与资产清单测试，以及关键 JavaScript 语法检查与 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.7-Setup.exe` `101480140` 字节；`.blockmap` `105940` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `09cdaa786f890f2b618f8650d9422faa79fdca73a3ef8bb9cd289bdcce28321d`；`.blockmap` `e51bc8f6b94025b367123001d8ef5398fd6a97503ce177495f0e6a52689e214c`；`latest.yml` `3c3f404d19493544ad60043b02c9fcd4dba5a4c3ed098711247791ed085714ba`；SHA256 清单 `e561c8da33309dc41eb04a099ce0ec46f5d7bae1d669a8b1ce7f185c0664526a`。
- `latest.yml` 的 Setup SHA512：`AlNNeuJNbLZ1uMwA87vgHS0M1Z1gk0uAfJoZcZZvJ6cK74WEJfB3zCcNZHdAliYOnMIyfkiPrTjd/vRvu9DObg==`。
- 发布标题使用 `Mineradio v1.5.7 自动播放开关与迷你播放器悬浮展开错位修复`。

## v1.5.6 标准迷你播放器收回态穿透与桌面歌词按钮镜像修复
- 正式发布版本从 `1.5.5` 提升为 `1.5.6`；构建时需同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.5` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 标准迷你播放器收回态改用 `setIgnoreMouseEvents(true, { forward: true })` 把鼠标事件交还桌面；CSS `pointer-events` 管不住透明窗口命中，原完整面板位置不再吞掉桌面点击与拖动。
- 穿透期间 renderer 依靠转发的 `mousemove` 与 `coverWrap` 矩形（外扩 `6px`）判定封面热区；指针回到热区立即通过 `mineradio-mini-player-set-pointer-passthrough` 收回鼠标事件并展开完整面板。
- 穿透通道只接受当前迷你窗口 sender 并对重复值去重；封面拖动期间和关闭“自动收回”时强制保持窗口交互，窗口创建 / 销毁 / 关闭都重置主进程穿透缓存。标准 BrowserWindow 继续固定 `360 × 84`，不通过缩放窗口实现收回。
- 桌面歌词 `词` 按钮随展开方向镜像：向左展开时用 `left: 5px; right: auto;` 移动到左下角，与返回按钮镜像方式一致。
- 全量 Node 回归 `372/372`；新增收回态穿透、封面热区恢复、穿透 IPC sender 门禁与生命周期重置、桌面歌词按钮镜像测试，版本一致性、发布工作流标签与资产清单测试，以及关键 JavaScript 语法检查与 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.6-Setup.exe` `101477362` 字节；`.blockmap` `105997` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `022fe2a36b410f315f7f0da3437e80e25ebfc3b140c8ef3756d31581c9d3ef19`；`.blockmap` `b0da61626594e2c9d3ab8059888b2ee4ce2fb2defd0c94fbe644871b136dde53`；`latest.yml` `8ac4d639ed432e263ed11aae91ef7db869bd7f0fa3a8922ed517a2102d985fa3`；SHA256 清单 `6ce17fbe9162952b293f6f5d1341da38f68240f8884827400fbf86e76dc8bd1d`。
- `latest.yml` 的 Setup SHA512：`rM/11nPqX2g2CucOyW4YmRhw+3qGg3gEjdjkV8Zc6cHPtdfif5cpNlg0U63lLm9tP0bzY3vZIkOEIcDkwLeeQA==`。
- 发布标题使用 `Mineradio v1.5.6 标准迷你播放器收回态穿透与桌面歌词按钮镜像修复`。

## v1.5.5 迷你播放器封面律动、贴边展开与拖动修复
- 正式发布版本从 `1.5.4` 提升为 `1.5.5`；构建时需同步 `package.json`、`package-lock.json` 和前端 `APP_VERSION`，使已安装 `1.5.4` 的客户端满足 `latestVersion > APP_VERSION` 并通过 `latest.yml` 自动更新。
- 标准迷你播放器封面律动恢复挂起的 `AudioContext` 音频分析，优先使用低平滑 `beatAnalyser`，并加入短期能量基线与峰谷对比；隐藏主窗口播放时仍由迷你播放器独立采样，低能量音乐不再长期显示固定脉冲。
- 标准迷你播放器根据当前显示器工作区左右余量计算 `expandDirection`：靠右时向左展开，靠左时向右展开；收回态封面保持贴近窗口外侧，避免完整面板伸出屏幕。
- 歌曲封面支持点击展开与拖动移动：位移小于约 `5px` 保持点击语义，超过阈值通过 `mineradio-mini-player-move-by` 按增量移动当前窗口；主进程校验 sender、夹紧到工作区并持久化坐标，不接管全局鼠标/键盘或主播放器拖动。
- 全量 Node 回归 `368/368`；迷你播放器方向、封面拖动、脉冲恢复和 IPC sender 门禁、版本一致性、发布工作流标签与资产清单测试，以及关键 JavaScript 语法检查与 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.5-Setup.exe` `101476694` 字节；`.blockmap` `105747` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `4af2724118ae0688e02cc0eefb4412ff909c2cf49780c11b051d2cfd5ee4f298`；`.blockmap` `96d6fdbfb86b638bf5083bdde3ca65797ffe27f482b4f2b13e2860425dc7204e`；`latest.yml` `9a61d1b3aaec517742339eb5189db632d87e40f1a5076d8894d3965420440b4b`；SHA256 清单 `b7ee1ae8f992d8390881808cb4d3e4c574d8479db875f6082ed0437b34e68867`。
- `latest.yml` 的 Setup SHA512：`Z1aNBtqVKPlb9VsvzClDK2fX4ZGHyPMNuU7oBTaNpEEM8uiahDvfOreqmNmQGK7qFJkR11ovKeYsgMSUK4aIMw==`。
- 发布标题使用 `Mineradio v1.5.5 迷你播放器封面律动、贴边展开与拖动修复`。

## v1.5.4 迷你播放器与 Wallpaper Engine 生命周期修复重发
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.5.4`，确保已安装 `1.5.3` 的客户端能够发现新版。
- 本次保持版本号 `1.5.4`，在现有 Wallpaper Engine 生命周期修复上进行同版本迷你播放器修复重发；已安装旧版 `1.5.4` 的客户端不会因版本比较自动发现本次产物，必须手动下载安装器覆盖安装。
- 标准迷你播放器封面律动恢复挂起的 `AudioContext` 音频分析，优先使用低平滑 `beatAnalyser`，并加入短期能量基线与峰谷对比；隐藏主窗口播放时仍由迷你播放器独立采样，低能量音乐不再长期显示固定脉冲。
- 标准迷你播放器根据当前显示器工作区左右余量计算 `expandDirection`：靠右时向左展开，靠左时向右展开；收回态封面保持贴近窗口外侧，避免完整面板伸出屏幕。
- 歌曲封面支持点击展开与拖动移动：位移小于约 `5px` 保持点击语义，超过阈值通过 `mineradio-mini-player-move-by` 按增量移动当前窗口；主进程校验 sender、夹紧到工作区并持久化坐标，不接管全局鼠标/键盘或主播放器拖动。
- 每次主窗口成功创建后集中调用 `wallpaperEngineBridge.attachWindow(mainWindow)`，旧窗口关闭后新窗口继续具备 Wallpaper Engine 的最小化、隐藏、恢复、移动、缩放、全屏和关闭 hook。
- 主窗口 renderer 崩溃、主 frame 导航、主 frame 不可恢复加载失败和窗口关闭都会停止当前原生 Scene，并清理 DWM helper、指针中继、静音重申定时器和捕获授权。
- `pagehide` 对离开前持有的 session 发定向最佳努力停止请求；刷新成功时等待旧 renderer 清理完成，避免误停新 session 或重复启动 Scene。
- 新增 renderer 崩溃、导航、刷新失败、窗口关闭、旧窗口所有权、并发清理和窗口重建 hook 生命周期测试。
- 全量 Node 回归 `366/366`；主进程、Wallpaper Engine bridge、runtime、前端脚本和 `server.js` 语法检查，以及 `git diff --check` 均通过。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.4-Setup.exe` `101477224` 字节；`.blockmap` `105771` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `af7fd330a1982fcb368a06720dac8e469c08ad5e2017bcb96a299736056b6793`；`.blockmap` `1bfaf29e6edb5abacff4092d413c18238daff117b4e5a7256243a4f5f716ecb72`；`latest.yml` `f44cf40f65b565ab1a45bee13e2bac86fbd34ab70204a85564397482e72db43d`；SHA256 清单 `8f87957f5ffca3a8c214d87743f1f6e7c971f25642a391d88634c93785f6ba64`。
- `latest.yml` 的 Setup SHA512：`8o7IoNPMahL9CrjWkeECfMA6WO9B2gGnyhsmGhvG/OmaymWEBmgVSBZbMMtoHO1B/ZMu/a4DmDMEPa4qST4Ocg==`。
- 发布标题使用 `Mineradio v1.5.4 迷你播放器与 Wallpaper Engine 生命周期修复重发`。

## v1.5.3 桌面歌词拖动原生竞态修复
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.5.3`，确保已安装 `1.5.2` 的客户端能够发现新版。
- 在实际运行的 `D:\Mineradio\Mineradio.exe` v1.5.2 上启用桌面歌词并采集鼠标、主窗口和歌词窗口原生坐标；确认主窗口拖动期间相对鼠标存在最高约 `410px` 的单帧突变。
- 主窗口通过 `WM_ENTERSIZEMOVE / WM_EXITSIZEMOVE` 提前标记 Windows 原生移动循环；移动期间桌面歌词强制 `setIgnoreMouseEvents(true, { forward:false })`，并拒绝 renderer 重新申请 pointer capture。
- Electron `will-move` 与 `move` 继续作为兜底；`moved` 不再执行任何主窗口边界 `setBounds()`，显示器参数变化和显示器插拔仍执行既有全量纠偏。
- 桌面歌词视觉、位置持久化、中键锁定、歌词自身拖动、播放控制、主界面布局、本地曲库和 `%APPDATA%\Mineradio-oirge` 用户数据保持不变。
- Windows x64 NSIS 继续只发布安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 全量 Node 回归 `353/353`，`server.js`、主进程、两份 preload、前端脚本语法和 `git diff --check` 通过；打包后的 `app.asar` 已确认包含 `1.5.3`、原生移动消息门禁、拖动期间 `forward:false` 与 `moved` 无边界重设。
- 发布资产：`Mineradio-1.5.3-Setup.exe` `101474711` 字节；`.blockmap` `105907` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `a8b9e9591dc2afb2296b391078a86635fa618524c52979183e7bd0659aedbcfe`；`.blockmap` `3b1699a90d2de78098e311caeab7f538c8d8aaa7504c21e91dbced96593fb0e7`；`latest.yml` `815f2f46cffc8518a51fa35b2841bcff4ef418ea08264ca8a9ff3260f2fc2aca`；SHA256 清单 `725962f0d913d357bf8c8606d98ba7badf12ba5a9f5acffaa78e9d04f1804e5b`。
- `latest.yml` 的 Setup SHA512：`XVMTLQ6t4UAPu2RXccyHG0EGMFfoGLsIh8+3nshJZ1ebIjfjjmMY6/ordgG7ZChJN3dZbzHvuiUOHr2uRNAexQ==`。
- Release 标题使用 `Mineradio v1.5.3 桌面歌词拖动原生竞态修复`。

## v1.5.2 本地文件授权与窗口拖动修复
- 更新 package.json、package-lock.json 和前端 APP_VERSION 为 1.5.2，确保已安装 1.5.1 的客户端能够发现新版。
- 主窗口导航与 IPC 信任边界加固：统一可信主 frame 校验，外部页面、非可信 frame 与非法 sender 全部拒绝；本地曲库授权由主进程维护并保留重启恢复能力。
- 修复开启桌面歌词后拖动主窗口松手瞬间被工作区边界拉回跳位：拖动结束宽容纠偏，只有窗口几乎完全不可见才夹回，显示器参数变化与插拔仍全量纠偏。
- 升级继续使用 %APPDATA%\Mineradio-oirge 与既有曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不执行破坏性清空或强制重新导入。
- 全量 Node 回归 345/345、关键 JavaScript 语法检查与 git diff --check 通过。
- Windows x64 NSIS 发布继续只包含安装器、.blockmap、latest.yml 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：Mineradio-1.5.2-Setup.exe 101475712 字节；.blockmap 105928 字节；latest.yml 347 字节；SHA256 清单 273 字节。
- SHA256：安装器 907f3f45f2a26cf2344666e8df14d68d1d712e8f8d11f5b1d07c2d121756fe7a；.blockmap ccb059c3bb744e4c9964f2592922b8f1ecd12fe695fe8576fa7e5a35170fb226；latest.yml 7129e5cce239c5a7902052f1156676ecc81ce41c4f5775984cb3eab101c8f9e9；SHA256 清单 ba47def9ac8bc21f5a34615db69abca921e24ed026d86135a690bddd6121ade0。
- latest.yml 的 Setup SHA512：QYv376lguIqpVOnVx4zjku0uJ7WLSpdN4UYoh6b5r2JmWJ3YI50NPn48u0HwxOqoWkUc+w0CMnDxQBZQJ9Ih1w==。
- Release 标题使用 Mineradio v1.5.2 本地文件授权与窗口拖动修复。

## v1.5.1 软件内更新自动选择最快线路
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.5.1`，确保已安装 `1.5.0` 的客户端能够发现新版。
- 完整安装包和快速补丁在正式下载前共用后端并行测速：每条候选线路最多读取 `128 KiB`，统一等待窗口为 `4 秒`，按包含连接耗时的实测吞吐量降序选择。
- 测速窗口结束前已收到的部分字节仍作为有效样本；完全失败的线路保持原顺序放在队尾，正式下载失败后继续使用既有自动换线流程。
- 镜像测速继续执行 SHA-256/SHA-512 摘要门禁，不能绕过安装包校验；正式下载仍执行大小上限、流式摘要校验和正文空闲超时。
- 前端不新增线路选择控件；测速阶段显示“正在测速更新线路 · 自动测速”，选线后沿用当前线路、速度、进度和剩余时间反馈。
- 新增 `tests/update-fastest-route.test.js`，覆盖最快排序、失败兜底、全失败原序、范围流量上限、部分样本超时、镜像摘要门禁以及完整包/补丁双入口。
- 全量 Node 回归 `341/341`、关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布继续只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.1-Setup.exe` `101472841` 字节；`.blockmap` `105974` 字节；`latest.yml` `347` 字节；SHA256 清单 `273` 字节。
- SHA256：安装器 `b6d3cd88b20ac5e0d6da86d77ca7a86793b0b2003cc9c8a9daaa33a9196b3803`；`.blockmap` `5d8fc5e2f0685f09707eb8b661eb95f6aafbec88cf202f514eb7d80539e5a660`；`latest.yml` `7449c07b148a5b69e3dd8b4ebffab7df68650b8f6c4ef2cf40fd4f281970a0f1`；SHA256 清单 `444f1da527f96d38389be620322f56823f4ed4a90621563897b28c54be36a4ef`。
- `latest.yml` 的 Setup SHA512：`NvScakaOo1zWvZccwnqPFKoW9JadqUxxrpfbKo+1NE+CWYKVDoKXC2FYapof8BpmWGrfJZugINo5ofQAr1MGGQ==`。
- 打包后的 `app.asar.unpacked/server.js` 与源码 SHA256 一致，并包含 `UPDATE_ROUTE_PROBE_BYTES`、`rankUpdateDownloadCandidates()` 及完整包/补丁双入口；`app.asar` 内包版本和前端版本均为 `1.5.1`。
- Release 标题使用 `Mineradio v1.5.1 更新自动选择最快线路`。

## v1.5.0 桌面歌词拖动与迷你封面动效修复
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.5.0`。
- 主窗口进入用户拖动时，桌面歌词窗口强制保持鼠标穿透；`moved` 后延迟 `80ms` 恢复原锁定/热区状态，避免歌词置顶窗口抢走本次鼠标释放并造成窗口跳位。
- 桌面歌词 renderer 在检测到外部左键拖动时主动撤销 hover 捕获，歌词自身拖动仍保留完整指针捕获；“下一首”按钮同步修复为正确的右向三角形和竖线图标。
- 标准迷你播放器降低低频脉冲同步阈值，并用非线性映射增强低能量段；封面态和完整态采用不同缩放幅度，保持节拍明显且不过度跳动。
- 封面光晕改为不会被 `overflow:hidden` 裁掉的外层双层光晕与内沿描边；关闭光晕后只保留基础内边框，强度设为 `0` 时律动严格归零。
- 极简迷你播放器仍不创建封面结构；标准/极简样式、自动收回、圆角和既有用户设置继续兼容。
- 升级继续使用 `%APPDATA%\Mineradio-oirge` 与既有曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不执行破坏性清空或强制重新导入。
- 全量 Node 回归 `334/334`、关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.5.0-Setup.exe` `101473799` 字节；`.blockmap` `105756` 字节；`latest.yml` `347` 字节；SHA256 清单 `273` 字节。
- SHA256：安装器 `5992c04e662232cd71bfea4dc17dfe6f472b5534e9224019584684a828136514`；`.blockmap` `f9109d799eeb7e27d30cd589609d20ced394891df6dec3fcce10ad9fb3248550`；`latest.yml` `10b9c50075fc07eac8495fd1fb7f0295d42d41959637a565dbf09f6d27fe3187`；SHA256 清单 `20f1e2e843d292c96b4116205f4fca834fdb1b2e4864fc26d37230cf0fb7e4b3`。
- `latest.yml` 的 Setup SHA512：`kEr+xTSvx/BEFbP+scKbU8Z9cccnONpEgrlM9KTF68x8tYp7hqI4hkaj1dkSGZNQ0RGnRZc1VseVJcsGHG126Q==`。
- Release 标题使用 `Mineradio v1.5.0`。

## v1.4.11 更新圆环与窗口拖动修复
- 同版本修复重发：检测更新圆环不再使用 GSAP/CSS 几何 `transform`，改用 `stroke-dashoffset` 做描边动画；下载进度环改用 SVG 坐标中的固定旋转，彻底避开 Electron SVG 轴心偏移。
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.11`。
- 标题栏检测更新圆环使用描边偏移动画，下载进度环使用 SVG 坐标中的固定起点，修复桌面壳 `18px` 图标下圆环偏心、转到按钮外侧的问题。
- 主窗口连续 `move` 事件不再执行显示器边界 `setBounds()`；用户松开鼠标后的 `moved` 事件才单次纠偏，修复拖动过程中窗口突然跳位。
- 保留显示器参数变化和全屏状态门禁；副屏或较小工作区中尺寸过大时自动缩放，窗口位置越界时按当前坐标夹回可见区域而不强制居中。
- 升级继续使用 `%APPDATA%\\Mineradio-oirge` 与既有曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不执行破坏性清空或强制重新导入。
- 全量 Node 回归 `331/331`、关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.11-Setup.exe` `101474035` 字节；`.blockmap` `105866` 字节；`latest.yml` `350` 字节；SHA256 清单 `271` 字节。
- SHA256：安装器 `5bd7d90d31d530f04465390e007ccc75faccd6b07058aecc3bf6be04d4a19e82`；`.blockmap` `e2993b41ee75bea87a1384285aa1c7939027eef0e3e24947e141bf905668086b`；`latest.yml` `7cfe66cf2ee88e5862c9346ec68a6e5ab5f98be9fa4b82237198d885a1213f0a`；SHA256 清单 `aaf8b7d85be0ece8d9060708d581074137259abb58e3e7e4e27f977754a6fac5`。
- `latest.yml` 的 Setup SHA512：`kZH9qZviP1plVzwLS8S+hZ+0oM6aD1touiHN2D3ihcT5vC739ghXAnQU5bFt2iN+RFFdWwPFrPBnY45tH7vmzw==`。
- Release 标题使用 `Mineradio v1.4.11 更新圆环与窗口拖动修复`。

## v1.4.10 界面布局与 3D 歌单详情修复
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.10`。
- DIY 控制台新增独立“迷你”页，集中迷你播放器总开关、样式、封面律动、光晕、悬停展开、圆角和 `× 自动收回` 设置。
- 修复顶栏“检测更新”按钮上偏、DIY 底部按钮重叠，以及全屏状态下 Home、DIY、退出全屏按钮中心线错位。
- 修复 3D 歌单详情把错误布局对象传入绘制流程导致坐标与缩放为 `NaN`、详情界面异常拉伸的问题。
- 普通详情态立即隐藏舞台歌词，避免动态镜头下巨型歌词遮挡详情；关闭详情后恢复原有歌词状态。
- 升级继续使用 `%APPDATA%\\Mineradio-oirge` 与既有曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不执行破坏性清空或强制重新导入。
- 全量 Node 回归 `328/328`、关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.10-Setup.exe` `101472152` 字节；`.blockmap` `105866` 字节；`latest.yml` `350` 字节；SHA256 清单 `272` 字节。
- SHA256：安装器 `62dac19065ee44762546bd12a33b28bd3acbfbe294bae7a30dcba2a890a60ff3`；`.blockmap` `6f82c9f1ad3abc03efc2d9c10381f67f43cdd083538bb5e03e15336078d683f6`；`latest.yml` `b96254d510f98da6f8bf210ecc585f939026c88bd400b5ce3ab3ae0d2f3e30a5`；SHA256 清单 `71d161bb80d5bcc0e1821fc44c5c5eecc6cdedee6633430bbce3f30e250e0562`。
- `latest.yml` 的 Setup SHA512：`larz2ROa3ZeCkzzVDJvHzfLZUo/xY1UlKsMe63m8KxrlAzIVSTLrOXsSUCeJ7MBSyvUAFo8u1Dy1TAzND/HvGQ==`。
- Release 标题使用 `Mineradio v1.4.10 界面布局与 3D 歌单详情修复`。

## v1.4.9 迷你播放器与更新检测
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.9`。
- 标准迷你播放器本体不再放置一次性 `×`；四角“返回主界面”按钮恢复到右上角原位，桌面歌词和播放控制保持不变。
- DIY“迷你播放器样式”区域新增永久可见的 `× 自动收回` 双向开关；开启后悬停或键盘聚焦展开并在离开后收回，关闭后保持完整面板。
- 歌单删除改为播放器内暗色玻璃确认弹层，明确显示目标歌单、歌曲数量和本地文件保留提示，并支持遮罩与 `Esc` 关闭。
- 顶栏更新入口常驻显示，更新面板新增独立“检测更新”按钮；检测请求复用单一在途 Promise，并提供检测中、最新版、新版本和网络失败状态。
- 当前已是最新版或检测失败时禁用无效下载入口；发现新版本后继续使用现有轻量补丁、完整安装包、校验和安装流程。
- 升级继续使用 `%APPDATA%\\Mineradio-oirge` 与既有曲库、播放会话、特别喜欢、自建歌单和 DIY 设置，不执行破坏性清空或强制重新导入。
- 新增手动更新检测回归，扩展迷你播放器和歌单删除测试；全量 Node 回归 `325/325`，关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.9-Setup.exe` `101471651` 字节；`.blockmap` `105745` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `72da914f9561be28b27e0abe5b2e76fccc65e1471a07ba1c452b72abb304378b`；`.blockmap` `f722090d6b7e4f87ba8be38969f49b0bf4f5042c70202681e5b519f01e3f1617`；`latest.yml` `d21ed265e377ae8db48787f32be35d09bb2bac01d425258712f0db92ad0b9a92`；SHA256 清单 `9cf2ffa3b168326e0424e7b47fdca50b28b3e26c791bd2662cbbd610f2d3caae`。
- `latest.yml` 的 Setup SHA512：`WLMWFQgiy7/C0I4vlaZJH6eOUT88l2lpgAL3sODGlOqDECiKg28qBL8q4VgcC4Sg3cPTa1VBDbEa5tCk4k2dkw==`。
- Release 标题使用 `Mineradio v1.4.9 迷你播放器与更新检测`。

## v1.4.8 歌单定向收藏与全屏过渡
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.8`。
- 当前播放队列、主曲库、歌手详情和自建歌单详情统一支持选择收藏到任意自建歌单；同一首歌曲可加入多个歌单，并明确显示目标歌单与已收藏状态。
- 新建歌单时可直接把本次歌曲收藏进去；选择播放来源或收藏目标后，左侧歌单面板恢复自动隐藏，不再保持永久展开。
- 歌单选择弹层使用独立深色玻璃背景与高对比文字，避免粒子背景穿透造成标题、数量和操作项看不清。
- 全屏进入与退出增加暗场、轻缩放、状态/resize 稳定后回亮的过渡；系统启用“减少动态效果”时自动缩短动画。
- 保留透明无边框窗口全屏边界保护、全屏退出入口、DIY 布局和 `%APPDATA%\\Mineradio-oirge` 用户数据，不清空音乐文件夹、歌单、播放会话或已有设置。
- 新增全屏过渡回归并扩展歌单收藏测试；全量 Node 回归 `323/323`，关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.8-Setup.exe` `101470154` 字节；`.blockmap` `105922` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `3c9166b116e1e37b81163fda6a902d98d25f6125b7be33c37c75666613cafb44`；`.blockmap` `7eecde29cacd54b9360ef5196e082b780e40bedf2901a8801bc6828b04b1d5ff`；`latest.yml` `ad884333d2e9656413835b15d8610cae35bd80ed2ee925359936ea7cdb943416`。
- `latest.yml` 的 Setup SHA512：`EkF7Uh166g2QwhxQ8TY/rUu33sAfxB9BE8pc7VvDvSeOBAGq1zLjJaxRJr8zwPWjpXem3SZp4RknXIcuvQk+3w==`。
- Release 标题使用 `Mineradio v1.4.8 歌单收藏与全屏过渡`。

## v1.4.7 多歌单与播放来源选择器
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.7`。
- 新增多个独立本地歌单的完整 CRUD；收藏弹窗、左侧歌单页和 3D 歌单架统一读取同一份轻量歌曲引用。
- 未解析歌曲引用继续保留，用户重新导入原音乐目录后可按本地键或规范化路径自动恢复；编辑歌单不改当前播放队列。
- 主播放栏来源按钮改为暗色玻璃歌单选择器，支持全部音乐、特别喜欢和任意自建歌单，提供当前态、歌曲数量、待重新定位数量和管理入口。
- 来源切换优先保留当前歌曲及进度；当前歌曲不存在时从第一首开始，空歌单和已删除歌单保持当前队列并给出提示。
- 标准迷你播放器 `×` 现在关闭并持久化“封面悬停展开”，使完整控制栏保持展开；不会关闭迷你窗口、迷你播放器总开关或桌面歌词入口。
- 升级继续使用 `%APPDATA%\\Mineradio-oirge` 与既有曲库、播放会话、特别喜欢和设置存储，不执行破坏性清空或强制重新导入。
- 浏览器真实交互验证三类来源切换、队列和 Local Storage 持久化均正确且无运行错误；全量 Node 回归 `317/317`，关键 JavaScript 语法检查和 `git diff --check` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.7-Setup.exe` `101469963` 字节；`.blockmap` `105780` 字节；`latest.yml` `347` 字节；SHA256 清单 `270` 字节。
- SHA256：安装器 `c057a4c6700aa9c4641b1aa4c35577dc0d4d901846113933a316edfbcae858b8`；`.blockmap` `1559259940d9ac14802e690b3cbaf45be3457b019105a3caea3e9afa97c997ec`；`latest.yml` `60b1926a65e9cc0c03313f83ee2b5a916d6efdcdcbb2551c57e88e5bf2d3a538`。
- `latest.yml` 的 Setup SHA512：`UrWQ75sRJcOHuN4k1uoE+c1EL4dEiL+RHX5fZ15NLpoRRaAPUOkBr8J3OTNdwK8TWBpGxQPqF+rGF0glBdYVuw==`。
- Release 标题使用 `Mineradio v1.4.7 多歌单与播放来源选择器`。

## v1.4.6 全屏、更新安装与迷你播放器修复重发
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.6`。
- 修复 Windows 透明无边框主窗口调用 `setFullScreen(true)` 后，`move` 事件把完整显示器边界误判为超出工作区并缩回普通窗口的问题。
- 普通窗口边界校正同时识别 Electron 原生全屏、应用窗口全屏和 HTML 全屏状态；普通超大窗口仍会按当前显示器工作区恢复。
- 退出全屏和主进程 `Esc` 处理不再只依赖 `BrowserWindow.isFullScreen()`；HTML 全屏时保留 Chromium 的默认退出流程，避免 DOM 全屏状态残留。
- 应用内更新安装器通过独立子进程启动，确认启动成功后主动退出 Electron 后台进程；NSIS 保留注册表恢复且带安全标记的原安装目录，并只关闭当前 `$INSTDIR`、当前 Session 内的 `Mineradio.exe`。
- 标准迷你播放器完整控制栏右上角增加收起按钮，只执行控制栏折叠；永久完整模式隐藏该按钮，极简模式不增加按钮。
- 新增 `tests/update-installer-process-close.test.js` 并扩展 `tests/mini-player-visual.test.js`；全量 Node 回归 `312/312`，关键 JavaScript 语法检查与 `git diff --check` 通过。
- Windows 实机验证：主窗口从 `1376x774` 进入 `1920x1080`，覆盖任务栏区域，退出后恢复 `1376x774`。
- 标准迷你播放器在 `360×84` 实际 Electron 窗口中验证：收起、返回主界面和桌面歌词按钮互不重叠，点击收起后立即回到封面态，永久完整模式下收起按钮隐藏。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- 发布资产：`Mineradio-1.4.6-Setup.exe` `101465672` 字节；`.blockmap` `105830` 字节；`latest.yml` `347` 字节；SHA256 清单记录这三个自动更新资产，不上传 Portable ZIP。
- SHA256：安装器 `1e194e75c82d2b9f85e6fdbff958d0b9af3db8922cc3b5f4f4051d872dca35fb`；`.blockmap` `a56be86fdc67d0da35c192c4b97cfabe918604645d1dd839c0187825926b1a4f`；`latest.yml` `ac2290ce7d367007cc528749c40a2ce412b0e3421664365963176e1da3f42665`。
- `latest.yml` 的 Setup SHA512：`Ks9xoTn1XXpJoCd6EJjq8kZF3gvTJpHtMfB8/Y6O0CNV3DaRNGcxwCN7RBcPeprucyyF8Ll3FbQqyTlDrs3Lbg==`。
- 本次为同版本修复重发；版本比较不会把新版 `1.4.6` 推送给已安装旧版 `1.4.6` 的用户，Release 正文必须提示手动下载安装覆盖。
- Release 标题使用 `Mineradio v1.4.6 全屏与更新安装修复版`。

## v1.4.5 综合修复重发
- 版本保持 `1.4.5`，以修复后的提交重新指向 `v1.4.5` tag，并重新生成和上传全部 Windows 自动更新资产。
- 迷你播放器提供独立启用开关；标准模式默认显示圆角封面，鼠标悬停或键盘聚焦时展开完整控制栏，也可关闭悬停展开并保持完整面板；关闭迷你播放器后同步释放窗口、状态和封面资源。
- 全屏模式的 DIY 与“退出全屏”固定在 Home 房子按钮左侧，退出入口常驻，修复与导入歌曲及账号区域重叠。
- 新增多个独立本地歌单的持久化、恢复、播放来源切换和跨 profile 合并；保留特别喜欢与普通曲库来源。
- 主窗口按当前显示器工作区动态设置最小尺寸并校正边界，修复副屏或小尺寸屏幕显示不全。
- 二创正式版固定使用 `%APPDATA%\\Mineradio-oirge` 与稳定高位端口，和原版的进程锁、端口、托盘、Chromium profile 分离；关闭行为不再互相覆盖。
- 首次启动从旧 `%APPDATA%\\Mineradio` 及全部 `Mineradio-path-*` 自动合并音乐文件夹、播放会话、红心和独立歌单；旧 profile 更新或出现新迁移源时标记自动失效并再次合并。
- 旧 Chromium Local Storage 先复制到临时 session 再读取，避免锁住仍在运行的原版；迁移隐藏窗口不会再误触发主程序退出。
- 保留 WAV 本地播放支持并增加媒体预加载与错误诊断。
- 发布前全量 Node 回归 `301/301`、关键 JavaScript 语法检查与 `git diff --check` 通过；Windows x64 NSIS 使用 Electron `43.4.0` 构建成功。
- 发布资产：`Mineradio-1.4.5-Setup.exe` `101469628` 字节；`.blockmap` `105712` 字节；`latest.yml` `347` 字节；SHA256 清单仅记录这三个自动更新资产，不上传 Portable ZIP。
- SHA256：安装器 `C8E006AC8AC3E58B04D6BE3E80040C1B3337D06AA64A66D8D0A08FD8D66E5C21`；`.blockmap` `4DD97E299CC5429619EEA9B5F017C9922F69680EB01264A6A8F3AA0DCF834C7F`；`latest.yml` `4915FA9ABE8797A14569D81F05F5A69244EE3609F466545D130B9DD77D6EF2BD`。
- `latest.yml` 的 Setup SHA512：`fHgoan4fKjXHFljK46di9B6VR/bRrrKVjQDl18ERBlZlKtxK/M0ySVsPIbxc9ZAOGPyPotmPYhxZzqC1T94aSA==`。

## v1.4.4 迷你播放器封面动效
- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.4`。
- 标准迷你播放器默认显示当前歌曲封面圆角矩形图标；悬停或键盘聚焦时展开完整迷你播放器，离开后平滑收起。
- 新增封面出现/消失、展开/收起、律动缩放和光晕过渡动画；无歌曲时显示 Mineradio 占位图标。
- 视觉控制台新增封面律动、律动强度、封面光晕、悬停展开和封面圆角 DIY 设置；极简模式保持无封面。
- 律动通过低频音频采样和增量 IPC 同步，避免每帧跨进程通信。
- 新增迷你播放器视觉回归测试；定向 Node 测试 `14/14` 通过。
- Windows x64 NSIS 发布包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- Windows x64 NSIS 构建使用 Electron `43.4.0` 完成；安装器 `101462613` 字节，`.blockmap` `105900` 字节，`latest.yml` `347` 字节。
- SHA256：安装器 `B7DAEBDEC91667617894C5C9BCD5ED834C7C02E2BC31E8478650C4E1E79AD6D7`；`.blockmap` `7DC8E18718DFDA558B3B41B0351B90B4F9E009850A81D99EEBF08C7B95671821`；`latest.yml` `7E9E33F597BB49AF7A07D3FF119594A02C1FEE4FF49320549AEF1C02AAE9F8D8`。
- `latest.yml` 的 Setup SHA512：`iXpovEiBl76ltXNZ79QEEBkWszXWyQaGXH6X4yRLlrxGWUZxb9Zp48VVrfVAaIwMzU1DtOzNMi9beQAS6/2Rcw==`。

## v1.4.3 Wallpaper Engine 壁纸背景
- 新增独立 Wallpaper Engine 启用开关，默认关闭；选择项目不会自动接管背景，停用后保留上次选择，可随时恢复。

- 更新 `package.json`、`package-lock.json` 和前端 `APP_VERSION` 为 `1.4.3`。
- 基于 `v1.4.2` 接入 Wallpaper Engine 壁纸背景：本机库识别、手动导入、Video/图片直播、Scene 原生引擎运行。
- 视觉控制台新增识别、导入、收藏、隐藏和恢复原背景入口；Scene 自动静音壁纸音频。
- 新增 `desktop/wallpaper-engine-library.js`、`desktop/wallpaper-engine-runtime.js`、`desktop/wallpaper-engine-bridge.js` 与前端 `public/wallpaper-engine.js` / `public/wallpaper-engine.css`。
- 新增 `tests/wallpaper-engine-library.test.js`；主进程/预加载/服务端/渲染器语法检查和 `git diff --check` 通过。
- 修复部分下载器写入 FLAC 的 `kuwo` / `酷我` 等来源占位标签覆盖文件名歌曲信息；元数据缓存 schema 升为 `3`，旧错误缓存会自动重新解析。
- 本地曲库确认支持 D 盘三级及更深目录递归扫描；新增三级目录 FLAC 回归和来源占位标签回归，定向 Node 回归 `25/25` 通过。
- Windows x64 NSIS 发布只包含安装器、`.blockmap`、`latest.yml` 和 SHA256 清单，不生成或上传 Portable ZIP。
- Windows x64 NSIS 构建使用 Electron `43.4.0` 完成；本次重打安装器 `101541957` 字节，blockmap `105957` 字节，`latest.yml` `347` 字节。
- SHA256：安装器 `6DE4175B768EC0D79337C309D7814F2784B462982952D7A51F10DF199B12B830`；blockmap `82FCB857DB678D2060BBB80E3442FECF8B439B0158C02D40A2C1109C08875CD3`；`latest.yml` `80165724A4A5CAB7B058C564F56339F7F2B6B5E6F6B016B8866D796E4B30ED65`；SHA256 清单 `EB572A2771FAB4B4FB07A6119EB896BFDE4810EC3EA4B4787B4CCE169CAE2EFF`。
- `latest.yml` 的 Setup SHA512：`zUP28omYhcuktRnf1D2sn1gVvJVCJ27VrxoHQ6vN5fWiaKoQPou/WPoVPOmg7wbHATqyXJ+DBsCj29/pHwKdjw==`。
- GitHub Release：`https://github.com/oirge/Mineradio/releases/tag/v1.4.3`；本地已重建并验证包含 FLAC 来源占位标签修复，发布资产使用本次验证过的安装包。

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
