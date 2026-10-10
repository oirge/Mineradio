import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SongResult } from '../../../src/types';

// test/unit/onlineMusic/playbackReportGate.test.ts
// The gate is the second half of the risk-control story: even a tracker that somehow produced a
// burst of reports must not be able to send them at a rate no listener could produce.

const reportPlayback = vi.fn(async () => {});

vi.mock('../../../src/services/onlineMusic/omni', () => ({
    omni: {
        reportPlayback: (...args: unknown[]) => reportPlayback(...(args as [])),
        canReportPlayback: () => true,
        getProviderCapabilities: () => ({ playbackReports: true }),
        getProviderAvailability: () => ({ configured: true }),
    },
}));

const { MAX_REPORTS_PER_HOUR, MIN_REPORT_GAP_MS, resetPlaybackReportGate, sendPlaybackReport } = await import(
    '../../../src/services/onlineMusic/playbackReportGate'
);

const song = {
    id: 1,
    name: 'Song',
    sourceRef: { kind: 'online', providerId: 'netease', mediaId: '1' },
} as unknown as SongResult;

const report = { playedSeconds: 45, totalSeconds: 240 };

describe('playback report gate', () => {
    beforeEach(() => {
        resetPlaybackReportGate();
        reportPlayback.mockClear();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends a report through to the owning provider', async () => {
        await expect(sendPlaybackReport(song, report, 0)).resolves.toBe(true);
        expect(reportPlayback).toHaveBeenCalledWith(song, report);
    });

    it('drops a second report that arrives faster than a listener could play', async () => {
        await sendPlaybackReport(song, report, 0);

        await expect(sendPlaybackReport(song, report, MIN_REPORT_GAP_MS - 1)).resolves.toBe(false);
        expect(reportPlayback).toHaveBeenCalledTimes(1);
    });

    it('allows the next report once the minimum gap has passed', async () => {
        await sendPlaybackReport(song, report, 0);

        await expect(sendPlaybackReport(song, report, MIN_REPORT_GAP_MS)).resolves.toBe(true);
        expect(reportPlayback).toHaveBeenCalledTimes(2);
    });

    it('stops at the hourly ceiling and resumes once the window rolls past', async () => {
        for (let index = 0; index < MAX_REPORTS_PER_HOUR; index += 1) {
            await sendPlaybackReport(song, report, index * MIN_REPORT_GAP_MS);
        }
        expect(reportPlayback).toHaveBeenCalledTimes(MAX_REPORTS_PER_HOUR);

        const stillInsideTheHour = MAX_REPORTS_PER_HOUR * MIN_REPORT_GAP_MS;
        await expect(sendPlaybackReport(song, report, stillInsideTheHour)).resolves.toBe(false);
        expect(reportPlayback).toHaveBeenCalledTimes(MAX_REPORTS_PER_HOUR);

        await expect(sendPlaybackReport(song, report, 60 * 60 * 1000 + 1)).resolves.toBe(true);
    });

    it('refuses a report while another one is still in flight', async () => {
        let release = () => {};
        reportPlayback.mockImplementationOnce(() => new Promise<void>(resolve => { release = () => resolve(); }));

        const first = sendPlaybackReport(song, report, 0);
        const second = await sendPlaybackReport(song, report, MIN_REPORT_GAP_MS);
        release();

        expect(second).toBe(false);
        await expect(first).resolves.toBe(true);
    });

    it('releases the slot when a request never settles, instead of wedging the session', async () => {
        vi.useFakeTimers();
        // A dead proxy: the transport has no timeout of its own, so this promise never settles.
        reportPlayback.mockImplementationOnce(() => new Promise<void>(() => {}));

        const wedged = sendPlaybackReport(song, report, 0);
        await vi.advanceTimersByTimeAsync(15_000);
        await expect(wedged).resolves.toBe(false);
        vi.useRealTimers();

        // The gate must still accept the next report rather than dropping it as "still in flight".
        await expect(sendPlaybackReport(song, report, MIN_REPORT_GAP_MS)).resolves.toBe(true);
    });

    it('reports a provider failure as a dropped record rather than throwing', async () => {
        reportPlayback.mockRejectedValueOnce(new Error('rejected'));

        await expect(sendPlaybackReport(song, report, 0)).resolves.toBe(false);
    });
});
