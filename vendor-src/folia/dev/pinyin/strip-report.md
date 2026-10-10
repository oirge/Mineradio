# 关键词降级报告

- 命令数：125
- 关键词总数：1183 -> 705（删除 478）
- R1 全拼：221
- R2 首字母：208
- R3 照抄标题：49
- 源码中改写的数组：121
- 含中文但未能归属到命令的数组：0

规则：R1 全拼 / R2 首字母 —— 只有当构建期生成器能从仍然活着的中文里原样造出这个字符串时才删；
R3 照抄标题 —— 与任一语言的完整 title/description 相同；R4 重复。中文同义词一律不删。

## 逐命令

### filter-view

保留：`filter`、`filter view`、`narrow`、`筛选`、`过滤`、`筛选视图`

- 删 `shaixuan` —— R1 全拼，来源 `筛选`
- 删 `guolv` —— R1 全拼，来源 `过滤`
- 删 `sx` —— R2 首字母，来源 `筛选`
- 删 `gl` —— R2 首字母，来源 `过滤`

### search-current

保留：`search`、`find`、`song`、`搜索`、`搜歌`

- 删 `sousuo` —— R1 全拼，来源 `搜索`
- 删 `souge` —— R1 全拼，来源 `搜歌`
- 删 `ss` —— R2 首字母，来源 `搜索`
- 删 `sg` —— R2 首字母，来源 `搜歌`

### search-local

保留：`local`、`local search`、`search local`、`本地`、`本地音乐`

- 删 `bendi` —— R1 全拼，来源 `本地`
- 删 `bendiyinyue` —— R1 全拼，来源 `本地音乐`
- 删 `bd` —— R2 首字母，来源 `本地`
- 删 `bdyy` —— R2 首字母，来源 `本地音乐`

### search-navidrome

保留：`navi`、`navidrome`、`search navidrome`、`导航`、`服务器`

- 删 `fuwuqi` —— R1 全拼，来源 `服务器`
- 删 `fwq` —— R2 首字母，来源 `服务器`

### search-netease

保留：`netease`、`cloud`、`search netease`、`网易云`、`网抑云`

- 删 `wangyiyun` —— R1 全拼，来源 `网易云`
- 删 `wyy` —— R2 首字母，来源 `网易云`

### queue

保留：`播放队列`、`队列搜索`

- 删 `queue` —— R3 照抄标题，来源 `Queue`
- 删 `duilie` —— R1 全拼，来源 `队列`
- 删 `duiliesousuo` —— R1 全拼，来源 `队列搜索`
- 删 `dl` —— R2 首字母，来源 `队列`
- 删 `dlss` —— R2 首字母，来源 `队列搜索`

### playback-volume

保留：`volume slider`、`音量`、`音量条`

- 删 `volume` —— R3 照抄标题，来源 `Volume`
- 删 `yinliang` —— R1 全拼，来源 `音量`
- 删 `yinliangtiao` —— R1 全拼，来源 `音量条`
- 删 `yl` —— R2 首字母，来源 `音量`
- 删 `ylt` —— R2 首字母，来源 `音量条`

### playback-fm-mode

保留：`fm mode`、`fm scene`、`radio mode`、`私人 fm 模式`、`私人fm模式`、`fm 模式`、`fm模式`、`私人电台`、`电台模式`、`场景电台`、`sirenfmmoshi`、`sirenfm`、`fmmoshi`、`srfmms`、`srfm`、`fmms`

- 删 `personal fm mode` —— R3 照抄标题，来源 `Personal FM mode`
- 删 `sirendiantai` —— R1 全拼，来源 `私人电台`
- 删 `diantaimoshi` —— R1 全拼，来源 `电台模式`
- 删 `changjingdiantai` —— R1 全拼，来源 `场景电台`
- 删 `srdt` —— R2 首字母，来源 `私人电台`
- 删 `dtms` —— R2 首字母，来源 `电台模式`

### playback-replaygain-off

保留：`replaygain off`、`audio gain off`、`关闭音频增益`、`关闭 replaygain`、`gbyyzy`

- 删 `disable replaygain` —— R3 照抄标题，来源 `Disable ReplayGain`
- 删 `guanbiyinpinzengyi` —— R1 全拼，来源 `关闭音频增益`

### playback-replaygain-track

保留：`replaygain track`、`track gain`、`single track gain`、`单曲增益`、`单曲 replaygain`

- 删 `danquzengyi` —— R1 全拼，来源 `单曲增益`
- 删 `dqzy` —— R2 首字母，来源 `单曲增益`

### playback-replaygain-album

保留：`replaygain album`、`album gain`、`专辑增益`、`专辑 replaygain`

- 删 `zhuanjizengyi` —— R1 全拼，来源 `专辑增益`
- 删 `zjzy` —— R2 首字母，来源 `专辑增益`

### playback-equalizer

保留：`equalizer`、`audio equalizer`、`eq`、`10 band eq`、`effect chain`、`均衡器`、`音频均衡器`、`十段均衡器`、`音效`、`效果器`、`jhh`、`ypjhh`

- 删 `audio effects` —— R3 照抄标题，来源 `Audio effects`
- 删 `junhengqi` —— R1 全拼，来源 `均衡器`
- 删 `yinpinjunhengqi` —— R1 全拼，来源 `音频均衡器`
- 删 `yinxiao` —— R1 全拼，来源 `音效`
- 删 `xiaoguoqi` —— R1 全拼，来源 `效果器`
- 删 `yx` —— R2 首字母，来源 `音效`
- 删 `xgq` —— R2 首字母，来源 `效果器`

### playback-sound-preset-flat

保留：`flat`、`reset audio effects`、`水平`、`关闭音效`、`sound preset`、`audio preset`、`音效预设`

- 删 `shuiping` —— R1 全拼，来源 `水平`
- 删 `guanbiyinxiao` —— R1 全拼，来源 `关闭音效`
- 删 `sp` —— R2 首字母，来源 `水平`
- 删 `gbyx` —— R2 首字母，来源 `关闭音效`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-lofi

保留：`lofi`、`lo-fi`、`low fidelity`、`低保真`、`sound preset`、`audio preset`、`音效预设`

- 删 `dibaozhen` —— R1 全拼，来源 `低保真`
- 删 `dbz` —— R2 首字母，来源 `低保真`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-radio

保留：`radio`、`am radio`、`telephone`、`收音机`、`广播`、`sound preset`、`audio preset`、`音效预设`

- 删 `shouyinji` —— R1 全拼，来源 `收音机`
- 删 `guangbo` —— R1 全拼，来源 `广播`
- 删 `syj` —— R2 首字母，来源 `收音机`
- 删 `gb` —— R2 首字母，来源 `广播`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-hall

