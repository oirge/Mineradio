# 思索（Ponder）教程清单

这份清单记的是「哪些地方该有教程、哪些教程的说法和真实行为对不上」。

为什么要有它：思索的目标是声明式数据，写错了不会有任何类型错误，缺一个目标也不会有任何东西报警 ——
只有人翻到那儿发现没有，或者照着字幕做了一遍发现做不成。所以覆盖面和准确性只能靠一份手写的账。

判断「值得单独讲」的标准：

- 藏在悬停 / 长按 / 右键 / 拖放后面，静态画面上看不见
- 和别的播放器的习惯不一样
- 一处控件镜像另一处配置，改一处两处都变
- 有前置条件才出现（某个来源才有、某个开关开了才有）
- 命名不自解释，或者同一屏里两个选项互斥
- **会改动或删除用户数据，做错了不可逆**

---

## 已完成

### 机制

- [x] 章节自动续播：一章播完读条 5.2s 进下一章；暂停、指针移到「下一章」上、按任意键都取消；末章不读条
- [x] 悬停提示胶囊写出目标名称（第二行，强调色）
- [x] 思索图标统一成灯泡（`PonderHintCapsule` / `PonderChrome` 此前是键盘图标）
- [x] `PonderSceneAction` 增加 `openUrl`，章节可以带一颗打开外部链接的按钮

### 右侧控制面板

- [x] 骨架重画：删掉封面和标签排之间那条不存在的「曲目信息」带；四页内容按真实组件重画
- [x] `panel-cover-actions` — 封面四角那四颗悬停才出现的按钮
- [x] `panel-cover-tab` / `panel-controls-tab` / `panel-queue-tab` / `panel-account-tab` — 一页一个目标
- [x] `panel-source-tab` — 跟着来源走的那一格（本地 / Navidrome / 在线歌词共用一格）
- [x] 文案修正：控制页的音量增益与歌词偏移其实在来源页、队列页不能拖动排序也没有「清空」、账号页的缓存清理已被注释掉

### 设置

- [x] `lyrics-animation-settings` 骨架与文案重做（两个开关同属一张卡；调参台是左预览右设置栏，原文左右说反了）
- [x] `theme-settings` 骨架与文案重做（Theme Park 是编辑器不是配色库；来源只有两个选项；补上下半截三个开关）
- [x] `grid3d-card-style` — 首页卡片样式
- [x] `grid-view-card-settings` — 网格卡片（全画幅封面解锁正方形卡片；两条滑杆调的是衰减下限）
- [x] `lattice-style-settings` — 队列拼贴（暗角 + 层层嵌套的海报叠色）

### 入门与导航

- [x] 思索导航页：帮助页那颗按钮开的是它，一屏按分类列完所有能单独讲的东西。
      每张卡挂 `data-ponder-nav-target`，悬停长按 G 和触屏点击走同一条路
- [x] `category` 进 `PonderTargetDefinition`，导航页从注册表算分组 —— 手写的表和注册表必然走散
- [x] 总览压到**一章**：细节拆成 `ponder-basics` / `folia-transport` / `folia-shortcuts` / `folia-desktop`
- [x] `folia-desktop` — 壁纸模式、系统托盘、遥控窗口。画的是一整块桌面，
      因为这三样讲的都是 Folia 和操作系统之间的关系
- [x] 第一次那道门开的是总览，不再是底下那一页的海报墙教程
- [x] `help-page` 重写成入门教程，帮助页那颗灯泡按钮直接开它
- [x] 六章：你已经在思索里了 / 整页教程与触屏那颗灯泡 / 不用切回来也能控制播放 /
      四个常用快捷键 / 去文档 / 看够了把提示关掉
- [x] 入门教程换掉通用页面轮廓，改画一张讲思索本身的示意图（`ponder-onboarding`）：
      一页界面、指针停着的那个组件、浮出来的提示胶囊、右下角触屏用的灯泡，再加教程接管整屏的那一层
- [x] 触屏灯泡的说法改准：它只在主指针不是精确指针（`(hover: hover) and (pointer: fine)` 不成立）时渲染，用鼠标找不到是正常的
- [x] 触屏灯泡从右下角搬到右上角 —— 右下角是底部控制条、集合页列表按钮、播放页手柄挤在一起
      的地方，一颗常驻浮动按钮压上去就是挡路
- [x] 灯泡改成限时显示：落地或换页露 4 秒就收，点右上角热区唤回；热区按坐标判而不是摆元素，
      摆元素等于把「挡路」原样搬到右上角
- [x] 设置里可以彻底关掉这颗按钮（设置 · 实验室 → 思索教程提示），命令面板也有对应开关

### 对话框与整屏编辑器

- [x] `audio-equalizer` — 拖任何一根推子都会**静默**把你转到自定义槽 1 并覆写它；
      复位只清当前那个槽，停在内置预设上时是灰的。
      （计划里一度划掉过，后来决定留下：它落在「会改动用户数据、做错了不可逆」那一条里）
