import type { LocalSong } from '../types';
import { isValidLocalCoverAssetId, isLocalCoverWebRuntimeSupported } from './localCoverBinaryStore';
import { getSizedCoverUrl } from '../utils/coverUrl';

// src/services/localCoverAssetUrl.ts
// Resolves content-addressed local covers to stable Electron or same-origin Web resource URLs.

const WEB_COVER_PATH_PREFIX = '/__folia_cover/';

const hasElectronCoverProtocol = (): boolean => (
  typeof window !== 'undefined' && typeof window.electron?.hasLocalCoverAsset === 'function'
);

export const getLocalCoverAssetUrl = (assetId: string | undefined, size?: number): string | null => {
  if (!isValidLocalCoverAssetId(assetId)) return null;
  let url: string;
  if (hasElectronCoverProtocol()) {
    url = `folia-cover://asset/${encodeURIComponent(assetId)}`;
  } else {
    if (!isLocalCoverWebRuntimeSupported()) return null;
    url = `${WEB_COVER_PATH_PREFIX}${encodeURIComponent(assetId)}`;
  }
  return size ? getSizedCoverUrl(url, size) : url;
};

export const isLocalCoverAssetUrl = (url: string | null | undefined): url is string => (
  typeof url === 'string'
  && (url.startsWith('folia-cover://asset/') || url.startsWith(WEB_COVER_PATH_PREFIX))
);

export const getPreferredLocalSongCoverUrl = (song: LocalSong): string | null => {
  const localCoverUrl = getLocalCoverAssetUrl(song.localCoverAssetId, 1024);
  return song.useOnlineCover
    ? song.onlineMetadata?.coverUrl || localCoverUrl
    : localCoverUrl || song.onlineMetadata?.coverUrl || null;
};
