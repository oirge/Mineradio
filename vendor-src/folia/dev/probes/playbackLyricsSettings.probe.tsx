import React from 'react';
import PlaybackSettingsSubview from '../../src/components/modal/settings/PlaybackSettingsSubview';
import { DEFAULT_THEME } from '../../src/services/baseThemes';
import type { ProbeDefinition } from './definition';
// dev/probes/playbackLyricsSettings.probe.tsx

/**
 * 播放设置里的歌词分区。
 *
 * 歌词过滤入口是从实验室搬过来的，这里主要确认它作为「全局时间偏移」的同组兄弟项
 * 渲染正常：同一张卡内的分隔线、图标对齐和 chevron 都要和上面一行一致。
 */
const PlaybackLyricsSettingsProbe: React.FC = () => (
    <div
        className="min-h-screen bg-zinc-950 p-8"
        style={{
            '--text-primary': DEFAULT_THEME.primaryColor,
            '--text-secondary': DEFAULT_THEME.secondaryColor,
        } as React.CSSProperties}
    >
        <div className="mx-auto max-w-3xl">
            <PlaybackSettingsSubview
                isDaylight={false}
                onAudioOutputDeviceChange={() => true}
                onOpenGlobalLyricOffsetSettings={() => {}}
                onOpenLyricFilterSettings={() => {}}
                replayGainMode="off"
                onReplayGainModeChange={() => {}}
                settingsCardClass="border-white/10 bg-white/[0.04]"
                theme={DEFAULT_THEME}
                utilityGhostButtonClass="border border-white/10 bg-white/5"
            />
        </div>
    </div>
);

const probe: ProbeDefinition = {
    id: 'playbackLyricsSettings',
    title: '播放设置·歌词分区',
    description: '歌词过滤入口从实验室搬到播放设置后，与全局时间偏移同组渲染是否一致',
    Component: PlaybackLyricsSettingsProbe,
};

export default probe;