- [x] `vis-playground` — 预览上三块完全透明的点击热区，悬停才描边、点了右栏跳到对应那一节；
      再走一遍右栏四页：通用（示例文本与歌词字体、只退本页的复位）、动画与背景
      （模式下面跟着的调参随模式换）、字幕（内容三选一、可读性那几行、字体跟不跟歌词走）。
      具体有哪些动画模式刻意不列 —— 那是一份会长的清单，留给人自己翻
- [x] `theme-park` — 整屏配色编辑器：在编辑哪一份主题、亮暗是两份独立配色，
      以及保存灰掉的原因（名字在「信息」那一页上）

### 集合页与本地曲库

- [x] `pages.gridViewActivate` 文案修正 —— 点卡片只把它移到中央，播放靠卡片上那颗独立的播放键；
      编辑模式下那两颗按钮直接消失，只剩一个移除用的叉
- [x] `grid-action-button` — 右下角那颗按钮：点击开列表、向左滑是第二个动作、滑到哪由设置决定
- [x] `grid-view-edit-mode` — 编辑模式：卡片按钮整排换掉；本地与 Navidrome 歌单改名退出时才提交
- [x] `local-folder-actions` — 信息面板底部那一列：这一列有什么取决于集合类型；重扫是增量；红的那颗会删记录
- [x] `local-metadata-match` — 三重条件才出现的那颗铅笔
- [x] `local-track-sorting` — 只有本地文件夹能排序，选择存 localStorage 跨会话保留

### 命令面板与设置

- [x] `custom-shortcut-settings` — 修饰键固定 Alt 所以录不进组合键；命令下拉被
      `isScopeIndependentCommand` 筛过，命令窗口里有的这里可能没有
- [x] `pinned-commands` — 三个槽位和「最近用过的排前面」是两套独立机制，存在不同的键里
- [x] `replay-gain-settings` — 和来源页那个三选一是同一个值；来源页还多一行 T/A 分贝
- [x] `import-export-settings` — 只带外观那一套，不是全量备份；导入会先弹逐项对照框，
      其中衍生改动勾不掉
- [x] `queue-command-surface` — 队列窗口：`@artist:` / `@album:` 是全仓唯一没有按钮能替代的语法；
      `--remove` 作用于筛选结果而不是选中行，两道保险（没筛选拒绝执行、排除当前歌）也讲了
- [x] `transition-settings` — 选了 automix 不等于在跑，那枚「已退回淡化」的小徽章是唯一提示
- [x] `local-library-watch` — 监视列表里眼睛和黄三角两种状态，后者意味着监视已失效
- [x] `queue-settings` — 「加入队列」加到哪儿，改的是全应用所有入口
- [x] `lyrics-settings` — 自动择优会盖掉手动选的来源；两个同名偏移量会相加
- [x] `grid-palette-hotkey` — 网格页上 S 归命令窗口还是归筛选框
- [x] `queue-shuffle` — 没有随机模式，只有打乱队列；命令、控制条按钮、队列页按钮、固定命令四个入口各一章。
      没有悬停落点，连点循环按钮三下弹出的提示（最多两次）送人进来

### 文案事实性错误

- [x] `pages.playerShuffleHow`、`pages.playerExecuteMode`、`commandPalette.executeEnter` —— 冒号是**窗口关着时**按的，`{{mod}}+K` 之后再按只会打进输入框
- [x] `playerBar.volumeIntro` —— 控制页有常驻音量滑杆，应为「底部控制条上没有」
- [x] `playerBar.basicsPlay` —— 播放键只在宽屏时在最左端
- [x] `pages.latticeBack` —— 硬写 Ctrl/Cmd，全仓只有这一条不用 `{{mod}}`
- [x] `pages.playerPaletteOtherWays` 补上「焦点空闲时裸按 S」

### 补现有目标的缺章

- [x] `panel-queue-tab` 第二章：私人 FM 打开时这一格整格换成电台面板，队列本身不在了；
      底下那颗「扔掉」不是移掉一行，是告诉服务别再放这首
- [x] `panel-controls-tab` 第二章：箭头只走一格，点中间那块名称才展开完整列表；
      列表底下那一条是去完整设置，不是第七个模式
- [x] `player-bar` 补一句：暂停且不在首页时胶囊自动展开，不是只有悬停才展开

---

## 待办

（暂无。新发现值得单独讲的东西时，按开头那份判断标准往上面各节里加。）

---

## 验证链

每批都跑这三条：

```
npx vitest run -c vitest.config.ts test/unit/ponder
npx playwright test --project=components test/component/ponderPageSurfaces.spec.ts
npx playwright test --project=e2e test/ui/ponder.spec.ts
```

`test/component/lattice.spec.ts` 有几条随机失败的用例，和思索无关。
