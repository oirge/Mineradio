import { AudioLines, Captions, Command, Disc3, Film, FolderOpen, Heart, Images, Library, ListMusic, Maximize2, Music2, Pause, Play, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Sparkles } from 'lucide-react';
import { normalizeSearchText, splitWords } from '../../components/command-palette/search/normalize';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';

// src/mineradio/local/localCommandCatalog.ts
// Local action registry; it has no provider/application stores and is shared by every command entry.
export const LOCAL_ACTIONS = [
    { id: 'togglePlay', label: 'play', icon: Play, keywords: 'play pause 播放 暂停 bofang zanting', track: true, slot: false },
    { id: 'next', label: 'next', icon: SkipForward, keywords: 'next 下一首 xiayishou xys', track: true, slot: false },
    { id: 'previous', label: 'previous', icon: SkipBack, keywords: 'previous 上一首 shangyishou sys', track: true, slot: false },
    { id: 'mode', label: 'loop', icon: Repeat, keywords: 'repeat loop mode 循环 播放模式 xunhuan bfms', track: false, slot: true },
    { id: 'like', label: 'like', icon: Heart, keywords: 'like favorite 收藏 喜欢 shoucang sc xihuan', track: true, slot: true },
    { id: 'addPlaylist', label: 'addToPlaylist', icon: Plus, keywords: 'add playlist 加入歌单 jiarugedan jrgd', track: true, slot: true },
    { id: 'shuffle', label: 'shuffleQueue', icon: Shuffle, keywords: 'shuffle random 打乱 随机队列 daluan suiji', track: false, slot: true },
    { id: 'queue', label: 'queue', icon: ListMusic, keywords: 'queue 队列 duilie dl', track: false, slot: true },
    { id: 'library', label: 'library', icon: Library, keywords: 'library songs 音乐库 本地歌曲 yinyueku yyk', track: false, slot: true },
    { id: 'playback', label: 'playbackSettings', icon: SlidersHorizontal, keywords: 'speed sleep gapless crossfade 倍速 睡眠 定时 淡化 音量 beisu shuimian bs sm', track: false, slot: true },
    { id: 'audio', label: 'audioSettings', icon: AudioLines, keywords: 'eq equalizer device output audio 音效 均衡器 输出设备 yinxiao junhengqi shuchu yx jhq', track: false, slot: true },
    { id: 'subtitles', label: 'subtitleSettings', icon: Captions, keywords: 'subtitle captions translation romanization 字幕 翻译 罗马音 zimu fanyi fy zm', track: false, slot: true },
    { id: 'translationSource', label: 'customTranslationSource', icon: Captions, keywords: 'custom translation source endpoint api key model 自定义 翻译源 接口 模型 zidingyi fanyiyuan zdy fyy', track: false, slot: false },
    { id: 'videoExport', label: 'videoExport', icon: Film, keywords: 'video export record mp4 webm 视频 导出 录制 歌词 shipin daochu luzhi sp dc', track: false, slot: true },
    { id: 'visuals', label: 'effects', icon: Sparkles, keywords: 'effects visuals styles lyric background 歌词 样式 背景 效果 geci yangshi xiaoguo', track: false, slot: true },
    { id: 'commands', label: 'commands', icon: Command, keywords: 'command palette 命令 搜索 mingling sousuo ml', track: false, slot: true },
    { id: 'lyrics', label: 'lyricsView', icon: Music2, keywords: 'lyrics view 歌词界面 gecijiemian', track: false, slot: false },
    { id: 'records', label: 'recordsView', icon: Disc3, keywords: 'records view 唱片 悬浮唱片 changpian cp', track: false, slot: false },
    { id: 'posters', label: 'postersView', icon: Images, keywords: 'lattice posters 拼贴 封面墙 fengmianqiang pt', track: false, slot: false },
    { id: 'focus', label: 'focus', icon: Maximize2, keywords: 'focus immersive 沉浸 chenjin cj', track: false, slot: false },
    { id: 'importFiles', label: 'importFiles', icon: Music2, keywords: 'import files 导入音乐文件 daoru dryy', track: false, slot: false },
    { id: 'importFolder', label: 'importFolder', icon: FolderOpen, keywords: 'import folder 导入文件夹 daoruwenjianjia', track: false, slot: false },
] as const;
export type LocalActionId = typeof LOCAL_ACTIONS[number]['id'];
export type LocalTool = 'commands' | 'audio' | 'subtitles' | 'addPlaylist' | 'videoExport';
export const SLOT_ACTIONS = LOCAL_ACTIONS.filter(action => action.slot);
export function localActionView(id: LocalActionId, state: HostState | null) {
    const action = LOCAL_ACTIONS.find(item => item.id === id)!;
    const mode = state?.playMode ?? 'loop';
    return { ...action, disabled: action.track && !state?.currentTrack,
        label: id === 'mode' ? mode : id === 'like' && state?.currentTrack?.liked ? 'unlike' : id === 'togglePlay' && state?.playing ? 'pause' : action.label,
        icon: id === 'mode' ? mode === 'shuffle' ? Shuffle : mode === 'single' ? Repeat1 : Repeat : id === 'togglePlay' && state?.playing ? Pause : action.icon,
        active: id === 'like' ? Boolean(state?.currentTrack?.liked) : id === 'mode' && mode !== 'loop',
    };
}
export function localCommandMatches(text: string, query: string): boolean {
    const normalized = normalizeSearchText(text);
    return splitWords(normalizeSearchText(query)).every(word => normalized.includes(word));
}
export interface LocalActionServices {
    state: HostState | null; command: LocalCommand;
    tool: (tool: LocalTool) => void; library: (queue: boolean) => void;
    playback: () => void; visuals: () => void; focus: () => void;
    view: (view: 'lyrics' | 'records' | 'posters') => void;
}
export function executeLocalAction(id: LocalActionId, services: LocalActionServices) {
    if (localActionView(id, services.state).disabled) return;
    const run = (method: string, params?: Record<string, unknown>) => { void services.command(method, params).catch(() => {}); };
    if (id === 'mode') {
        const mode = services.state?.playMode ?? 'loop';
        run('setPlayMode', { mode: mode === 'loop' ? 'shuffle' : mode === 'shuffle' ? 'single' : 'loop' });
    } else if (id === 'like') run('toggleLike', { id: services.state?.currentTrack?.id });
    else if (id === 'shuffle') run('shuffleQueue');
    else if (id === 'queue' || id === 'library') services.library(id === 'queue');
    else if (id === 'playback') services.playback();
    else if (id === 'translationSource') run('openTranslationSettings');
    else if (id === 'visuals') services.visuals();
    else if (id === 'focus') services.focus();
    else if (id === 'lyrics' || id === 'records' || id === 'posters') services.view(id);
    else if (id === 'commands' || id === 'audio' || id === 'subtitles' || id === 'addPlaylist' || id === 'videoExport') services.tool(id);
    else run(id);
}