保留：`hall`、`reverb`、`space`、`大厅`、`混响`、`空间`、`daating`、`sound preset`、`audio preset`、`音效预设`

- 删 `hunxiang` —— R1 全拼，来源 `混响`
- 删 `dt` —— R2 首字母，来源 `大厅`
- 删 `hx` —— R2 首字母，来源 `混响`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-vocal

保留：`vocal`、`voice`、`人声`、`sound preset`、`audio preset`、`音效预设`

- 删 `rensheng` —— R1 全拼，来源 `人声`
- 删 `rs` —— R2 首字母，来源 `人声`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-bass

保留：`bass boost`、`bass`、`低音增强`、`重低音`、`sound preset`、`audio preset`、`音效预设`

- 删 `diyinzengqiang` —— R1 全拼，来源 `低音增强`
- 删 `zhongdiyin` —— R1 全拼，来源 `重低音`
- 删 `dyzq` —— R2 首字母，来源 `低音增强`
- 删 `zdy` —— R2 首字母，来源 `重低音`
- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-custom1

保留：`custom 1`、`custom sound 1`、`自定义 1`、`自定义音效1`、`zidingyi1`、`zdy1`、`sound preset`、`audio preset`、`音效预设`

- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-sound-preset-custom2

保留：`custom 2`、`custom sound 2`、`自定义 2`、`自定义音效2`、`zidingyi2`、`zdy2`、`sound preset`、`audio preset`、`音效预设`

- 删 `yinxiaoyushe` —— R1 全拼，来源 `音效预设`
- 删 `yxys` —— R2 首字母，来源 `音效预设`

### playback-play

保留：`播放`

- 删 `play` —— R3 照抄标题，来源 `Play`
- 删 `bofang` —— R1 全拼，来源 `播放`
- 删 `bf` —— R2 首字母，来源 `播放`

### playback-pause

保留：`暂停`

- 删 `pause` —— R3 照抄标题，来源 `Pause`
- 删 `zanting` —— R1 全拼，来源 `暂停`
- 删 `zt` —— R2 首字母，来源 `暂停`

### playback-next

保留：`next`、`下一首`

- 删 `xiayishou` —— R1 全拼，来源 `下一首`
- 删 `xys` —— R2 首字母，来源 `下一首`

### playback-prev

保留：`prev`、`previous`、`上一首`

- 删 `shangyishou` —— R1 全拼，来源 `上一首`
- 删 `sys` —— R2 首字母，来源 `上一首`

### playback-loop

保留：`loop`、`循环`

- 删 `xunhuan` —— R1 全拼，来源 `循环`
- 删 `xh` —— R2 首字母，来源 `循环`

### playback-like

保留：`like`、`unlike`、`favourite`、`favorite`、`star`、`喜欢`、`收藏`、`取消收藏`

- 删 `xihuan` —— R1 全拼，来源 `喜欢`
- 删 `shoucang` —— R1 全拼，来源 `收藏`
- 删 `xh` —— R2 首字母，来源 `喜欢`
- 删 `sc` —— R2 首字母，来源 `收藏`

### playback-add-to-playlist

保留：`add to playlist`、`playlist`、`collect`、`添加到歌单`、`收藏到歌单`、`加入歌单`

- 删 `tianjiadaogedan` —— R1 全拼，来源 `添加到歌单`
- 删 `jiarugedan` —— R1 全拼，来源 `加入歌单`
- 删 `tjdgd` —— R2 首字母，来源 `添加到歌单`
- 删 `jrgd` —— R2 首字母，来源 `加入歌单`

### playback-mute

保留：`unmute`、`silence`、`静音`、`取消静音`

- 删 `mute` —— R3 照抄标题，来源 `Mute`
- 删 `jingyin` —— R1 全拼，来源 `静音`
- 删 `jy` —— R2 首字母，来源 `静音`

### playback-shuffle

保留：`shuffle`、`打乱`、`打乱队列`

- 删 `shuffle queue` —— R3 照抄标题，来源 `Shuffle queue`
- 删 `daluan` —— R1 全拼，来源 `打乱`
- 删 `daluanduilie` —— R1 全拼，来源 `打乱队列`
- 删 `dl` —— R2 首字母，来源 `打乱`

### playback-clear-queue

保留：`empty queue`、`clear playlist`、`remove all songs`、`清空队列`、`清空播放队列`、`清除队列`

- 删 `clear queue` —— R3 照抄标题，来源 `Clear queue`
- 删 `qingkongduilie` —— R1 全拼，来源 `清空队列`
- 删 `qingkongbofangduilie` —— R1 全拼，来源 `清空播放队列`
- 删 `qingchuduilie` —— R1 全拼，来源 `清除队列`
- 删 `qkdl` —— R2 首字母，来源 `清空队列`
- 删 `qcdl` —— R2 首字母，来源 `清除队列`

### playback-auto-match-best-lyric

保留：`best lyrics`、`auto match lyrics`、`最佳歌词`、`匹配最佳歌词`、`自动匹配歌词`

- 删 `match best lyrics` —— R3 照抄标题，来源 `Match best lyrics`
- 删 `zuijiageci` —— R1 全拼，来源 `最佳歌词`
- 删 `pipeizuijiageci` —— R1 全拼，来源 `匹配最佳歌词`
- 删 `zidongpipeigeci` —— R1 全拼，来源 `自动匹配歌词`
- 删 `zjgc` —— R2 首字母，来源 `最佳歌词`
- 删 `ppzjgc` —— R2 首字母，来源 `匹配最佳歌词`
- 删 `zdppgc` —— R2 首字母，来源 `自动匹配歌词`

### settings-help

保留：`help`、`帮助`

- 删 `bangzhu` —— R1 全拼，来源 `帮助`
- 删 `bz` —— R2 首字母，来源 `帮助`

### sleep-timer

保留：`auto close`、`auto quit`、`shutdown timer`、`定时关闭`、`睡眠定时`、`自动关闭`、`到时关闭`、`倒计时退出`

- 删 `sleep timer` —— R3 照抄标题，来源 `Sleep timer`
- 删 `dingshiguanbi` —— R1 全拼，来源 `定时关闭`
- 删 `shuimiandingshi` —— R1 全拼，来源 `睡眠定时`
- 删 `zidongguanbi` —— R1 全拼，来源 `自动关闭`
- 删 `daoshiguanbi` —— R1 全拼，来源 `到时关闭`
- 删 `dsgb` —— R2 首字母，来源 `定时关闭`
- 删 `smds` —— R2 首字母，来源 `睡眠定时`
- 删 `zdgb` —— R2 首字母，来源 `自动关闭`

