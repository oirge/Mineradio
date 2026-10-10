import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalSong, SongResult } from '@/types';
import { cancelPlayableTranscode, startPlayableTranscode } from '@/services/playbackRecovery/playableSourceService';
import { getFileFromLocalSong } from '@/services/localMusicService';

// Verifies cancellation before IPC registration cannot leave an orphaned FFmpeg job.

vi.mock('@/services/localMusicService', () => ({
    getFileFromLocalSong: vi.fn(),
}));

const song = {
    id: 'local-song',
    name: 'Local song',
    artists: [],
    album: { id: 0, name: '' },
    durationMs: 1_000,
    isLocal: true,
    localRef: { songId: 'local-song' },
    sourceRef: { kind: 'local', mediaId: 'local-song' },
} as SongResult;

const localSong = {
    id: 'local-song',
    fileName: 'song.wv',
    fileSize: 8,
    fileLastModified: 10,
} as LocalSong;

describe('playable source service cancellation', () => {
    const requestTranscodeFallback = vi.fn();
    const cancelTranscodeFallback = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('window', {
            electron: { requestTranscodeFallback, cancelTranscodeFallback },
        });
    });

    it('does not register IPC after cancellation during a local file read', async () => {
        let finishRead!: (data: ArrayBuffer) => void;
        const pendingRead = new Promise<ArrayBuffer>(resolve => { finishRead = resolve; });
        vi.mocked(getFileFromLocalSong).mockResolvedValue({
            name: 'song.wv',
            size: 8,
            lastModified: 10,
            arrayBuffer: () => pendingRead,
        } as File);

        const request = startPlayableTranscode(song, 'blob:local', [localSong], 'playback');
        cancelPlayableTranscode(request.requestId);
        finishRead(new ArrayBuffer(8));

        await expect(request.result).resolves.toMatchObject({ ok: false, errorCode: 'CANCELLED' });
        expect(requestTranscodeFallback).not.toHaveBeenCalled();
        expect(cancelTranscodeFallback).toHaveBeenCalledWith(request.requestId);
    });

    it('passes the shared media-cache ceiling when registering the request', async () => {
        vi.mocked(getFileFromLocalSong).mockResolvedValue({
            name: 'song.wv',
            size: 8,
            lastModified: 10,
            arrayBuffer: async () => new ArrayBuffer(8),
        } as File);
        requestTranscodeFallback.mockResolvedValue({ ok: false, errorCode: 'TEST' });

        const request = startPlayableTranscode(song, 'blob:local', [localSong], 'playback');
        await request.result;

        expect(requestTranscodeFallback).toHaveBeenCalledWith(expect.objectContaining({
            requestId: request.requestId,
            limitBytes: 5 * 1024 * 1024 * 1024,
        }));
    });
});
