# Ponder 中文文案与组件 / 场景对照

> 这份文档供手工改稿使用。文案原表保持 `zh-CN.ts` 的 key 结构；修改后请把最终文本同步回 `src/i18n/locales/zh-CN.ts`。

## 1. 入口、设置与命令面板文案

| Key | 中文文案 | 对应组件 / 场景 |
| --- | --- | --- |
| `help.ponder` | 思索帮助页 | src/components/modal/SettingsHelpActions.tsx |
| `help.ponderDescription` | 了解 Folia 的基本操作与运行逻辑 | src/components/modal/SettingsHelpActions.tsx |
| `options.ponderHints` | 思索教程提示 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderHintsDesc` | 把指针停在可教学的控件上会提示长按 G，松手后打开一段演示该手势的动画教程。 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderHintsAlways` | 始终显示 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderHintsUnseen` | 仅未看过的区域 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderHintsOff` | 关闭 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderTouchButton` | 触屏思索按钮 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `options.ponderTouchButtonDesc` | 触屏设备上右上角那颗灯泡：进入页面时露几秒，之后点右上角唤回。关掉它之后，触屏上就只能从命令窗口进入思索。 | src/components/modal/settings/PonderHintSettingsSection.tsx |
| `commandPalette.commands.settings-ponder-hints.title` | 思索教程提示 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.settings-ponder-hints.description` | 设置长按 G 的提示什么时候出现 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-always.title` | 思索提示：始终显示 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-always.description` | 所有可教学的控件都提示长按 G | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-unseen.title` | 思索提示：仅未看过的区域 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-unseen.description` | 某个控件的教程看过之后就不再提示它 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-off.title` | 思索提示：关闭 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-hints-off.description` | 不再显示长按 G 的提示 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-touch-button-toggle.title` | 触屏思索按钮 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-touch-button-toggle.description` | 显示或隐藏触屏右上角那颗灯泡 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-current-page.title` | 思索当前页面 | src/components/command-palette/commands/settingsCommands.ts |
| `commandPalette.commands.ponder-current-page.description` | 打开当前页面的交互式介绍 | src/components/command-palette/commands/settingsCommands.ts |

## 2. 教程目标、对应组件和场景

目标定义文件声明标题、摘要、章节、字幕和锚点；合成演示界面由 PonderSurfaceContents.tsx 按 surfaceKind 分发。

| 目标 ID | 目标标题 key | 类别 | 目标定义文件 | 真实组件定位 | 合成演示组件 | 场景 ID |
| --- | --- | --- | --- | --- | --- | --- |
| `audio-equalizer` | `ponder.targets.audioEqualizer` | playback | `src/components/ponder/targets/audioEqualizer.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderAudioEqualizerSurface.tsx | `audio-equalizer-presets`<br>`audio-equalizer-silent-write`<br>`audio-equalizer-effects` |
| `command-palette` | `ponder.targets.commandPalette` | basics | `src/components/ponder/targets/commandPalette.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/PonderSurfaceContents.tsx → PaletteContents | `command-palette-search`<br>`command-palette-argument`<br>`command-palette-execute-mode` |
| `custom-shortcut-settings` | `ponder.targets.customShortcutSettings` | basics | `src/components/ponder/targets/customShortcutSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderCommandSettingsSurfaces.tsx → PonderCustomShortcutSurface | `custom-shortcut-key`<br>`custom-shortcut-command` |
| `folia-desktop` | `ponder.targets.foliaDesktop` | desktop | `src/components/ponder/targets/foliaDesktop.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderDesktopFeaturesSurface.tsx | `folia-desktop-wallpaper`<br>`folia-desktop-tray`<br>`folia-desktop-remote` |
| `folia-shortcuts` | `ponder.targets.foliaShortcuts` | basics | `src/components/ponder/targets/foliaShortcuts.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/PonderSurfaceContents.tsx → PaletteContents | `help-page-shortcuts` |
| `folia-transport` | `ponder.targets.foliaTransport` | playback | `src/components/ponder/targets/foliaTransport.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlayerPageSurface.tsx | `help-page-transport` |
| `grid3d-card-style` | `ponder.targets.grid3dCardStyle` | appearance | `src/components/ponder/targets/grid3dCardStyle.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderAppearanceSettingsSurfaces.tsx → PonderGrid3dCardStyleSurface | `grid3d-card-style-options` |
| `grid-action-button` | `ponder.targets.gridActionButton` | browsing | `src/components/ponder/targets/gridActionButton.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewSurfaces.tsx → PonderGridActionButtonSurface | `grid-action-button-list`<br>`grid-action-button-slide` |
| `grid-page` | `ponder.targets.gridPage` | browsing | `src/components/ponder/targets/gridPage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridPageSurface.tsx | `grid-page-structure`<br>`grid-page-tabs`<br>`grid-page-cards`<br>`grid-page-map`<br>`grid-page-search`<br>`grid-page-keyboard` |
| `grid-palette-hotkey` | `ponder.targets.gridPaletteHotkey` | browsing | `src/components/ponder/targets/gridPaletteHotkey.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderGridHotkeySurface | `grid-palette-hotkey-owner` |
| `grid-view-card-settings` | `ponder.targets.gridViewCardSettings` | appearance | `src/components/ponder/targets/gridViewCardSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderAppearanceSettingsSurfaces.tsx → PonderGridViewCardSurface | `grid-view-card-cover`<br>`grid-view-card-falloff` |
| `grid-view-edit-mode` | `ponder.targets.gridViewEditMode` | browsing | `src/components/ponder/targets/gridViewEditMode.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewSurfaces.tsx → PonderGridViewCardsSurface | `grid-view-edit-mode-cards`<br>`grid-view-edit-mode-rename` |
| `grid-view-page` | `ponder.targets.gridViewPage` | browsing | `src/components/ponder/targets/gridViewPage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewPageSurface.tsx | `grid-view-page-structure`<br>`grid-view-page-navigation`<br>`grid-view-page-info`<br>`grid-view-page-filter`<br>`grid-view-page-activate` |
| `help-page` | `ponder.targets.helpPage` | basics | `src/components/ponder/targets/helpPage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderOnboardingSurface.tsx | `help-page-overview` |
| `import-export-settings` | `ponder.targets.importExportSettings` | appearance | `src/components/ponder/targets/importExportSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderImportExportSurface.tsx | `import-export-scope`<br>`import-export-export`<br>`import-export-confirm` |
| `lattice-chrome` | `ponder.targets.latticeChrome` | playback | `src/components/ponder/targets/latticeChrome.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderLatticeChromeSurface.tsx | `lattice-chrome-layout`<br>`lattice-chrome-shared-slots`<br>`lattice-chrome-bottom-bar` |
| `lattice-page` | `ponder.targets.latticePage` | playback | `src/components/ponder/targets/latticePage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderLatticePageSurface.tsx | `lattice-page-structure`<br>`lattice-page-navigation`<br>`lattice-page-poster`<br>`lattice-page-tools`<br>`lattice-page-keyboard` |
| `lattice-style-settings` | `ponder.targets.latticeStyleSettings` | appearance | `src/components/ponder/targets/latticeStyleSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderAppearanceSettingsSurfaces.tsx → PonderLatticeStyleSurface | `lattice-style-tint`<br>`lattice-style-custom-color` |
| `local-folder-actions` | `ponder.targets.localFolderActions` | browsing | `src/components/ponder/targets/localFolderActions.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewSurfaces.tsx → PonderLocalFolderActionsSurface | `local-folder-actions-list`<br>`local-folder-actions-maintenance`<br>`local-folder-actions-delete` |
| `local-library-watch` | `ponder.targets.localLibraryWatch` | browsing | `src/components/ponder/targets/localLibraryWatch.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderLibraryWatchSurface | `local-library-watch-roots` |
| `local-metadata-match` | `ponder.targets.localMetadataMatch` | browsing | `src/components/ponder/targets/localMetadataMatch.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewSurfaces.tsx → PonderGridViewCardsSurface | `local-metadata-match-reveal` |
| `local-track-sorting` | `ponder.targets.localTrackSorting` | browsing | `src/components/ponder/targets/localTrackSorting.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderGridViewSurfaces.tsx → PonderLocalTrackListSurface | `local-track-sorting-fields` |
| `lyrics-animation-settings` | `ponder.targets.lyricsAnimationSettings` | appearance | `src/components/ponder/targets/lyricsAnimationSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSettingsSectionSurfaces.tsx → PonderLyricsAnimationSettingsSurface | `lyrics-animation-entry`<br>`lyrics-animation-toggles` |
| `lyrics-settings` | `ponder.targets.lyricsSettings` | playback | `src/components/ponder/targets/lyricsSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderLyricsSourceSurface | `lyrics-settings-source`<br>`lyrics-settings-offset` |
| `panel-account-tab` | `ponder.targets.panelAccountTab` | playback | `src/components/ponder/targets/panelAccountTab.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-account-tab` |
| `panel-controls-tab` | `ponder.targets.panelControlsTab` | playback | `src/components/ponder/targets/panelControlsTab.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-controls-tab`<br>`panel-controls-tab-mode-list` |
| `panel-cover-actions` | `ponder.targets.panelCoverActions` | playback | `src/components/ponder/targets/panelCoverActions.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-cover-actions-reveal`<br>`panel-cover-actions-right` |
| `panel-cover-tab` | `ponder.targets.panelCoverTab` | playback | `src/components/ponder/targets/panelCoverTab.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-cover-tab` |
| `panel-queue-tab` | `ponder.targets.panelQueueTab` | playback | `src/components/ponder/targets/panelQueueTab.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-queue-tab`<br>`panel-queue-tab-radio` |
| `panel-slide` | `ponder.targets.panelSlide` | playback | `src/components/ponder/targets/panelSlide.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/PonderSurfaceContents.tsx → PaletteContents | `panel-slide-to-palette`<br>`panel-slide-edge-hotspot`<br>`panel-slide-keyboard` |
| `panel-source-tab` | `ponder.targets.panelSourceTab` | playback | `src/components/ponder/targets/panelSourceTab.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `panel-source-tab-where`<br>`panel-source-tab-contents` |
| `pinned-commands` | `ponder.targets.pinnedCommands` | basics | `src/components/ponder/targets/pinnedCommands.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderCommandSettingsSurfaces.tsx → PonderPinnedCommandsSurface | `pinned-commands-slots`<br>`pinned-commands-vs-recent` |
| `player-bar` | `ponder.targets.playerBar` | playback | `src/components/ponder/targets/playerBar.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlayerBarSurface.tsx<br>src/components/ponder/PonderSurfaceContents.tsx → BottomUiSettingsContents<br>src/components/ponder/PonderSurfaceContents.tsx → PickerContents<br>src/components/ponder/PonderSurfaceContents.tsx → QueueContents<br>src/components/ponder/PonderSurfaceContents.tsx → VolumeContents | `player-bar-basics`<br>`player-bar-height`<br>`player-bar-slots`<br>`player-bar-shuffle`<br>`player-bar-volume` |
| `player-page` | `ponder.targets.playerPage` | playback | `src/components/ponder/targets/playerPage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlayerPageSurface.tsx | `player-page-layout`<br>`player-page-open-palette`<br>`player-page-run-commands`<br>`player-page-shuffle` |
| `ponder-basics` | `ponder.targets.ponderBasics` | basics | `src/components/ponder/targets/ponderBasics.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderOnboardingSurface.tsx<br>src/components/ponder/PonderSurfaceContents.tsx → PageContents(settings-page) | `help-page-ponder`<br>`help-page-whole-page`<br>`help-page-hint-settings` |
| `queue-command-surface` | `ponder.targets.queueCommandSurface` | playback | `src/components/ponder/targets/queueCommandSurface.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderQueueCommandSurface.tsx | `queue-command-facets`<br>`queue-command-batch` |
| `queue-settings` | `ponder.targets.queueSettings` | playback | `src/components/ponder/targets/queueSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderQueueSettingsSurface | `queue-settings-behavior` |
| `replay-gain-settings` | `ponder.targets.replayGainSettings` | playback | `src/components/ponder/targets/replayGainSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderReplayGainSurface | `replay-gain-modes`<br>`replay-gain-mirrored` |
| `settings-page` | `ponder.targets.settingsPage` | basics | `src/components/ponder/targets/settingsPage.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/PonderSurfaceContents.tsx → PageContents(settings-page)<br>src/components/ponder/PonderSurfaceContents.tsx → PaletteContents | `settings-page-overview`<br>`settings-page-direct-navigation` |
| `side-panel` | `ponder.targets.sidePanel` | playback | `src/components/ponder/targets/sidePanel.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSidePanelSurface.tsx | `side-panel-structure`<br>`side-panel-tabs` |
| `theme-park` | `ponder.targets.themePark` | appearance | `src/components/ponder/targets/themePark.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderFullEditorSurfaces.tsx → PonderThemeParkSurface | `theme-park-target`<br>`theme-park-colors`<br>`theme-park-saving` |
| `theme-settings` | `ponder.targets.themeSettings` | appearance | `src/components/ponder/targets/themeSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderSettingsSectionSurfaces.tsx → PonderThemeSettingsSurface | `theme-settings-presets`<br>`theme-settings-source`<br>`theme-settings-auto` |
| `transition-settings` | `ponder.targets.transitionSettings` | appearance | `src/components/ponder/targets/transitionSettings.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderPlaybackSettingsSurfaces.tsx → PonderTransitionSettingsSurface | `transition-settings-enable`<br>`transition-settings-fallback` |
| `vis-playground` | `ponder.targets.visPlayground` | appearance | `src/components/ponder/targets/visPlayground.target.ts` | 见目标文件 hoverSelector / 页面级入口 | src/components/ponder/surfaces/PonderFullEditorSurfaces.tsx → PonderVisPlaygroundSurface | `vis-playground-layout`<br>`vis-playground-hotspots`<br>`vis-playground-common`<br>`vis-playground-visuals`<br>`vis-playground-subtitle` |

## 3. Ponder 文案原表

下面是当前 zh-CN.ts 中 ponder 对象的完整内容。这里的 key 与源码保持一致，目标 / 场景的具体对应关系见第 2 节；如果要批量改稿，直接在这段里搜索 key 最方便。

```ts
  "ponder": {
    "openPage": "思索当前页面",
    "componentsOnPage": "本页可单独思索的组件",
    "navigation": {
      "title": "思索 · 全部教程",
      "hint": "悬停在条目上按住 G，或直接点击。想看整页介绍，按住 Ctrl + G。",
      "touchHint": "点条目打开；想看整页介绍，点右上角的灯泡。",
      "seen": "已看过"
    },
    "summaries": {
      "audio_equalizer": "十段均衡和效果链；拖动推子会改写自定义槽。",
      "vis_playground": "预览上的三块隐藏点击区。",
      "theme_park": "全屏配色编辑器，以及保存条件。",
      "custom_shortcut_settings": "Alt + 字母，以及可选命令范围。",
      "pinned_commands": "固定按钮和最近使用列表不是一回事。",
      "replay_gain_settings": "和来源页上那个三选一是同一个值。",
      "import_export_settings": "只导出外观，导入前会确认。",
      "command_palette": "搜出来、带参数、冒号进执行模式。",
      "folia_desktop": "壁纸模式、系统托盘和遥控窗口。",
      "folia_shortcuts": "K、P、B、G 四个组合分别通往哪。",
      "folia_transport": "系统媒体键在后台直接可用，应用里还有 Space 和 {{mod}}+←/→。",
      "grid3d_card_style": "首页海报墙用纯图片封面还是拍立得卡片。",
      "grid_action_button": "右下角按钮：点击开列表，左滑做第二个动作。",
      "grid_page": "海报墙怎么组织，怎么移动、打开和搜索。",
      "grid_view_card_settings": "网格卡片的封面形状，以及离中心越远衰减多少。",
      "grid_view_edit_mode": "进去之后卡片会变，以及改名什么时候才算数。",
      "grid_view_page": "集合页的结构、拖动与键盘移动、筛选。",
      "help_page": "Folia 的基本结构和下一步入口。",
      "lattice_chrome": "展开的海报底下那条控制，中间两颗和底栏共用。",
      "lattice_page": "把整条播放队列铺成一面海报墙。",
      "lattice_style_settings": "暗角，以及层层解锁的海报叠色。",
      "local_folder_actions": "重扫、整理歌曲信息，以及那颗会删东西的红按钮。",
      "local_metadata_match": "三重条件才出现的那颗铅笔。",
      "local_track_sorting": "只有本地文件夹能排序，选择跨会话保留。",
      "lyrics_animation_settings": "换歌词动画在哪儿换，加上两个影响观感的开关。",
      "panel_account_tab": "当前来源的登录、音质档位和同步。",
      "panel_controls_tab": "三颗大按钮、音量，以及两行模式取景器。",
      "panel_cover_actions": "封面四角那四颗悬停才出现的按钮。",
      "panel_cover_tab": "当前这首歌的歌名、歌手、专辑，点一下能做什么。",
      "panel_queue_tab": "队列列表：行内动作、打乱、铺成海报墙。",
      "queue_command_surface": "@ 收窄范围，-- 对筛出来的那些整批下手。",
      "transition_settings": "淡化还是自动混音，以及为什么选了可能没生效。",
      "local_library_watch": "监视列表里那个警告图标意味着什么。",
      "queue_settings": "「加入队列」到底加到哪儿，全应用一起变。",
      "lyrics_settings": "自动择优会盖掉手动选的来源，两个偏移量会相加。",
      "grid_palette_hotkey": "网格页上按 S 是打开命令窗口还是进筛选框。",
      "panel_slide": "那颗按钮还能往左滑，打开的是命令窗口。",
      "panel_source_tab": "跟着来源走的那一格：音频增益、歌词来源、时间轴偏移。",
      "player_bar": "整条胶囊上有什么，以及右边那两个可换的位置。",
      "player_page": "播放页上有什么、各在哪，以及随机播放怎么做。",
      "ponder_basics": "悬停出提示、长按 G、整页 Ctrl+G，以及怎么把提示关掉。",
      "settings_page": "设置怎么分组，以及从命令窗口直接跳过去。",
      "side_panel": "面板分几段、怎么换页。",
      "theme_settings": "预设、自定义配色从哪来，以及配色什么时候自己变。"
    },
    "categories": {
      "basics": "上手",
      "playback": "播放与控制",
      "browsing": "浏览与曲库",
      "appearance": "外观与样式",
      "desktop": "桌面端"
    },
    "noComponentsOnPage": "本页暂时没有单独的组件教程。",
    "onboarding": {
      "title": "认识思索模式",
      "description": "按住 Ctrl + G，等进度走满，打开当前页面介绍。",
      "touchDescription": "现在点下面的按钮，打开当前页面的介绍。",
      "shortcut": "按住 Ctrl + G",
      "required": "完成一次页面思索后才能继续。"
    },
    "sceneLabel": "章节",
    "allChaptersDone": "全部章节都看完了。",
    "nextChapter": "下一章",
    "nextChapterAuto": "即将进入下一章",
    "title": "思索",
    "hintCapsule": "按 G 思索",
    "hintCapsulePage": "思索本页",
    "hintCapsuleHold": "进入思索",
    "sceneCounter": "{{current}} / {{total}}",
    "prevScene": "上一场景",
    "nextScene": "下一场景",
    "playPause": "播放或暂停",
    "replay": "从头重播",
    "exit": "Esc 退出",
    "seekKeyframe": "跳到第 {{index}} 个关键帧",
    "legend": {
      "keyframe": "关键帧",
      "chapter": "章节",
      "pause": "暂停",
      "exit": "退出"
    },
    "actions": {
      "openAudioEqualizer": "打开音频效果",
      "openCustomShortcut": "打开快捷键设置",
      "openPinnedCommands": "打开固定命令",
      "openReplayGain": "打开音频增益",
      "openImportExport": "打开备份与导入",
      "openBottomUiSettings": "打开底部界面设置",
      "openLyricsAnimation": "打开歌词动画设置",
      "openThemePresets": "打开配色主题设置",
      "openSlotPicker": "去挑按钮",
      "openDocs": "打开文档",
      "openPonderHints": "去设置里调",
      "openWallpaperMode": "打开壁纸模式设置",
      "openTraySettings": "打开桌面窗口行为",
      "openTransitionSettings": "打开过渡设置",
      "openLibraryWatch": "打开文件夹监视",
      "openQueueSettings": "打开播放队列设置",
      "openLyricsSettings": "打开歌词设置",
      "openGridPaletteHotkey": "去改这个开关",
      "openGridActionButton": "去改滑动目标",
      "openGrid3dCardStyle": "打开首页卡片样式",
      "openGridViewCard": "打开网格卡片设置",
      "openLatticeSettings": "打开队列拼贴设置"
    },
    "anchors": {
      "audioEqualizer": {
        "panel": "音频效果",
        "enable": "总开关",
        "presets": "内置预设",
        "customSlots": "自定义 1 / 自定义 2",
        "reset": "清空这个槽",
        "bands": "十段推子",
        "bandFader": "其中一根",
        "effects": "效果链",
        "noiseBadge": "会加噪"
      },
      "visPlayground": {
        "sectionReset": "只退这一页",
        "rows": "这一页的控件",
        "rowOne": "第一行",
        "rowTwo": "第二行",
        "rowThree": "第三行",
        "rowFour": "第四行",
        "rowFive": "第五行",
        "panel": "歌词动画调参台",
        "header": "标题栏",
        "preview": "实时预览",
        "hotspotBackground": "背景那一块",
        "hotspotVisualizer": "动画那一块",
        "hotspotSubtitle": "字幕那一块",
        "pause": "暂停预览",
        "settingsPanel": "设置栏",
        "tabs": "四页",
        "tabCommon": "通用"
      },
      "themePark": {
        "panel": "Theme Park",
        "header": "标题栏",
        "targetToggle": "在编辑哪一份",
        "reset": "重置",
        "save": "保存",
        "preview": "实时预览",
        "editorPanel": "编辑栏",
        "tabs": "四页",
        "tabDetails": "信息那一页",
        "modeToggle": "亮 / 暗",
        "colorRows": "四种颜色",
        "picker": "取色器",
        "hex": "HEX",
        "recommended": "推荐色"
      },
      "customShortcut": {
        "panel": "设置 · 自定义快捷键",
        "capAlt": "Alt（固定）",
        "capKey": "你按的那颗字母",
        "clear": "清除",
        "command": "要运行的命令",
        "commandList": "在哪儿都成立的命令",
        "rejection": "被退回的原因"
      },
      "pinnedCommands": {
        "panel": "设置 · 固定命令",
        "slotFirst": "槽位 1",
        "slotSecond": "槽位 2",
        "slotThird": "槽位 3",
        "palette": "命令窗口",
        "paletteList": "会随使用重排的列表",
        "pinnedRow": "固定的那三颗"
      },
      "replayGain": {
        "panel": "设置 · 音频增益",
        "modeOff": "关闭",
        "modeTrack": "按单曲",
        "modeAlbum": "按专辑",
        "panelTab": "控制面板 · 来源页",
        "panelSummary": "这首歌的增益标签",
        "panelModes": "同样那三个模式"
      },
      "importExport": {
        "panel": "设置 · 备份与导入",
        "copy": "这一组做什么",
        "themeChips": "带哪个主题",
        "textarea": "配置文本",
        "exportButtons": "复制出去",
        "importButton": "导入",
        "dialog": "确认导入",
        "dialogGroups": "按组列出的改动",
        "dialogDerived": "你没挑、却会被改掉的"
      },
      "pages": {
        "grid": "海报墙",
        "gridView": "集合网格",
        "player": "播放器",
        "lattice": "Lattice",
        "help": "帮助",
        "settings": "设置",
        "commandPalette": "命令面板"
      },
      "playerPage": {
        "lyrics": "歌词与可视化",
        "bar": "底部控制条",
        "toggle": "侧边手柄",
        "track": "隐藏的滑轨",
        "panel": "控制面板",
        "palette": "命令窗口"
      },
      "commandPalette": {
        "input": "输入行",
        "results": "结果列表",
        "firstResult": "当前结果"
      },
      "latticeChrome": {
        "card": "展开的海报",
        "chrome": "播放控制条",
        "play": "播放 / 暂停",
        "prev": "上一首",
        "slotPrimary": "第一个槽位",
        "slotSecondary": "第二个槽位",
        "next": "下一首",
        "time": "时间",
        "openPlayer": "回到播放页",
        "progress": "进度条",
        "bottomBar": "底部控制条"
      },
      "transition": {
        "panel": "设置 · 过渡",
        "enable": "过渡总开关",
        "crossfade": "淡化",
        "automix": "自动混音",
        "badge": "使用中 / 已退回",
        "detail": "当前模式的参数",
        "notice": "缺条件时的提示"
      },
      "libraryWatch": {
        "panel": "设置 · 本地文件夹监视",
        "enable": "自动扫描",
        "roots": "监视中的文件夹",
        "recheck": "重新检查"
      },
      "queueSettings": {
        "panel": "设置 · 播放队列",
        "append": "加到末尾",
        "next": "加到当前之后"
      },
      "lyricsSource": {
        "panel": "设置 · 歌词",
        "autoBest": "自动择优",
        "priorityLocal": "本地优先",
        "priorityOnline": "在线优先",
        "globalOffset": "全局时间轴偏移"
      },
      "gridHotkey": {
        "panel": "设置 · 网格上的 S 键",
        "toggle": "S 归命令窗口"
      },
      "queueCommand": {
        "panel": "队列窗口",
        "input": "输入行",
        "suggestions": "歌手 / 专辑建议",
        "rows": "匹配到的歌曲",
        "preview": "批量操作预览"
      },
      "desktop": {
        "page": "桌面",
        "mainWindow": "主窗口",
        "trayIcon": "托盘图标",
        "trayMenu": "托盘菜单",
        "remoteWindow": "遥控窗口"
      },
      "onboarding": {
        "page": "一页界面",
        "component": "指针停着的那个组件",
        "capsule": "悬停提示",
        "touchBulb": "触屏上的思索按钮"
      },
      "gridActionButton": {
        "page": "集合页",
        "button": "右下角那颗按钮",
        "track": "隐藏的滑轨",
        "list": "曲目列表",
        "slideTarget": "本页筛选"
      },
      "gridViewCards": {
        "page": "集合页网格",
        "cards": "歌曲卡片",
        "card": "当前卡片",
        "title": "歌名",
        "pencil": "手动匹配",
        "actions": "播放与加入队列",
        "remove": "移除"
      },
      "localFolderActions": {
        "panel": "来源专属动作",
        "playAll": "全部播放",
        "reimport": "重新导入",
        "organize": "整理歌曲信息",
        "remove": "从曲库移除"
      },
      "localTrackList": {
        "panel": "曲目列表",
        "direction": "升序 / 降序",
        "sortMenu": "排序方式",
        "menu": "排序菜单"
      },
      "grid3dCardStyle": {
        "panel": "设置 · 首页卡片样式",
        "image": "纯图片封面",
        "card": "拍立得卡片"
      },
      "gridViewCard": {
        "panel": "设置 · 网格卡片",
        "fullBleed": "全画幅封面",
        "square": "正方形卡片",
        "minScale": "卡片最小尺寸",
        "minOpacity": "卡片最小透明度",
        "reset": "恢复默认衰减"
      },
      "latticeStyle": {
        "panel": "设置 · 队列拼贴",
        "vignette": "暗角",
        "tint": "海报叠色",
        "customColor": "使用固定颜色",
        "picker": "取色器",
        "intensity": "叠色强度"
      },
      "lyricsAnimation": {
        "panel": "设置 · 歌词动画",
        "entry": "歌词动画样式",
        "card": "两个开关那张卡",
        "transparent": "播放页透明背景",
        "autoHide": "自动隐藏控制栏"
      },
      "themeSettings": {
        "panel": "设置 · 配色主题预设",
        "themePark": "Theme Park",
        "presetDefault": "内置预设",
        "presetCustom": "自定义配色",
        "source": "主题生成来源",
        "followSystem": "跟随系统明暗",
        "preferCustom": "优先使用自定义主题",
        "autoSwitch": "主题自动切换"
      },
      "sidePanel": {
        "modeRow": "模式取景器那一行",
        "modeName": "中间那块名称",
        "modeList": "全部模式",
        "modeListFooter": "完整设置",
        "fmMode": "电台模式",
        "fmTransport": "上一首 / 播放 / 下一首",
        "fmActions": "扔掉和喜欢",
        "panel": "控制面板",
        "cover": "当前封面",
        "tabs": "标签页",
        "body": "当前标签页内容",
        "sourceInfo": "来源信息",
        "sourceGain": "音频增益",
        "sourceLyrics": "歌词",
        "sourceOffset": "时间轴偏移",
        "coverSettings": "打开设置",
        "coverTransparent": "播放页透明背景",
        "coverHome": "回到首页",
        "coverPlaylist": "加入歌单"
      },
      "playerBar": {
        "play": "播放 / 暂停",
        "title": "曲目标题",
        "progress": "进度条",
        "primarySlot": "第一个槽位",
        "secondarySlot": "第二个槽位",
        "bar": "底部控制条",
        "slots": "两个槽位",
        "bottomUiSettings": "设置 · 底部界面",
        "picker": "设置里的选择器",
        "queue": "播放队列",
        "volumeSurface": "音量面板"
      },
      "panelSlide": {
        "toggle": "面板开关",
        "track": "隐藏的滑轨",
        "threshold": "触发线",
        "palette": "命令面板"
      },
      "grid": {
        "help": "Folia 与帮助入口",
        "tabs": "内容来源页签",
        "search": "歌曲搜索",
        "map": "全部集合地图",
        "sourceActions": "来源专属操作",
        "shelf": "3D 海报轨道",
        "focusedCard": "当前海报",
        "focusedCopy": "当前集合信息"
      },
      "lattice": {
        "back": "返回",
        "wall": "播放队列海报墙",
        "poster": "队列海报",
        "expanded": "展开的歌曲",
        "chrome": "播放控制",
        "tools": "Lattice 工具",
        "toolsPanel": "工具面板"
      },
      "gridView": {
        "back": "返回上一级",
        "title": "集合标题与信息开关",
        "cards": "蜂窝歌曲网格",
        "card": "当前歌曲卡片",
        "info": "集合信息与批量操作",
        "filter": "本页筛选"
      }
    },
    "targets": {
      "audioEqualizer": "音频效果对话框",
      "visPlayground": "歌词动画调参台",
      "themePark": "Theme Park",
      "customShortcutSettings": "自定义快捷键",
      "pinnedCommands": "固定命令",
      "replayGainSettings": "音频增益（ReplayGain）",
      "importExportSettings": "备份与导入",
      "playerBar": "底部控制条",
      "panelSlide": "侧边面板开关",
      "gridPage": "海报墙页面",
      "gridViewPage": "集合网格页面",
      "playerPage": "播放器页面",
      "commandPalette": "命令窗口",
      "latticeChrome": "展开海报的播放控制",
      "lyricsAnimationSettings": "歌词动画设置",
      "themeSettings": "配色主题设置",
      "sidePanel": "右侧控制面板",
      "gridActionButton": "海报墙操作按钮",
      "gridViewEditMode": "集合页编辑模式",
      "localFolderActions": "本地集合的操作",
      "localMetadataMatch": "手动匹配歌曲信息",
      "localTrackSorting": "本地曲目排序",
      "grid3dCardStyle": "首页卡片样式",
      "gridViewCardSettings": "网格卡片设置",
      "latticeStyleSettings": "队列拼贴样式",
      "panelCoverActions": "封面上的四颗按钮",
      "panelCoverTab": "面板 · 封面页",
      "panelSourceTab": "面板 · 来源页",
      "panelControlsTab": "面板 · 控制页",
      "panelQueueTab": "面板 · 队列页",
      "panelAccountTab": "面板 · 账号页",
      "latticePage": "Lattice 页面",
      "helpPage": "认识 Folia",
      "ponderBasics": "思索怎么用",
      "foliaTransport": "播放控制与媒体键",
      "foliaShortcuts": "常用快捷键",
      "foliaDesktop": "桌面端独有功能",
      "queueCommandSurface": "队列窗口",
      "transitionSettings": "过渡与自动混音",
      "localLibraryWatch": "本地文件夹监视",
      "queueSettings": "加入队列的默认行为",
      "lyricsSettings": "歌词来源与偏移",
      "gridPaletteHotkey": "网格上的 S 键",
      "settingsPage": "设置页面"
    },
    "scenes": {
      "visPlaygroundCommon": "四页各管什么，以及「通用」里有什么",
      "visPlaygroundVisuals": "动画与背景",
      "visPlaygroundSubtitle": "字幕",
      "sidePanelControlsModeList": "完整模式列表藏在名称后面",
      "sidePanelQueueRadio": "私人 FM 下这一格是电台",
      "audioEqualizerPresets": "总开关、预设，和你自己的两个槽",
      "audioEqualizerSilentWrite": "拖一下就覆写一个槽",
      "audioEqualizerEffects": "底下那条效果链",
      "visPlaygroundLayout": "左边是真的在跑的预览",
      "visPlaygroundHotspots": "三块你看不见的区域",
      "visPlaygroundSections": "右栏那四页",
      "themeParkTarget": "你在编辑哪一份主题",
      "themeParkColors": "亮和暗是两份配色",
      "themeParkSaving": "保存为什么按不动",
      "customShortcutKey": "Alt 是印死的，你挑的是字母",
      "customShortcutCommand": "这份列表为什么更短",
      "pinnedCommandsSlots": "三个槽位",
      "pinnedCommandsVsRecent": "固定不等于「最近用过」",
      "replayGainModes": "三个模式",
      "replayGainMirrored": "同一个值，两处入口",
      "importExportScope": "它到底带走了什么",
      "importExportExport": "导出",
      "importExportConfirm": "导入会先问过你",
      "gridPageOverview": "海报墙如何组织",
      "gridPageNavigation": "移动、打开与搜索",
      "gridPageStructure": "页头的每个入口",
      "gridPageTabs": "切换来源与专属操作",
      "gridPageCards": "移动焦点并打开集合",
      "gridPageMap": "用地图总览全部集合",
      "gridPageSearch": "搜索歌曲而不是筛选海报",
      "gridPageKeyboard": "Grid3D 的全部页面快捷键",
      "gridViewPageOverview": "进入一个集合以后",
      "gridViewPageActions": "操作歌曲卡片",
      "gridViewPageStructure": "集合页的完整结构",
      "gridViewPageNavigation": "拖动与键盘移动",
      "gridViewPageInfo": "集合信息和批量操作",
      "gridViewPageFilter": "筛选当前集合",
      "gridViewPageActivate": "打开或播放卡片",
      "playerPageLayout": "页面上有什么、各在哪",
      "playerPageOpenPalette": "叫出命令窗口",
      "playerPageRunCommands": "在命令窗口里执行",
      "playerPageShuffle": "常见问题：怎么随机播放",
      "commandPaletteSearch": "搜出来，回车执行",
      "commandPaletteArgument": "给命令带参数",
      "commandPaletteExecuteMode": "冒号进执行模式",
      "latticeChromeLayout": "这条控制条上有什么",
      "latticeChromeSharedSlots": "中间两个和底栏是同一份",
      "latticeChromeBottomBar": "卡片看不见时底栏顶上来",
      "sidePanelCoverTab": "封面页",
      "sidePanelControlsTab": "控制页",
      "sidePanelQueueTab": "队列页",
      "sidePanelAccountTab": "账号页",
      "lyricsAnimationEntry": "换歌词动画在哪儿换",
      "lyricsAnimationToggles": "两个影响观感的开关",
      "themeSettingsPresets": "预设与自定义",
      "themeSettingsSource": "配色从哪来",
      "themeSettingsAuto": "配色什么时候自己变",
      "gridActionButtonList": "点一下开曲目列表",
      "gridActionButtonSlide": "往左滑是第二个动作",
      "gridViewEditModeCards": "进去之后卡片变成什么样",
      "gridViewEditModeRename": "改名什么时候才算数",
      "localFolderActionsList": "这一列有什么取决于你打开的是什么",
      "localFolderActionsMaintenance": "重扫与整理歌曲信息",
      "localFolderActionsDelete": "红色那颗会删东西",
      "localMetadataMatchReveal": "三重条件才出现的一颗铅笔",
      "localTrackSortingFields": "只有本地文件夹能排序",
      "grid3dCardStyleOptions": "两种卡片长什么样",
      "gridViewCardCover": "封面怎么占这张卡",
      "gridViewCardFalloff": "离中心越远，衰减到多少",
      "latticeStyleTint": "暗角与海报叠色",
      "latticeStyleCustomColor": "换成一个固定颜色",
      "panelSourceTabWhere": "这一格什么时候才在",
      "panelSourceTabContents": "增益、歌词与时间轴",
      "panelCoverActionsReveal": "悬停才出现的四颗按钮",
      "panelCoverActionsRight": "右边那两颗",
      "sidePanelStructure": "面板里有什么",
      "sidePanelTabs": "换标签页",
      "latticePageOverview": "Lattice 如何组织",
      "latticePageStructure": "队列墙、返回与工具",
      "latticePageNavigation": "在无限墙上移动焦点",
      "latticePagePoster": "展开海报并控制播放",
      "latticePageTools": "聚焦、跟随、队列与灯光",
      "latticePageKeyboard": "Lattice 的完整键盘操作",
      "helpPageOverview": "Folia 大致怎么转",
      "foliaDesktopWallpaper": "壁纸模式",
      "foliaDesktopTray": "系统托盘",
      "foliaDesktopRemote": "遥控窗口",
      "transitionSettingsEnable": "总开关与两种模式",
      "transitionSettingsFallback": "选了不等于在跑",
      "localLibraryWatchRoots": "监视列表与失效的那一行",
      "queueSettingsBehavior": "加到末尾还是加到下一首",
      "lyricsSettingsSource": "歌词从哪来",
      "lyricsSettingsOffset": "两个同名的偏移量",
      "gridPaletteHotkeyOwner": "网格上的 S 归谁",
      "queueCommandFacets": "@ 把范围收窄",
      "queueCommandBatch": "-- 对筛出来的全部下手",
      "helpPagePonder": "你已经在思索里了",
      "helpPageWholePage": "整页的教程，以及触屏怎么办",
      "helpPageTransport": "不用切回来也能控制播放",
      "helpPageShortcuts": "四个最常用的快捷键",
      "helpPageDocs": "还想知道更多",
      "helpPageHintSettings": "看够了就把提示关掉",
      "settingsPageOverview": "设置按用途分组",
      "settingsPageDirectNavigation": "从命令直接跳转",
      "playerBarBasics": "这条胶囊上有什么",
      "playerBarHeight": "整条的高度可以改",
      "playerBarSlots": "右边两个位置可以换",
      "playerBarShuffle": "随机只洗一次牌",
      "playerBarVolume": "音量在命令面板里",
      "panelSlideToPalette": "滑动打开命令面板",
      "panelSlideEdgeHotspot": "从边缘唤出手柄",
      "panelSlideKeyboard": "用键盘打开"
    },
    "captions": {
      "audioEqualizer": {
        "enable": "音量行右端打开均衡器。左上角可关闭整条效果链；关闭后设置保留，但不再生效。",
        "presets": "顶上一排是六个内置预设。每一个同时带着一条均衡曲线和一整套效果链，所以点一下是两样一起换。它们不可编辑。",
        "slots": "排尾那两颗是你自己的：自定义 1 和自定义 2，各存着一条曲线加一套链。",
        "bands": "十根竖推子，左端 31 Hz 到右端 16 kHz，每根 ±12 dB。",
        "silent": "内置预设不可编辑；拖动推子会切到「自定义 1」并写入新值。重要设置请先切到「自定义 2」。",
        "reset": "清空当前自定义槽，恢复平直曲线和中性效果。内置预设不能编辑，所以选中时按钮是灰的。",
        "effects": "推子下方是高低切、饱和、压缩、抖晃、噪声、立体声宽度、空间和冲击。同一自定义槽共用这套效果链。",
        "noise": "带这个徽章的效果会加入噪声；它不代表当前已经打开。"
      },
      "visPlayground": {
        "preview": "调参台全屏打开：左边是实时预览，右边是设置栏。预览使用真实渲染器，改动会马上显示。",
        "pause": "预览右下角那颗按钮把画面冻在当前这一帧。调那种只闪一下的效果时用得上，顺带也让预览在你读字的时候不再继续吃算力。",
        "invisible": "预览上有三块隐藏点击区，没有边框、底色或标签。",
        "three": "指针扫过去它们才显形：顶上一条是背景，中间一大块是动画，底下一条是字幕。",
        "jumps": "点其中一块，右边设置栏就跳到对应那一节。这是这一屏里最快的走法 —— 指着画面上你想改的那部分，而不是去读标签的名字。",
        "four": "设置栏一共四页：通用、背景、动画、字幕。热区指向的就是其中三页，所以标签和画面是同一份清单的两个入口。",
        "common": "只有一个例外：「通用」没有自己的热区，因为它不是画面的一部分 —— 它装的是作用于整屏的那些。那一页只能从这排标签进。",
        "fonts": "「通用」设置歌词字体、字号和字重。字重默认自动，也可手动指定。",
        "previewText": "第一行挑的是预览唱什么。想看看这套字撑不撑得住长句、或者别的文字系统，换一段示例比等一首真歌放到那儿要快。",
        "sectionReset": "每一页右上角各有一颗自己的复位，它退的只有这一页。它不是整张调参台的复位 —— 你在别的页上调过的东西不会被它带走。",
        "animation": "动画那一页最上面是模式本身。模式比这一屏能列下的多，而且值得你自己翻一遍，所以这一章只说这一页是什么，不把清单念一遍。",
        "perMode": "模式下方是对应参数；换模式，参数也会跟着换。",
        "background": "背景那一页是同一套做法：先挑背景，再调这个背景。它和动画是两层，各挑各的，任意组合都成立。",
        "subtitleContent": "字幕第二行可选：无、翻译或罗马音。三选一，不能同时开启。",
        "subtitleLegibility": "这里设置字幕底色、不透明度，以及未唱行的模糊效果。",
        "subtitleFont": "字幕默认跟随歌词字体。关闭后，字幕的字体、字号和字重设置才会出现。"
      },
      "themePark": {
        "which": "右上角切换当前编辑的主题：歌曲的 AI 主题或保存的自定义主题。两边草稿互不影响，保存只作用于当前选中的主题。",
        "reset": "重置丢掉的是你这一次改的东西，把草稿退回刚打开时的样子。它不碰已经保存下来的那一份。",
        "twoSides": "亮色和暗色分别保存。切换这一项后，下面的颜色、取色器和 HEX 输入框都会跟着切换。",
        "fourColors": "每面有背景、主色、强调色和次要色。点颜色后可在下方取色器调整，说明文字标出使用位置。",
        "recommended": "最底下那排色块是从当前封面算出来的。点一下直接填进正在选中的那一行 —— 这是配出一套和专辑相称的配色最快的路。",
        "blocked": "保存有时是灰的，而你正看着的这一页上没有任何地方说明原因。原因是主题要有名字，而且亮暗两面都要有，才存得下去。",
        "nameLivesHere": "主题名称和描述在「信息」页。保存按钮点不了时，先去那里填写名称。",
        "applies": "保存自定义主题后，应用会立即切换到它。"
      },
      "customShortcut": {
        "alt": "左边固定为 Alt，右边录入字母。只支持 Alt + 字母。",
        "capture": "点第二颗键帽开始录入，下次按下的字母会绑定。修饰键忽略，按 Esc 取消。",
        "taken": "已被占用的字母不能绑定，红字会说明原因。S、Ctrl+K 和其他命令的快捷键都算占用。",
        "clear": "录上之后键帽旁边会多一颗小小的 ✕，按它就把绑定清掉；在你重新录一颗之前，这条快捷键什么都不运行。",
        "filtered": "下拉框只列出可在所有页面使用的命令；依赖特定页面或面板的命令不会出现。",
        "goesQuiet": "快捷键执行时还会再次检查条件。命令失效或按键被占用时，它不会改做别的事，只会失效。"
      },
      "pinnedCommands": {
        "slots": "三个下拉槽按顺序显示在命令窗口下方，默认是上一首、下一首和队列。",
        "unique": "同一命令只能放一个槽位；空槽保留空位，三个都空时整排隐藏。",
        "where": "这三个下拉配出来的东西长在这儿：命令窗口下面一排三颗固定按钮，位置永远不变。点一下就执行，不用打字也不用翻。",
        "recent": "上面的列表和固定按钮是两套机制。列表按最近使用情况重排，固定按钮始终保持原位。",
        "empty": "所以两者各管各的用处：列表应付你临时要用的东西，那三颗应付你希望每次都在同一个位置的东西。"
      },
      "replayGain": {
        "off": "关闭后不使用文件里的 ReplayGain 标签，每首歌按原始音量播放。",
        "trackAlbum": "按单曲会让不同歌曲的响度更接近；按专辑会保留专辑内部的强弱变化。两种模式都只改播放音量，不改文件。",
        "sameValue": "控制面板来源页的三个按钮与这里共用同一个 ReplayGain 设置，改一处会同步另一处。",
        "summary": "来源页还会显示这首歌的 T/A 增益标签；没有标签时显示「不可用」。"
      },
      "importExport": {
        "scope": "导出外观设置：主题、歌词动画、渲染参数、字幕、字体、背景和卡片。",
        "notBackup": "它只备份外观：主题、歌词动画、渲染参数、字幕、字体、背景和卡片。歌单、曲库、播放设置、快捷键和账号不在里面。",
        "themeChoice": "导出前选择是否带主题：AI 主题、自定义主题，或不带主题。只想分享视觉设置时选「不带」。",
        "clipboard": "两个按钮都是复制：一个复制短码，一个复制可读 JSON。两者都是完整配置。",
        "paste": "导入走的是同一个框的反方向：把别人那串码粘进来，右边那颗导入就亮了。",
        "plan": "导入前会按组列出变更，并显示修改前后的值。每一项都可以单独取消。",
        "derived": "有些改动不会写在配置里，但会随导入发生：例如切到自定义主题、删除已上传字体。它们不能单独取消，只能取消对应的主改动。"
      },
      "onboarding": {
        "overviewShape": "Folia 分四块：网格选歌，Player/Lattice 播放，命令窗口找功能，设置调整选项。底部控制条始终保留。",
        "overviewAsk": "不用全记。悬停在不熟悉的组件上，按住 G 可查看说明。",
        "overviewNext": "想完整了解，回导航页选择播放、浏览、外观或桌面端教程。底部按钮打开文档。",
        "here": "这是当前页面的思索教程，不是视频。进度条可拖，方向键切换关键帧，Space 暂停，Esc 退出。",
        "hover": "悬停在按钮或组件上会出现提示。按住 G，进度走满后打开对应教程。",
        "hold": "按住不放，进度走满后打开教程；提前松手会取消。",
        "wholePage": "不想找组件也行：在任意页面上按住 Ctrl + G，打开的是整页的教程 —— 这一页上有什么、各在哪、能怎么操作。",
        "touchBulb": "触屏没有悬停，所以用右上角灯泡打开本页教程。它出现几秒后会收起，点右上角可再次唤出。鼠标看不到它是正常的。",
        "mediaKeys": "Windows 用 SMTC，Linux 用 MPRIS；系统媒体键和媒体浮窗都可控制或显示当前歌曲。",
        "inAppTransport": "Space 播放/暂停，{{mod}} + ←/→ 切歌；播放页 ←/→ 快退或快进 5 秒。更多操作用命令窗口。",
        "shortcutK": "{{mod}} + K 打开命令窗口，功能和设置都可直接搜索。",
        "shortcutP": "{{mod}} + P 打开播放队列；输入行可筛选，也支持 @artist: 等条件。",
        "shortcutB": "{{mod}} + B 打开 Lattice；已在 Lattice 时返回。",
        "shortcutG": "Ctrl + G 就是刚才那一下：打开当前页面的思索教程。任何时候迷路了，先按它。",
        "hintSettings": "可在设置 · 实验室关闭思索提示，或只提示未看过的区域。下方按钮可直接打开设置。",
        "docs": "这四章只是入门。命令、快捷键、在线来源、本地曲库、可视化和主题见文档站。"
      },
      "pages": {
        "grid": "这是浏览用的海报墙：搜索和歌单导航在卡片上方，选中一张卡片就会进入它的歌曲列表。",
        "gridNavigation": "滚动、滑动或用方向键在卡片间移动，然后选中当前卡片进入其中。",
        "gridSearch": "网格处于当前页面时直接输入文字即可筛选本页内容；按 Esc 关闭筛选。",
        "gridHelp": "左侧齿轮打开帮助页；有新版本时，更新提示也会出现在这里。Help 内仍可打开版本更新说明和本页 Ponder。",
        "gridTabs": "中间页签切换歌单、电台、专辑、本地库、Navidrome 与 Stage。Lattice 图标只在已有播放队列时出现。",
        "gridSearchBox": "右侧是跨当前来源的歌曲搜索。输入后按 Enter 会进入搜索工作台；它不会筛选下方的集合海报。",
        "gridTabResult": "切换页签后，下方 3D 轨道会换成该来源的集合，并记住各来源最后聚焦的位置。",
        "gridSourceActions": "这一组只在当前来源需要时出现，例如本地库的导入、刷新和播放列表导入，或服务器库的重新加载。",
        "gridCardMove": "拖动、滚轮或左右方向键移动轨道。点非中央海报只会把它移到中央，不会立刻打开。",
        "gridCardOpen": "再次点击中央海报，或按 Enter，才进入集合 GridView；底部文字始终描述当前中央海报。",
        "gridMap": "点顶部「全部」打开 GridMap 查看所有集合；{{mod}} + F 或直接输入可筛选集合。",
        "gridSearchResult": "提交右上角搜索后会打开独立搜索工作台，结果按歌曲列出，可播放、打开艺人/专辑或加入队列。",
        "gridCardKeys": "← / → 切换中央海报，Enter 打开当前集合；滚轮和水平拖动执行同样的焦点移动。",
        "gridPageKeys": "Tab / Shift + Tab 切换页签；{{mod}} + K 命令；{{mod}} + B 进 Lattice（需有队列）；Ctrl + G 本页 Ponder。",
        "gridView": "集合网格展示刚才打开的卡片所包含的歌曲、专辑或艺人。返回时会回到上一级，并保留原来的位置。",
        "gridViewActions": "选中卡片可以播放或继续进入。页面操作区还会按集合能力提供全部播放、加入队列、编辑等动作。",
        "gridViewBack": "左上角返回按钮退出当前集合，并清理这次进入使用的导航记录。Esc 在没有更内层状态时也会返回。",
        "gridViewTitle": "中央标题显示集合名称和说明。有信息面板的集合可点击标题，展开或收起左侧详情。",
        "gridViewCards": "歌曲以可拖动的蜂窝网格铺开；这不是规则行列列表，卡片位置会围绕当前焦点重新组织。",
        "gridViewPan": "在空白处拖动整片蜂窝网格；触摸屏同样可拖。卡片内的按钮和艺人/专辑链接不会误触发平移。",
        "gridViewFocus": "方向键按空间方向寻找相邻卡片并把它带入焦点；当前焦点也会被记住，返回后不会跳回开头。",
        "gridViewInfo": "点击标题打开信息面板：封面、创建者和说明在上方，全部播放、加入队列以及编辑、重扫、导出等来源专属动作在下方。",
        "gridViewFilter": "{{mod}} + F 或直接输入打开筛选；--play 播放结果，--add 加入队列；Esc 清空并关闭。",
        "gridViewActivate": "点卡片只会把它移到中央；播放用卡片上的播放键，旁边是加入队列。编辑模式下改为右上角的移除按钮。",
        "gridViewKeys": "Enter 激活当前卡片；Esc 依次关闭内层状态、清除焦点，最后返回上一级。",
        "playerLayout": "播放页全屏显示歌词和可视化；入口只有底部控制条、右侧手柄和展开后的面板。",
        "playerLyrics": "中间这块是歌词与可视化。它不是控件：点它等于点背景，只切换控制条的显隐，不会暂停。",
        "playerBarWhere": "控制条浮在屏幕底部正中，不贴边。左端是播放/暂停，中间是歌名和进度条，右端两个位置放什么由你决定。",
        "playerToggleWhere": "侧边手柄贴在屏幕右缘，底边和控制条对齐。它是一颗圆按钮，按一下展开右侧控制面板。",
        "playerPanelWhere": "面板从手柄上方展开，贴着右侧。顶部是封面，下面是封面、控制、队列、账号等标签页。",
        "playerPaletteSlide": "手柄背后还藏着一条向左的滑轨。按住手柄往左拖，越过判定线再松手，打开的是命令窗口，不是面板。",
        "playerPaletteOpened": "命令窗口从屏幕上方落下，水平居中。Folia 把「找功能」这件事全部收在这里。",
        "playerPaletteOtherWays": "{{mod}} + K 可随时打开命令窗口。播放页焦点不在输入框时，按 S 也可以；触屏先点右缘唤出手柄。",
        "playerCommandFilter": "窗口开着就直接打字，它按名字、别名和关键词一起筛。↑↓ 选，Enter 执行 —— 不必先想清楚这条命令归在哪一类。",
        "playerCommandArgument": "需要参数的命令不会立刻跑。打完命令名按空格，它收成输入行里的一枚标签，光标留在后面等你补参数，补完再 Enter。",
        "playerExecuteMode": "窗口关闭且焦点不在输入框时，按冒号进入执行模式；窗口打开时只会输入冒号。进入后按 r/v/o/h 执行命令。",
        "playerShuffleNoSwitch": "Folia 没有常驻的随机播放开关；它是一次操作，按下后会打乱当前队列。",
        "playerShuffleHow": "播放页按冒号进入执行模式，再按 r 打乱队列；再次执行可换顺序。",
        "playerShuffleSlot": "如果你常用它，把「随机队列」放进控制条右边那两个位置之一，以后按一下就行。",
        "lattice": "Lattice 把整条播放队列铺成一面海报墙。你可以在墙上移动查看队列，并选中海报来操作那首歌。",
        "latticeWall": "Lattice 将队列铺成不规则海报墙，同一首歌可重复出现；当前歌曲显示编号和状态。",
        "latticeBack": "左上角返回；{{mod}} + B 关闭 Lattice。Esc 先收起展开内容或清除焦点，再按一次返回。",
        "latticePan": "在墙面拖动或滚轮平移相机，海报会随视口动态出现；拖动结束后的惯性不会改变播放队列顺序。",
        "latticeFocusKeys": "方向键从视口中央选择最近海报，再按空间方向移动焦点，并自动平移相机让目标可见。",
        "latticePosterOpen": "点击或按 Enter 展开海报。当前歌曲展开后显示同步歌词；其他歌曲展开后显示标题与播放入口，队列本身不会被重排。",
        "latticeChrome": "展开海报显示播放、额外槽位、时间、进度和返回 Player；触屏点海报，键盘按 Space 显示或隐藏控制条。",
        "latticeTools": "右下角工具依次提供：聚焦当前歌曲、切歌时自动跟随、打开队列命令、灯光开关与快捷键说明；向左滑这个按钮会打开命令面板。",
        "latticeLights": "灯光关闭后海报退暗，只保留必要层次；这是显示设置，不会暂停播放或修改队列。",
        "latticePosterKeys": "收起时 Enter/Space 展开；展开后 Enter 播放/暂停，Space 显示控制，Esc 收起。",
        "latticePageKeys": ": + C 当前歌曲；{{mod}} + P 队列；{{mod}} + B 返回；{{mod}} + K 命令；方向键移动。",
        "help": "Folia 分开处理浏览、播放、命令和设置。Ctrl+G 说明当前页面，有特殊操作的组件也有独立教程。",
        "helpCommands": "{{mod}} + K 可以搜索全部命令和设置。对于藏得较深的选项，直接搜名称通常比记住它在哪一级更快。",
        "helpOperatingModel": "网格选歌，Player 或 Lattice 播放；底部控制条负责播放，帮助和设置覆盖当前页面。",
        "settings": "左侧按外观、界面、播放、交互、集成、存储、桌面和实验室分组；右侧显示当前分组里的具体设置。",
        "settingsDirectNavigation": "不必逐层翻找：在命令面板搜索设置名称，Folia 会直接打开对应分组并滚到准确位置。"
      },
      "playerBar": {
        "basicsAutoExpand": "暂停且不在首页时，控制条会自动展开。恢复播放或回到首页后，它会收起。",
        "basicsIntro": "播放控制只有这一条胶囊；上一首、下一首、随机、循环和音量都不常驻。",
        "basicsPlay": "整条上唯一永远在的按钮是播放 / 暂停。宽屏时它在最左端；窄到一行放不下时，它落到第二行正中，两个槽位分列两侧。",
        "basicsTitle": "悬停歌名，两侧会显示上一首和下一首；点箭头切歌。",
        "basicsProgress": "进度条就地拖动或点击跳转。点胶囊其他任何地方不是暂停，而是进入播放页；在 Lattice 上则是把视野拉回当前这首。",
        "basicsSlots": "剩下的功能都归右边这两个位置。十个动作里你挑两个放上去，别的一律不在条上 —— 这就是这里没有一排固定按钮的原因。",
        "basicsCollapsed": "移开指针，整条收回成一根进度条。你平时看到的是这个形态，需要控制时靠近它就会展开。",
        "heightIntro": "这条控制条离屏幕底边有多远是可以改的，各页面的歌曲卡片和侧边面板会跟着一起动。",
        "heightSettings": "入口在设置 → 底部界面设置。滑杆调整高度，「在播放页拖动调整」允许直接拖动控制条；命令窗口也能打开同一设置。",
        "heightDrag": "进了拖动调整之后，按住胶囊任意位置上下拖。松手即生效，而且会被记住。",
        "slotsIntro": "进度条右边这两个按钮不是固定的，两个位置各自独立。",
        "slotsWhere": "在设置里挑：循环、随机、喜爱、队列、音量、睡眠定时等十个动作里任选，选完立刻生效。",
        "shuffleIntro": "这个随机和别处的不一样 —— 它不是一个开着就一直生效的模式。",
        "shuffleOnce": "按一下，Folia 把当前队列原地洗一次牌，洗完这个顺序就定下来了。想换个顺序就再按一次。",
        "volumeIntro": "底部控制条上没有常驻的音量滑块。",
        "volumeOpens": "按这里打开的是命令面板里的音量面板，不是就地弹一个小滑块。"
      },
      "commandPalette": {
        "type": "命令是搜出来的，不是翻出来的。窗口一开就打字，它按名字、别名和关键词一起筛；记不住全名，记得一半也找得到。",
        "run": "↑↓ 在结果里移动，Enter 执行当前这条。最近用过的会排在前面，常用的那几条越用越靠上。",
        "pill": "需要参数的命令：输入命令名后按空格，命令会收成标签，继续输入参数。",
        "flags": "带标志的命令在你输入 -- 时会把自己的选项列出来。不必记有哪些标志，输入两个减号就是在问它。",
        "executeEnter": "窗口关闭且焦点不在输入框时，按冒号进入执行模式；窗口打开时，冒号只输入到查询框。",
        "executeKeys": "进去之后一个键就是一条命令：r 打乱队列、v 音量、o 设置、h 帮助。这些键互不构成前缀，所以按完立即执行。"
      },
      "latticeChrome": {
        "intro": "在墙上展开一张海报，它底部会长出一条播放控制。这条只属于展开的那张卡，收起来就没有了。",
        "playAndSeek": "最左边是播放 / 暂停：这张卡不是当前歌曲时，按它是从这首开始播。底下那条进度条可以直接拖动跳转。",
        "openPlayer": "右端那个斜箭头回到播放页。海报上的其它位置是选中和展开，只有这里会离开 Lattice。",
        "ends": "中间四个按钮，两端固定是上一首和下一首 —— 这两个位置不可配置。",
        "sharedSlots": "中间那两个不是另一套按钮，就是底部控制条右边那两个槽位的同一份：同一个动作、同一个图标、同一套可用性判断。",
        "swap": "所以在设置里把底栏的槽位换掉，这里也跟着变 —— 不需要、也没有第二个地方再配一遍。",
        "onlyWhenVisible": "这条控制条只在展开的海报上。海报没展开，或者展开的那张被滚出了视口，它就不在屏幕上。",
        "barShows": "这时候底部控制条会自己顶上来：正在播的那首海报一离开视口，它就出现；滚回去看得见了，它又收起。播放控制不会真的消失。"
      },
      "sidePanel": {
        "controlsSteppers": "这两行取景器选的是歌词动画和背景。两端那对箭头一次只换到相邻的一个模式 —— 十来个动画排着，这么翻要翻很久。",
        "controlsModeList": "中间的名称可点击打开完整列表，直接跳到目标项。",
        "controlsModeListFooter": "列表最底下那一条不是第七个模式 —— 它打开的是这一行对应的完整设置，调参就在那儿。",
        "queueRadio": "私人 FM 播放时，这一页会变成电台面板，不再显示队列。",
        "queueRadioMode": "顶上那枚胶囊写的是你现在在哪个电台模式；点它打开的是命令窗口里的模式选择器，和命令面板给的是同一个。",
        "queueRadioActions": "底部按钮用于丢弃或喜欢。丢弃后服务不会再播放这首，电台会继续下一首。",
        "cover": "面板顶部是当前歌曲的方形封面，换页时保持不动。悬停后四角会出现按钮。",
        "tabs": "封面下方是标签页：封面、控制、队列、账号；有来源信息时还会多一个来源页。换页不会移动面板。",
        "body": "标签下方是当前内容。面板固定为封面、标签和内容三部分。",
        "cycle": "不必去点那一排小格子。面板开着时按 Tab，就在标签页之间往后循环一格。",
        "cycleReverse": "Shift + Tab 往回一格。循环只在当前真的有的那几页之间走 —— 来源不同，页数也不同。",
        "sourceTab": "本地、Navidrome 或在线来源的歌曲才会显示来源页；没有来源信息时只显示四个标签。",
        "sourceInfo": "来源页显示本地文件信息或 Navidrome 的 Song ID；在线来源没有这一页。",
        "sourceGain": "音频增益就是 ReplayGain，可选关闭、单曲或专辑。右上角的 T/A 是歌曲自带的增益值，没有标签时显示不可用。",
        "sourceLyrics": "右侧两颗图标分别用于导入本地歌词和在线匹配。下方显示当前歌词，导入后可以切换回其他版本。",
        "sourceOffset": "时间轴偏移按 250ms 调整，也可以直接输入。它只对当前播放生效；设置里的全局偏移会与它相加。",
        "coverTab": "封面页放的是当前这首歌的文字信息：歌名、歌手、专辑，居中排一列。大封面不在这一页里，它常驻在面板顶上。",
        "coverTabDetail": "点击歌手或专辑可进入对应集合。点击歌名复制歌曲信息，按住 Ctrl 点击可打开来源页面。",
        "controlsTab": "控制页最上面是三颗大按钮：循环模式、喜欢、生成主题。这是整块面板里唯一一排大触控目标。",
        "controlsTabDetail": "控制页有音量、均衡器、自动混音、歌词动画、背景和主题设置。音频增益与歌词偏移在来源页。",
        "queueTab": "队列页是当前播放队列的完整列表，顶上一行写着队列里有多少首。",
        "queueTabDetail": "点击歌曲即可播放；悬停后可移到下一首、移到队尾或移除。顶部按钮可打开 Lattice 或打乱队列。这里不能拖动排序。",
        "accountTab": "账号页管的是当前音乐来源那一侧的事。",
        "accountTabDetail": "账号页显示登录状态、音质档位和云同步。不同来源会显示各自的账号信息。"
      },
      "transition": {
        "enable": "这一组管的是两首歌之间怎么接上。最上面是总开关 —— 它和控制页音量行右端那颗小图标是同一个值，两处改的是同一件事。",
        "modes": "模式包括淡化和自动混音：淡化切换歌曲，自动混音分析音频后选择接点。",
        "badge": "「使用中」表示自动混音正在运行；「已退回淡化」表示条件不足，系统改用淡化。",
        "notice": "自动混音需要媒体缓存；黄色提示中的链接可直接打开缓存设置。"
      },
      "libraryWatch": {
        "enable": "打开后，Folia 会监视已导入的本地文件夹并自动增量扫描。",
        "roots": "开关底下才展开这张列表，一行一个被监视的根文件夹，下面那行小字是它的真实路径。",
        "warning": "眼睛表示监视正常；黄色三角表示路径或权限有问题，文件夹已停止自动扫描。",
        "recheck": "看到三角就按右边这颗「重新检查」，它会重新挂一遍所有导入过的文件夹。旁边那行小字是上一次自动扫描的时间。"
      },
      "queueSettings": {
        "append": "这两张卡决定「加入队列」到底加到哪儿。默认是加到队列末尾，先听完手上排着的。",
        "next": "选择后，新歌曲会插到当前歌曲后面。这个设置会影响卡片、队列行和命令窗口里的所有加入队列入口。"
      },
      "lyricsSource": {
        "autoBest": "自动择优会从网易云、AMLLDB、QQ 和酷狗匹配歌词，并可能覆盖来源页的手动选择。手动选择没有生效时，先检查这里。",
        "priority": "底下两张卡决定本地和在线的歌词谁优先。本地文件自带的歌词和在线检索到的同时存在时，按这里说的来。",
        "globalOffset": "「全局时间轴偏移」点进去是一整屏的标尺，调的是所有歌的歌词整体提前或延后多少 —— 一般用来补声卡或蓝牙的固定延迟。",
        "offsetSum": "来源页偏移只对当前歌曲有效，全局偏移长期生效；两者会相加。"
      },
      "gridHotkey": {
        "off": "在海报墙和集合页，按字母直接筛选；默认按 S 也是筛选，不会打开命令窗口。",
        "on": "打开后，S 用于打开命令窗口，其他字母仍用于筛选。"
      },
      "queueCommand": {
        "whatItIs": "{{mod}} + P 打开队列窗口。输入即可筛选，↑↓选择，Enter 播放。",
        "atSign": "输入 @ 可筛选队列中的歌手或专辑；后面会显示各项包含的歌曲数。",
        "narrowed": "选中后会收成输入行标签，列表只显示该项的歌曲。",
        "flags": "输入 -- 可查看批量操作：--remove 移除，--next 移到下一首，--end 移到队尾。",
        "scope": "它操作的是筛选出的全部歌曲，不是高亮行。预览会显示“将影响 N 首”。",
        "guards": "没有搜索词或 @ 筛选时拒绝执行，避免清空队列；正在播放的歌曲会排除。"
      },
      "desktop": {
        "windowNormal": "桌面版多出三项功能：窗口层级、系统托盘和遥控窗口。先从普通主窗口开始。",
        "wallpaper": "壁纸模式会把窗口放到桌面底层，歌词铺在桌面上；键盘在此模式下不可用。",
        "wallpaperExit": "所以退出壁纸模式不能靠点窗口。走托盘菜单里的「壁纸模式」，或者在命令窗口里搜同一条命令。",
        "trayIcon": "托盘图标位于任务栏角落。最小化到托盘后，主窗口不在任务栏，但播放和媒体键仍正常。",
        "trayMenu": "托盘菜单可在不打开主窗口的情况下显示/隐藏窗口、打开遥控窗口、设置透明和置顶等。壁纸模式下，托盘是退出入口。",
        "remote": "遥控窗口可从命令窗口或托盘打开；主窗口最小化或进入壁纸模式时仍可使用。",
        "remoteChrome": "遥控窗口有自己的置顶、透明、点击穿透、任务栏图标和自动隐藏设置，与主窗口互不影响。"
      },
      "gridActionButton": {
        "tap": "集合页和海报墙右下角都有这颗按钮。点一下，曲目列表从右边切进来 —— 这是它的第一个动作。",
        "list": "列表里一行一首，点哪首播哪首。本地文件夹的列表顶上还多两颗排序控件。",
        "track": "它背后还藏着一条向左的滑轨，平时看不见 —— 和播放页右缘那颗手柄是同一个手势。按住按钮往左拖。",
        "slideTarget": "松手后打开本页筛选，也可在设置 · 交互中改为命令窗口。"
      },
      "gridViewEdit": {
        "normalCard": "常态下卡片底部有两颗：左边圆的是播放，右边那颗是把这首加进队列。点卡片本身不播放，只是把它移到中央。",
        "editCard": "编辑模式下按钮移到右上角的红叉，点击立即移除歌曲，不会弹确认框。",
        "rename": "本地和 Navidrome 歌单的改名会在退出编辑模式时提交；中途按 Esc 或关闭页面会丢失改动。",
        "onlinePlaylist": "在线的自有歌单走的是另一条路：它是就地编辑，改一下算一下，没有「退出时提交」这个步骤。同一颗按钮，两种来源两种行为。"
      },
      "localFolderActions": {
        "conditional": "操作栏随集合类型变化：本地文件夹可重扫和整理信息，本地歌单可导出，其他来源只显示支持的操作。",
        "playAll": "最上面两颗任何集合都有：全部播放和加入队列。页面上开着筛选时，它们作用于筛出来的那些，按钮文字会写出条数。",
        "reimport": "重新导入会增量扫描文件夹：新增、更新和移除分别处理，不会重建已有记录。",
        "organize": "「整理歌曲信息」打开的是这个文件夹的批量改 tag 面板 —— 一次处理整个文件夹，不是一首一首改。",
        "remove": "最下面这颗红的把这个文件夹从曲库里移除。它不删磁盘上的文件，但曲库里这些歌的记录、以及它们在歌单里的位置都会跟着没。",
        "confirm": "删除前会确认；根文件夹和子文件夹的影响范围不同，确认框会说明。"
      },
      "localMetadata": {
        "conditions": "手动匹配只在当前卡片是本地歌曲、且指针停在歌名上时显示。",
        "pencil": "满足之后它浮在歌名右端，只有 65% 不透明度。点开是手动匹配面板，重新给这首歌挑一份正确的标题、歌手和专辑。"
      },
      "localTrackSorting": {
        "whereOnly": "排序控件只对本地文件夹显示；其他来源的顺序由来源决定。",
        "fields": "排序方式三选一：文件名、文件修改时间、专辑内音轨号。选好之后存在本地，换一个文件夹进去还是这个排法。",
        "direction": "左边那颗切升序和降序，和排序方式各自独立。"
      },
      "gridStyle": {
        "grid3dImage": "「纯图片封面」是首页海报墙的默认样子：整张卡就是一张封面，歌单名压在封面底部的渐变里。",
        "grid3dCard": "拍立得卡片把封面缩到上半部，白边显示名称；封面不裁切，但每屏能放的卡片更少。",
        "fullBleed": "全画幅封面让集合页封面铺满卡片，歌名和歌手显示在渐变遮罩上。",
        "squareCard": "只有打开全画幅封面后才会显示「正方形卡片」。打开后卡片等宽等高，方形封面不会被裁切。",
        "minScale": "这条滑杆设置外围卡片的最小缩放比例。调高更易辨认，调低纵深感更强。",
        "minOpacity": "同理，这条是「最多淡到多少」。两条一起决定了这片网格看起来是平铺的还是有纵深的。",
        "falloffReset": "调乱了按这颗恢复默认衰减。它只复位上面这两条滑杆，封面形状那两个开关不受影响。",
        "latticeVignette": "「暗角」在队列拼贴页面四周压一层淡淡的暗，把视线收到中间的海报上。它只是显示效果，不影响队列本身。",
        "latticeTint": "海报叠色会让播放中、聚焦和悬停的海报更醒目。关闭后，叠色强度和固定颜色设置也会隐藏。",
        "latticeIntensity": "打开之后下面才有「叠色强度」。它是百分比：调到 0 等于没叠色，调高普通海报越暗、正在播的那张越突出。",
        "latticeCustomColor": "默认的叠色是从当前主题算出来的渐变，会跟着换主题一起变。打开「使用固定颜色」就把它钉死成一个颜色，主题怎么换都不动。",
        "latticePicker": "开了固定颜色，下面才出现取色器。拖动时海报墙实时跟着变，松手才真正存下来。"
      },
      "panelCoverActions": {
        "appear": "封面上平时什么都没有。指针移上去，四个角各浮出一颗按钮 —— 它们是四件互不相干的事，不是同一组「这首歌的操作」。",
        "settings": "左上角那颗打开设置。按下去面板会先收起来，再把设置窗口铺上来。",
        "home": "左下角那颗回到首页的海报墙，同样先收起面板。播放不会中断。",
        "transparent": "「播放页透明背景」让整个窗口透明，仅对播放页生效，适合 OBS 浏览器源或抠像叠加。",
        "addToPlaylist": "右下角那颗把当前这首加进歌单。只有当前来源支持歌单时它才在；加不了的时候它是灰的，悬停会写明原因。",
        "touch": "触屏上没有悬停这回事：点一下封面，四颗按钮就出来；点封面以外的地方再收起。"
      },
      "lyricsAnimation": {
        "where": "换歌词动画不在播放页上换，在设置 · 外观的「歌词动画」这一组里。最上面这一条就是入口。",
        "playground": "点开是整屏的动画调参台。左边那一大块是实时预览，放的就是播放页真正会渲染出来的样子；右边那条窄栏才是设置。",
        "playgroundSections": "右栏分为通用、背景、动画、字幕四页。动画页选择模式，下面显示该模式的参数。",
        "card": "入口下面这一张卡里装着两个开关。它们是同一张卡的上下两行，中间只隔一条分隔线，不是两张并排的卡。",
        "transparent": "「播放页透明背景」只影响播放页，适合 OBS 或抠像叠加；它和封面右上角按钮是同一个开关。",
        "autoHide": "下面那行「自动隐藏控制栏」在你不动指针时把播放页的进度条和右侧按钮收起来，只留歌词。需要控制时靠近它们就会回来。"
      },
      "themeSettings": {
        "presetDefault": "左边这个是内置预设「墨染 / 素白」：一枚渐变小圆加一行标签，跟着明暗模式在深色和浅色之间自动换。",
        "presetCustom": "右边这个是自定义配色。还没有自定义主题时它是灰的、按不动；有了之后选中它，播放页、卡片和面板都会换成这套颜色。",
        "source": "自定义配色有两个来源：当前封面或 AI。未配置 API Key 时，AI 选项不可用。",
        "themePark": "标题旁的调色板按钮打开 Theme Park。它是全屏配色编辑器，左侧显示实时预览。",
        "themeParkTabs": "右栏有配色、信息、内容、AI 四页。配色页分别保存亮暗两套颜色，AI 页可以生成整套主题。",
        "followSystem": "这一组下半截是三个开关。「跟随系统明暗」按系统设置自动切亮色 / 暗色；你手动切过一次明暗之后，它会自己关掉。",
        "preferCustom": "「优先使用自定义主题」打开之后，主题自动切换会被关掉 —— 两者是互斥的。这就是开了它以后换歌颜色不再变的原因。",
        "autoSwitch": "主题自动切换会在播放有缓存主题的歌曲时应用它；打开主题生成后，没有缓存的歌曲也会自动生成主题。"
      },
      "panelSlide": {
        "grabbed": "按住这个按钮不放，它背后的滑轨就亮起来了。",
        "intro": "这个按钮底下藏着一条滑轨。按住它，滑轨就会显出来。",
        "threshold": "往左拖。36 像素就够了 —— 到 44 像素按钮便不再跟手。",
        "outcome": "越过那条线松手，命令面板就打开了。",
        "hotspotIntro": "触屏上没有悬停这回事，所以屏幕边缘本身就是入口。",
        "hotspotRevealed": "在右边缘附近点一下，手柄会自己出来。",
        "keyboardIntro": "也可以完全不用指针。",
        "keyboardOutcome": "直接按 {{mod}} + K，打开的是同一个窗口。"
      }
    }
  }
} as const;
```

## 4. 修改时的定位速查

- 改入口卡片标题和说明：第 1 节，SettingsHelpActions.tsx。
- 改教程目标和章节归属：第 2 节，再回到对应的 targets/*.target.ts。
- 改通用提示、导航、章节控制和退出文案：第 3 节中的 navigation、onboarding、legend 及顶层 key；组件主要在 PonderNavigationPage.tsx、PonderHost.tsx、PonderChrome.tsx、PonderNextChapterCue.tsx。
- 改教程长段说明：第 3 节中的 captions；实际渲染组件是 PonderActors.tsx。
- 改合成界面上显示的区域名：第 3 节中的 anchors；区域声明在目标文件，绘制组件见第 2 节。

## 5. 源码入口

- 语言文件：src/i18n/locales/zh-CN.ts
- 目标注册表：src/components/ponder/ponderRegistry.ts
- 教程目标定义：src/components/ponder/targets/*.target.ts
- 教程挂载与交互：src/components/ponder/PonderHost.tsx、src/components/ponder/PonderStage.tsx
- 合成演示界面分发：src/components/ponder/PonderSurfaceContents.tsx

## 6. 每条字幕对应的组件与场景

这张表把第 3 节中的字幕正文连回实际目标脚本；指向区域是合成界面里的锚点，对应的区域标签同时列出。

当前语言文件里有 112 个章节 key、267 个字幕 key；目标脚本直接引用的是 105 个章节和 257 个字幕。第 3 节保留全部原文，下面的映射表只列脚本当前直接引用的文案，未映射项可能是共享、条件分支或历史保留文案。

| 目标 ID | 场景 ID | 场景标题 | 字幕 key | 中文文案 | 指向区域 | 区域 label key |
| --- | --- | --- | --- | --- | --- | --- |
| `audio-equalizer` | `audio-equalizer-presets` | 总开关、预设，和你自己的两个槽 | `ponder.captions.audioEqualizer.enable` | 音量行右端打开均衡器。左上角可关闭整条效果链；关闭后设置保留，但不再生效。 | enable：总开关 | `ponder.anchors.audioEqualizer.enable` |
| `audio-equalizer` | `audio-equalizer-presets` | 总开关、预设，和你自己的两个槽 | `ponder.captions.audioEqualizer.presets` | 顶上一排是六个内置预设。每一个同时带着一条均衡曲线和一整套效果链，所以点一下是两样一起换。它们不可编辑。 | presets：内置预设 | `ponder.anchors.audioEqualizer.presets` |
| `audio-equalizer` | `audio-equalizer-presets` | 总开关、预设，和你自己的两个槽 | `ponder.captions.audioEqualizer.slots` | 排尾那两颗是你自己的：自定义 1 和自定义 2，各存着一条曲线加一套链。 | customSlots：自定义 1 / 自定义 2 | `ponder.anchors.audioEqualizer.customSlots` |
| `audio-equalizer` | `audio-equalizer-silent-write` | 拖一下就覆写一个槽 | `ponder.captions.audioEqualizer.bands` | 十根竖推子，左端 31 Hz 到右端 16 kHz，每根 ±12 dB。 | bands：十段推子 | `ponder.anchors.audioEqualizer.bands` |
| `audio-equalizer` | `audio-equalizer-silent-write` | 拖一下就覆写一个槽 | `ponder.captions.audioEqualizer.silent` | 停在内置预设时，拖动任意推子会自动切到「自定义 1」，并把新值写进去。不会提示，也不会确认；如果自定义 1 里有重要设置，先切到自定义 2。 | customSlots：自定义 1 / 自定义 2 | `ponder.anchors.audioEqualizer.customSlots` |
| `audio-equalizer` | `audio-equalizer-silent-write` | 拖一下就覆写一个槽 | `ponder.captions.audioEqualizer.reset` | 清空当前自定义槽，恢复平直曲线和中性效果。内置预设不能编辑，所以选中时按钮是灰的。 | reset：清空这个槽 | `ponder.anchors.audioEqualizer.reset` |
| `audio-equalizer` | `audio-equalizer-effects` | 底下那条效果链 | `ponder.captions.audioEqualizer.effects` | 推子下方是高低切、饱和、压缩、抖晃、噪声、立体声宽度、空间和冲击。同一自定义槽共用这套效果链。 | effects：效果链 | `ponder.anchors.audioEqualizer.effects` |
| `audio-equalizer` | `audio-equalizer-effects` | 底下那条效果链 | `ponder.captions.audioEqualizer.noise` | 带这个徽章的效果会加入噪声；它不代表当前已经打开。 | noiseBadge：会加噪 | `ponder.anchors.audioEqualizer.noiseBadge` |
| `command-palette` | `command-palette-search` | 搜出来，回车执行 | `ponder.captions.commandPalette.type` | 命令是搜出来的，不是翻出来的。窗口一开就打字，它按名字、别名和关键词一起筛；记不住全名，记得一半也找得到。 | input：输入行 | `ponder.anchors.commandPalette.input` |
| `command-palette` | `command-palette-search` | 搜出来，回车执行 | `ponder.captions.commandPalette.run` | ↑↓ 在结果里移动，Enter 执行当前这条。最近用过的会排在前面，常用的那几条越用越靠上。 | firstResult：当前结果 | `ponder.anchors.commandPalette.firstResult` |
| `command-palette` | `command-palette-argument` | 给命令带参数 | `ponder.captions.commandPalette.pill` | 需要参数的命令：输入命令名后按空格，命令会收成标签，继续输入参数。 | input：输入行 | `ponder.anchors.commandPalette.input` |
| `command-palette` | `command-palette-argument` | 给命令带参数 | `ponder.captions.commandPalette.flags` | 带标志的命令在你输入 -- 时会把自己的选项列出来。不必记有哪些标志，输入两个减号就是在问它。 | results：结果列表 | `ponder.anchors.commandPalette.results` |
| `command-palette` | `command-palette-execute-mode` | 冒号进执行模式 | `ponder.captions.commandPalette.executeEnter` | 窗口关闭且焦点不在输入框时，按冒号进入执行模式；窗口打开时，冒号只输入到查询框。 | input：输入行 | `ponder.anchors.commandPalette.input` |
| `command-palette` | `command-palette-execute-mode` | 冒号进执行模式 | `ponder.captions.commandPalette.executeKeys` | 进去之后一个键就是一条命令：r 打乱队列、v 音量、o 设置、h 帮助。这些键互不构成前缀，所以按完立即执行。 | results：结果列表 | `ponder.anchors.commandPalette.results` |
| `custom-shortcut-settings` | `custom-shortcut-key` | Alt 是印死的，你挑的是字母 | `ponder.captions.customShortcut.alt` | 左边是固定的 Alt，右边才是你要录入的字母。这里只支持 Alt + 字母，不支持 Ctrl+Shift+X 这类组合。 | capAlt：Alt（固定） | `ponder.anchors.customShortcut.capAlt` |
| `custom-shortcut-settings` | `custom-shortcut-key` | Alt 是印死的，你挑的是字母 | `ponder.captions.customShortcut.capture` | 点第二颗键帽开始录入，下次按下的字母会绑定。修饰键忽略，按 Esc 取消。 | capKey：你按的那颗字母 | `ponder.anchors.customShortcut.capKey` |
| `custom-shortcut-settings` | `custom-shortcut-key` | Alt 是印死的，你挑的是字母 | `ponder.captions.customShortcut.taken` | 已被占用的字母不能绑定，红字会说明原因。S、Ctrl+K 和其他命令的快捷键都算占用。 | rejection：被退回的原因 | `ponder.anchors.customShortcut.rejection` |
| `custom-shortcut-settings` | `custom-shortcut-key` | Alt 是印死的，你挑的是字母 | `ponder.captions.customShortcut.clear` | 录上之后键帽旁边会多一颗小小的 ✕，按它就把绑定清掉；在你重新录一颗之前，这条快捷键什么都不运行。 | clear：清除 | `ponder.anchors.customShortcut.clear` |
| `custom-shortcut-settings` | `custom-shortcut-command` | 这份列表为什么更短 | `ponder.captions.customShortcut.filtered` | 下拉框只列出可在所有页面使用的命令；依赖特定页面或面板的命令不会出现。 | commandList：在哪儿都成立的命令 | `ponder.anchors.customShortcut.commandList` |
| `custom-shortcut-settings` | `custom-shortcut-command` | 这份列表为什么更短 | `ponder.captions.customShortcut.goesQuiet` | 快捷键执行时还会再次检查条件。命令失效或按键被占用时，它不会改做别的事，只会失效。 | commandList：在哪儿都成立的命令 | `ponder.anchors.customShortcut.commandList` |
| `folia-desktop` | `folia-desktop-wallpaper` | 壁纸模式 | `ponder.captions.desktop.windowNormal` | 桌面版多出三项功能：窗口层级、系统托盘和遥控窗口。先从普通主窗口开始。 | mainWindow：主窗口 | `ponder.anchors.desktop.mainWindow` |
| `folia-desktop` | `folia-desktop-wallpaper` | 壁纸模式 | `ponder.captions.desktop.wallpaper` | 壁纸模式会把窗口放到桌面底层，歌词铺在桌面上；键盘在此模式下不可用。 | page：桌面 | `ponder.anchors.desktop.page` |
| `folia-desktop` | `folia-desktop-wallpaper` | 壁纸模式 | `ponder.captions.desktop.wallpaperExit` | 所以退出壁纸模式不能靠点窗口。走托盘菜单里的「壁纸模式」，或者在命令窗口里搜同一条命令。 | trayIcon：托盘图标 | `ponder.anchors.desktop.trayIcon` |
| `folia-desktop` | `folia-desktop-tray` | 系统托盘 | `ponder.captions.desktop.trayIcon` | 托盘图标位于任务栏角落。最小化到托盘后，主窗口不在任务栏，但播放和媒体键仍正常。 | trayIcon：托盘图标 | `ponder.anchors.desktop.trayIcon` |
| `folia-desktop` | `folia-desktop-tray` | 系统托盘 | `ponder.captions.desktop.trayMenu` | 托盘菜单可在不打开主窗口的情况下显示/隐藏窗口、打开遥控窗口、设置透明和置顶等。壁纸模式下，托盘是退出入口。 | trayMenu：托盘菜单 | `ponder.anchors.desktop.trayMenu` |
| `folia-desktop` | `folia-desktop-remote` | 遥控窗口 | `ponder.captions.desktop.remote` | 遥控窗口可从命令窗口或托盘打开；主窗口最小化或进入壁纸模式时仍可使用。 | remoteWindow：遥控窗口 | `ponder.anchors.desktop.remoteWindow` |
| `folia-desktop` | `folia-desktop-remote` | 遥控窗口 | `ponder.captions.desktop.remoteChrome` | 遥控窗口有自己的置顶、透明、点击穿透、任务栏图标和自动隐藏设置，与主窗口互不影响。 | remoteWindow：遥控窗口 | `ponder.anchors.desktop.remoteWindow` |
| `folia-shortcuts` | `help-page-shortcuts` | 四个最常用的快捷键 | `ponder.captions.onboarding.shortcutK` | {{mod}} + K 打开命令窗口，功能和设置都可直接搜索。 | page：命令面板 | `ponder.anchors.pages.commandPalette` |
| `folia-shortcuts` | `help-page-shortcuts` | 四个最常用的快捷键 | `ponder.captions.onboarding.shortcutP` | {{mod}} + P 打开播放队列；输入行可筛选，也支持 @artist: 等条件。 | page：命令面板 | `ponder.anchors.pages.commandPalette` |
| `folia-shortcuts` | `help-page-shortcuts` | 四个最常用的快捷键 | `ponder.captions.onboarding.shortcutB` | {{mod}} + B 打开 Lattice；已在 Lattice 时返回。 | page：命令面板 | `ponder.anchors.pages.commandPalette` |
| `folia-shortcuts` | `help-page-shortcuts` | 四个最常用的快捷键 | `ponder.captions.onboarding.shortcutG` | Ctrl + G 就是刚才那一下：打开当前页面的思索教程。任何时候迷路了，先按它。 | page：命令面板 | `ponder.anchors.pages.commandPalette` |
| `folia-transport` | `help-page-transport` | 不用切回来也能控制播放 | `ponder.captions.onboarding.mediaKeys` | 系统媒体键可以在后台控制播放；Windows 使用 SMTC，Linux 使用 MPRIS。系统媒体浮窗也会显示当前歌曲。 | page：播放器 | `ponder.anchors.pages.player` |
| `folia-transport` | `help-page-transport` | 不用切回来也能控制播放 | `ponder.captions.onboarding.inAppTransport` | 应用内：Space 播放/暂停，{{mod}} + ←/→ 切歌；播放页的 ←/→ 快退或快进 5 秒。更多操作在命令窗口。 | page：播放器 | `ponder.anchors.pages.player` |
| `grid3d-card-style` | `grid3d-card-style-options` | 两种卡片长什么样 | `ponder.captions.gridStyle.grid3dImage` | 「纯图片封面」是首页海报墙的默认样子：整张卡就是一张封面，歌单名压在封面底部的渐变里。 | optionImage：纯图片封面 | `ponder.anchors.grid3dCardStyle.image` |
| `grid3d-card-style` | `grid3d-card-style-options` | 两种卡片长什么样 | `ponder.captions.gridStyle.grid3dCard` | 拍立得卡片把封面缩到上半部，白边显示名称；封面不裁切，但每屏能放的卡片更少。 | optionCard：拍立得卡片 | `ponder.anchors.grid3dCardStyle.card` |
| `grid-action-button` | `grid-action-button-list` | 点一下开曲目列表 | `ponder.captions.gridActionButton.tap` | 集合页和海报墙右下角都有这颗按钮。点一下，曲目列表从右边切进来 —— 这是它的第一个动作。 | button：右下角那颗按钮 | `ponder.anchors.gridActionButton.button` |
| `grid-action-button` | `grid-action-button-list` | 点一下开曲目列表 | `ponder.captions.gridActionButton.list` | 列表里一行一首，点哪首播哪首。本地文件夹的列表顶上还多两颗排序控件。 | listPanel：曲目列表 | `ponder.anchors.gridActionButton.list` |
| `grid-action-button` | `grid-action-button-slide` | 往左滑是第二个动作 | `ponder.captions.gridActionButton.track` | 它背后还藏着一条向左的滑轨，平时看不见 —— 和播放页右缘那颗手柄是同一个手势。按住按钮往左拖。 | track：隐藏的滑轨 | `ponder.anchors.gridActionButton.track` |
| `grid-action-button` | `grid-action-button-slide` | 往左滑是第二个动作 | `ponder.captions.gridActionButton.slideTarget` | 松手后打开本页筛选，也可在设置 · 交互中改为命令窗口。 | filterBar：本页筛选 | `ponder.anchors.gridActionButton.slideTarget` |
| `grid-page` | `grid-page-structure` | 页头的每个入口 | `ponder.captions.pages.gridHelp` | 左侧齿轮打开帮助页；有新版本时，更新提示也会出现在这里。Help 内仍可打开版本更新说明和本页 Ponder。 | help：Folia 与帮助入口 | `ponder.anchors.grid.help` |
| `grid-page` | `grid-page-structure` | 页头的每个入口 | `ponder.captions.pages.gridTabs` | 中间页签切换歌单、电台、专辑、本地库、Navidrome 与 Stage。Lattice 图标只在已有播放队列时出现。 | tabs：内容来源页签 | `ponder.anchors.grid.tabs` |
| `grid-page` | `grid-page-structure` | 页头的每个入口 | `ponder.captions.pages.gridSearchBox` | 右侧是跨当前来源的歌曲搜索。输入后按 Enter 会进入搜索工作台；它不会筛选下方的集合海报。 | search：歌曲搜索 | `ponder.anchors.grid.search` |
| `grid-page` | `grid-page-tabs` | 切换来源与专属操作 | `ponder.captions.pages.gridTabResult` | 切换页签后，下方 3D 轨道会换成该来源的集合，并记住各来源最后聚焦的位置。 | tabs：内容来源页签 | `ponder.anchors.grid.tabs` |
| `grid-page` | `grid-page-tabs` | 切换来源与专属操作 | `ponder.captions.pages.gridSourceActions` | 这一组只在当前来源需要时出现，例如本地库的导入、刷新和播放列表导入，或服务器库的重新加载。 | sourceActions：来源专属操作 | `ponder.anchors.grid.sourceActions` |
| `grid-page` | `grid-page-cards` | 移动焦点并打开集合 | `ponder.captions.pages.gridCardMove` | 拖动、滚轮或左右方向键移动轨道。点非中央海报只会把它移到中央，不会立刻打开。 | shelf：3D 海报轨道 | `ponder.anchors.grid.shelf` |
| `grid-page` | `grid-page-cards` | 移动焦点并打开集合 | `ponder.captions.pages.gridCardOpen` | 再次点击中央海报，或按 Enter，才进入集合 GridView；底部文字始终描述当前中央海报。 | focusedCard：当前海报 | `ponder.anchors.grid.focusedCard` |
| `grid-page` | `grid-page-map` | 用地图总览全部集合 | `ponder.captions.pages.gridMap` | 点顶部「全部」打开 GridMap 查看所有集合；{{mod}} + F 或直接输入可筛选集合。 | map：全部集合地图 | `ponder.anchors.grid.map` |
| `grid-page` | `grid-page-search` | 搜索歌曲而不是筛选海报 | `ponder.captions.pages.gridSearchResult` | 提交右上角搜索后会打开独立搜索工作台，结果按歌曲列出，可播放、打开艺人/专辑或加入队列。 | search：歌曲搜索 | `ponder.anchors.grid.search` |
| `grid-page` | `grid-page-keyboard` | Grid3D 的全部页面快捷键 | `ponder.captions.pages.gridCardKeys` | ← / → 切换中央海报，Enter 打开当前集合；滚轮和水平拖动执行同样的焦点移动。 | shelf：3D 海报轨道 | `ponder.anchors.grid.shelf` |
| `grid-page` | `grid-page-keyboard` | Grid3D 的全部页面快捷键 | `ponder.captions.pages.gridPageKeys` | Tab / Shift + Tab 切换页签；{{mod}} + K 命令；{{mod}} + B 进 Lattice（需有队列）；Ctrl + G 本页 Ponder。 | page：海报墙 | `ponder.anchors.pages.grid` |
| `grid-palette-hotkey` | `grid-palette-hotkey-owner` | 网格上的 S 归谁 | `ponder.captions.gridHotkey.off` | 在海报墙和集合页，按字母直接筛选；默认按 S 也是筛选，不会打开命令窗口。 | toggle：S 归命令窗口 | `ponder.anchors.gridHotkey.toggle` |
| `grid-palette-hotkey` | `grid-palette-hotkey-owner` | 网格上的 S 归谁 | `ponder.captions.gridHotkey.on` | 打开后，S 用于打开命令窗口，其他字母仍用于筛选。 | toggle：S 归命令窗口 | `ponder.anchors.gridHotkey.toggle` |
| `grid-view-card-settings` | `grid-view-card-cover` | 封面怎么占这张卡 | `ponder.captions.gridStyle.fullBleed` | 全画幅封面让集合页封面铺满卡片，歌名和歌手显示在渐变遮罩上。 | fullBleed：全画幅封面 | `ponder.anchors.gridViewCard.fullBleed` |
| `grid-view-card-settings` | `grid-view-card-cover` | 封面怎么占这张卡 | `ponder.captions.gridStyle.squareCard` | 只有打开全画幅封面后才会显示「正方形卡片」。打开后卡片等宽等高，方形封面不会被裁切。 | square：正方形卡片 | `ponder.anchors.gridViewCard.square` |
| `grid-view-card-settings` | `grid-view-card-falloff` | 离中心越远，衰减到多少 | `ponder.captions.gridStyle.minScale` | 这条滑杆设置外围卡片的最小缩放比例。调高更易辨认，调低纵深感更强。 | minScale：卡片最小尺寸 | `ponder.anchors.gridViewCard.minScale` |
| `grid-view-card-settings` | `grid-view-card-falloff` | 离中心越远，衰减到多少 | `ponder.captions.gridStyle.minOpacity` | 同理，这条是「最多淡到多少」。两条一起决定了这片网格看起来是平铺的还是有纵深的。 | minOpacity：卡片最小透明度 | `ponder.anchors.gridViewCard.minOpacity` |
| `grid-view-card-settings` | `grid-view-card-falloff` | 离中心越远，衰减到多少 | `ponder.captions.gridStyle.falloffReset` | 调乱了按这颗恢复默认衰减。它只复位上面这两条滑杆，封面形状那两个开关不受影响。 | reset：恢复默认衰减 | `ponder.anchors.gridViewCard.reset` |
| `grid-view-edit-mode` | `grid-view-edit-mode-cards` | 进去之后卡片变成什么样 | `ponder.captions.gridViewEdit.normalCard` | 常态下卡片底部有两颗：左边圆的是播放，右边那颗是把这首加进队列。点卡片本身不播放，只是把它移到中央。 | actions：播放与加入队列 | `ponder.anchors.gridViewCards.actions` |
| `grid-view-edit-mode` | `grid-view-edit-mode-cards` | 进去之后卡片变成什么样 | `ponder.captions.gridViewEdit.editCard` | 编辑模式下按钮移到右上角的红叉，点击立即移除歌曲，不会弹确认框。 | removeBadge：移除 | `ponder.anchors.gridViewCards.remove` |
| `grid-view-edit-mode` | `grid-view-edit-mode-rename` | 改名什么时候才算数 | `ponder.captions.gridViewEdit.rename` | 本地和 Navidrome 歌单的改名会在退出编辑模式时提交；中途按 Esc 或关闭页面会丢失改动。 | page：集合页网格 | `ponder.anchors.gridViewCards.page` |
| `grid-view-edit-mode` | `grid-view-edit-mode-rename` | 改名什么时候才算数 | `ponder.captions.gridViewEdit.onlinePlaylist` | 在线的自有歌单走的是另一条路：它是就地编辑，改一下算一下，没有「退出时提交」这个步骤。同一颗按钮，两种来源两种行为。 | cards：歌曲卡片 | `ponder.anchors.gridViewCards.cards` |
| `grid-view-page` | `grid-view-page-structure` | 集合页的完整结构 | `ponder.captions.pages.gridViewBack` | 左上角返回按钮退出当前集合，并清理这次进入使用的导航记录。Esc 在没有更内层状态时也会返回。 | back：返回上一级 | `ponder.anchors.gridView.back` |
| `grid-view-page` | `grid-view-page-structure` | 集合页的完整结构 | `ponder.captions.pages.gridViewTitle` | 中央标题显示集合名称和说明。有信息面板的集合可点击标题，展开或收起左侧详情。 | title：集合标题与信息开关 | `ponder.anchors.gridView.title` |
| `grid-view-page` | `grid-view-page-structure` | 集合页的完整结构 | `ponder.captions.pages.gridViewCards` | 歌曲以可拖动的蜂窝网格铺开；这不是规则行列列表，卡片位置会围绕当前焦点重新组织。 | cards：蜂窝歌曲网格 | `ponder.anchors.gridView.cards` |
| `grid-view-page` | `grid-view-page-navigation` | 拖动与键盘移动 | `ponder.captions.pages.gridViewPan` | 在空白处拖动整片蜂窝网格；触摸屏同样可拖。卡片内的按钮和艺人/专辑链接不会误触发平移。 | cards：蜂窝歌曲网格 | `ponder.anchors.gridView.cards` |
| `grid-view-page` | `grid-view-page-navigation` | 拖动与键盘移动 | `ponder.captions.pages.gridViewFocus` | 方向键按空间方向寻找相邻卡片并把它带入焦点；当前焦点也会被记住，返回后不会跳回开头。 | card：当前歌曲卡片 | `ponder.anchors.gridView.card` |
| `grid-view-page` | `grid-view-page-info` | 集合信息和批量操作 | `ponder.captions.pages.gridViewInfo` | 点击标题打开信息面板：封面、创建者和说明在上方，全部播放、加入队列以及编辑、重扫、导出等来源专属动作在下方。 | info：集合信息与批量操作 | `ponder.anchors.gridView.info` |
| `grid-view-page` | `grid-view-page-filter` | 筛选当前集合 | `ponder.captions.pages.gridViewFilter` | {{mod}} + F 或直接输入打开筛选；--play 播放结果，--add 加入队列；Esc 清空并关闭。 | filter：本页筛选 | `ponder.anchors.gridView.filter` |
| `grid-view-page` | `grid-view-page-activate` | 打开或播放卡片 | `ponder.captions.pages.gridViewActivate` | 点卡片只会把它移到中央；播放用卡片上的播放键，旁边是加入队列。编辑模式下改为右上角的移除按钮。 | card：当前歌曲卡片 | `ponder.anchors.gridView.card` |
| `grid-view-page` | `grid-view-page-activate` | 打开或播放卡片 | `ponder.captions.pages.gridViewKeys` | Enter 激活当前卡片；Esc 依次关闭内层状态、清除焦点，最后返回上一级。 | card：当前歌曲卡片 | `ponder.anchors.gridView.card` |
| `help-page` | `help-page-overview` | Folia 大致怎么转 | `ponder.captions.onboarding.overviewShape` | Folia 分成四块：网格选歌，Player 或 Lattice 播放，命令窗口找功能，设置调整选项。底部控制条会一直保留。 | page：一页界面 | `ponder.anchors.onboarding.page` |
| `help-page` | `help-page-overview` | Folia 大致怎么转 | `ponder.captions.onboarding.overviewAsk` | 不用全记。悬停在不熟悉的组件上，按住 G 可查看说明。 | capsule：悬停提示 | `ponder.anchors.onboarding.capsule` |
| `help-page` | `help-page-overview` | Folia 大致怎么转 | `ponder.captions.onboarding.overviewNext` | 想完整了解，回导航页选择播放、浏览、外观或桌面端教程。底部按钮打开文档。 | page：一页界面 | `ponder.anchors.onboarding.page` |
| `import-export-settings` | `import-export-scope` | 它到底带走了什么 | `ponder.captions.importExport.scope` | 导出外观设置：主题、歌词动画、渲染参数、字幕、字体、背景和卡片。 | copy：这一组做什么 | `ponder.anchors.importExport.copy` |
| `import-export-settings` | `import-export-scope` | 它到底带走了什么 | `ponder.captions.importExport.notBackup` | 它只备份外观：主题、歌词动画、渲染参数、字幕、字体、背景和卡片。歌单、曲库、播放设置、快捷键和账号不在里面。 | panel：设置 · 备份与导入 | `ponder.anchors.importExport.panel` |
| `import-export-settings` | `import-export-export` | 导出 | `ponder.captions.importExport.themeChoice` | 导出前选择是否带主题：AI 主题、自定义主题，或不带主题。只想分享视觉设置时选「不带」。 | themeChips：带哪个主题 | `ponder.anchors.importExport.themeChips` |
| `import-export-settings` | `import-export-export` | 导出 | `ponder.captions.importExport.clipboard` | 两个按钮都是复制：一个复制短码，一个复制可读 JSON。两者都是完整配置。 | exportButtons：复制出去 | `ponder.anchors.importExport.exportButtons` |
| `import-export-settings` | `import-export-export` | 导出 | `ponder.captions.importExport.paste` | 导入走的是同一个框的反方向：把别人那串码粘进来，右边那颗导入就亮了。 | textarea：配置文本 | `ponder.anchors.importExport.textarea` |
| `import-export-settings` | `import-export-confirm` | 导入会先问过你 | `ponder.captions.importExport.plan` | 导入前会按组列出变更，并显示修改前后的值。每一项都可以单独取消。 | dialogGroups：按组列出的改动 | `ponder.anchors.importExport.dialogGroups` |
| `import-export-settings` | `import-export-confirm` | 导入会先问过你 | `ponder.captions.importExport.derived` | 有些改动不会写在配置里，但会随导入发生：例如切到自定义主题、删除已上传字体。它们不能单独取消，只能取消对应的主改动。 | dialogDerived：你没挑、却会被改掉的 | `ponder.anchors.importExport.dialogDerived` |
| `lattice-chrome` | `lattice-chrome-layout` | 这条控制条上有什么 | `ponder.captions.latticeChrome.intro` | 在墙上展开一张海报，它底部会长出一条播放控制。这条只属于展开的那张卡，收起来就没有了。 | chrome：播放控制条 | `ponder.anchors.latticeChrome.chrome` |
| `lattice-chrome` | `lattice-chrome-layout` | 这条控制条上有什么 | `ponder.captions.latticeChrome.playAndSeek` | 最左边是播放 / 暂停：这张卡不是当前歌曲时，按它是从这首开始播。底下那条进度条可以直接拖动跳转。 | play：播放 / 暂停 | `ponder.anchors.latticeChrome.play` |
| `lattice-chrome` | `lattice-chrome-layout` | 这条控制条上有什么 | `ponder.captions.latticeChrome.openPlayer` | 右端那个斜箭头回到播放页。海报上的其它位置是选中和展开，只有这里会离开 Lattice。 | openPlayer：回到播放页 | `ponder.anchors.latticeChrome.openPlayer` |
| `lattice-chrome` | `lattice-chrome-shared-slots` | 中间两个和底栏是同一份 | `ponder.captions.latticeChrome.ends` | 中间四个按钮，两端固定是上一首和下一首 —— 这两个位置不可配置。 | prev：上一首 | `ponder.anchors.latticeChrome.prev` |
| `lattice-chrome` | `lattice-chrome-shared-slots` | 中间两个和底栏是同一份 | `ponder.captions.latticeChrome.sharedSlots` | 中间那两个不是另一套按钮，就是底部控制条右边那两个槽位的同一份：同一个动作、同一个图标、同一套可用性判断。 | slotPrimary：第一个槽位 | `ponder.anchors.latticeChrome.slotPrimary` |
| `lattice-chrome` | `lattice-chrome-shared-slots` | 中间两个和底栏是同一份 | `ponder.captions.latticeChrome.swap` | 所以在设置里把底栏的槽位换掉，这里也跟着变 —— 不需要、也没有第二个地方再配一遍。 | slotPrimary：第一个槽位 | `ponder.anchors.latticeChrome.slotPrimary` |
| `lattice-chrome` | `lattice-chrome-bottom-bar` | 卡片看不见时底栏顶上来 | `ponder.captions.latticeChrome.onlyWhenVisible` | 这条控制条只在展开的海报上。海报没展开，或者展开的那张被滚出了视口，它就不在屏幕上。 | chrome：播放控制条 | `ponder.anchors.latticeChrome.chrome` |
| `lattice-chrome` | `lattice-chrome-bottom-bar` | 卡片看不见时底栏顶上来 | `ponder.captions.latticeChrome.barShows` | 这时候底部控制条会自己顶上来：正在播的那首海报一离开视口，它就出现；滚回去看得见了，它又收起。播放控制不会真的消失。 | bottomBar：底部控制条 | `ponder.anchors.latticeChrome.bottomBar` |
| `lattice-page` | `lattice-page-structure` | 队列墙、返回与工具 | `ponder.captions.pages.latticeWall` | Lattice 将队列铺成不规则海报墙，同一首歌可重复出现；当前歌曲显示编号和状态。 | wall：播放队列海报墙 | `ponder.anchors.lattice.wall` |
| `lattice-page` | `lattice-page-structure` | 队列墙、返回与工具 | `ponder.captions.pages.latticeBack` | 左上角返回；{{mod}} + B 关闭 Lattice。Esc 先收起展开内容或清除焦点，再按一次返回。 | back：返回 | `ponder.anchors.lattice.back` |
| `lattice-page` | `lattice-page-navigation` | 在无限墙上移动焦点 | `ponder.captions.pages.latticePan` | 在墙面拖动或滚轮平移相机，海报会随视口动态出现；拖动结束后的惯性不会改变播放队列顺序。 | wall：播放队列海报墙 | `ponder.anchors.lattice.wall` |
| `lattice-page` | `lattice-page-navigation` | 在无限墙上移动焦点 | `ponder.captions.pages.latticeFocusKeys` | 方向键从视口中央选择最近海报，再按空间方向移动焦点，并自动平移相机让目标可见。 | pannedPoster：队列海报 | `ponder.anchors.lattice.poster` |
| `lattice-page` | `lattice-page-poster` | 展开海报并控制播放 | `ponder.captions.pages.latticePosterOpen` | 点击或按 Enter 展开海报。当前歌曲展开后显示同步歌词；其他歌曲展开后显示标题与播放入口，队列本身不会被重排。 | expanded：展开的歌曲 | `ponder.anchors.lattice.expanded` |
| `lattice-page` | `lattice-page-poster` | 展开海报并控制播放 | `ponder.captions.pages.latticeChrome` | 展开海报显示播放、额外槽位、时间、进度和返回 Player；触屏点海报，键盘按 Space 显示或隐藏控制条。 | chrome：播放控制 | `ponder.anchors.lattice.chrome` |
| `lattice-page` | `lattice-page-tools` | 聚焦、跟随、队列与灯光 | `ponder.captions.pages.latticeTools` | 右下角工具依次提供：聚焦当前歌曲、切歌时自动跟随、打开队列命令、灯光开关与快捷键说明；向左滑这个按钮会打开命令面板。 | toolsPanel：工具面板 | `ponder.anchors.lattice.toolsPanel` |
| `lattice-page` | `lattice-page-tools` | 聚焦、跟随、队列与灯光 | `ponder.captions.pages.latticeLights` | 灯光关闭后海报退暗，只保留必要层次；这是显示设置，不会暂停播放或修改队列。 | wall：播放队列海报墙 | `ponder.anchors.lattice.wall` |
| `lattice-page` | `lattice-page-keyboard` | Lattice 的完整键盘操作 | `ponder.captions.pages.latticePosterKeys` | 收起时 Enter/Space 展开；展开后 Enter 播放/暂停，Space 显示控制，Esc 收起。 | poster：队列海报 | `ponder.anchors.lattice.poster` |
| `lattice-page` | `lattice-page-keyboard` | Lattice 的完整键盘操作 | `ponder.captions.pages.latticePageKeys` | : + C 当前歌曲；{{mod}} + P 队列；{{mod}} + B 返回；{{mod}} + K 命令；方向键移动。 | page：Lattice | `ponder.anchors.pages.lattice` |
| `lattice-style-settings` | `lattice-style-tint` | 暗角与海报叠色 | `ponder.captions.gridStyle.latticeVignette` | 「暗角」在队列拼贴页面四周压一层淡淡的暗，把视线收到中间的海报上。它只是显示效果，不影响队列本身。 | vignette：暗角 | `ponder.anchors.latticeStyle.vignette` |
| `lattice-style-settings` | `lattice-style-tint` | 暗角与海报叠色 | `ponder.captions.gridStyle.latticeTint` | 海报叠色会让播放中、聚焦和悬停的海报更醒目。关闭后，叠色强度和固定颜色设置也会隐藏。 | tint：海报叠色 | `ponder.anchors.latticeStyle.tint` |
| `lattice-style-settings` | `lattice-style-tint` | 暗角与海报叠色 | `ponder.captions.gridStyle.latticeIntensity` | 打开之后下面才有「叠色强度」。它是百分比：调到 0 等于没叠色，调高普通海报越暗、正在播的那张越突出。 | intensity：叠色强度 | `ponder.anchors.latticeStyle.intensity` |
| `lattice-style-settings` | `lattice-style-custom-color` | 换成一个固定颜色 | `ponder.captions.gridStyle.latticeCustomColor` | 默认的叠色是从当前主题算出来的渐变，会跟着换主题一起变。打开「使用固定颜色」就把它钉死成一个颜色，主题怎么换都不动。 | customColor：使用固定颜色 | `ponder.anchors.latticeStyle.customColor` |
| `lattice-style-settings` | `lattice-style-custom-color` | 换成一个固定颜色 | `ponder.captions.gridStyle.latticePicker` | 开了固定颜色，下面才出现取色器。拖动时海报墙实时跟着变，松手才真正存下来。 | picker：取色器 | `ponder.anchors.latticeStyle.picker` |
| `local-folder-actions` | `local-folder-actions-list` | 这一列有什么取决于你打开的是什么 | `ponder.captions.localFolderActions.conditional` | 操作栏随集合类型变化：本地文件夹可重扫和整理信息，本地歌单可导出，其他来源只显示支持的操作。 | panel：来源专属动作 | `ponder.anchors.localFolderActions.panel` |
| `local-folder-actions` | `local-folder-actions-list` | 这一列有什么取决于你打开的是什么 | `ponder.captions.localFolderActions.playAll` | 最上面两颗任何集合都有：全部播放和加入队列。页面上开着筛选时，它们作用于筛出来的那些，按钮文字会写出条数。 | playAll：全部播放 | `ponder.anchors.localFolderActions.playAll` |
| `local-folder-actions` | `local-folder-actions-maintenance` | 重扫与整理歌曲信息 | `ponder.captions.localFolderActions.reimport` | 重新导入会增量扫描文件夹：新增、更新和移除分别处理，不会重建已有记录。 | reimport：重新导入 | `ponder.anchors.localFolderActions.reimport` |
| `local-folder-actions` | `local-folder-actions-maintenance` | 重扫与整理歌曲信息 | `ponder.captions.localFolderActions.organize` | 「整理歌曲信息」打开的是这个文件夹的批量改 tag 面板 —— 一次处理整个文件夹，不是一首一首改。 | organize：整理歌曲信息 | `ponder.anchors.localFolderActions.organize` |
| `local-folder-actions` | `local-folder-actions-delete` | 红色那颗会删东西 | `ponder.captions.localFolderActions.remove` | 最下面这颗红的把这个文件夹从曲库里移除。它不删磁盘上的文件，但曲库里这些歌的记录、以及它们在歌单里的位置都会跟着没。 | remove：从曲库移除 | `ponder.anchors.localFolderActions.remove` |
| `local-folder-actions` | `local-folder-actions-delete` | 红色那颗会删东西 | `ponder.captions.localFolderActions.confirm` | 删除前会确认；根文件夹和子文件夹的影响范围不同，确认框会说明。 | panel：来源专属动作 | `ponder.anchors.localFolderActions.panel` |
| `local-library-watch` | `local-library-watch-roots` | 监视列表与失效的那一行 | `ponder.captions.libraryWatch.enable` | 打开后，Folia 会监视已导入的本地文件夹并自动增量扫描。 | enable：自动扫描 | `ponder.anchors.libraryWatch.enable` |
| `local-library-watch` | `local-library-watch-roots` | 监视列表与失效的那一行 | `ponder.captions.libraryWatch.roots` | 开关底下才展开这张列表，一行一个被监视的根文件夹，下面那行小字是它的真实路径。 | roots：监视中的文件夹 | `ponder.anchors.libraryWatch.roots` |
| `local-library-watch` | `local-library-watch-roots` | 监视列表与失效的那一行 | `ponder.captions.libraryWatch.warning` | 眼睛表示监视正常；黄色三角表示路径或权限有问题，文件夹已停止自动扫描。 | roots：监视中的文件夹 | `ponder.anchors.libraryWatch.roots` |
| `local-library-watch` | `local-library-watch-roots` | 监视列表与失效的那一行 | `ponder.captions.libraryWatch.recheck` | 看到三角就按右边这颗「重新检查」，它会重新挂一遍所有导入过的文件夹。旁边那行小字是上一次自动扫描的时间。 | recheck：重新检查 | `ponder.anchors.libraryWatch.recheck` |
| `local-metadata-match` | `local-metadata-match-reveal` | 三重条件才出现的一颗铅笔 | `ponder.captions.localMetadata.conditions` | 手动匹配只在当前卡片是本地歌曲、且指针停在歌名上时显示。 | card：当前卡片 | `ponder.anchors.gridViewCards.card` |
| `local-metadata-match` | `local-metadata-match-reveal` | 三重条件才出现的一颗铅笔 | `ponder.captions.localMetadata.pencil` | 满足之后它浮在歌名右端，只有 65% 不透明度。点开是手动匹配面板，重新给这首歌挑一份正确的标题、歌手和专辑。 | pencil：手动匹配 | `ponder.anchors.gridViewCards.pencil` |
| `local-track-sorting` | `local-track-sorting-fields` | 只有本地文件夹能排序 | `ponder.captions.localTrackSorting.whereOnly` | 排序控件只对本地文件夹显示；其他来源的顺序由来源决定。 | sortMenu：排序方式 | `ponder.anchors.localTrackList.sortMenu` |
| `local-track-sorting` | `local-track-sorting-fields` | 只有本地文件夹能排序 | `ponder.captions.localTrackSorting.fields` | 排序方式三选一：文件名、文件修改时间、专辑内音轨号。选好之后存在本地，换一个文件夹进去还是这个排法。 | menu：排序菜单 | `ponder.anchors.localTrackList.menu` |
| `local-track-sorting` | `local-track-sorting-fields` | 只有本地文件夹能排序 | `ponder.captions.localTrackSorting.direction` | 左边那颗切升序和降序，和排序方式各自独立。 | direction：升序 / 降序 | `ponder.anchors.localTrackList.direction` |
| `lyrics-animation-settings` | `lyrics-animation-entry` | 换歌词动画在哪儿换 | `ponder.captions.lyricsAnimation.where` | 换歌词动画不在播放页上换，在设置 · 外观的「歌词动画」这一组里。最上面这一条就是入口。 | entry：歌词动画样式 | `ponder.anchors.lyricsAnimation.entry` |
| `lyrics-animation-settings` | `lyrics-animation-entry` | 换歌词动画在哪儿换 | `ponder.captions.lyricsAnimation.playground` | 点开是整屏的动画调参台。左边那一大块是实时预览，放的就是播放页真正会渲染出来的样子；右边那条窄栏才是设置。 | panel：设置 · 歌词动画 | `ponder.anchors.lyricsAnimation.panel` |
| `lyrics-animation-settings` | `lyrics-animation-entry` | 换歌词动画在哪儿换 | `ponder.captions.lyricsAnimation.playgroundSections` | 右栏分为通用、背景、动画、字幕四页。动画页选择模式，下面显示该模式的参数。 | panel：设置 · 歌词动画 | `ponder.anchors.lyricsAnimation.panel` |
| `lyrics-animation-settings` | `lyrics-animation-toggles` | 两个影响观感的开关 | `ponder.captions.lyricsAnimation.card` | 入口下面这一张卡里装着两个开关。它们是同一张卡的上下两行，中间只隔一条分隔线，不是两张并排的卡。 | card：两个开关那张卡 | `ponder.anchors.lyricsAnimation.card` |
| `lyrics-animation-settings` | `lyrics-animation-toggles` | 两个影响观感的开关 | `ponder.captions.lyricsAnimation.transparent` | 「播放页透明背景」只影响播放页，适合 OBS 或抠像叠加；它和封面右上角按钮是同一个开关。 | transparent：播放页透明背景 | `ponder.anchors.lyricsAnimation.transparent` |
| `lyrics-animation-settings` | `lyrics-animation-toggles` | 两个影响观感的开关 | `ponder.captions.lyricsAnimation.autoHide` | 下面那行「自动隐藏控制栏」在你不动指针时把播放页的进度条和右侧按钮收起来，只留歌词。需要控制时靠近它们就会回来。 | autoHide：自动隐藏控制栏 | `ponder.anchors.lyricsAnimation.autoHide` |
| `lyrics-settings` | `lyrics-settings-source` | 歌词从哪来 | `ponder.captions.lyricsSource.autoBest` | 自动择优会从网易云、AMLLDB、QQ 和酷狗匹配歌词，并可能覆盖来源页的手动选择。手动选择没有生效时，先检查这里。 | autoBest：自动择优 | `ponder.anchors.lyricsSource.autoBest` |
| `lyrics-settings` | `lyrics-settings-source` | 歌词从哪来 | `ponder.captions.lyricsSource.priority` | 底下两张卡决定本地和在线的歌词谁优先。本地文件自带的歌词和在线检索到的同时存在时，按这里说的来。 | priorityLocal：本地优先 | `ponder.anchors.lyricsSource.priorityLocal` |
| `lyrics-settings` | `lyrics-settings-offset` | 两个同名的偏移量 | `ponder.captions.lyricsSource.globalOffset` | 「全局时间轴偏移」点进去是一整屏的标尺，调的是所有歌的歌词整体提前或延后多少 —— 一般用来补声卡或蓝牙的固定延迟。 | globalOffset：全局时间轴偏移 | `ponder.anchors.lyricsSource.globalOffset` |
| `lyrics-settings` | `lyrics-settings-offset` | 两个同名的偏移量 | `ponder.captions.lyricsSource.offsetSum` | 来源页偏移只对当前歌曲有效，全局偏移长期生效；两者会相加。 | globalOffset：全局时间轴偏移 | `ponder.anchors.lyricsSource.globalOffset` |
| `panel-account-tab` | `panel-account-tab` | 账号页 | `ponder.captions.sidePanel.accountTab` | 账号页管的是当前音乐来源那一侧的事。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-account-tab` | `panel-account-tab` | 账号页 | `ponder.captions.sidePanel.accountTabDetail` | 账号页显示登录状态、音质档位和云同步。不同来源会显示各自的账号信息。 | body：当前标签页内容 | `ponder.anchors.sidePanel.body` |
| `panel-controls-tab` | `panel-controls-tab` | 控制页 | `ponder.captions.sidePanel.controlsTab` | 控制页最上面是三颗大按钮：循环模式、喜欢、生成主题。这是整块面板里唯一一排大触控目标。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-controls-tab` | `panel-controls-tab` | 控制页 | `ponder.captions.sidePanel.controlsTabDetail` | 控制页有音量、均衡器、自动混音、歌词动画、背景和主题设置。音频增益与歌词偏移在来源页。 | body：当前标签页内容 | `ponder.anchors.sidePanel.body` |
| `panel-controls-tab` | `panel-controls-tab-mode-list` | 完整模式列表藏在名称后面 | `ponder.captions.sidePanel.controlsSteppers` | 这两行取景器选的是歌词动画和背景。两端那对箭头一次只换到相邻的一个模式 —— 十来个动画排着，这么翻要翻很久。 | modeRow：模式取景器那一行 | `ponder.anchors.sidePanel.modeRow` |
| `panel-controls-tab` | `panel-controls-tab-mode-list` | 完整模式列表藏在名称后面 | `ponder.captions.sidePanel.controlsModeList` | 中间的名称可点击打开完整列表，直接跳到目标项。 | modeList：全部模式 | `ponder.anchors.sidePanel.modeList` |
| `panel-controls-tab` | `panel-controls-tab-mode-list` | 完整模式列表藏在名称后面 | `ponder.captions.sidePanel.controlsModeListFooter` | 列表最底下那一条不是第七个模式 —— 它打开的是这一行对应的完整设置，调参就在那儿。 | modeListFooter：完整设置 | `ponder.anchors.sidePanel.modeListFooter` |
| `panel-cover-actions` | `panel-cover-actions-reveal` | 悬停才出现的四颗按钮 | `ponder.captions.panelCoverActions.appear` | 封面上平时什么都没有。指针移上去，四个角各浮出一颗按钮 —— 它们是四件互不相干的事，不是同一组「这首歌的操作」。 | cover：当前封面 | `ponder.anchors.sidePanel.cover` |
| `panel-cover-actions` | `panel-cover-actions-reveal` | 悬停才出现的四颗按钮 | `ponder.captions.panelCoverActions.settings` | 左上角那颗打开设置。按下去面板会先收起来，再把设置窗口铺上来。 | coverSettings：打开设置 | `ponder.anchors.sidePanel.coverSettings` |
| `panel-cover-actions` | `panel-cover-actions-reveal` | 悬停才出现的四颗按钮 | `ponder.captions.panelCoverActions.home` | 左下角那颗回到首页的海报墙，同样先收起面板。播放不会中断。 | coverHome：回到首页 | `ponder.anchors.sidePanel.coverHome` |
| `panel-cover-actions` | `panel-cover-actions-right` | 右边那两颗 | `ponder.captions.panelCoverActions.transparent` | 「播放页透明背景」让整个窗口透明，仅对播放页生效，适合 OBS 浏览器源或抠像叠加。 | coverTransparent：播放页透明背景 | `ponder.anchors.sidePanel.coverTransparent` |
| `panel-cover-actions` | `panel-cover-actions-right` | 右边那两颗 | `ponder.captions.panelCoverActions.addToPlaylist` | 右下角那颗把当前这首加进歌单。只有当前来源支持歌单时它才在；加不了的时候它是灰的，悬停会写明原因。 | coverPlaylist：加入歌单 | `ponder.anchors.sidePanel.coverPlaylist` |
| `panel-cover-actions` | `panel-cover-actions-right` | 右边那两颗 | `ponder.captions.panelCoverActions.touch` | 触屏上没有悬停这回事：点一下封面，四颗按钮就出来；点封面以外的地方再收起。 | cover：当前封面 | `ponder.anchors.sidePanel.cover` |
| `panel-cover-tab` | `panel-cover-tab` | 封面页 | `ponder.captions.sidePanel.coverTab` | 封面页放的是当前这首歌的文字信息：歌名、歌手、专辑，居中排一列。大封面不在这一页里，它常驻在面板顶上。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-cover-tab` | `panel-cover-tab` | 封面页 | `ponder.captions.sidePanel.coverTabDetail` | 点击歌手或专辑可进入对应集合。点击歌名复制歌曲信息，按住 Ctrl 点击可打开来源页面。 | body：当前标签页内容 | `ponder.anchors.sidePanel.body` |
| `panel-queue-tab` | `panel-queue-tab` | 队列页 | `ponder.captions.sidePanel.queueTab` | 队列页是当前播放队列的完整列表，顶上一行写着队列里有多少首。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-queue-tab` | `panel-queue-tab` | 队列页 | `ponder.captions.sidePanel.queueTabDetail` | 点击歌曲即可播放；悬停后可移到下一首、移到队尾或移除。顶部按钮可打开 Lattice 或打乱队列。这里不能拖动排序。 | body：当前标签页内容 | `ponder.anchors.sidePanel.body` |
| `panel-queue-tab` | `panel-queue-tab-radio` | 私人 FM 下这一格是电台 | `ponder.captions.sidePanel.queueRadio` | 私人 FM 播放时，这一页会变成电台面板，不再显示队列。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-queue-tab` | `panel-queue-tab-radio` | 私人 FM 下这一格是电台 | `ponder.captions.sidePanel.queueRadioMode` | 顶上那枚胶囊写的是你现在在哪个电台模式；点它打开的是命令窗口里的模式选择器，和命令面板给的是同一个。 | fmMode：电台模式 | `ponder.anchors.sidePanel.fmMode` |
| `panel-queue-tab` | `panel-queue-tab-radio` | 私人 FM 下这一格是电台 | `ponder.captions.sidePanel.queueRadioActions` | 底部按钮用于丢弃或喜欢。丢弃后服务不会再播放这首，电台会继续下一首。 | fmActions：扔掉和喜欢 | `ponder.anchors.sidePanel.fmActions` |
| `panel-slide` | `panel-slide-to-palette` | 滑动打开命令面板 | `ponder.captions.panelSlide.intro` | 这个按钮底下藏着一条滑轨。按住它，滑轨就会显出来。 | track：隐藏的滑轨 | `ponder.anchors.panelSlide.track` |
| `panel-slide` | `panel-slide-to-palette` | 滑动打开命令面板 | `ponder.captions.panelSlide.grabbed` | 按住这个按钮不放，它背后的滑轨就亮起来了。 | toggle：面板开关 | `ponder.anchors.panelSlide.toggle` |
| `panel-slide` | `panel-slide-to-palette` | 滑动打开命令面板 | `ponder.captions.panelSlide.threshold` | 往左拖。36 像素就够了 —— 到 44 像素按钮便不再跟手。 | threshold | — |
| `panel-slide` | `panel-slide-to-palette` | 滑动打开命令面板 | `ponder.captions.panelSlide.outcome` | 越过那条线松手，命令面板就打开了。 | palette：命令面板 | `ponder.anchors.panelSlide.palette` |
| `panel-slide` | `panel-slide-edge-hotspot` | 从边缘唤出手柄 | `ponder.captions.panelSlide.hotspotIntro` | 触屏上没有悬停这回事，所以屏幕边缘本身就是入口。 | toggle：面板开关 | `ponder.anchors.panelSlide.toggle` |
| `panel-slide` | `panel-slide-edge-hotspot` | 从边缘唤出手柄 | `ponder.captions.panelSlide.hotspotRevealed` | 在右边缘附近点一下，手柄会自己出来。 | track：隐藏的滑轨 | `ponder.anchors.panelSlide.track` |
| `panel-slide` | `panel-slide-keyboard` | 用键盘打开 | `ponder.captions.panelSlide.keyboardIntro` | 也可以完全不用指针。 |  | — |
| `panel-slide` | `panel-slide-keyboard` | 用键盘打开 | `ponder.captions.panelSlide.keyboardOutcome` | 直接按 {{mod}} + K，打开的是同一个窗口。 | palette：命令面板 | `ponder.anchors.panelSlide.palette` |
| `panel-source-tab` | `panel-source-tab-where` | 这一格什么时候才在 | `ponder.captions.sidePanel.sourceTab` | 本地、Navidrome 或在线来源的歌曲才会显示来源页；没有来源信息时只显示四个标签。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `panel-source-tab` | `panel-source-tab-where` | 这一格什么时候才在 | `ponder.captions.sidePanel.sourceInfo` | 来源页显示本地文件信息或 Navidrome 的 Song ID；在线来源没有这一页。 | sourceInfo：来源信息 | `ponder.anchors.sidePanel.sourceInfo` |
| `panel-source-tab` | `panel-source-tab-contents` | 增益、歌词与时间轴 | `ponder.captions.sidePanel.sourceGain` | 音频增益就是 ReplayGain，可选关闭、单曲或专辑。右上角的 T/A 是歌曲自带的增益值，没有标签时显示不可用。 | sourceGain：音频增益 | `ponder.anchors.sidePanel.sourceGain` |
| `panel-source-tab` | `panel-source-tab-contents` | 增益、歌词与时间轴 | `ponder.captions.sidePanel.sourceLyrics` | 右侧两颗图标分别用于导入本地歌词和在线匹配。下方显示当前歌词，导入后可以切换回其他版本。 | sourceLyrics：歌词 | `ponder.anchors.sidePanel.sourceLyrics` |
| `panel-source-tab` | `panel-source-tab-contents` | 增益、歌词与时间轴 | `ponder.captions.sidePanel.sourceOffset` | 时间轴偏移按 250ms 调整，也可以直接输入。它只对当前播放生效；设置里的全局偏移会与它相加。 | sourceOffset：时间轴偏移 | `ponder.anchors.sidePanel.sourceOffset` |
| `pinned-commands` | `pinned-commands-slots` | 三个槽位 | `ponder.captions.pinnedCommands.slots` | 三个下拉槽按顺序显示在命令窗口下方，默认是上一首、下一首和队列。 | slotSecond：槽位 2 | `ponder.anchors.pinnedCommands.slotSecond` |
| `pinned-commands` | `pinned-commands-slots` | 三个槽位 | `ponder.captions.pinnedCommands.unique` | 同一命令只能放一个槽位；空槽保留空位，三个都空时整排隐藏。 | slotThird：槽位 3 | `ponder.anchors.pinnedCommands.slotThird` |
| `pinned-commands` | `pinned-commands-vs-recent` | 固定不等于「最近用过」 | `ponder.captions.pinnedCommands.where` | 这三个下拉配出来的东西长在这儿：命令窗口下面一排三颗固定按钮，位置永远不变。点一下就执行，不用打字也不用翻。 | pinnedRow：固定的那三颗 | `ponder.anchors.pinnedCommands.pinnedRow` |
| `pinned-commands` | `pinned-commands-vs-recent` | 固定不等于「最近用过」 | `ponder.captions.pinnedCommands.recent` | 上面的列表和固定按钮是两套机制。列表按最近使用情况重排，固定按钮始终保持原位。 | paletteList：会随使用重排的列表 | `ponder.anchors.pinnedCommands.paletteList` |
| `pinned-commands` | `pinned-commands-vs-recent` | 固定不等于「最近用过」 | `ponder.captions.pinnedCommands.empty` | 所以两者各管各的用处：列表应付你临时要用的东西，那三颗应付你希望每次都在同一个位置的东西。 | pinnedRow：固定的那三颗 | `ponder.anchors.pinnedCommands.pinnedRow` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsIntro` | 播放控制只有这一条胶囊；上一首、下一首、随机、循环和音量都不常驻。 | bar：底部控制条 | `ponder.anchors.playerBar.bar` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsPlay` | 整条上唯一永远在的按钮是播放 / 暂停。宽屏时它在最左端；窄到一行放不下时，它落到第二行正中，两个槽位分列两侧。 | play：播放 / 暂停 | `ponder.anchors.playerBar.play` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsTitle` | 悬停歌名，两侧会显示上一首和下一首；点箭头切歌。 | title：曲目标题 | `ponder.anchors.playerBar.title` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsProgress` | 进度条就地拖动或点击跳转。点胶囊其他任何地方不是暂停，而是进入播放页；在 Lattice 上则是把视野拉回当前这首。 | progress：进度条 | `ponder.anchors.playerBar.progress` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsSlots` | 剩下的功能都归右边这两个位置。十个动作里你挑两个放上去，别的一律不在条上 —— 这就是这里没有一排固定按钮的原因。 | slots：两个槽位 | `ponder.anchors.playerBar.slots` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsCollapsed` | 移开指针，整条收回成一根进度条。你平时看到的是这个形态，需要控制时靠近它就会展开。 | bar：底部控制条 | `ponder.anchors.playerBar.bar` |
| `player-bar` | `player-bar-basics` | 这条胶囊上有什么 | `ponder.captions.playerBar.basicsAutoExpand` | 暂停且不在首页时，控制条会自动展开。恢复播放或回到首页后，它会收起。 | bar：底部控制条 | `ponder.anchors.playerBar.bar` |
| `player-bar` | `player-bar-height` | 整条的高度可以改 | `ponder.captions.playerBar.heightIntro` | 这条控制条离屏幕底边有多远是可以改的，各页面的歌曲卡片和侧边面板会跟着一起动。 | bar：底部控制条 | `ponder.anchors.playerBar.bar` |
| `player-bar` | `player-bar-height` | 整条的高度可以改 | `ponder.captions.playerBar.heightSettings` | 入口在设置 → 底部界面设置。滑杆调整高度，「在播放页拖动调整」允许直接拖动控制条；命令窗口也能打开同一设置。 | settings：设置 · 底部界面 | `ponder.anchors.playerBar.bottomUiSettings` |
| `player-bar` | `player-bar-height` | 整条的高度可以改 | `ponder.captions.playerBar.heightDrag` | 进了拖动调整之后，按住胶囊任意位置上下拖。松手即生效，而且会被记住。 | raised | — |
| `player-bar` | `player-bar-slots` | 右边两个位置可以换 | `ponder.captions.playerBar.slotsIntro` | 进度条右边这两个按钮不是固定的，两个位置各自独立。 | slots：两个槽位 | `ponder.anchors.playerBar.slots` |
| `player-bar` | `player-bar-slots` | 右边两个位置可以换 | `ponder.captions.playerBar.slotsWhere` | 在设置里挑：循环、随机、喜爱、队列、音量、睡眠定时等十个动作里任选，选完立刻生效。 | picker：设置里的选择器 | `ponder.anchors.playerBar.picker` |
| `player-bar` | `player-bar-shuffle` | 随机只洗一次牌 | `ponder.captions.playerBar.shuffleIntro` | 这个随机和别处的不一样 —— 它不是一个开着就一直生效的模式。 | primarySlot：第一个槽位 | `ponder.anchors.playerBar.primarySlot` |
| `player-bar` | `player-bar-shuffle` | 随机只洗一次牌 | `ponder.captions.playerBar.shuffleOnce` | 按一下，Folia 把当前队列原地洗一次牌，洗完这个顺序就定下来了。想换个顺序就再按一次。 | queue：播放队列 | `ponder.anchors.playerBar.queue` |
| `player-bar` | `player-bar-volume` | 音量在命令面板里 | `ponder.captions.playerBar.volumeIntro` | 底部控制条上没有常驻的音量滑块。 | primarySlot：第一个槽位 | `ponder.anchors.playerBar.primarySlot` |
| `player-bar` | `player-bar-volume` | 音量在命令面板里 | `ponder.captions.playerBar.volumeOpens` | 按这里打开的是命令面板里的音量面板，不是就地弹一个小滑块。 | volumeSurface：音量面板 | `ponder.anchors.playerBar.volumeSurface` |
| `player-page` | `player-page-layout` | 页面上有什么、各在哪 | `ponder.captions.pages.playerLayout` | 播放页全屏显示歌词和可视化；入口只有底部控制条、右侧手柄和展开后的面板。 | page：播放器 | `ponder.anchors.pages.player` |
| `player-page` | `player-page-layout` | 页面上有什么、各在哪 | `ponder.captions.pages.playerLyrics` | 中间这块是歌词与可视化。它不是控件：点它等于点背景，只切换控制条的显隐，不会暂停。 | lyrics：歌词与可视化 | `ponder.anchors.playerPage.lyrics` |
| `player-page` | `player-page-layout` | 页面上有什么、各在哪 | `ponder.captions.pages.playerBarWhere` | 控制条浮在屏幕底部正中，不贴边。左端是播放/暂停，中间是歌名和进度条，右端两个位置放什么由你决定。 | bar：底部控制条 | `ponder.anchors.playerPage.bar` |
| `player-page` | `player-page-layout` | 页面上有什么、各在哪 | `ponder.captions.pages.playerToggleWhere` | 侧边手柄贴在屏幕右缘，底边和控制条对齐。它是一颗圆按钮，按一下展开右侧控制面板。 | toggle：侧边手柄 | `ponder.anchors.playerPage.toggle` |
| `player-page` | `player-page-layout` | 页面上有什么、各在哪 | `ponder.captions.pages.playerPanelWhere` | 面板从手柄上方展开，贴着右侧。顶部是封面，下面是封面、控制、队列、账号等标签页。 | panel：控制面板 | `ponder.anchors.playerPage.panel` |
| `player-page` | `player-page-open-palette` | 叫出命令窗口 | `ponder.captions.pages.playerPaletteSlide` | 手柄背后还藏着一条向左的滑轨。按住手柄往左拖，越过判定线再松手，打开的是命令窗口，不是面板。 | track：隐藏的滑轨 | `ponder.anchors.playerPage.track` |
| `player-page` | `player-page-open-palette` | 叫出命令窗口 | `ponder.captions.pages.playerPaletteOpened` | 命令窗口从屏幕上方落下，水平居中。Folia 把「找功能」这件事全部收在这里。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-open-palette` | 叫出命令窗口 | `ponder.captions.pages.playerPaletteOtherWays` | {{mod}} + K 可随时打开命令窗口。播放页焦点不在输入框时，按 S 也可以；触屏先点右缘唤出手柄。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-run-commands` | 在命令窗口里执行 | `ponder.captions.pages.playerCommandFilter` | 窗口开着就直接打字，它按名字、别名和关键词一起筛。↑↓ 选，Enter 执行 —— 不必先想清楚这条命令归在哪一类。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-run-commands` | 在命令窗口里执行 | `ponder.captions.pages.playerCommandArgument` | 需要参数的命令不会立刻跑。打完命令名按空格，它收成输入行里的一枚标签，光标留在后面等你补参数，补完再 Enter。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-run-commands` | 在命令窗口里执行 | `ponder.captions.pages.playerExecuteMode` | 窗口关闭且焦点不在输入框时，按冒号进入执行模式；窗口已打开时，冒号只会输入到查询框。进入后按 r/v/o/h 执行对应命令。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-shuffle` | 常见问题：怎么随机播放 | `ponder.captions.pages.playerShuffleNoSwitch` | Folia 没有常驻的随机播放开关；它是一次操作，按下后会打乱当前队列。 | bar：底部控制条 | `ponder.anchors.playerPage.bar` |
| `player-page` | `player-page-shuffle` | 常见问题：怎么随机播放 | `ponder.captions.pages.playerShuffleHow` | 播放页按冒号进入执行模式，再按 r 打乱队列；再次执行可换顺序。 | palette：命令窗口 | `ponder.anchors.playerPage.palette` |
| `player-page` | `player-page-shuffle` | 常见问题：怎么随机播放 | `ponder.captions.pages.playerShuffleSlot` | 如果你常用它，把「随机队列」放进控制条右边那两个位置之一，以后按一下就行。 | bar：底部控制条 | `ponder.anchors.playerPage.bar` |
| `ponder-basics` | `help-page-ponder` | 你已经在思索里了 | `ponder.captions.onboarding.here` | 这是当前页面的思索教程，不是视频。进度条可拖，方向键切换关键帧，Space 暂停，Esc 退出。 | page：一页界面 | `ponder.anchors.onboarding.page` |
| `ponder-basics` | `help-page-ponder` | 你已经在思索里了 | `ponder.captions.onboarding.hover` | 悬停在按钮或组件上会出现提示。按住 G，进度走满后打开对应教程。 | capsule：悬停提示 | `ponder.anchors.onboarding.capsule` |
| `ponder-basics` | `help-page-ponder` | 你已经在思索里了 | `ponder.captions.onboarding.hold` | 按住不放，进度走满后打开教程；提前松手会取消。 | page：一页界面 | `ponder.anchors.onboarding.page` |
| `ponder-basics` | `help-page-whole-page` | 整页的教程，以及触屏怎么办 | `ponder.captions.onboarding.wholePage` | 不想找组件也行：在任意页面上按住 Ctrl + G，打开的是整页的教程 —— 这一页上有什么、各在哪、能怎么操作。 | page：一页界面 | `ponder.anchors.onboarding.page` |
| `ponder-basics` | `help-page-whole-page` | 整页的教程，以及触屏怎么办 | `ponder.captions.onboarding.touchBulb` | 触屏没有悬停，所以用右上角灯泡打开本页教程。它出现几秒后会收起，点右上角可再次唤出。鼠标看不到它是正常的。 | touchBulb：触屏上的思索按钮 | `ponder.anchors.onboarding.touchBulb` |
| `ponder-basics` | `help-page-hint-settings` | 看够了就把提示关掉 | `ponder.captions.onboarding.hintSettings` | 可在设置 · 实验室关闭思索提示，或只提示未看过的区域。下方按钮可直接打开设置。 | page：设置 | `ponder.anchors.pages.settings` |
| `queue-command-surface` | `queue-command-facets` | @ 把范围收窄 | `ponder.captions.queueCommand.whatItIs` | {{mod}} + P 打开队列窗口。输入即可筛选，↑↓选择，Enter 播放。 | input：输入行 | `ponder.anchors.queueCommand.input` |
| `queue-command-surface` | `queue-command-facets` | @ 把范围收窄 | `ponder.captions.queueCommand.atSign` | 输入 @ 可筛选队列中的歌手或专辑；后面会显示各项包含的歌曲数。 | suggestions：歌手 / 专辑建议 | `ponder.anchors.queueCommand.suggestions` |
| `queue-command-surface` | `queue-command-facets` | @ 把范围收窄 | `ponder.captions.queueCommand.narrowed` | 选中后会收成输入行标签，列表只显示该项的歌曲。 | input：输入行 | `ponder.anchors.queueCommand.input` |
| `queue-command-surface` | `queue-command-batch` | -- 对筛出来的全部下手 | `ponder.captions.queueCommand.flags` | 输入 -- 可查看批量操作：--remove 移除，--next 移到下一首，--end 移到队尾。 | input：输入行 | `ponder.anchors.queueCommand.input` |
| `queue-command-surface` | `queue-command-batch` | -- 对筛出来的全部下手 | `ponder.captions.queueCommand.scope` | 它操作的是筛选出的全部歌曲，不是高亮行。预览会显示“将影响 N 首”。 | preview：批量操作预览 | `ponder.anchors.queueCommand.preview` |
| `queue-command-surface` | `queue-command-batch` | -- 对筛出来的全部下手 | `ponder.captions.queueCommand.guards` | 没有搜索词或 @ 筛选时拒绝执行，避免清空队列；正在播放的歌曲会排除。 | preview：批量操作预览 | `ponder.anchors.queueCommand.preview` |
| `queue-settings` | `queue-settings-behavior` | 加到末尾还是加到下一首 | `ponder.captions.queueSettings.append` | 这两张卡决定「加入队列」到底加到哪儿。默认是加到队列末尾，先听完手上排着的。 | append：加到末尾 | `ponder.anchors.queueSettings.append` |
| `queue-settings` | `queue-settings-behavior` | 加到末尾还是加到下一首 | `ponder.captions.queueSettings.next` | 选择后，新歌曲会插到当前歌曲后面。这个设置会影响卡片、队列行和命令窗口里的所有加入队列入口。 | next：加到当前之后 | `ponder.anchors.queueSettings.next` |
| `replay-gain-settings` | `replay-gain-modes` | 三个模式 | `ponder.captions.replayGain.off` | 关闭后不使用文件里的 ReplayGain 标签，每首歌按原始音量播放。 | modeOff：关闭 | `ponder.anchors.replayGain.modeOff` |
| `replay-gain-settings` | `replay-gain-modes` | 三个模式 | `ponder.captions.replayGain.trackAlbum` | 按单曲会让不同歌曲的响度更接近；按专辑会保留专辑内部的强弱变化。两种模式都只改播放音量，不改文件。 | modeAlbum：按专辑 | `ponder.anchors.replayGain.modeAlbum` |
| `replay-gain-settings` | `replay-gain-mirrored` | 同一个值，两处入口 | `ponder.captions.replayGain.sameValue` | 控制面板来源页的三个按钮与这里共用同一个 ReplayGain 设置，改一处会同步另一处。 | panelModes：同样那三个模式 | `ponder.anchors.replayGain.panelModes` |
| `replay-gain-settings` | `replay-gain-mirrored` | 同一个值，两处入口 | `ponder.captions.replayGain.summary` | 来源页还会显示这首歌的 T/A 增益标签；没有标签时显示「不可用」。 | panelSummary：这首歌的增益标签 | `ponder.anchors.replayGain.panelSummary` |
| `settings-page` | `settings-page-overview` | 设置按用途分组 | `ponder.captions.pages.settings` | 左侧按外观、界面、播放、交互、集成、存储、桌面和实验室分组；右侧显示当前分组里的具体设置。 | page：设置 | `ponder.anchors.pages.settings` |
| `settings-page` | `settings-page-direct-navigation` | 从命令直接跳转 | `ponder.captions.pages.settingsDirectNavigation` | 不必逐层翻找：在命令面板搜索设置名称，Folia 会直接打开对应分组并滚到准确位置。 | palette：命令面板 | `ponder.anchors.pages.commandPalette` |
| `side-panel` | `side-panel-structure` | 面板里有什么 | `ponder.captions.sidePanel.cover` | 面板顶部是当前歌曲的方形封面，换页时保持不动。悬停后四角会出现按钮。 | cover：当前封面 | `ponder.anchors.sidePanel.cover` |
| `side-panel` | `side-panel-structure` | 面板里有什么 | `ponder.captions.sidePanel.tabs` | 封面下方是标签页：封面、控制、队列、账号；有来源信息时还会多一个来源页。换页不会移动面板。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `side-panel` | `side-panel-structure` | 面板里有什么 | `ponder.captions.sidePanel.body` | 标签下方是当前内容。面板固定为封面、标签和内容三部分。 | body：当前标签页内容 | `ponder.anchors.sidePanel.body` |
| `side-panel` | `side-panel-tabs` | 换标签页 | `ponder.captions.sidePanel.cycle` | 不必去点那一排小格子。面板开着时按 Tab，就在标签页之间往后循环一格。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `side-panel` | `side-panel-tabs` | 换标签页 | `ponder.captions.sidePanel.cycleReverse` | Shift + Tab 往回一格。循环只在当前真的有的那几页之间走 —— 来源不同，页数也不同。 | tabs：标签页 | `ponder.anchors.sidePanel.tabs` |
| `theme-park` | `theme-park-target` | 你在编辑哪一份主题 | `ponder.captions.themePark.which` | 右上角切换当前编辑的主题：歌曲的 AI 主题或保存的自定义主题。两边草稿互不影响，保存只作用于当前选中的主题。 | targetToggle：在编辑哪一份 | `ponder.anchors.themePark.targetToggle` |
| `theme-park` | `theme-park-target` | 你在编辑哪一份主题 | `ponder.captions.themePark.reset` | 重置丢掉的是你这一次改的东西，把草稿退回刚打开时的样子。它不碰已经保存下来的那一份。 | reset：重置 | `ponder.anchors.themePark.reset` |
| `theme-park` | `theme-park-colors` | 亮和暗是两份配色 | `ponder.captions.themePark.twoSides` | 亮色和暗色分别保存。切换这一项后，下面的颜色、取色器和 HEX 输入框都会跟着切换。 | modeToggle：亮 / 暗 | `ponder.anchors.themePark.modeToggle` |
| `theme-park` | `theme-park-colors` | 亮和暗是两份配色 | `ponder.captions.themePark.fourColors` | 每面有背景、主色、强调色和次要色。点颜色后可在下方取色器调整，说明文字标出使用位置。 | colorRows：四种颜色 | `ponder.anchors.themePark.colorRows` |
| `theme-park` | `theme-park-colors` | 亮和暗是两份配色 | `ponder.captions.themePark.recommended` | 最底下那排色块是从当前封面算出来的。点一下直接填进正在选中的那一行 —— 这是配出一套和专辑相称的配色最快的路。 | recommended：推荐色 | `ponder.anchors.themePark.recommended` |
| `theme-park` | `theme-park-saving` | 保存为什么按不动 | `ponder.captions.themePark.blocked` | 保存有时是灰的，而你正看着的这一页上没有任何地方说明原因。原因是主题要有名字，而且亮暗两面都要有，才存得下去。 | save：保存 | `ponder.anchors.themePark.save` |
| `theme-park` | `theme-park-saving` | 保存为什么按不动 | `ponder.captions.themePark.nameLivesHere` | 主题名称和描述在「信息」页。保存按钮点不了时，先去那里填写名称。 | tabDetails：信息那一页 | `ponder.anchors.themePark.tabDetails` |
| `theme-park` | `theme-park-saving` | 保存为什么按不动 | `ponder.captions.themePark.applies` | 保存自定义主题后，应用会立即切换到它。 | save：保存 | `ponder.anchors.themePark.save` |
| `theme-settings` | `theme-settings-presets` | 预设与自定义 | `ponder.captions.themeSettings.presetDefault` | 左边这个是内置预设「墨染 / 素白」：一枚渐变小圆加一行标签，跟着明暗模式在深色和浅色之间自动换。 | presetDefault：内置预设 | `ponder.anchors.themeSettings.presetDefault` |
| `theme-settings` | `theme-settings-presets` | 预设与自定义 | `ponder.captions.themeSettings.presetCustom` | 右边这个是自定义配色。还没有自定义主题时它是灰的、按不动；有了之后选中它，播放页、卡片和面板都会换成这套颜色。 | presetCustom：自定义配色 | `ponder.anchors.themeSettings.presetCustom` |
| `theme-settings` | `theme-settings-source` | 配色从哪来 | `ponder.captions.themeSettings.source` | 自定义配色有两个来源：当前封面或 AI。未配置 API Key 时，AI 选项不可用。 | source：主题生成来源 | `ponder.anchors.themeSettings.source` |
| `theme-settings` | `theme-settings-source` | 配色从哪来 | `ponder.captions.themeSettings.themePark` | 标题旁的调色板按钮打开 Theme Park。它是全屏配色编辑器，左侧显示实时预览。 | panel：设置 · 配色主题预设 | `ponder.anchors.themeSettings.panel` |
| `theme-settings` | `theme-settings-source` | 配色从哪来 | `ponder.captions.themeSettings.themeParkTabs` | 右栏有配色、信息、内容、AI 四页。配色页分别保存亮暗两套颜色，AI 页可以生成整套主题。 | panel：设置 · 配色主题预设 | `ponder.anchors.themeSettings.panel` |
| `theme-settings` | `theme-settings-auto` | 配色什么时候自己变 | `ponder.captions.themeSettings.followSystem` | 这一组下半截是三个开关。「跟随系统明暗」按系统设置自动切亮色 / 暗色；你手动切过一次明暗之后，它会自己关掉。 | followSystem：跟随系统明暗 | `ponder.anchors.themeSettings.followSystem` |
| `theme-settings` | `theme-settings-auto` | 配色什么时候自己变 | `ponder.captions.themeSettings.preferCustom` | 「优先使用自定义主题」打开之后，主题自动切换会被关掉 —— 两者是互斥的。这就是开了它以后换歌颜色不再变的原因。 | preferCustom：优先使用自定义主题 | `ponder.anchors.themeSettings.preferCustom` |
| `theme-settings` | `theme-settings-auto` | 配色什么时候自己变 | `ponder.captions.themeSettings.autoSwitch` | 主题自动切换会在播放有缓存主题的歌曲时应用它；打开主题生成后，没有缓存的歌曲也会自动生成主题。 | autoSwitch：主题自动切换 | `ponder.anchors.themeSettings.autoSwitch` |
| `transition-settings` | `transition-settings-enable` | 总开关与两种模式 | `ponder.captions.transition.enable` | 这一组管的是两首歌之间怎么接上。最上面是总开关 —— 它和控制页音量行右端那颗小图标是同一个值，两处改的是同一件事。 | enable：过渡总开关 | `ponder.anchors.transition.enable` |
| `transition-settings` | `transition-settings-enable` | 总开关与两种模式 | `ponder.captions.transition.modes` | 模式包括淡化和自动混音：淡化切换歌曲，自动混音分析音频后选择接点。 | automix：自动混音 | `ponder.anchors.transition.automix` |
| `transition-settings` | `transition-settings-fallback` | 选了不等于在跑 | `ponder.captions.transition.badge` | 「使用中」表示自动混音正在运行；「已退回淡化」表示条件不足，系统改用淡化。 | badge：使用中 / 已退回 | `ponder.anchors.transition.badge` |
| `transition-settings` | `transition-settings-fallback` | 选了不等于在跑 | `ponder.captions.transition.notice` | 自动混音需要媒体缓存；黄色提示中的链接可直接打开缓存设置。 | notice：缺条件时的提示 | `ponder.anchors.transition.notice` |
| `vis-playground` | `vis-playground-layout` | 左边是真的在跑的预览 | `ponder.captions.visPlayground.preview` | 调参台全屏打开：左边是实时预览，右边是设置栏。预览使用真实渲染器，改动会马上显示。 | preview：实时预览 | `ponder.anchors.visPlayground.preview` |
| `vis-playground` | `vis-playground-layout` | 左边是真的在跑的预览 | `ponder.captions.visPlayground.pause` | 预览右下角那颗按钮把画面冻在当前这一帧。调那种只闪一下的效果时用得上，顺带也让预览在你读字的时候不再继续吃算力。 | pause：暂停预览 | `ponder.anchors.visPlayground.pause` |
| `vis-playground` | `vis-playground-hotspots` | 三块你看不见的区域 | `ponder.captions.visPlayground.invisible` | 预览上有三块隐藏点击区，没有边框、底色或标签。 | preview：实时预览 | `ponder.anchors.visPlayground.preview` |
| `vis-playground` | `vis-playground-hotspots` | 三块你看不见的区域 | `ponder.captions.visPlayground.three` | 指针扫过去它们才显形：顶上一条是背景，中间一大块是动画，底下一条是字幕。 | hotspotVisualizer：动画那一块 | `ponder.anchors.visPlayground.hotspotVisualizer` |
| `vis-playground` | `vis-playground-hotspots` | 三块你看不见的区域 | `ponder.captions.visPlayground.jumps` | 点其中一块，右边设置栏就跳到对应那一节。这是这一屏里最快的走法 —— 指着画面上你想改的那部分，而不是去读标签的名字。 | tabs：四页 | `ponder.anchors.visPlayground.tabs` |
| `vis-playground` | `vis-playground-common` | 四页各管什么，以及「通用」里有什么 | `ponder.captions.visPlayground.four` | 设置栏一共四页：通用、背景、动画、字幕。热区指向的就是其中三页，所以标签和画面是同一份清单的两个入口。 | tabs：四页 | `ponder.anchors.visPlayground.tabs` |
| `vis-playground` | `vis-playground-common` | 四页各管什么，以及「通用」里有什么 | `ponder.captions.visPlayground.common` | 只有一个例外：「通用」没有自己的热区，因为它不是画面的一部分 —— 它装的是作用于整屏的那些。那一页只能从这排标签进。 | tabCommon：通用 | `ponder.anchors.visPlayground.tabCommon` |
| `vis-playground` | `vis-playground-common` | 四页各管什么，以及「通用」里有什么 | `ponder.captions.visPlayground.fonts` | 「通用」设置歌词字体、字号和字重。字重默认自动，也可手动指定。 | rowTwo：第二行 | `ponder.anchors.visPlayground.rowTwo` |
| `vis-playground` | `vis-playground-common` | 四页各管什么，以及「通用」里有什么 | `ponder.captions.visPlayground.previewText` | 第一行挑的是预览唱什么。想看看这套字撑不撑得住长句、或者别的文字系统，换一段示例比等一首真歌放到那儿要快。 | rowOne：第一行 | `ponder.anchors.visPlayground.rowOne` |
| `vis-playground` | `vis-playground-common` | 四页各管什么，以及「通用」里有什么 | `ponder.captions.visPlayground.sectionReset` | 每一页右上角各有一颗自己的复位，它退的只有这一页。它不是整张调参台的复位 —— 你在别的页上调过的东西不会被它带走。 | sectionReset：只退这一页 | `ponder.anchors.visPlayground.sectionReset` |
| `vis-playground` | `vis-playground-visuals` | 动画与背景 | `ponder.captions.visPlayground.animation` | 动画那一页最上面是模式本身。模式比这一屏能列下的多，而且值得你自己翻一遍，所以这一章只说这一页是什么，不把清单念一遍。 | rowOne：第一行 | `ponder.anchors.visPlayground.rowOne` |
| `vis-playground` | `vis-playground-visuals` | 动画与背景 | `ponder.captions.visPlayground.perMode` | 模式下方是对应参数；换模式，参数也会跟着换。 | rowTwo：第二行 | `ponder.anchors.visPlayground.rowTwo` |
| `vis-playground` | `vis-playground-visuals` | 动画与背景 | `ponder.captions.visPlayground.background` | 背景那一页是同一套做法：先挑背景，再调这个背景。它和动画是两层，各挑各的，任意组合都成立。 | rowOne：第一行 | `ponder.anchors.visPlayground.rowOne` |
| `vis-playground` | `vis-playground-subtitle` | 字幕 | `ponder.captions.visPlayground.subtitleContent` | 字幕第二行可选：无、翻译或罗马音。三选一，不能同时开启。 | rowOne：第一行 | `ponder.anchors.visPlayground.rowOne` |
| `vis-playground` | `vis-playground-subtitle` | 字幕 | `ponder.captions.visPlayground.subtitleLegibility` | 这里设置字幕底色、不透明度，以及未唱行的模糊效果。 | rowTwo：第二行 | `ponder.anchors.visPlayground.rowTwo` |
| `vis-playground` | `vis-playground-subtitle` | 字幕 | `ponder.captions.visPlayground.subtitleFont` | 字幕默认跟随歌词字体。关闭后，字幕的字体、字号和字重设置才会出现。 | rowFive：第五行 | `ponder.anchors.visPlayground.rowFive` |