### show-user-guide

保留：`guide`、`help`、`tutorial`、`用户指引`、`指南`、`帮助`

- 删 `yonghuzhiyin` —— R1 全拼，来源 `用户指引`
- 删 `zhinan` —— R1 全拼，来源 `指南`
- 删 `yhzy` —— R2 首字母，来源 `用户指引`
- 删 `zn` —— R2 首字母，来源 `指南`

### settings-options

保留：`settings`、`options`、`设置`、`选项`

- 删 `shezhi` —— R1 全拼，来源 `设置`
- 删 `xuanxiang` —— R1 全拼，来源 `选项`
- 删 `sz` —— R2 首字母，来源 `设置`
- 删 `xx` —— R2 首字母，来源 `选项`

### settings-appearance

保留：`appearance`、`visual settings`、`外观`、`视觉`

- 删 `waiguan` —— R1 全拼，来源 `外观`
- 删 `shijue` —— R1 全拼，来源 `视觉`
- 删 `wg` —— R2 首字母，来源 `外观`
- 删 `sj` —— R2 首字母，来源 `视觉`

### settings-general

保留：`general`、`language settings`、`locale`、`通用`、`语言`

- 删 `tongyong` —— R1 全拼，来源 `通用`
- 删 `yuyan` —— R1 全拼，来源 `语言`
- 删 `ty` —— R2 首字母，来源 `通用`
- 删 `yy` —— R2 首字母，来源 `语言`

### settings-playback

保留：`playback`、`播放`、`播放设置`

- 删 `playback settings` —— R3 照抄标题，来源 `Playback settings`
- 删 `bofang` —— R1 全拼，来源 `播放`
- 删 `bofangshezhi` —— R1 全拼，来源 `播放设置`
- 删 `bf` —— R2 首字母，来源 `播放`
- 删 `bfsz` —— R2 首字母，来源 `播放设置`

### settings-local-lyrics-priority

保留：`local lyrics priority`、`online lyrics first`、`local song lyrics`、`本地歌曲歌词优先级`、`在线优先`、`本地歌词`、`bendigeciyouxianji`、`bdgcyxj`

- 删 `zaixianyouxian` —— R1 全拼，来源 `在线优先`
- 删 `zxyx` —— R2 首字母，来源 `在线优先`

### settings-integration

保留：`integration`、`stage`、`now playing`、`navidrome settings`、`集成`、`连接`

- 删 `jicheng` —— R1 全拼，来源 `集成`
- 删 `lianjie` —— R1 全拼，来源 `连接`
- 删 `jc` —— R2 首字母，来源 `集成`
- 删 `lj` —— R2 首字母，来源 `连接`

### automix-toggle

保留：`automix`、`blend`、`auto mix`、`transition`、`智能过渡`、`自动混音`、`过渡`、`开启过渡`、`znguodu`

- 删 `smart transition` —— R3 照抄标题，来源 `Smart transition`
- 删 `zhinengguodu` —— R1 全拼，来源 `智能过渡`
- 删 `zidonghunyin` —— R1 全拼，来源 `自动混音`
- 删 `guodu` —— R1 全拼，来源 `过渡`
- 删 `zdhy` —— R2 首字母，来源 `自动混音`
- 删 `gd` —— R2 首字母，来源 `过渡`

### transition-mode-crossfade

保留：`crossfade`、`folia crossfade`、`transition mode crossfade`、`交叉淡化`、`过渡模式交叉淡化`、`gdmscf`

- 删 `jiaochadanhua` —— R1 全拼，来源 `交叉淡化`
- 删 `guodumoshijiaochadanhua` —— R1 全拼，来源 `过渡模式交叉淡化`
- 删 `jcdh` —— R2 首字母，来源 `交叉淡化`

### transition-mode-automix

保留：`automix`、`folia automix`、`transition mode automix`、`自动混音`、`过渡模式自动混音`、`gdmsauto`

- 删 `zidonghunyin` —— R1 全拼，来源 `自动混音`
- 删 `guodumoshizidonghunyin` —— R1 全拼，来源 `过渡模式自动混音`
- 删 `zdhy` —— R2 首字母，来源 `自动混音`

### transition-performance-toggle

保留：`performance mode`、`transition performance`、`aggressive transition`、`表现模式`、`过渡表现`、`性能模式`

- 删 `biaoxianmoshi` —— R1 全拼，来源 `表现模式`
- 删 `guodubiaoxian` —— R1 全拼，来源 `过渡表现`
- 删 `bxms` —— R2 首字母，来源 `表现模式`
- 删 `gdbx` —— R2 首字母，来源 `过渡表现`

### settings-discord-presence

保留：`discord`、`rich presence`、`discord presence`、`playing status`、`播放状态`、`discord状态`、`discordzhuangtai`、`dc`

- 删 `bofangzhuangtai` —— R1 全拼，来源 `播放状态`
- 删 `zt` —— R2 首字母，来源 `discord状态`

### settings-obs-browser-source

保留：`obs`、`browser source`、`live source`、`直播源`、`浏览器源`

- 删 `zhiboyuan` —— R1 全拼，来源 `直播源`
- 删 `liulanqiyuan` —— R1 全拼，来源 `浏览器源`
- 删 `zby` —— R2 首字母，来源 `直播源`
- 删 `llqy` —— R2 首字母，来源 `浏览器源`

### desktop-toggle-lyric-api

保留：`lyric endpoint`、`local api`、`歌词接口`、`本地接口`

- 删 `lyrics api` —— R3 照抄标题，来源 `Lyrics API`
- 删 `gecijiekou` —— R1 全拼，来源 `歌词接口`
- 删 `bendijiekou` —— R1 全拼，来源 `本地接口`
- 删 `gcjk` —— R2 首字母，来源 `歌词接口`
- 删 `bdjk` —— R2 首字母，来源 `本地接口`

### settings-obs-copy-css

保留：`obs css`、`obs custom css`、`obs assets`、`browser source css`、`复制 obs css`、`obs 自定义 css`、`obs 资产`、`fuzhiobscss`、`obszidingyicss`、`obszichan`、`fzobscss`、`obszdycss`、`obszc`

- 删 `copy obs css` —— R3 照抄标题，来源 `Copy OBS CSS`

### settings-storage

保留：`storage`、`cache`、`存储`、`缓存`

- 删 `cunchu` —— R1 全拼，来源 `存储`
- 删 `huancun` —— R1 全拼，来源 `缓存`
- 删 `cc` —— R2 首字母，来源 `存储`
- 删 `hc` —— R2 首字母，来源 `缓存`

