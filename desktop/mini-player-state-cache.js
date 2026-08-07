'use strict';

const MAX_MINI_PLAYER_COVER_LENGTH = 8 * 1024 * 1024;

/**
 * 创建不持有歌曲或封面引用的迷你播放器初始状态。
 * @returns {{title:string, artist:string, cover:string, playing:boolean, hasTrack:boolean, desktopLyrics:boolean, metaSignature:string}} 空状态。
 */
function createEmptyMiniPlayerState() {
  return {
    title: 'Mineradio',
    artist: '',
    cover: '',
    playing: false,
    hasTrack: false,
    desktopLyrics: false,
    metaSignature: '',
  };
}

/**
 * 管理主进程中的迷你播放器状态所有权。
 * 功能禁用或窗口不驻留时立即替换为空状态，并拒绝后续 renderer 补丁，避免继续持有封面 data URL。
 */
class MiniPlayerStateCache {
  /**
   * @param {boolean} enabled 初始是否启用迷你播放器功能。
   */
  constructor(enabled) {
    this.enabled = !!enabled;
    this.resident = false;
    this.value = createEmptyMiniPlayerState();
  }

  /**
   * 切换状态接收能力；禁用时释放所有歌曲与封面引用。
   * @param {boolean} enabled 是否接受后续状态补丁。
   * @returns {void}
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.resident = false;
      this.value = createEmptyMiniPlayerState();
    }
  }

  /**
   * 切换迷你窗口驻留状态；离开驻留态时释放全部歌曲与封面引用。
   * @param {boolean} resident 当前是否存在由缓存服务的迷你窗口。
   * @returns {void}
   */
  setResident(resident) {
    this.resident = this.enabled && !!resident;
    if (!this.resident) this.value = createEmptyMiniPlayerState();
  }

  /**
   * 在启用状态下应用 renderer 增量补丁。
   * @param {unknown} payload renderer 发送的状态补丁。
   * @returns {boolean} 是否接受并应用了补丁。
   */
  apply(payload) {
    if (!this.enabled || !this.resident) return false;
    const source = payload && typeof payload === 'object' ? payload : {};
    const next = { ...this.value };
    if (Object.prototype.hasOwnProperty.call(source, 'title')) next.title = String(source.title || 'Mineradio').slice(0, 260);
    if (Object.prototype.hasOwnProperty.call(source, 'artist')) next.artist = String(source.artist || '').slice(0, 320);
    if (Object.prototype.hasOwnProperty.call(source, 'cover')) {
      const cover = String(source.cover || '');
      next.cover = cover.length <= MAX_MINI_PLAYER_COVER_LENGTH ? cover : '';
    }
    if (Object.prototype.hasOwnProperty.call(source, 'playing')) next.playing = !!source.playing;
    if (Object.prototype.hasOwnProperty.call(source, 'hasTrack')) next.hasTrack = !!source.hasTrack;
    if (Object.prototype.hasOwnProperty.call(source, 'desktopLyrics')) next.desktopLyrics = source.desktopLyrics === true;
    if (Object.prototype.hasOwnProperty.call(source, 'metaSignature')) next.metaSignature = String(source.metaSignature || '').slice(0, 240);
    this.value = next;
    return true;
  }
}

module.exports = { MiniPlayerStateCache };
