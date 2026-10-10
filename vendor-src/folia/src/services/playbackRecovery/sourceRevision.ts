import type { LocalSong, SongResult } from '../../types';
import { resolveNavidromePlaybackCarrier } from '../../utils/appPlaybackGuards';

// Builds credential-free source revisions shared by playback selection and recovery caching.

const safeUrlIdentity = (value: string): string => {
    try {
        const url = new URL(value);
        const representationParams = ['format', 'maxBitRate']
            .map(key => [key, url.searchParams.get(key)] as const)
            .filter((entry): entry is readonly [string, string] => entry[1] !== null)
            .map(([key, item]) => `${key}=${item}`)
            .join('&');
        return `${url.origin}${url.pathname}${representationParams ? `?${representationParams}` : ''}`;
    } catch {
        return 'invalid-url';
    }
};

export const buildLocalSourceRevision = (
    song: Pick<LocalSong, 'id' | 'fileSize' | 'fileLastModified'>,
    file?: Pick<File, 'size' | 'lastModified'>,
): string => `${song.id}:${file?.size ?? song.fileSize}:${file?.lastModified ?? song.fileLastModified ?? 0}`;

export const buildNavidromeSourceRevision = (song: SongResult, sourceUrl: string): string => {
    const carrier = resolveNavidromePlaybackCarrier(song);
    if (!carrier) return '';
    const data = carrier.navidromeData;
    return [data.id, data.path, data.suffix, song.durationMs, safeUrlIdentity(sourceUrl)].join(':');
};