### settings-r2-sync

保留：`sync server`、`d1 sync`、`cloud sync`、`sync settings`、`同步`、`云同步`、`d1同步`

- 删 `tongbu` —— R1 全拼，来源 `同步`
- 删 `yuntongbu` —— R1 全拼，来源 `云同步`
- 删 `tb` —— R2 首字母，来源 `同步`
- 删 `ytb` —— R2 首字母，来源 `云同步`

### sync-now

保留：`d1 sync now`、`cloud sync now`、`立即同步`、`马上同步`、`d1同步`

- 删 `sync now` —— R3 照抄标题，来源 `Sync now`
- 删 `lijitongbu` —— R1 全拼，来源 `立即同步`
- 删 `mashangtongbu` —— R1 全拼，来源 `马上同步`
- 删 `ljtb` —— R2 首字母，来源 `立即同步`
- 删 `mstb` —— R2 首字母，来源 `马上同步`

### settings-desktop

保留：`desktop`、`electron`、`桌面`、`桌面端`

- 删 `zhuomian` —— R1 全拼，来源 `桌面`
- 删 `zhuomianduan` —— R1 全拼，来源 `桌面端`
- 删 `zm` —— R2 首字母，来源 `桌面`
- 删 `zmd` —— R2 首字母，来源 `桌面端`

### settings-update-channel

保留：`release channel`、`realeco`、`limo`、`cielo`、`更新通道`、`发布通道`

- 删 `update channel` —— R3 照抄标题，来源 `Update channel`
- 删 `gengxintongdao` —— R1 全拼，来源 `更新通道`
- 删 `fabutongdao` —— R1 全拼，来源 `发布通道`
- 删 `gxtd` —— R2 首字母，来源 `更新通道`
- 删 `fbtd` —— R2 首字母，来源 `发布通道`

### desktop-toggle-voice-input-pause

保留：`voice input`、`dictation`、`voice typing`、`microphone pause`、`语音输入`、`语音键入`、`语音转文字`、`麦克风`、`yyzw`

- 删 `yuyinshuru` —— R1 全拼，来源 `语音输入`
- 删 `yuyinjianru` —— R1 全拼，来源 `语音键入`
- 删 `yuyinzhuanwenzi` —— R1 全拼，来源 `语音转文字`
- 删 `maikefeng` —— R1 全拼，来源 `麦克风`
- 删 `yysr` —— R2 首字母，来源 `语音输入`
- 删 `yyjr` —— R2 首字母，来源 `语音键入`
- 删 `mkf` —— R2 首字母，来源 `麦克风`

### desktop-toggle-prevent-display-sleep

保留：`prevent display sleep`、`keep display awake`、`keep screen on`、`播放时阻止休眠`、`保持屏幕唤醒`、`屏幕常亮`、`bfzzxm`

- 删 `bofangshizuzhixiumian` —— R1 全拼，来源 `播放时阻止休眠`
- 删 `baochipingmuhuanxing` —— R1 全拼，来源 `保持屏幕唤醒`
- 删 `pingmuchangliang` —— R1 全拼，来源 `屏幕常亮`
- 删 `pmcl` —— R2 首字母，来源 `屏幕常亮`

### settings-wallpaper-mode

保留：`wallpaper mode`、`desktop wallpaper`、`lyrics wallpaper`、`壁纸模式`、`桌面壁纸`、`歌词壁纸`

- 删 `bizhimoshi` —— R1 全拼，来源 `壁纸模式`
- 删 `zhuomianbizhi` —— R1 全拼，来源 `桌面壁纸`
- 删 `gecibizhi` —— R1 全拼，来源 `歌词壁纸`
- 删 `bzms` —— R2 首字母，来源 `壁纸模式`
- 删 `zmbz` —— R2 首字母，来源 `桌面壁纸`
- 删 `gcbz` —— R2 首字母，来源 `歌词壁纸`

### desktop-toggle-wallpaper-mode

保留：`wallpaper mode`、`desktop wallpaper`、`lyrics wallpaper`、`壁纸模式`、`桌面壁纸`、`歌词壁纸`

- 删 `bizhimoshi` —— R1 全拼，来源 `壁纸模式`
- 删 `zhuomianbizhi` —— R1 全拼，来源 `桌面壁纸`
- 删 `gecibizhi` —— R1 全拼，来源 `歌词壁纸`
- 删 `bzms` —— R2 首字母，来源 `壁纸模式`
- 删 `zmbz` —— R2 首字母，来源 `桌面壁纸`
- 删 `gcbz` —— R2 首字母，来源 `歌词壁纸`

### settings-lab

保留：`lab`、`experimental`、`实验`、`实验室`

- 删 `shiyan` —— R1 全拼，来源 `实验`
- 删 `shiyanshi` —— R1 全拼，来源 `实验室`
- 删 `sy` —— R2 首字母，来源 `实验`
- 删 `sys` —— R2 首字母，来源 `实验室`

### settings-visualizer

保留：`visualizer workbench`、`可视化`、`歌词动画`、`donghua`

- 删 `visualizer settings` —— R3 照抄标题，来源 `Visualizer settings`
- 删 `keshihua` —— R1 全拼，来源 `可视化`
- 删 `gecidonghua` —— R1 全拼，来源 `歌词动画`
- 删 `ksh` —— R2 首字母，来源 `可视化`
- 删 `gcdh` —— R2 首字母，来源 `歌词动画`

### settings-theme-park

保留：`theme park`、`theme`、`配色`、`主题`、`主题公园`

- 删 `color` —— R3 照抄标题，来源 `Color`
- 删 `peise` —— R1 全拼，来源 `配色`
- 删 `zhuti` —— R1 全拼，来源 `主题`
- 删 `zhutigongyuan` —— R1 全拼，来源 `主题公园`
- 删 `ps` —— R2 首字母，来源 `配色`
- 删 `zt` —— R2 首字母，来源 `主题`
- 删 `ztgy` —— R2 首字母，来源 `主题公园`

### settings-global-lyric-offset

保留：`lyric delay`、`audio latency`、`bluetooth delay`、`sync lyrics`、`全局时间偏移`、`歌词延迟`、`音画同步`、`蓝牙延迟`

