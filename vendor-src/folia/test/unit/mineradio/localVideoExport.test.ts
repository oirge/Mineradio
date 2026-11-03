// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { normalizeVisualPreferences } from '../../../src/mineradio/local/useVisualSettings';
import { isLocalVideoExportBusy, LOCAL_VIDEO_PRESETS, localVideoExportParams, readVideoExportTransition, saveVideoExportTransition, VIDEO_EXPORT_OPTIONS_KEY, videoElapsedLabel, type LocalVideoExportState } from '../../../src/mineradio/local/localVideoExportData';
import { executeLocalAction, localCommandMatches, LOCAL_ACTIONS, type LocalActionServices } from '../../../src/mineradio/local/localCommandCatalog';
import { LOCAL_VIDEO_EXPORT_RESOURCES } from '../../../src/mineradio/local/localVideoExportLocale';
import { createVideoExportTimeline } from '../../../src/mineradio/local/videoExportTimeline';
import type { VideoExportInitial } from '../../../src/mineradio/local/videoExportBridge';

describe('local video export contract', () => {
    it('snapshots serializable visuals independently of live preference objects and record-wall routing', () => {
        const visuals = normalizeVisualPreferences({ view: 'posters', mode: 'classic', lyricsFontScale: 1.25, subtitleContentMode: 'both', rhythm: false });
        Object.assign(visuals, { update: () => {}, presets: [{ name: 'must not travel' }] });
        const request = localVideoExportParams(LOCAL_VIDEO_PRESETS[3], 'current', visuals);
        expect(request).toMatchObject({ width: 1080, height: 1920, startMode: 'current', visuals: { view: 'lyrics', mode: 'classic', rhythm: false, subtitleContentMode: 'both' } });
        expect(request.transitionBehavior).toBe('continue');
        expect(localVideoExportParams(LOCAL_VIDEO_PRESETS[0], 'from-start', visuals, 'save').transitionBehavior).toBe('save');
        expect(request.visuals).not.toHaveProperty('update'); expect(request.visuals).not.toHaveProperty('presets');
        visuals.tunings.classic!.avoidOverlap = true;
        expect(request.visuals.tunings.classic!.avoidOverlap).toBe(false);
        expect(() => structuredClone(request)).not.toThrow();
    });
    it('keeps only active recording phases busy so saved/cancelled/error can be retried', () => {
        for (const status of ['preparing', 'recording', 'paused', 'saving'] as const) expect(isLocalVideoExportBusy({ status } as LocalVideoExportState)).toBe(true);
        for (const status of ['idle', 'saved', 'cancelled', 'error'] as const) expect(isLocalVideoExportBusy({ status } as LocalVideoExportState)).toBe(false);
        expect(LOCAL_VIDEO_PRESETS.map(size => `${size.width}x${size.height}`)).toEqual(['1280x720', '1920x1080', '720x1280', '1080x1920']);
    });
    it('opens the job dialog without starting or seeking playback, even with an empty library', () => {
        const services: LocalActionServices = { state: null, command: vi.fn(), tool: vi.fn(), library: vi.fn(), playback: vi.fn(), visuals: vi.fn(), focus: vi.fn(), view: vi.fn() };
        executeLocalAction('videoExport', services);
        expect(services.tool).toHaveBeenCalledWith('videoExport'); expect(services.command).not.toHaveBeenCalled();
        const action = LOCAL_ACTIONS.find(item => item.id === 'videoExport')!;
        for (const query of ['视频', '导出', 'record', 'dc']) expect(localCommandMatches(action.keywords, query)).toBe(true);
    });
    it('has matching bilingual copy for each export state and describes real-time playback behavior', () => {
        expect(Object.keys(LOCAL_VIDEO_EXPORT_RESOURCES.en).sort()).toEqual(Object.keys(LOCAL_VIDEO_EXPORT_RESOURCES['zh-CN']).sort());
        expect(LOCAL_VIDEO_EXPORT_RESOURCES.en.videoExportHint).toContain('real time');
        expect(LOCAL_VIDEO_EXPORT_RESOURCES['zh-CN'].videoExportHint).toContain('重新播放');
        expect(LOCAL_VIDEO_EXPORT_RESOURCES.en.videoExportBackground).toContain('desktop and cursor are excluded');
    });
    it('formats recorded time without NaN or negative labels', () => {
        expect(videoElapsedLabel(125.9)).toBe('2:05'); expect(videoElapsedLabel(-1)).toBe('0:00'); expect(videoElapsedLabel(NaN)).toBe('0:00');
    });
    it('follows track changes and backwards seeks while rejecting stale lyric packets', () => {
        const initial = { id: 'export-one', state: { currentTrack: { id: 'a', title: 'First' }, duration: 60, position: 15 },
            lyrics: { trackId: 'a', lines: [{ time: 0, text: 'First opening' }, { time: 10, text: 'First verse' }] } } as VideoExportInitial;
        const timeline = createVideoExportTimeline(initial);
        expect(timeline.at(15)).toBe(1);
        const second = { ...initial.state, currentTrack: { ...initial.state.currentTrack!, id: 'b', title: 'Second' }, position: 0 };
        expect(timeline.apply({ id: initial.id, state: second }).trackChanged).toBe(true);
        expect(timeline.lines).toEqual([]); expect(timeline.at(0)).toBe(-1);
        timeline.apply({ id: initial.id, state: second, lyrics: initial.lyrics });
        expect(timeline.lines).toEqual([]);
        timeline.apply({ id: initial.id, state: second, lyrics: { trackId: 'b', lines: [{ time: 0, text: 'New opening' }, { time: 20, text: 'New verse' }] } });
        expect(timeline.lines[0].fullText).toBe('New opening'); expect(timeline.state.currentTrack?.title).toBe('Second');
        expect(timeline.at(25)).toBe(1); expect(timeline.at(1)).toBe(0);
        const before = timeline.lines;
        expect(timeline.apply({ id: 'old-session', state: initial.state, lyrics: initial.lyrics }).accepted).toBe(false);
        expect(timeline.state.currentTrack?.id).toBe('b'); expect(timeline.lines).toBe(before);
    });
    it('accepts updated lyrics for the same track and preserves visual-only songs', () => {
        const initial = { id: 'export-two', state: { currentTrack: { id: 'a' }, duration: 20 }, lyrics: { trackId: 'a', lines: [] } } as unknown as VideoExportInitial;
        const timeline = createVideoExportTimeline(initial);
        expect(timeline.lines).toEqual([]); expect(timeline.at(5)).toBe(-1);
        timeline.apply({ id: initial.id, state: initial.state, lyrics: { trackId: 'a', lines: [{ time: 2, text: 'Loaded later' }] } });
        expect(timeline.lines[0].endTime).toBe(20); expect(timeline.at(3)).toBe(0);
    });
    it('restores only a bounded valid transition setting and writes no job or playback data', () => {
        const setItem = vi.fn(); saveVideoExportTransition('save', { setItem });
        expect(setItem).toHaveBeenCalledWith(VIDEO_EXPORT_OPTIONS_KEY, '{"transitionBehavior":"save"}');
        expect(readVideoExportTransition({ getItem: () => '{"transitionBehavior":"save"}' })).toBe('save');
        for (const raw of [null, '', '{bad', '[]', 'null', '{"transitionBehavior":"invalid"}', ' '.repeat(300)]) {
            expect(readVideoExportTransition({ getItem: () => raw })).toBe('continue');
        }
        expect(readVideoExportTransition({ getItem: () => { throw new Error('blocked'); } })).toBe('continue');
        expect(() => saveVideoExportTransition('continue', { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
    });
});
