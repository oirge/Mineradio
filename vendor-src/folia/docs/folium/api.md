<!-- 本文件由 `npm run folium:api` 从 src/mods/folium/contract.ts 生成，请勿手动修改。 -->

# Folium API 参考

当前契约版本：**Folium 1.4**（运行时用 `folium.host.folium.minor` 做功能探测）。

本文列出模组能用到的全部公开类型，内容直接来自契约文件 [`src/mods/folium/contract.ts`](../../src/mods/folium/contract.ts)，
成员说明保留契约里的原文注释。平台规则（清单、权限、生命周期、安全模型）见 [Folium 规范](../../mods/README.md)，
从零开始写模组、调试与发布到模组市场见 [模组开发与贡献指南](contributing.md)。

## 目录

- **客户端入口**：[FoliumContextKind](#foliumcontextkind) · [FoliumHostInfo](#foliumhostinfo) · [FoliumStorage](#foliumstorage) · [FoliumRpc](#foliumrpc) · [FoliumLogger](#foliumlogger) · [FoliumClientApi](#foliumclientapi) · [FoliumClientModule](#foliumclientmodule)
- **注册表与条目**：[FoliumVisualizerDef](#foliumvisualizerdef) · [FoliumTuningDef](#foliumtuningdef) · [FoliumCommandContext](#foliumcommandcontext) · [FoliumCommandDef](#foliumcommanddef) · [FoliumBackgroundContext](#foliumbackgroundcontext) · [FoliumBackgroundDef](#foliumbackgrounddef) · [FoliumStageSlot](#foliumstageslot) · [FoliumStageLayerDef](#foliumstagelayerdef) · [FoliumSettingsSectionDef](#foliumsettingssectiondef) · [FoliumPlayerPanelTabDef](#foliumplayerpaneltabdef) · [FoliumProgressContext](#foliumprogresscontext) · [FoliumControlSlot](#foliumcontrolslot) · [FoliumControlButtonDef](#foliumcontrolbuttondef) · [FoliumProgressLayerDef](#foliumprogresslayerdef) · [FoliumStyleDef](#foliumstyledef) · [FoliumRegistryHandle](#foliumregistryhandle) · [FoliumSettingsSectionHandle](#foliumsettingssectionhandle) · [FoliumRegistry](#foliumregistry) · [FoliumRegistries](#foliumregistries)
- **宿主容器与上下文**：[FoliumMount](#foliummount) · [FoliumPanelContext](#foliumpanelcontext) · [FoliumSettingsPanelContext](#foliumsettingspanelcontext) · [FoliumClock](#foliumclock) · [FoliumSurface](#foliumsurface) · [FoliumAudioBands](#foliumaudiobands) · [FoliumAudio](#foliumaudio) · [FoliumDisplay](#foliumdisplay) · [FoliumStageContext](#foliumstagecontext)
- **事件**：[FoliumEventPriority](#foliumeventpriority) · [FoliumNotificationEvents](#foliumnotificationevents) · [FoliumLyricsTransformEvent](#foliumlyricstransformevent) · [FoliumBeforePlayEvent](#foliumbeforeplayevent) · [FoliumOmniLyricsEvent](#foliumomnilyricsevent) · [FoliumOmniAudioEvent](#foliumomniaudioevent) · [FoliumHookEvents](#foliumhookevents) · [FoliumEventMap](#foliumeventmap) · [FoliumEvents](#foliumevents)
- **服务**：[FoliumPlaybackService](#foliumplaybackservice) · [FoliumFileHandle](#foliumfilehandle) · [FoliumIconOptions](#foliumiconoptions) · [FoliumUiService](#foliumuiservice) · [FoliumFetchInit](#foliumfetchinit) · [FoliumFetchResponse](#foliumfetchresponse) · [FoliumNetService](#foliumnetservice)
- **共享工具**：[FoliumWordSegment](#foliumwordsegment) · [FoliumWordColorRange](#foliumwordcolorrange) · [FoliumLyricsHelpers](#foliumlyricshelpers) · [FoliumThemeHelpers](#foliumthemehelpers)
- **参数 schema**：[FoliumParamType](#foliumparamtype) · [FoliumParamOption](#foliumparamoption) · [FoliumParam](#foliumparam) · [FoliumParamValues](#foliumparamvalues) · [FoliumParamAccess](#foliumparamaccess)
- **数据结构**：[FoliumLyricRuby](#foliumlyricruby) · [FoliumLyricSyllable](#foliumlyricsyllable) · [FoliumLyricAlternateText](#foliumlyricalternatetext) · [FoliumWord](#foliumword) · [FoliumBackgroundVocal](#foliumbackgroundvocal) · [FoliumLineTimingClass](#foliumlinetimingclass) · [FoliumLineTransitionMode](#foliumlinetransitionmode) · [FoliumWordRevealMode](#foliumwordrevealmode) · [FoliumLineRenderHints](#foliumlinerenderhints) · [FoliumLine](#foliumline) · [FoliumTheme](#foliumtheme) · [FoliumSong](#foliumsong) · [FoliumPlaybackState](#foliumplaybackstate) · [FoliumPlaybackSnapshot](#foliumplaybacksnapshot) · [FoliumLyricFormat](#foliumlyricformat) · [FoliumLyricsTrack](#foliumlyricstrack) · [FoliumLyricsResult](#foliumlyricsresult) · [FoliumLegacyLyricsResult](#foliumlegacylyricsresult) · [FoliumParsedLyrics](#foliumparsedlyrics)
- **实验接口**：[FoliumProviderSong](#foliumprovidersong) · [FoliumAudioQuality](#foliumaudioquality) · [FoliumOmniProviderDef](#foliumomniproviderdef)
- **基础类型**：[FOLIUM_VERSION](#folium_version) · [FoliumId](#foliumid) · [FoliumLabel](#foliumlabel) · [FoliumDisposer](#foliumdisposer)
- **main 入口（Node）**：[api 对象](#main-入口node)

## 客户端入口

模组的 `client` 入口默认导出 `activate(folium)`，参数就是 [FoliumClientApi](#foliumclientapi)，所有能力都从这里取。

### FoliumContextKind

Where a client runs: the main window, or the transparent video export window.

```ts
type FoliumContextKind = 'main' | 'export'
```

### FoliumHostInfo

The host, for runtime feature detection (`folium.host`).

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `folium` | `{ major: number; minor: number }` | The Folium version (`major`, `minor`). |
| `folia` | `string \| null` | Folia app version, or null when the host cannot tell. |

### FoliumStorage

`folium.storage`: this mod's data file (shared with its main entry, 1 MB). Needs the `filesystem.data`
permission; values must be JSON-serializable.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `get()` | `<T = unknown>(key: string): Promise<T \| undefined>` | The stored value, or undefined. |
| `set()` | `(key: string, value: unknown): Promise<void>` | Stores a JSON-serializable value. |
| `has()` | `(key: string): Promise<boolean>` | Whether the key exists. |
| `delete()` | `(key: string): Promise<void>` | Removes the key. |
| `keys()` | `(): Promise<string[]>` | All keys. |

### FoliumRpc

`folium.rpc`: calls into this mod's main entry.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `call()` | `<T = unknown>(name: string, ...args: unknown[]): Promise<T>` | Calls the function the main entry registered with `api.rpc.handle(name, fn)`; arguments and result must be JSON-serializable. |

### FoliumLogger

`folium.log`. `error` entries show in the mods panel under the mod.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `info()` | `(message: string, details?: unknown): void` | Informational log. |
| `warn()` | `(message: string, details?: unknown): void` | Warning. |
| `error()` | `(message: string, details?: unknown): void` | Error; shown in the mods panel. |

### FoliumClientApi

The object a client entry's `activate(folium)` receives.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly modId` | `string` | This mod's id. |
| `readonly host` | `FoliumHostInfo` | Host versions, for feature detection. |
| `readonly env` | `{ readonly context: FoliumContextKind }` | Where this client runs. |
| `readonly log` | `FoliumLogger` | Logging. |
| `readonly registries` | `FoliumRegistries` | Everything a mod can add to the host. |
| `readonly events` | `FoliumEvents` | The event bus. |
| `readonly playback` | `FoliumPlaybackService` | Playback state and control. |
| `readonly ui` | `FoliumUiService` | Toasts, panels, files, embeds, icons. |
| `readonly net` | `FoliumNetService` | Network access through the host. |
| `readonly storage` | `FoliumStorage` | This mod's data file. |
| `readonly rpc` | `FoliumRpc` | Calls into this mod's main entry. |
| `readonly lyrics` | `FoliumLyricsHelpers` | Folium 1.3. |
| `readonly theme` | `FoliumThemeHelpers` | Folium 1.3. |
| `readonly experimental` | `Readonly<Record<string, unknown>>` | Unfrozen surfaces; each requires the matching manifest `experimental` opt-in. |
| `readonly internals` | `Readonly<Record<string, unknown>>` | Host internals with no compatibility promise. Only available when the manifest pins host versions with `"folia"`; otherwise accessing it throws. |

相关：[FoliumHostInfo](#foliumhostinfo) · [FoliumContextKind](#foliumcontextkind) · [FoliumLogger](#foliumlogger) · [FoliumRegistries](#foliumregistries) · [FoliumEvents](#foliumevents) · [FoliumPlaybackService](#foliumplaybackservice) · [FoliumUiService](#foliumuiservice) · [FoliumNetService](#foliumnetservice) · [FoliumStorage](#foliumstorage) · [FoliumRpc](#foliumrpc) · [FoliumLyricsHelpers](#foliumlyricshelpers) · [FoliumThemeHelpers](#foliumthemehelpers)

### FoliumClientModule

The shape of a client entry module.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `default` | `(folium: FoliumClientApi) => void \| FoliumDisposer \| Promise<void \| FoliumDisposer>` | `activate(folium)`; may return a disposer, which runs before the host removes the mod's registrations. |

相关：[FoliumClientApi](#foliumclientapi) · [FoliumDisposer](#foliumdisposer)

## 注册表与条目

`folium.registries.<名称>.register(def)` 返回 [FoliumRegistryHandle](#foliumregistryhandle)。条目 id 由宿主加上命名空间成为 `<modid>:<id>`；模组停用时宿主自动撤下它注册的一切。

### FoliumVisualizerDef

A lyric animation mode. Its mode id is `mod:<modid>:<id>`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id; the mode id becomes `mod:<modid>:<id>`. |
| `label` | `FoliumLabel` | Name in the mode picker. |
| `order?` | `number` | Position in the mode picker; default 500 (after builtin modes). |
| `mount` | `FoliumMount<FoliumStageContext>` | Draws the visualizer into its container. |
| `settings?` | `FoliumParam[]` | Settings schema; the host renders the form under the mode picker, persists the values and includes them in visual config import/export. |
| `settingsPanel?` | `FoliumMount<FoliumSettingsPanelContext>` | Replaces the host-rendered form; values still follow `settings`. |
| `hostLayers?` | `{ background?: boolean; subtitles?: boolean }` | Host-rendered layers around the visualizer. Both default to true. |

相关：[FoliumLabel](#foliumlabel) · [FoliumMount](#foliummount) · [FoliumStageContext](#foliumstagecontext) · [FoliumParam](#foliumparam) · [FoliumSettingsPanelContext](#foliumsettingspanelcontext)

### FoliumTuningDef

Extra tuning knobs for a builtin visualizer mode that declares Folium tunables.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `target` | `string` | A builtin visualizer mode that declares `foliumTunables`, e.g. "sonnet". |
| `label` | `FoliumLabel` | Card title. |
| `params` | `FoliumParam[]` | Number params only; keys and ranges are checked against the target's whitelist. |

相关：[FoliumLabel](#foliumlabel) · [FoliumParam](#foliumparam)

### FoliumCommandContext

What a command receives when it runs.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly values` | `FoliumParamValues` | Validated parameter values (defaults merged). |

相关：[FoliumParamValues](#foliumparamvalues)

### FoliumCommandDef

A command in the mods panel and the command palette. `run` executes in the renderer; hand Node work to the
main entry through `folium.rpc`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `label` | `FoliumLabel` | Command name. |
| `description?` | `FoliumLabel` | Shown under the name. |
| `keywords?` | `string[]` | Extra search terms for the command palette (label texts are always included). |
| `params?` | `FoliumParam[]` | Shown in the mods panel and the command palette; a palette entry with params opens a form. |
| `run()` | `(ctx: FoliumCommandContext): unknown \| Promise<unknown>` | Runs the command; the result is shown as a summary (a string, `{ outputPath }` or `{ message }`). |

相关：[FoliumLabel](#foliumlabel) · [FoliumParam](#foliumparam) · [FoliumCommandContext](#foliumcommandcontext)

### FoliumBackgroundContext

Lyric-free context for background types: they paint behind every mode, previews included.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly staticMode` | `boolean` | A still preview: draw one frame, do not animate. |
| `isPaused()` | `(): boolean` | Playback is paused. |
| `getTheme()` | `(): FoliumTheme` | The current theme. |
| `getSettings()` | `(): FoliumParamValues` | This background's settings values (defaults merged). |
| `getCoverUrl()` | `(): string \| null` | Cover image URL of the displayed song. |
| `subscribe()` | `(listener: () => void): FoliumDisposer` | Called when pause, theme, settings or cover change. |
| `readonly audio` | `FoliumAudio` | Folium 1.2. |

相关：[FoliumTheme](#foliumtheme) · [FoliumParamValues](#foliumparamvalues) · [FoliumDisposer](#foliumdisposer) · [FoliumAudio](#foliumaudio)

### FoliumBackgroundDef

A background type in the background picker; it paints behind every mode, previews and export included.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `label` | `FoliumLabel` | Name in the background picker. |
| `order?` | `number` | Position in the picker; default 500. |
| `mount` | `FoliumMount<FoliumBackgroundContext>` | Draws the background into its container. |
| `settings?` | `FoliumParam[]` | Settings schema, as for visualizers. |
| `settingsPanel?` | `FoliumMount<FoliumSettingsPanelContext>` | Replaces the host-rendered form; values still follow `settings`. |

相关：[FoliumLabel](#foliumlabel) · [FoliumMount](#foliummount) · [FoliumBackgroundContext](#foliumbackgroundcontext) · [FoliumParam](#foliumparam) · [FoliumSettingsPanelContext](#foliumsettingspanelcontext)

### FoliumStageSlot

Where a stage layer sits on the player page:
  - `player.stage.back`: above the background, under the lyrics;
  - `player.stage.front`: above the lyrics, under the player chrome;
  - `app.overlay`: above the whole app.

```ts
type FoliumStageSlot = 'player.stage.back' | 'player.stage.front' | 'app.overlay'
```

### FoliumStageLayerDef

A layer on the live player page (never in previews, OBS sources or the export window). Needs the `ui.stage`
permission.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `slot` | `FoliumStageSlot` | Where the layer sits. |
| `order?` | `number` | Stacking order within the slot; default 500. |
| `interactive?` | `boolean` | When false (default) the layer is click-through, so it cannot block the player; elements that should still take clicks set `pointer-events: auto`. When true the whole layer captures the pointer. |
| `mount` | `FoliumMount<FoliumStageContext>` | Draws the layer into its container. |

相关：[FoliumStageSlot](#foliumstageslot) · [FoliumMount](#foliummount) · [FoliumStageContext](#foliumstagecontext)

### FoliumSettingsSectionDef

The mod's own settings, shown in the mods panel when the mod's row is expanded. Values are readable in
every context.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `label` | `FoliumLabel` | Section title. |
| `description?` | `FoliumLabel` | Shown under the title. |
| `settings` | `FoliumParam[]` | The fields. |
| `settingsPanel?` | `FoliumMount<FoliumSettingsPanelContext>` | Replaces the host-rendered form; values still follow `settings`. |

相关：[FoliumLabel](#foliumlabel) · [FoliumParam](#foliumparam) · [FoliumMount](#foliummount) · [FoliumSettingsPanelContext](#foliumsettingspanelcontext)

### FoliumPlayerPanelTabDef

A tab in the player panel. `folium.ui.openPlayerPanel(id)` opens it.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id; pass it to `folium.ui.openPlayerPanel`. |
| `label` | `FoliumLabel` | Tab title. |
| `order?` | `number` | Tab order; default 500. |
| `mount` | `FoliumMount<FoliumPanelContext>` | Draws the tab into its container. |

相关：[FoliumLabel](#foliumlabel) · [FoliumMount](#foliummount) · [FoliumPanelContext](#foliumpanelcontext)

### FoliumProgressContext

Progress-bar context shared by control buttons and progress layers.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly currentTime` | `FoliumClock` | The playback clock (audio time). |
| `getDuration()` | `(): number` | Track duration, seconds; 0 when unknown. |
| `timeToRatio()` | `(seconds: number): number` | 0..1 position of a time on the track (0 when the duration is unknown). |
| `seek()` | `(seconds: number): void` | Seeks the host player; ignored while the host bar is disabled. |
| `getColors()` | `(): { fill: string; track: string; text: string }` | The host bar's colors, so mod UI can match it. |
| `subscribe()` | `(listener: () => void): FoliumDisposer` | Called when the duration or the colors change. |

相关：[FoliumClock](#foliumclock) · [FoliumDisposer](#foliumdisposer)

### FoliumControlSlot

The side of the progress bar a control button sits on.

```ts
type FoliumControlSlot = 'progress.leading' | 'progress.trailing'
```

### FoliumControlButtonDef

A button next to the progress bar. All three host progress bars (floating controls x2, Lattice) show it.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `slot` | `FoliumControlSlot` | Left or right of the bar. |
| `order?` | `number` | Order within the slot; default 500. |
| `hideWhenCollapsed?` | `boolean` | Folium 1.3: leave the collapsed floating capsule alone. The button is not mounted there, only on the expanded capsule and Lattice. Default false. |
| `mount` | `FoliumMount<FoliumProgressContext>` | Draws the button into its container. |

相关：[FoliumControlSlot](#foliumcontrolslot) · [FoliumMount](#foliummount) · [FoliumProgressContext](#foliumprogresscontext)

### FoliumProgressLayerDef

A layer over the progress track. Its container is click-through so seeking
keeps working; elements that should take clicks set `pointer-events: auto`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `order?` | `number` | Stacking order; default 500. |
| `mount` | `FoliumMount<FoliumProgressContext>` | Draws the layer into its container, which spans the track. |

相关：[FoliumMount](#foliummount) · [FoliumProgressContext](#foliumprogresscontext)

### FoliumStyleDef

Mod CSS, injected inside `@layer folium-mods` and removed with the mod. The
stable targets are the host's public parts: `[data-folium-part="progress.track"]` etc.
(see mods/README.md for the list). Anything else in the host DOM is not API.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local id. |
| `css` | `string` | The stylesheet. |

### FoliumRegistryHandle

What `register` returns.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly id` | `FoliumId` | Full namespaced id (`modid:name`). |
| `unregister()` | `(): void` | Removes the entry now (the host also removes it when the mod stops). |

相关：[FoliumId](#foliumid)

### FoliumSettingsSectionHandle

What `settingsSections.register` returns: the handle plus the section's values.

```ts
interface FoliumSettingsSectionHandle extends FoliumRegistryHandle
```

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly params` | `FoliumParamAccess` | The section's values (defaults merged) and write access. |

相关：[FoliumRegistryHandle](#foliumregistryhandle) · [FoliumParamAccess](#foliumparamaccess)

### FoliumRegistry

Every registry has this one method.

```ts
interface FoliumRegistry<Def, Handle extends FoliumRegistryHandle = FoliumRegistryHandle>
```

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `register()` | `(def: Def): Handle` | Adds an entry; throws on an invalid definition or a duplicate id. |

相关：[FoliumRegistryHandle](#foliumregistryhandle)

### FoliumRegistries

All registries, as `folium.registries`. UI-only ones (commands, stageLayers, playerPanelTabs,
controlButtons, progressLayers, styles) accept registrations and do nothing in the export window.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `visualizers` | `FoliumRegistry<FoliumVisualizerDef>` | Lyric animation modes. |
| `tunings` | `FoliumRegistry<FoliumTuningDef>` | Tuning knobs for builtin modes. |
| `commands` | `FoliumRegistry<FoliumCommandDef>` | Commands. |
| `backgrounds` | `FoliumRegistry<FoliumBackgroundDef>` | Background types. |
| `stageLayers` | `FoliumRegistry<FoliumStageLayerDef>` | Player page layers (`ui.stage`). |
| `settingsSections` | `FoliumRegistry<FoliumSettingsSectionDef, FoliumSettingsSectionHandle>` | The mod's own settings. |
| `playerPanelTabs` | `FoliumRegistry<FoliumPlayerPanelTabDef>` | Player panel tabs. |
| `controlButtons` | `FoliumRegistry<FoliumControlButtonDef>` | Progress bar buttons. |
| `progressLayers` | `FoliumRegistry<FoliumProgressLayerDef>` | Layers over the progress track. |
| `styles` | `FoliumRegistry<FoliumStyleDef>` | Mod CSS for public parts. |

相关：[FoliumRegistry](#foliumregistry) · [FoliumVisualizerDef](#foliumvisualizerdef) · [FoliumTuningDef](#foliumtuningdef) · [FoliumCommandDef](#foliumcommanddef) · [FoliumBackgroundDef](#foliumbackgrounddef) · [FoliumStageLayerDef](#foliumstagelayerdef) · [FoliumSettingsSectionDef](#foliumsettingssectiondef) · [FoliumSettingsSectionHandle](#foliumsettingssectionhandle) · [FoliumPlayerPanelTabDef](#foliumplayerpaneltabdef) · [FoliumControlButtonDef](#foliumcontrolbuttondef) · [FoliumProgressLayerDef](#foliumprogresslayerdef) · [FoliumStyleDef](#foliumstyledef)

## 宿主容器与上下文

界面类条目都是 `mount(container, ctx) => dispose?`：宿主创建并回收容器，通过 `ctx` 提供时钟、主题、设置、音频等只读信息与订阅。

### FoliumMount

Everything UI-shaped is mounted into a container the host owns. The host
creates it (inside a ShadowRoot for panels), passes theme colors as
`--folium-*` CSS custom properties, and calls the disposer when it removes the
container. Mods never query or mutate host DOM outside their container.

```ts
type FoliumMount<Ctx> = (container: HTMLElement, ctx: Ctx) => void | FoliumDisposer
```

相关：[FoliumDisposer](#foliumdisposer)

### FoliumPanelContext

Context for panel-like containers (player panel tabs, settings panels).

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly locale` | `string` | The UI locale, e.g. `zh-CN`. |
| `getTheme()` | `(): FoliumTheme` | The current theme. |
| `subscribe()` | `(listener: () => void): FoliumDisposer` | Called when the theme changes. |

相关：[FoliumTheme](#foliumtheme) · [FoliumDisposer](#foliumdisposer)

### FoliumSettingsPanelContext

Context for a custom settings panel (`settingsPanel`): the panel draws the form, the schema still owns the
values.

```ts
interface FoliumSettingsPanelContext extends FoliumPanelContext
```

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly params` | `FoliumParamAccess` | Read and write the values the schema describes. |

相关：[FoliumPanelContext](#foliumpanelcontext) · [FoliumParamAccess](#foliumparamaccess)

### FoliumClock

A clock in seconds. `on` fires while it runs; read it with `get` when you need it now.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `get()` | `(): number` | Current time, seconds. |
| `on()` | `(event: 'change', listener: (seconds: number) => void): FoliumDisposer` | Called with the time on every change. |

相关：[FoliumDisposer](#foliumdisposer)

### FoliumSurface

What the host draws around the content.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `transparent` | `boolean` | The host renders onto a transparent surface (OBS source, alpha export). |
| `hostBackground` | `boolean` | The host is painting its configured background under this content. |

### FoliumAudioBands

Analyser band energies, each 0..1.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly bass` | `number` | 20–150 Hz |
| `readonly lowMid` | `number` | 150–400 Hz |
| `readonly mid` | `number` | 400–1200 Hz |
| `readonly vocal` | `number` | 1000–3500 Hz |
| `readonly treble` | `number` | 3500 Hz and up |

### FoliumAudio

Folium 1.2: the host's audio analyser, for audio-reactive content. Values
change every frame and nothing is announced: read them inside your own frame
loop. Previews feed a synthetic signal; silence (or no analyser) reads as 0.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `getPower()` | `(): number` | Overall energy (bass + low mid, shaped), 0..1. |
| `getBands()` | `(): FoliumAudioBands` | The same object on every call, refreshed in place; copy it to keep a reading. |
| `getSpectrum()` | `(): Uint8Array \| null` | Raw analyser FFT magnitudes (0–255), or null when there are none. The host reuses the array. |

相关：[FoliumAudioBands](#foliumaudiobands)

### FoliumDisplay

Context for lyric-synced content (visualizers, stage layers).
Snapshot fields are fixed for one mount; the host remounts only when the
lyric data, the song or `staticMode` changes (or the preview line in static
mode). Everything else is read through getters, and `subscribe` fires when
any getter's value changes, including while paused, when `currentTime` is idle.

Folium 1.3: the host's display settings for lyric content, named and valued
as builtin modes receive them. A mod that turns off `hostLayers.subtitles`
and draws its own reads the subtitle settings here.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `showText` | `boolean` | False while lyrics should not be drawn (e.g. the settings modal covers the player). |
| `lyricsFontScale` | `number` | The user's lyric size multiplier; builtin modes scale lyric text by it. |
| `subtitleFontScale` | `number` | Subtitle size multiplier. |
| `subtitleOverlayOpacity` | `number` | Subtitle opacity, 0..1. |
| `subtitleOverlayBackground` | `boolean` | Subtitles get a backing plate. |
| `subtitleUpcomingLyricsBlur` | `boolean` | Upcoming-line subtitles are blurred. |
| `showHarmonySubtitle` | `boolean` | Background vocals are shown as subtitles. |
| `harmonySubtitleBackground` | `boolean` | Harmony subtitles get a backing plate. |
| `showSubtitleTranslation` | `boolean` | Subtitles show a translation or romanization. |
| `hideTranslationSubtitle` | `boolean` | The host hides translation subtitles here (e.g. the lyrics already carry them). |
| `subtitleContentMode` | `'translation' \| 'romanization' \| 'none'` | What subtitles show. |
| `isPlayerChromeHidden` | `boolean` | The player controls are hidden. |
| `isPanelOpen` | `boolean` | The player panel is open. |
| `visualizerOpacity` | `number` | Lyric layer opacity, 0..1. |

### FoliumStageContext

Context for lyric-synced content (visualizers, stage layers). Snapshot fields are fixed for one mount; the
host remounts only when the lyric data, the song or `staticMode` changes (or the preview line in static
mode). Everything else is read through getters, and `subscribe` fires when any getter's value changes,
including while paused, when `currentTime` is idle.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly lines` | `readonly FoliumLine[]` | Lyrics of this song (fixed for the mount). |
| `readonly song` | `FoliumSong \| null` | This song (fixed for the mount). |
| `readonly staticMode` | `boolean` | A still preview: draw one frame of `staticLineIndex`, do not animate. |
| `readonly staticLineIndex` | `number \| null` | Only meaningful in static mode: the line the preview shows. |
| `readonly seed` | `string \| null` | Folium 1.3: the geometry seed builtin modes get (the displayed song's id, or a per-mode fallback). Stable per song, identical in previews, playback and export, so seeded randomness matches everywhere. |
| `readonly isPreview` | `boolean` | Folium 1.3: rendering inside a settings preview rather than the player page. |
| `readonly currentTime` | `FoliumClock` | The lyric clock. |
| `getLineIndex()` | `(): number` | Index into `lines` of the active line; -1 between lines. |
| `isPaused()` | `(): boolean` | Playback is paused. |
| `getTheme()` | `(): FoliumTheme` | The current theme. |
| `getSubtitleTheme()` | `(): FoliumTheme` | Folium 1.3: the theme the host's subtitles use; equals getTheme() where there is none. |
| `getCoverUrl()` | `(): string \| null` | Folium 1.3. |
| `getDisplay()` | `(): FoliumDisplay` | Folium 1.3. The same object until a value changes; `subscribe` announces changes. |
| `getSettings()` | `(): FoliumParamValues` | This entry's settings values (defaults merged); empty without a schema. |
| `getSurface()` | `(): FoliumSurface` | What the host draws around this content. |
| `subscribe()` | `(listener: () => void): FoliumDisposer` | Called when the line index, pause, theme, subtitle theme, cover, display, settings or surface change. |
| `readonly audio` | `FoliumAudio` | Folium 1.2. |

相关：[FoliumLine](#foliumline) · [FoliumSong](#foliumsong) · [FoliumClock](#foliumclock) · [FoliumTheme](#foliumtheme) · [FoliumDisplay](#foliumdisplay) · [FoliumParamValues](#foliumparamvalues) · [FoliumSurface](#foliumsurface) · [FoliumDisposer](#foliumdisposer) · [FoliumAudio](#foliumaudio)

## 事件

`folium.events.on(type, handler, { priority })`。通知只读、事后发出；钩子让处理器依次修改同一个事件对象。`omni.*` 需要选用实验接口 `omni.hooks`。

### FoliumEventPriority

Handler order for one event type; handlers of the same priority run in registration order.

```ts
type FoliumEventPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest'
```

### FoliumNotificationEvents

Read-only notifications, emitted after the fact.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `playback.songChanged` | `{ readonly song: FoliumSong \| null }` | The displayed song changed. |
| `playback.stateChanged` | `{ readonly state: FoliumPlaybackState }` | Playing, paused or stopped. |
| `playback.seeked` | `{ readonly position: number }` | The user or a mod seeked; `position` in seconds. |
| `lyrics.loaded` | `{ readonly song: FoliumSong \| null; readonly lines: readonly FoliumLine[] }` | Lyrics for the displayed song are ready (after `lyrics.transform`). |
| `app.viewChanged` | `{ readonly view: string }` | The app switched views (e.g. `home`, `player`). |
| `visualizer.modeChanged` | `{ readonly mode: string }` | The lyric animation mode changed. |
| `theme.changed` | `{ readonly theme: FoliumTheme }` | The theme or daylight mode changed. |
| `playback.likeChanged` | `{ readonly liked: boolean }` | Folium 1.3: `playback.getState().liked` changed (a like or unlike, or a new song). |

相关：[FoliumSong](#foliumsong) · [FoliumPlaybackState](#foliumplaybackstate) · [FoliumLine](#foliumline) · [FoliumTheme](#foliumtheme)

### FoliumLyricsTransformEvent

Synchronous hook: runs when new lyrics reach the player, before they are
shown. Assign `lines` to rewrite them; lines left untouched (same object)
keep all their host-side data, new or changed ones are built from the DTO.

Always runs on untransformed lyrics, never on its own output: when the host
rebuilds lyrics already on screen (e.g. a word-segmentation update) it
starts again from the untransformed version, so handlers need not be
idempotent.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly song` | `FoliumSong \| null` | The song the lyrics belong to. |
| `lines` | `readonly FoliumLine[]` | Assign a new array to rewrite the lyrics. |

相关：[FoliumSong](#foliumsong) · [FoliumLine](#foliumline)

### FoliumBeforePlayEvent

Async hook: runs before a song starts. Handlers may cancel it or play
another song instead. Not run for the track an automix blend advances to:
the blend starts that track seconds early on a fixed schedule and cannot
wait for handlers.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly song` | `FoliumSong` | The song about to play. |
| `readonly cancelled` | `boolean` | A handler already cancelled. |
| `cancel()` | `(): void` | Stops the song from playing; later handlers are skipped. |
| `replaceWith()` | `(song: FoliumSong): void` | Plays this song instead; it must carry a `ref` from the host. |

相关：[FoliumSong](#foliumsong)

### FoliumOmniLyricsEvent

EXPERIMENTAL (manifest `experimental: ["omni.hooks"]`): Omni answered with
lyrics for an online song. Same line rules as `lyrics.transform`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly song` | `FoliumSong` | The online song. |
| `lines` | `readonly FoliumLine[]` | Assign a new array to rewrite the lyrics. |
| `readonly isPureMusic` | `boolean` | Omni reported the song as instrumental. |

相关：[FoliumSong](#foliumsong) · [FoliumLine](#foliumline)

### FoliumOmniAudioEvent

EXPERIMENTAL (`omni.hooks`): Omni resolved an audio URL; assign `url` to use another one.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly song` | `FoliumSong` | The online song. |
| `url` | `string \| null` | Assign another https URL to play that instead. |

相关：[FoliumSong](#foliumsong)

### FoliumHookEvents

Hooks: every handler receives the same event object, in priority order, and may change it.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `lyrics.transform` | `FoliumLyricsTransformEvent` | Rewrite lyrics before they are shown (sync). |
| `playback.beforePlay` | `FoliumBeforePlayEvent` | Cancel or replace a song before it plays (async, 1.5 s per handler). |
| `omni.lyricsResolved` | `FoliumOmniLyricsEvent` | Rewrite lyrics Omni fetched (experimental, `omni.hooks`). |
| `omni.audioSourceResolved` | `FoliumOmniAudioEvent` | Replace the audio URL Omni resolved (experimental, `omni.hooks`). |

相关：[FoliumLyricsTransformEvent](#foliumlyricstransformevent) · [FoliumBeforePlayEvent](#foliumbeforeplayevent) · [FoliumOmniLyricsEvent](#foliumomnilyricsevent) · [FoliumOmniAudioEvent](#foliumomniaudioevent)

### FoliumEventMap

Every event type and its payload.

```ts
type FoliumEventMap = FoliumNotificationEvents & FoliumHookEvents
```

相关：[FoliumNotificationEvents](#foliumnotificationevents) · [FoliumHookEvents](#foliumhookevents)

### FoliumEvents

The event bus, as `folium.events`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `on()` | `<K extends keyof FoliumEventMap>(type: K, handler: (event: FoliumEventMap[K]) => void \| Promise<void>, options?: { priority?: FoliumEventPriority }): FoliumDisposer` | Adds a handler; returns its disposer. Each handler runs in its own error boundary; a sync handler over 16 ms logs a warning. |

相关：[FoliumEventMap](#foliumeventmap) · [FoliumEventPriority](#foliumeventpriority) · [FoliumDisposer](#foliumdisposer)

## 服务

`folium.playback` / `folium.ui` / `folium.net`。标注需要权限的方法未在 `mod.json` 声明对应权限时抛 `permission-denied:<权限>`；导出窗口里调用会抛 `*-unavailable-in-export-context`（`ui.icon` 除外）。

### FoliumPlaybackService

`folium.playback`. `getState` is always available; every other method needs the `playback.control`
permission. All of it is unavailable in the export window.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `getState()` | `(): { song: FoliumSong \| null; state: FoliumPlaybackState; position: number; duration: number; liked: boolean; canLike: boolean; }` | The displayed song, player state, position and duration (seconds). Folium 1.3: `liked` (the displayed song is liked; false with no song) and `canLike` (toggleLike would act now; the host's own like button greys out otherwise). |
| `play()` | `(): void` | Resumes playback. Needs `playback.control`. |
| `pause()` | `(): void` | Pauses. Needs `playback.control`. |
| `toggle()` | `(): void` | Play/pause. Needs `playback.control`. |
| `seek()` | `(seconds: number): void` | Seeks to a playback position (audio time), seconds. Needs `playback.control`. |
| `seekToLyricTime()` | `(lyricSeconds: number): void` | Folium 1.3: seeks to a point on the lyric clock, e.g. `line.startTime`, the way clicking a lyric line does in builtin modes. The host converts lyric time to playback time (lyric offsets, lyrics-only stage sources); `seek(line.startTime)` would land off by the offset. Ignored while the host has now-playing controls disabled. Needs `playback.control`. |
| `next()` | `(): void` | Next track. Needs `playback.control`. |
| `previous()` | `(): void` | Previous track. Needs `playback.control`. |
| `playSong()` | `(song: FoliumSong): Promise<boolean>` | Plays a song by its host `ref`. Resolves false when the ref is unknown. Needs `playback.control`. |
| `enqueue()` | `(song: FoliumSong): boolean` | Appends a song (by `ref`) to the queue. Needs `playback.control`. |
| `shuffleQueue()` | `(): boolean` | Folium 1.3: shuffles the play queue, keeping the current song first. False when there is nothing to shuffle (Personal FM, a queue of one, external Stage playback). Needs `playback.control`. |
| `toggleLike()` | `(): boolean` | Folium 1.3: likes or unlikes the displayed song, like the host's like button, which also reports the result. False when `canLike` is false. Needs `playback.control`. |

相关：[FoliumSong](#foliumsong) · [FoliumPlaybackState](#foliumplaybackstate)

### FoliumFileHandle

A local file the user picked for this mod.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `url` | `string` | folia-mod:// URL usable as a media/img src for this session. |
| `name` | `string` | File name. |
| `size` | `number` | Size in bytes. |
| `grantId?` | `string` | Folium 1.1: opaque id of a persisted grant (pickFile with `persist`, or restoreFile). Store it to get the file back after a restart. |

### FoliumIconOptions

Folium 1.2: options for `folium.ui.icon`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `size?` | `number` | Width and height in px. Default 24. |
| `strokeWidth?` | `number` | Stroke width in the icon's 24-unit grid. Default 2. |
| `color?` | `string` | Any CSS color. Default `currentColor`, so the icon follows the surrounding text. |

### FoliumUiService

`folium.ui`. Unavailable in the export window, except `icon`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `toast()` | `(message: string, options?: { type?: 'info' \| 'success' \| 'error'; durationMs?: number }): void` | Shows a status message. |
| `openPlayerPanel()` | `(tabId?: string): void` | Opens the player panel, optionally on one of this mod's panel tabs (local id). |
| `navigate()` | `(view: 'home' \| 'player'): void` | Switches to the home or player view. |
| `openVolume()` | `(): void` | Folium 1.3: opens the host volume panel (the command palette's volume command). |
| `pickFile()` | `(options?: { accept?: 'video' \| 'audio' \| 'image' \| 'any'; persist?: boolean }): Promise<FoliumFileHandle \| null>` | Lets the user pick a local file; null when cancelled. With `persist` (Folium 1.1) the pick is remembered for this mod and the handle carries a `grantId` for restoreFile. |
| `restoreFile()` | `(grantId: string): Promise<FoliumFileHandle \| null>` | Folium 1.1: a file this mod picked with `persist`, as a fresh session handle. Null when the grant is unknown to this mod or the file is gone. |
| `releaseFile()` | `(grantId: string): Promise<void>` | Folium 1.1: forgets a persisted grant. URLs already handed out keep working this session. |
| `embed()` | `(container: HTMLElement, url: string, options?: { title?: string; allow?: string[] }): FoliumDisposer` | Embeds an external page in `container` as a sandboxed iframe. The URL's origin must be listed in the manifest `embedOrigins` (needs `net.embed`). |
| `icon()` | `(name: string, options?: FoliumIconOptions): Promise<SVGSVGElement \| null>` | Folium 1.2: one of the host's icons (lucide, named as on lucide.dev, e.g. "play", "skip-forward") as a new <svg> element the mod owns; null for an unknown name. Works in every context, the export window included. |

相关：[FoliumFileHandle](#foliumfilehandle) · [FoliumDisposer](#foliumdisposer) · [FoliumIconOptions](#foliumiconoptions)

### FoliumFetchInit

Request options for `folium.net.fetch`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `method?` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' \| 'HEAD'` | Default `GET`. |
| `headers?` | `Record<string, string>` | Request headers. |
| `body?` | `string` | Request body (text). |
| `timeoutMs?` | `number` | Default 15000, at most 60000. |

### FoliumFetchResponse

A fully read response (body at most 5 MB); `text` and `json` return synchronously.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly ok` | `boolean` | Status is 2xx. |
| `readonly status` | `number` | HTTP status. |
| `readonly statusText` | `string` | HTTP status text. |
| `readonly headers` | `Readonly<Record<string, string>>` | Response headers, lowercase names. |
| `text()` | `(): string` | The body as text. |
| `json()` | `<T = unknown>(): T` | The body parsed as JSON; throws on invalid JSON. |

### FoliumNetService

`folium.net`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `fetch()` | `(url: string, init?: FoliumFetchInit): Promise<FoliumFetchResponse>` | Fetch through the host (no CORS limits); needs the `net.fetch` permission. |

相关：[FoliumFetchInit](#foliumfetchinit) · [FoliumFetchResponse](#foliumfetchresponse)

## 共享工具

`folium.lyrics` 与 `folium.theme`：内置歌词动画使用的同一批函数，主窗口与导出窗口都可用。`folium.lyrics.parse`（1.4）是唯一的异步方法，走本地歌词文件的解析流程。

### FoliumWordSegment

One word from `folium.lyrics.segmentWords`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `segment` | `string` | The segment text. |
| `index` | `number` | UTF-16 offset of the segment in the line's `fullText`. |
| `isWordLike` | `boolean` | False for whitespace and punctuation-only segments. |

### FoliumWordColorRange

A keyword-colored span of a line's `fullText` (UTF-16 offsets, end exclusive).

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `startOffset` | `number` | Start offset in `fullText` (UTF-16). |
| `endOffset` | `number` | End offset, exclusive. |
| `color` | `string` | CSS color from `wordColors`. |
| `priority` | `number` | Longer and more specific matches rank higher. |

### FoliumLyricsHelpers

Folium 1.3: the pure lyric helpers builtin modes share, so a mod lays out,
times and colors lines exactly as they do. Available in both contexts.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `getLineRenderEndTime()` | `(line: FoliumLine \| null \| undefined): number` | When the host stops showing the line: `renderHints.renderEndTime`. -Infinity for null. |
| `segmentWords()` | `(line: Pick<FoliumLine, 'fullText' \| 'wordSegments'>): FoliumWordSegment[]` | The user's saved split when valid, otherwise Intl.Segmenter word segmentation. |
| `getRecentCompletedLine()` | `(lines: readonly FoliumLine[], lineIndex: number, time: number): FoliumLine \| null` | With no active line (index -1): the last line already over, for subtitles in gaps. |
| `getUpcomingLine()` | `(lines: readonly FoliumLine[], lineIndex: number, time: number): FoliumLine \| null` | The next line: after the active one, or the first still ahead when none is active. |
| `getUpcomingLines()` | `(lines: readonly FoliumLine[], lineIndex: number, count?: number): FoliumLine[]` | Up to `count` (default 2) lines after the active one; empty when none is active. |
| `buildWordColorRanges()` | `(fullText: string, wordColors: FoliumTheme['wordColors']): FoliumWordColorRange[]` | Non-overlapping keyword color spans of `fullText` for `theme.wordColors`. |
| `resolveWordColor()` | `(wordText: string, wordColors: FoliumTheme['wordColors'], fallbackColor: string, options?: { cjkMatchMode?: 'target-contains-token' \| 'bidirectional-contains' \| 'exact' }): string` | The keyword color of one word, or `fallbackColor`. |
| `parse()` | `(track: FoliumLyricsTrack): Promise<FoliumParsedLyrics>` | Folium 1.4: parses a lyric document with the host's local lyric file pipeline, off the main thread. Rejects with a TypeError (`invalid-lyrics-track`) when the track is malformed. |

相关：[FoliumLine](#foliumline) · [FoliumWordSegment](#foliumwordsegment) · [FoliumTheme](#foliumtheme) · [FoliumWordColorRange](#foliumwordcolorrange) · [FoliumLyricsTrack](#foliumlyricstrack) · [FoliumParsedLyrics](#foliumparsedlyrics)

### FoliumThemeHelpers

Folium 1.3: theme resolution builtin modes use. Available in both contexts.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `resolveFontStack()` | `(theme: Pick<FoliumTheme, 'fontStyle' \| 'fontFamily' \| 'fontFamilyStack'>): string` | CSS font-family value for lyric text. |
| `resolveTranslationFontStack()` | `(theme: Pick<FoliumTheme, 'fontStyle' \| 'fontFamily' \| 'fontFamilyStack'>): string` | CSS font-family value for translations and subtitles. |
| `resolveFontWeight()` | `(theme: Pick<FoliumTheme, 'fontWeight'> \| null \| undefined, fallback: number): number` | The theme's weight, normalized, or `fallback`. |

相关：[FoliumTheme](#foliumtheme)

## 参数 schema

设置分区、visualizer / background 设置、tunings 与命令参数共用 [FoliumParam](#foliumparam)。读到的值已合并默认值，写入按 schema 校验。

### FoliumParamType

Field kinds: a slider, a text box, a switch, or a choice among `options`.

```ts
type FoliumParamType = 'number' | 'text' | 'boolean' | 'select'
```

### FoliumParamOption

One choice of a `select` field.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `value` | `string` | The stored value. |
| `label` | `FoliumLabel` | What the user sees. |

相关：[FoliumLabel](#foliumlabel)

### FoliumParam

One declarative field. The same schema drives settings sections, visualizer
settings, tunings of builtin modes and command parameters, and it is the only
source of keys, defaults and validation for the values it describes.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `key` | `string` | Value key, unique within the schema. |
| `type` | `FoliumParamType` | Field kind. |
| `label` | `FoliumLabel` | Field label. |
| `description?` | `FoliumLabel` | Help text. |
| `group?` | `FoliumLabel` | Fields sharing a group label render together under that heading. |
| `defaultValue?` | `string \| number \| boolean` | Used until the user changes the field; also what `reset` restores. |
| `min?` | `number` | `number`: lower bound (values are clamped). |
| `max?` | `number` | `number`: upper bound (values are clamped). |
| `step?` | `number` | `number`: slider step. Default 1 when both bounds are integers, else 0.01. |
| `placeholder?` | `string` | `text`: placeholder. |
| `options?` | `FoliumParamOption[]` | `select`: the choices; values outside them are rejected. |

相关：[FoliumParamType](#foliumparamtype) · [FoliumLabel](#foliumlabel) · [FoliumParamOption](#foliumparamoption)

### FoliumParamValues

Values keyed by field `key`, defaults merged. Read-only; write through `FoliumParamAccess.set`.

```ts
type FoliumParamValues = Readonly<Record<string, unknown>>
```

### FoliumParamAccess

Read/write access to one schema's persisted values (defaults already merged).

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `readonly schema` | `readonly FoliumParam[]` | The fields, as registered (invalid declarations dropped). |
| `get()` | `(): FoliumParamValues` | Current values, defaults merged. |
| `set()` | `(patch: Record<string, unknown>): void` | Validated against the schema: unknown keys are dropped, numbers clamped, selects checked. |
| `reset()` | `(): void` | Restores every default. |
| `subscribe()` | `(listener: () => void): FoliumDisposer` | Called after any value changes. |

相关：[FoliumParam](#foliumparam) · [FoliumParamValues](#foliumparamvalues) · [FoliumDisposer](#foliumdisposer)

## 数据结构

歌词行与主题与内置 visualizer 收到的 `Line` / `Theme` 同名同义，是宿主投影出的冻结副本。

### FoliumLyricRuby

Ruby (furigana) over part of a syllable. Times in seconds on the lyric clock.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `text` | `string` | The ruby text. |
| `startTime` | `number` | Start, seconds. |
| `endTime` | `number` | End, seconds. |

### FoliumLyricSyllable

One timed syllable of a word. Times in seconds on the lyric clock.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `text` | `string` | The syllable text. |
| `startTime` | `number` | Start, seconds. |
| `endTime` | `number` | End, seconds. |
| `endsWithSpace?` | `boolean` | A space follows this syllable. |
| `ruby?` | `FoliumLyricRuby[]` | Ruby over this syllable. |
| `obscene?` | `boolean` | Marked explicit by the lyric source. |
| `emptyBeat?` | `number` | Beats of silence after the syllable, from the lyric source. |

相关：[FoliumLyricRuby](#foliumlyricruby)

### FoliumLyricAlternateText

Another rendering of a line or vocal: a translation, a romanization, or another role from the lyric source.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `role` | `string` | 'translation', 'romanization' or another role from the lyric source. |
| `language?` | `string` | BCP 47 language tag, when the source gives one. |
| `text` | `string` | The full text. |
| `syllables?` | `FoliumLyricSyllable[]` | Timed syllables, when the source has them. |

相关：[FoliumLyricSyllable](#foliumlyricsyllable)

### FoliumWord

One timed word of a line. Times in seconds on the lyric clock.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `text` | `string` | The word text, including a trailing space when there is one. |
| `startTime` | `number` | Start, seconds. |
| `endTime` | `number` | End, seconds. |
| `syllables?` | `FoliumLyricSyllable[]` | Timed syllables, when the source has them. |

相关：[FoliumLyricSyllable](#foliumlyricsyllable)

### FoliumBackgroundVocal

A background vocal (harmony) attached to a line, timed and structured like a line.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `text` | `string` | The full text. |
| `startTime` | `number` | Start, seconds. |
| `endTime` | `number` | End, seconds. |
| `words` | `FoliumWord[]` | Timed words. |
| `agentId?` | `string` | The singer, when the source names one. |
| `translation?` | `string` | Translation text. |
| `romanization?` | `string` | Romanization text. |
| `alternateTexts?` | `FoliumLyricAlternateText[]` | All alternate texts from the source. |

相关：[FoliumWord](#foliumword) · [FoliumLyricAlternateText](#foliumlyricalternatetext)

### FoliumLineTimingClass

How short a line is: `micro` and `short` lines get faster transitions.

```ts
type FoliumLineTimingClass = 'normal' | 'short' | 'micro'
```

### FoliumLineTransitionMode

How the host moves a line in and out: full, fast, or no transition.

```ts
type FoliumLineTransitionMode = 'normal' | 'fast' | 'none'
```

### FoliumWordRevealMode

How the host reveals the words of a line: full, fast, or all at once.

```ts
type FoliumWordRevealMode = 'normal' | 'fast' | 'instant'
```

### FoliumLineRenderHints

How the host times a line on screen; builtin modes read the same values.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `rawDuration` | `number` | `endTime - startTime`, seconds. |
| `timingClass` | `FoliumLineTimingClass` | How short the line is. |
| `renderEndTime` | `number` | When the host stops showing the line (endTime plus hold/tail). |
| `lineTransitionMode` | `FoliumLineTransitionMode` | How the line moves in and out. |
| `wordRevealMode` | `FoliumWordRevealMode` | How its words are revealed. |

相关：[FoliumLineTimingClass](#foliumlinetimingclass) · [FoliumLineTransitionMode](#foliumlinetransitionmode) · [FoliumWordRevealMode](#foliumwordrevealmode)

### FoliumLine

One lyric line, the same fields and meanings as the host `Line` builtin visualizers receive. Times in
seconds on the lyric clock.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `words` | `FoliumWord[]` | Timed words; a line without word timing has one word spanning the line. |
| `startTime` | `number` | Start, seconds. |
| `endTime` | `number` | The lyric's own end time. When the line leaves the screen is `renderHints.renderEndTime`. |
| `fullText` | `string` | The whole line. |
| `renderHints` | `FoliumLineRenderHints` | Always present: the host fills in hints the lyric source did not carry. |
| `translation?` | `string` | Translation text. |
| `romanization?` | `string` | Romanization text. |
| `alternateTexts?` | `FoliumLyricAlternateText[]` | All alternate texts from the source, with language and role. |
| `id?` | `string` | Line id from the source, when it has one. |
| `agentId?` | `string` | The singer, when the source names one. |
| `songPart?` | `string` | Song part name from the source, e.g. `Chorus`. |
| `blockIndex?` | `number` | Index of the song part this line belongs to. |
| `isChorus?` | `boolean` | The line is part of a chorus. |
| `chorusEffect?` | `'bars' \| 'circles' \| 'beams'` | The chorus effect builtin modes draw for it. |
| `backgroundVocals?` | `FoliumBackgroundVocal[]` | Background vocals. The host's legacy single `backgroundVocal` is folded in here, so this is the only place to look. |
| `wordSegments?` | `string[]` | The user's saved word split; `join('')` equals `fullText`. See `folium.lyrics.segmentWords`. |

相关：[FoliumWord](#foliumword) · [FoliumLineRenderHints](#foliumlinerenderhints) · [FoliumLyricAlternateText](#foliumlyricalternatetext) · [FoliumBackgroundVocal](#foliumbackgroundvocal)

### FoliumTheme

The current theme, the same fields and meanings as the host `Theme` builtin visualizers receive, plus
`isDaylight`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | Theme name. |
| `backgroundColor` | `string` | CSS color. |
| `primaryColor` | `string` | CSS color of lyric text. |
| `accentColor` | `string` | CSS color for highlights. |
| `secondaryColor` | `string` | CSS color for secondary text. |
| `fontStyle` | `'sans' \| 'serif' \| 'mono'` | The builtin font family class. |
| `fontFamily?` | `string` | The user's chosen family, if any. For a CSS font-family value use `folium.theme.resolveFontStack(theme)`. |
| `fontFamilyStack?` | `string[]` | The user's font fallback list. |
| `fontWeight?` | `number` | For a concrete weight use `folium.theme.resolveFontWeight(theme, fallback)`. |
| `animationIntensity` | `'calm' \| 'normal' \| 'chaotic'` | How lively animations should be; builtin modes scale motion by it. |
| `wordColors?` | `{ word: string; color: string }[]` | Keyword colors; match them with `folium.lyrics.buildWordColorRanges` / `resolveWordColor`. |
| `lyricsIcons?` | `string[]` | Decorative icon names the theme suggests. |
| `provider?` | `string` | Where the theme came from (e.g. an AI provider). |
| `description?` | `string` | Theme description. |
| `isDaylight` | `boolean` | Folium addition: builtin modes get this as a separate `isDaylight` prop. |

### FoliumSong

A song as mods see it. Pass it back to the host (playSong, enqueue, beforePlay.replaceWith) only when it
carries a `ref`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string \| null` | The song id at its source, as a string; null when unknown. |
| `title` | `string` | Song title. |
| `artist` | `string` | Artists joined with ` / `. |
| `album` | `string \| null` | Album name. |
| `source` | `string \| null` | Where the song comes from: an Omni provider id, 'local', 'navidrome', … |
| `ref` | `string \| null` | Opaque handle the host can turn back into the real song (playSong, enqueue, beforePlay.replaceWith). Valid for the session; null when the DTO was not built from a host song. |

### FoliumPlaybackState

The host player state.

```ts
type FoliumPlaybackState = 'playing' | 'paused' | 'stopped'
```

### FoliumPlaybackSnapshot

The whole playback picture, as main entries read it with `api.runtime.getPlaybackSnapshot()`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `song` | `FoliumSong \| null` | The displayed song. |
| `state` | `FoliumPlaybackState` | The player state. |
| `position` | `number` | Seconds. |
| `duration` | `number` | Seconds; 0 when unknown. |
| `lines` | `FoliumLine[]` | Lyrics of the displayed song. |
| `theme` | `FoliumTheme \| null` | The current theme. |
| `visualizerMode` | `string \| null` | The current lyric animation mode id. |

相关：[FoliumSong](#foliumsong) · [FoliumPlaybackState](#foliumplaybackstate) · [FoliumLine](#foliumline) · [FoliumTheme](#foliumtheme)

### FoliumLyricFormat

Folium 1.4: lyric formats the host parses, the same parsers as local lyric files. These and nothing
else: lyrics in any other form (a platform's JSON, SRT, ASS, a custom word-timing scheme) are the mod's
to convert into one of them first. QRC and KRC are the decrypted plain text; the host does not decrypt.

The format is never sniffed, and the content is not checked against it: an `lrc` track that carries
`<mm:ss.xx>` word tags is read as plain LRC (name it `enhanced-lrc`), and mislabelled or malformed text
parses to no lines or to garbled ones. `folium.lyrics.parse` runs the same pipeline, to check a conversion.

```ts
type FoliumLyricFormat = 'lrc' | 'enhanced-lrc' | 'yrc' | 'qrc' | 'krc' | 'ttml' | 'vtt' | 'awlrc'
```

### FoliumLyricsTrack

Folium 1.4: one lyric document in its raw text, parsed by the host's local lyric file pipeline.
Each text is at most 1,048,576 characters.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `format` | `FoliumLyricFormat` | How to read `text`. |
| `text` | `string` | The raw lyric document. |
| `translationText?` | `string` | Translation lines, matched to `text` by start time like a local `.t.lrc` file (VTT cues for a `vtt` track). Ignored for `ttml`, which carries its translations inline. |
| `romanizationText?` | `string` | Romanization lines, matched like `translationText`. Ignored for `ttml`. |

相关：[FoliumLyricFormat](#foliumlyricformat)

### FoliumLyricsResult

Folium 1.4: lyrics a provider hands the host. With both tracks the host shows `wordByWord`, and falls
back to `main` when it is missing or parses to no lines; a `wordByWord` track without its own
translation or romanization borrows the ones on `main`.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `main?` | `FoliumLyricsTrack` | Line-timed lyrics, also the fallback for `wordByWord`. |
| `wordByWord?` | `FoliumLyricsTrack` | Word-timed lyrics, shown in preference to `main`. |
| `isPureMusic?` | `boolean` | An instrumental: the host shows its pure-music view and ignores both tracks. |
| `chorusRanges?` | `Array<{ startTime: number; endTime: number }>` | Chorus spans in seconds on the lyric clock; lines inside one get the chorus effect. Without them the host detects choruses from repeated lines, and TTML `songPart` markers take precedence over both. At most 64 are kept; a span needs finite times with `0 <= startTime < endTime`. |

相关：[FoliumLyricsTrack](#foliumlyricstrack)

### FoliumLegacyLyricsResult

The Folium 1.3 `getLyrics` answer: plain LRC, parsed as plain LRC. Deprecated in Folium 1.4 in favor of
FoliumLyricsResult; Folium 2 drops it.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `lrc` | `string` | LRC text. |
| `translationLrc?` | `string` | Translation LRC. |

### FoliumParsedLyrics

Folium 1.4: what `folium.lyrics.parse` returns.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `lines` | `readonly FoliumLine[]` | The parsed lines; empty when the text holds none. The host's lyric display filter is not applied. |
| `isWordByWord` | `boolean` | Whether the lines carry real word timings rather than timings the host estimated. |

相关：[FoliumLine](#foliumline)

## 实验接口

需要在 `mod.json` 的 `experimental` 里选用，经 `folium.experimental[name]` 访问；任何 minor 版本都可能变化。

### FoliumProviderSong

EXPERIMENTAL (`omni.providers`): a song as a mod provider describes it.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Song id within this provider. |
| `title` | `string` | Song title. |
| `artists` | `string[]` | Artist names. |
| `album?` | `string` | Album name. |
| `coverUrl?` | `string` | Cover image URL. |
| `durationMs?` | `number` | Duration in milliseconds. |

### FoliumAudioQuality

Audio quality levels an Omni provider may be asked for.

```ts
type FoliumAudioQuality = 'standard' | 'high' | 'lossless' | 'hires'
```

### FoliumOmniProviderDef

EXPERIMENTAL (`omni.providers`): an online music source. The host adapts it
to its provider contract; songs from it play, queue and show lyrics like any
online song. Use folium.net.fetch for network access.

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Local provider id. |
| `displayName` | `string` | Full name: the second line of the source's row in the home provider switcher. |
| `shortName?` | `string` | Short name: the switcher row, the search overlay's source chip and the home placeholder title; its first character is the avatar badge. Defaults to `displayName`. |
| `search?()` | `(query: string, page: { limit: number; offset: number }): Promise<{ items: FoliumProviderSong[]; hasMore: boolean; total?: number }>` | Search songs; `page` is offset-based. |
| `getSong?()` | `(id: string): Promise<FoliumProviderSong \| null>` | One song by id. |
| `getAudioUrl?()` | `(song: FoliumProviderSong, quality: FoliumAudioQuality): Promise<{ url: string; expiresAt?: number } \| null>` | A playable URL for the song at a quality. |
| `getLyrics?()` | `(song: FoliumProviderSong): Promise<FoliumLyricsResult \| FoliumLegacyLyricsResult \| null>` | Lyrics for a song, as raw text the host parses (FoliumLyricsResult, Folium 1.4), or the deprecated Folium 1.3 plain-LRC shape. Null when there are none. |

相关：[FoliumProviderSong](#foliumprovidersong) · [FoliumAudioQuality](#foliumaudioquality) · [FoliumLyricsResult](#foliumlyricsresult) · [FoliumLegacyLyricsResult](#foliumlegacylyricsresult)

## 基础类型

### FOLIUM_VERSION

The Folium version this host implements; mods read it at runtime as `folium.host.folium`.

```ts
const FOLIUM_VERSION = Object.freeze({ major: 1, minor: 4 })
```

### FoliumId

`modid:name`, like a Forge ResourceLocation. The mod id part is added by the host.

```ts
type FoliumId = string
```

### FoliumLabel

Localized text keyed by locale (`zh-CN`, `en`, `in`); the host falls back to `en`, then to any entry.

```ts
type FoliumLabel = Record<string, string | undefined>
```

### FoliumDisposer

Undoes a registration, subscription or mount. Safe to call more than once.

```ts
type FoliumDisposer = () => void
```

## main 入口（Node）

`mod.json` 的 `main` 指向一个 `.cjs` / `.js` 文件，导出 `activate(api)`，在主进程运行，拥有完整 Node.js 权限。
`api` 由 `electron/modSystem/modApi.cjs` 创建：

```js
module.exports = function activate(api) {
  api.rpc.handle('export', async (spec) => api.render.exportVideo(spec));
  return () => { /* 可选：模组停用时清理 */ };
};
```

| 成员 | 说明 |
| --- | --- |
| `api.manifest` | 冻结的清单副本 |
| `api.host` | `{ folium: { major, minor }, folia }`，与客户端的 `folium.host` 相同 |
| `api.log.info / warn / error(message, details?)` | 写入模组日志；`error` 会显示在模组面板 |
| `api.storage.data.get / set / has / delete / keys` | 异步；需要 `filesystem.data`；与客户端 `folium.storage` 共用同一个数据文件（上限 1 MB） |
| `api.lifecycle.onDeactivate(fn)` | 模组被停用、重载或应用退出时调用；`activate` 返回的函数效果相同 |
| `api.runtime.getPlaybackSnapshot()` | 当前播放状态的 [FoliumPlaybackSnapshot](#foliumplaybacksnapshot)，渲染端尚未推送时为 `null`；需要 `runtime.playback` |
| `api.rpc.handle(name, fn)` | 注册客户端 `folium.rpc.call(name, ...args)` 调用的函数；名称匹配 `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`，参数与返回值需可 JSON 序列化 |
| `api.render.exportVideo(spec)` | 按当前歌曲、动画模式与参数导出透明视频；需要 `render.export` 与 ffmpeg |
| `api.experimental` | 预留，目前为空 |