- 删 `global timing offset` —— R3 照抄标题，来源 `Global timing offset`
- 删 `quanjushijianpianyi` —— R1 全拼，来源 `全局时间偏移`
- 删 `geciyanchi` —— R1 全拼，来源 `歌词延迟`
- 删 `yinhuatongbu` —— R1 全拼，来源 `音画同步`
- 删 `lanyayanchi` —— R1 全拼，来源 `蓝牙延迟`
- 删 `qjsjpy` —— R2 首字母，来源 `全局时间偏移`
- 删 `gcyc` —— R2 首字母，来源 `歌词延迟`
- 删 `yhtb` —— R2 首字母，来源 `音画同步`
- 删 `lyyc` —— R2 首字母，来源 `蓝牙延迟`

### settings-lyric-filter

保留：`lyrics filter`、`歌词过滤`、`过滤`

- 删 `lyric filter` —— R3 照抄标题，来源 `Lyric filter`
- 删 `geciguolv` —— R1 全拼，来源 `歌词过滤`
- 删 `guolv` —— R1 全拼，来源 `过滤`
- 删 `gcgl` —— R2 首字母，来源 `歌词过滤`
- 删 `gl` —— R2 首字母，来源 `过滤`

### lyric-staff-policy-cycle

保留：`opening credits`、`staff credits`、`lyric credits`、`credits`、`制作人员`、`署名`、`开头署名`、`前奏署名`

- 删 `zhizuorenyuan` —— R1 全拼，来源 `制作人员`
- 删 `shuming` —— R1 全拼，来源 `署名`
- 删 `kaitoushuming` —— R1 全拼，来源 `开头署名`
- 删 `zzry` —— R2 首字母，来源 `制作人员`
- 删 `sm` —— R2 首字母，来源 `署名`
- 删 `ktsm` —— R2 首字母，来源 `开头署名`

### lyric-staff-absorb-cycle

保留：`absorb`、`absorb neighbouring lines`、`lyric credits absorb`、`吸收相邻行`、`吸收`、`署名吸收`、`前奏吸收`、`xsh`

- 删 `xishou` —— R1 全拼，来源 `吸收`
- 删 `xishouxianglinxing` —— R1 全拼，来源 `吸收相邻行`
- 删 `xsxlx` —— R2 首字母，来源 `吸收相邻行`

### theme-generate-current

保留：`ai theme`、`theme generation`、`generate theme`、`生成AI主题`、`生成主题`、`主题生成`、`aizhuti`、`aizt`

- 删 `generate ai theme` —— R3 照抄标题，来源 `Generate AI theme`
- 删 `shengchengzhuti` —— R1 全拼，来源 `生成AI主题`
- 删 `sczt` —— R2 首字母，来源 `生成AI主题`

### theme-source-ai

保留：`theme source ai`、`ai theme source`、`theme generation source`、`主题来源AI`、`主题生成来源`、`AI推断`、`aituiduan`、`ztsclly`、`aitd`

- 删 `zhutilaiyuan` —— R1 全拼，来源 `主题来源AI`
- 删 `zhutishengchenglaiyuan` —— R1 全拼，来源 `主题生成来源`
- 删 `ztly` —— R2 首字母，来源 `主题来源AI`

### theme-source-cover

保留：`theme source cover`、`cover theme source`、`cover colors`、`theme generation source`、`主题来源封面`、`封面取色`、`主题生成来源`、`fengmianqvse`、`zhutilaiyuan`

- 删 `fengmianquse` —— R1 全拼，来源 `封面取色`
- 删 `ztlyfm` —— R2 首字母，来源 `主题来源封面`
- 删 `fmqs` —— R2 首字母，来源 `封面取色`

### theme-quick-editor

保留：`theme editor`、`ai theme editor`、`custom theme editor`、`快速主题编辑器`、`主题编辑器`、`自定义主题编辑器`

- 删 `quick theme editor` —— R3 照抄标题，来源 `Quick theme editor`
- 删 `kuaisuzhutibianjiqi` —— R1 全拼，来源 `快速主题编辑器`
- 删 `zhutibianjiqi` —— R1 全拼，来源 `主题编辑器`
- 删 `zidingyizhutibianjiqi` —— R1 全拼，来源 `自定义主题编辑器`
- 删 `ksztbjq` —— R2 首字母，来源 `快速主题编辑器`
- 删 `ztbjq` —— R2 首字母，来源 `主题编辑器`

### settings-toggle-transparent

保留：`transparent`、`transparency`、`透明`、`透明化`

- 删 `touming` —— R1 全拼，来源 `透明`
- 删 `touminghua` —— R1 全拼，来源 `透明化`
- 删 `tm` —— R2 首字母，来源 `透明`
- 删 `tmh` —— R2 首字母，来源 `透明化`

### settings-toggle-daylight

保留：`daylight`、`midnight`、`light`、`dark`、`明暗`、`切换明暗`、`日夜`、`日间`、`夜间`

- 删 `qiehuanmingan` —— R1 全拼，来源 `切换明暗`
- 删 `ry` —— R2 首字母，来源 `日夜`
- 删 `rj` —— R2 首字母，来源 `日间`
- 删 `yj` —— R2 首字母，来源 `夜间`

### settings-toggle-track-switch-buttons

保留：`track switch buttons`、`previous next arrows`、`progress bar arrows`、`song switch buttons`、`切歌箭头`、`切换箭头`、`始终显示切歌按钮`、`进度条切歌按钮`、`上一首下一首按钮`、`jinduting qiege`、`sysqgan`

- 删 `always show track switch arrows` —— R3 照抄标题，来源 `Always show track switch arrows`
- 删 `qiege jiantou` —— R1 全拼，来源 `切歌箭头`
- 删 `qiehuan jiantou` —— R1 全拼，来源 `切换箭头`
- 删 `qgjt` —— R2 首字母，来源 `切歌箭头`
- 删 `qhjt` —— R2 首字母，来源 `切换箭头`

### settings-toggle-main-window-titlebar

保留：`always show window controls`、`window control buttons`、`always show titlebar`、`main window titlebar`、`titlebar`、`标题栏`、`控制按钮`、`始终显示标题栏`、`始终显示控制按钮`、`主窗口标题栏`、`kongzhi annniu`、`bt`、`zckbt`

- 删 `biaoti lan` —— R1 全拼，来源 `标题栏`
- 删 `zhuchuangkou biaoti lan` —— R1 全拼，来源 `主窗口标题栏`
- 删 `kzan` —— R2 首字母，来源 `控制按钮`

### settings-toggle-bottom-subtitle-overlay

保留：`bottom subtitle overlay`、`subtitle overlay`、`hide subtitle overlay`、`show subtitle overlay`、`bottom subtitles`、`hide bottom subtitles`、`底部字幕层`、`隐藏底部字幕层`、`显示底部字幕层`、`底部字幕`、`隐藏底部字幕`、`显示底部字幕`、`zimu ceng`

- 删 `dibuzimu` —— R1 全拼，来源 `底部字幕`
- 删 `dibuzimuceng` —— R1 全拼，来源 `底部字幕层`
- 删 `yincang dibuzimu` —— R1 全拼，来源 `隐藏底部字幕`
- 删 `xianshi dibuzimu` —— R1 全拼，来源 `显示底部字幕`
- 删 `dbzm` —— R2 首字母，来源 `底部字幕`
- 删 `dbzmc` —— R2 首字母，来源 `底部字幕层`
- 删 `ycdbzm` —— R2 首字母，来源 `隐藏底部字幕`
- 删 `xsdbzm` —— R2 首字母，来源 `显示底部字幕`

### settings-cycle-subtitle-content-mode

保留：`subtitle translation`、`translation subtitle`、`show subtitle translation`、`lyrics translation`、`caption translation`、`subtitle romanization`、`romanized lyrics`、`romaji`、`字幕翻译`、`显示翻译`、`翻译字幕`、`歌词翻译`、`切换翻译字幕`、`罗马音`、`罗马字`、`副字幕`

- 删 `zimu fanyi` —— R1 全拼，来源 `字幕翻译`
- 删 `xianshi fanyi` —— R1 全拼，来源 `显示翻译`
- 删 `fanyi zimu` —— R1 全拼，来源 `翻译字幕`
- 删 `geci fanyi` —— R1 全拼，来源 `歌词翻译`
- 删 `luomayin` —— R1 全拼，来源 `罗马音`
- 删 `zmfy` —— R2 首字母，来源 `字幕翻译`
- 删 `xsfy` —— R2 首字母，来源 `显示翻译`
- 删 `gc fy` —— R2 首字母，来源 `歌词翻译`
- 删 `lmy` —— R2 首字母，来源 `罗马音`
- 删 `fzm` —— R2 首字母，来源 `副字幕`
- 删 `qhfyzm` —— R2 首字母，来源 `切换翻译字幕`

### settings-toggle-subtitle-background

保留：`subtitle background`、`subtitle readability background`、`caption background`、`show subtitle background`、`hide subtitle background`、`字幕背景`、`切换字幕背景`、`显示字幕背景`、`隐藏字幕背景`、`字幕底色`

- 删 `zimu beijing` —— R1 全拼，来源 `字幕背景`
- 删 `qiehuan zimu beijing` —— R1 全拼，来源 `切换字幕背景`
- 删 `xianshi zimu beijing` —— R1 全拼，来源 `显示字幕背景`
- 删 `yincang zimu beijing` —— R1 全拼，来源 `隐藏字幕背景`
- 删 `zimu dise` —— R1 全拼，来源 `字幕底色`
- 删 `zmbj` —— R2 首字母，来源 `字幕背景`
- 删 `qhzmbj` —— R2 首字母，来源 `切换字幕背景`
- 删 `xszmbj` —— R2 首字母，来源 `显示字幕背景`
- 删 `yczmbj` —— R2 首字母，来源 `隐藏字幕背景`

### settings-language-system

保留：`system language`、`follow system`、`auto language`、`跟随系统`、`系统语言`

- 删 `gensuixitong` —— R1 全拼，来源 `跟随系统`
- 删 `xitongyuyan` —— R1 全拼，来源 `系统语言`
- 删 `gsxt` —— R2 首字母，来源 `跟随系统`
- 删 `xtyy` —— R2 首字母，来源 `系统语言`

### settings-language-zh-CN

保留：`chinese`、`simplified chinese`、`中文`、`简体中文`

- 删 `zhongwen` —— R1 全拼，来源 `中文`
- 删 `jiantizhongwen` —— R1 全拼，来源 `简体中文`
- 删 `zw` —— R2 首字母，来源 `中文`
- 删 `jtzw` —— R2 首字母，来源 `简体中文`

### settings-language-en

保留：`english`、`interface english`、`英文`

- 删 `yingwen` —— R1 全拼，来源 `英文`
- 删 `yw` —— R2 首字母，来源 `英文`

### settings-language-in

保留：`indonesian`、`bahasa indonesia`、`indonesia`、`印尼语`、`bhs`

- 删 `yinniyu` —— R1 全拼，来源 `印尼语`
- 删 `yny` —— R2 首字母，来源 `印尼语`

### navigate-home

保留：`home`、`首页`、`主页`

- 删 `shouye` —— R1 全拼，来源 `首页`
- 删 `zhuye` —— R1 全拼，来源 `主页`
- 删 `sy` —— R2 首字母，来源 `首页`
- 删 `zy` —— R2 首字母，来源 `主页`

### navigate-player

保留：`player`、`播放页`、`播放器`

- 删 `bofangye` —— R1 全拼，来源 `播放页`
- 删 `bofangqi` —— R1 全拼，来源 `播放器`
- 删 `bfy` —— R2 首字母，来源 `播放页`
- 删 `bfq` —— R2 首字母，来源 `播放器`

### browser-fullscreen

保留：`full screen`、`f11`、`browser fullscreen`、`全屏`、`浏览器全屏`

- 删 `fullscreen` —— R3 照抄标题，来源 `Fullscreen`
- 删 `quanping` —— R1 全拼，来源 `全屏`
- 删 `liulanqiquanping` —— R1 全拼，来源 `浏览器全屏`
- 删 `qp` —— R2 首字母，来源 `全屏`
- 删 `llqqp` —— R2 首字母，来源 `浏览器全屏`

### home-playlist

保留：`playlist`、`playlists`、`歌单`

- 删 `gedan` —— R1 全拼，来源 `歌单`
- 删 `gd` —— R2 首字母，来源 `歌单`

### home-local

保留：`local music`、`local`、`本地`、`本地音乐`

- 删 `bendi` —— R1 全拼，来源 `本地`
- 删 `bendiyinyue` —— R1 全拼，来源 `本地音乐`
- 删 `bd` —— R2 首字母，来源 `本地`
- 删 `bdyy` —— R2 首字母，来源 `本地音乐`

### home-albums

保留：`albums`、`album`、`专辑`

- 删 `zhuanji` —— R1 全拼，来源 `专辑`
- 删 `zj` —— R2 首字母，来源 `专辑`

### home-navidrome

保留：`navidrome`、`navi`、`服务器`

- 删 `fuwuqi` —— R1 全拼，来源 `服务器`
- 删 `fwq` —— R2 首字母，来源 `服务器`

### home-radio

保留：`radio`、`fm`、`电台`

- 删 `diantai` —— R1 全拼，来源 `电台`
- 删 `dt` —— R2 首字母，来源 `电台`

### desktop-toggle-remote-control

保留：`remote control`、`remote window`、`toggle remote`、`遥控窗口`、`切换遥控窗口`、`打开遥控`

- 删 `yaokongchuangkou` —— R1 全拼，来源 `遥控窗口`
- 删 `qiehuanyaokongchuangkou` —— R1 全拼，来源 `切换遥控窗口`
- 删 `ykck` —— R2 首字母，来源 `遥控窗口`
- 删 `qhykck` —— R2 首字母，来源 `切换遥控窗口`

### desktop-toggle-main-window-always-on-top

保留：`always on top`、`main window on top`、`pin main window`、`主窗口置顶`、`切换主窗口置顶`、`取消主窗口置顶`

- 删 `zhuchuangkouzhiding` —— R1 全拼，来源 `主窗口置顶`
- 删 `qiehuanzhuchuangkouzhiding` —— R1 全拼，来源 `切换主窗口置顶`
- 删 `zckzd` —— R2 首字母，来源 `主窗口置顶`
- 删 `qhzckzd` —— R2 首字母，来源 `切换主窗口置顶`

### panel-cover

保留：`cover panel`、`封面`

- 删 `panel cover` —— R3 照抄标题，来源 `Panel: cover`
- 删 `fengmian` —— R1 全拼，来源 `封面`
- 删 `fm` —— R2 首字母，来源 `封面`

### panel-controls

保留：`controls panel`、`控制`

- 删 `panel controls` —— R3 照抄标题，来源 `Panel: controls`
- 删 `kongzhi` —— R1 全拼，来源 `控制`
- 删 `kz` —— R2 首字母，来源 `控制`

### panel-queue

保留：`queue panel`、`队列`

- 删 `panel queue` —— R3 照抄标题，来源 `Panel: queue`
- 删 `duilie` —— R1 全拼，来源 `队列`
- 删 `dl` —— R2 首字母，来源 `队列`

### panel-account

保留：`account panel`、`账号`、`账户`

- 删 `panel account` —— R3 照抄标题，来源 `Panel: account`
- 删 `zhanghao` —— R1 全拼，来源 `账号`
- 删 `zhanghu` —— R1 全拼，来源 `账户`
- 删 `zh` —— R2 首字母，来源 `账号`

### panel-local

保留：`local panel`、`本地面板`

- 删 `panel local` —— R3 照抄标题，来源 `Panel: local`
- 删 `bendimianban` —— R1 全拼，来源 `本地面板`
- 删 `bdmb` —— R2 首字母，来源 `本地面板`

### panel-navi

保留：`panel navi`、`navi panel`、`navidrome 面板`、`服务器面板`

- 删 `panel navidrome` —— R3 照抄标题，来源 `Panel: Navidrome`
- 删 `fuwuqimianban` —— R1 全拼，来源 `服务器面板`
- 删 `fwqmb` —— R2 首字母，来源 `服务器面板`

### panel-onlineLyrics

保留：`lyrics panel`、`歌词面板`

- 删 `panel lyrics` —— R3 照抄标题，来源 `Panel: lyrics`
- 删 `gecimianban` —— R1 全拼，来源 `歌词面板`
- 删 `gcmb` —— R2 首字母，来源 `歌词面板`

### mods

保留：`mods`、`mod`、`mods manager`、`模组`、`模组管理`、`mokuai`、`导出透明视频`

- 删 `mozu` —— R1 全拼，来源 `模组`
- 删 `mz` —— R2 首字母，来源 `模组`

### visualizer-picker

保留：`visualizer picker`、`pick visualizer`、`browse visualizers`、`可视化选择器`、`选择可视化`、`歌词动画选择`

- 删 `keshihuaxuanzeqi` —— R1 全拼，来源 `可视化选择器`
- 删 `xuanzekeshihua` —— R1 全拼，来源 `选择可视化`
- 删 `kshxzq` —— R2 首字母，来源 `可视化选择器`
- 删 `xzksh` —— R2 首字母，来源 `选择可视化`

### background-picker

保留：`background picker`、`pick background`、`browse backgrounds`、`背景选择器`、`选择背景`

- 删 `beijingxuanzeqi` —— R1 全拼，来源 `背景选择器`
- 删 `xuanzebeijing` —— R1 全拼，来源 `选择背景`
- 删 `bjxzq` —— R2 首字母，来源 `背景选择器`
- 删 `xzbj` —— R2 首字母，来源 `选择背景`

### visualizer-sonnet

保留：`sonnet`、`商籁`、`文字 pv`、`mg pv`、`vocaloid`

- 删 `visualizer sonnet` —— R3 照抄标题，来源 `Visualizer: Sonnet`
- 删 `shanglai` —— R1 全拼，来源 `商籁`
- 删 `sl` —— R2 首字母，来源 `商籁`

### visualizer-tempera

保留：`tempera`、`凝彩`、`dancai`、`dc`、`色块 pv`、`block pv`

- 删 `visualizer tempera` —— R3 照抄标题，来源 `Visualizer: Tempera`

### visualizer-classic

保留：`visualizer classic`、`classic`、`流光`

- 删 `liuguang` —— R1 全拼，来源 `流光`
- 删 `lg` —— R2 首字母，来源 `流光`

### visualizer-cadenza

保留：`visualizer cadenza`、`cadenza`、`mindscape`、`心象`

- 删 `xinxiang` —— R1 全拼，来源 `心象`
- 删 `xx` —— R2 首字母，来源 `心象`

### visualizer-partita

保留：`partita`、`云阶`

- 删 `visualizer partita` —— R3 照抄标题，来源 `Visualizer: Partita`
- 删 `yunjie` —— R1 全拼，来源 `云阶`
- 删 `yj` —— R2 首字母，来源 `云阶`

### visualizer-fume

保留：`fume`、`浮名`

- 删 `visualizer fume` —— R3 照抄标题，来源 `Visualizer: Fume`
- 删 `fuming` —— R1 全拼，来源 `浮名`
- 删 `fm` —— R2 首字母，来源 `浮名`

### visualizer-tilt

保留：`tilt`、`倾诉`

- 删 `visualizer tilt` —— R3 照抄标题，来源 `Visualizer: Tilt`
- 删 `qingsu` —— R1 全拼，来源 `倾诉`
- 删 `qs` —— R2 首字母，来源 `倾诉`

### visualizer-claddagh

保留：`claddagh`、`回环`

- 删 `visualizer claddagh` —— R3 照抄标题，来源 `Visualizer: Claddagh`
- 删 `huihuan` —— R1 全拼，来源 `回环`
- 删 `hh` —— R2 首字母，来源 `回环`

### visualizer-monet

保留：`monet`、`莫奈`、`切换到可视化：莫奈`、`切换到可视化莫奈`

- 删 `visualizer monet` —— R3 照抄标题，来源 `Visualizer: Monet`
- 删 `monai` —— R1 全拼，来源 `莫奈`
- 删 `mn` —— R2 首字母，来源 `莫奈`

### visualizer-pendolo

保留：`pendolo`、`擒纵`、`摆轮`、`pd`、`切换到可视化：擒纵`、`切换到可视化擒纵`

- 删 `visualizer pendolo` —— R3 照抄标题，来源 `Visualizer: Pendolo`
- 删 `qinzong` —— R1 全拼，来源 `擒纵`
- 删 `bailun` —— R1 全拼，来源 `摆轮`

### visualizer-cappella

保留：`cappella`、`群唱`

- 删 `visualizer cappella` —— R3 照抄标题，来源 `Visualizer: Cappella`
- 删 `qunchang` —— R1 全拼，来源 `群唱`
- 删 `qc` —— R2 首字母，来源 `群唱`

### visualizer-diorama

保留：`diorama`、`镜台`、`切换到可视化：镜台`、`切换到可视化镜台`

- 删 `visualizer diorama` —— R3 照抄标题，来源 `Visualizer: Diorama`
- 删 `jingtai` —— R1 全拼，来源 `镜台`
- 删 `jt` —— R2 首字母，来源 `镜台`

### visualizer-still

保留：`still`、`static`、`low resource`、`静止`、`静态`、`低占用`

- 删 `visualizer still` —— R3 照抄标题，来源 `Visualizer: Still`
- 删 `jingzhi` —— R1 全拼，来源 `静止`
- 删 `jingtai` —— R1 全拼，来源 `静态`
- 删 `jz` —— R2 首字母，来源 `静止`

### visualizer-toggle-random-per-song

保留：`random visualizer`、`random animation`、`per song`、`随机歌词动画`、`每首歌随机动画`

- 删 `suiji geci donghua` —— R1 全拼，来源 `随机歌词动画`
- 删 `meishouge suiji donghua` —— R1 全拼，来源 `每首歌随机动画`
- 删 `sjgcdh` —— R2 首字母，来源 `随机歌词动画`
- 删 `msgsjdh` —— R2 首字母，来源 `每首歌随机动画`

### background-monet-full-overlay

保留：`monet full screen`、`monet full`、`overlay`、`莫奈全屏叠色`、`全屏叠色`、`莫奈`、`背景切换到 莫奈: 全屏叠色`、`背景切换到莫奈全屏叠色`

- 删 `mnqpds` —— R2 首字母，来源 `莫奈全屏叠色`
- 删 `qpds` —— R2 首字母，来源 `全屏叠色`

### background-monet-half-gradient

保留：`monet half screen`、`monet half`、`gradient`、`莫奈半屏渐变`、`半屏渐变`、`莫奈`、`背景切换到 莫奈: 半屏渐变`、`背景切换到莫奈半屏渐变`

- 删 `mnbpjb` —— R2 首字母，来源 `莫奈半屏渐变`
- 删 `bpjb` —— R2 首字母，来源 `半屏渐变`

### background-common

保留：`background general`、`common`、`general`、`通用背景`、`ty`、`背景切换到 通用`、`背景切换到通用`

- 删 `background common` —— R3 照抄标题，来源 `Background: Common`
- 删 `tybj` —— R2 首字母，来源 `通用背景`

### background-nomand

保留：`nomand`、`dithering`、`dither`、`shader background`、`漫游`、`像素画`、`像素画背景`、`抖动背景`、`网点背景`、`主题色背景`

- 删 `man you` —— R1 全拼，来源 `漫游`
- 删 `xiang su hua` —— R1 全拼，来源 `像素画`
- 删 `dou dong bei jing` —— R1 全拼，来源 `抖动背景`
- 删 `wang dian bei jing` —— R1 全拼，来源 `网点背景`
- 删 `my` —— R2 首字母，来源 `漫游`
- 删 `xsh` —— R2 首字母，来源 `像素画`
- 删 `ddbj` —— R2 首字母，来源 `抖动背景`
- 删 `wdbj` —— R2 首字母，来源 `网点背景`

### background-latent

保留：`latent`、`latent background`、`shader background`、`隐现`、`隐现背景`、`音频响应背景`

- 删 `yin xian` —— R1 全拼，来源 `隐现`
- 删 `yinxian` —— R1 全拼，来源 `隐现`
- 删 `yxbj` —— R2 首字母，来源 `隐现背景`

### background-latent-dithering

保留：`latent dithering`、`隐现像素`、`像素层`

- 删 `latent pixel` —— R3 照抄标题，来源 `Latent: Pixel`
- 删 `yinxian xiangsu` —— R1 全拼，来源 `隐现像素`
- 删 `yxxs` —— R2 首字母，来源 `隐现像素`

### background-latent-mesh

保留：`latent mesh`、`mesh gradient`、`隐现流体`、`流体层`

- 删 `latent fluid` —— R3 照抄标题，来源 `Latent: Fluid`
- 删 `yinxian liuti` —— R1 全拼，来源 `隐现流体`
- 删 `yxlt` —— R2 首字母，来源 `隐现流体`

### background-latent-both

保留：`latent both`、`隐现混合`、`双层背景`

- 删 `latent mixed` —— R3 照抄标题，来源 `Latent: Mixed`
- 删 `yinxian hunhe` —— R1 全拼，来源 `隐现混合`
- 删 `yxhh` —— R2 首字母，来源 `隐现混合`

### background-url

保留：`embedded background`、`embed background`、`background embed`、`background url`、`url background`、`url`、`webpage`、`嵌入背景`、`网页背景`、`背景切换到 嵌入背景`、`背景切换到嵌入背景`

- 删 `qianrubeijing` —— R1 全拼，来源 `嵌入背景`
- 删 `qrbj` —— R2 首字母，来源 `嵌入背景`
- 删 `wybj` —— R2 首字母，来源 `网页背景`

### background-sora

保留：`sora`、`starry sky`、`star`、`星空`、`空`、`背景切换到 空`、`背景切换到空`、`背景切换到Sora`、`背景切换到星空`

- 删 `background sora` —— R3 照抄标题，来源 `Background: Sora`
- 删 `kong` —— R1 全拼，来源 `空`
- 删 `xingkong` —— R1 全拼，来源 `星空`
- 删 `xk` —— R2 首字母，来源 `星空`
