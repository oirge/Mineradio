'use strict';

const MAX_MINI_PLAYER_COVER_LENGTH = 8 * 1024 * 1024;
// 封面律动/光晕强度上限。1 是标准力度，>1 是用户主动要的“更明显”，0 等于关闭。
const MAX_MINI_PLAYER_EFFECT_STRENGTH = 3;
// 主题变量转发的硬上限。迷你播放器只吃 --th-* 这一族，多了也用不上，写死上限省得 renderer 灌满 IPC。
const MAX_MINI_PLAYER_THEME_VARS = 64;
const MAX_MINI_PLAYER_THEME_VALUE_LENGTH = 200;
const MINI_PLAYER_THEME_NAME_RE = /^--th-[a-z0-9][a-z0-9-]{0,58}$/;
// 值里出现这些就说明不是一个单纯的颜色/阴影，直接丢掉：分号和花括号能越出声明，url() 会拉远端资源。
const MINI_PLAYER_THEME_VALUE_RE = /[;{}<>]|url\s*\(|expression\s*\(|javascript\s*:|@import/i;

/**
 * 清洗 renderer 送来的主题变量表。主窗口那边已经过一遍 normalizeThemeVars，
 * 这里再收一次是因为迷你窗口是另一个渲染进程，不能让它依赖上游的清洗结果。
 * @param {unknown} source 原始变量表。
 * @returns {Object<string,string>} 只含合法 --th-* 键值的新对象。
 */
function normalizeMiniPlayerThemeVars(source) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  const keys = Object.keys(source);
  let count = 0;
  for (let i = 0; i < keys.length && count < MAX_MINI_PLAYER_THEME_VARS; i += 1) {
    const name = String(keys[i] || '').trim().toLowerCase();
    if (!MINI_PLAYER_THEME_NAME_RE.test(name)) continue;
    const value = String(source[keys[i]] == null ? '' : source[keys[i]]).trim();
    if (!value || value.length > MAX_MINI_PLAYER_THEME_VALUE_LENGTH) continue;
    if (MINI_PLAYER_THEME_VALUE_RE.test(value)) continue;
    out[name] = value;
    count += 1;
  }
  return out;
}

/**
 * 把变量表压成稳定的签名，用来判断要不要重发。键排序后拼接，顺序变化不算变化。
 * @param {Object<string,string>} vars 变量表。
 * @returns {string} 签名。
 */
function miniPlayerThemeSignature(vars) {
  const keys = Object.keys(vars || {}).sort();
  let out = '';
  for (let i = 0; i < keys.length; i += 1) out += keys[i] + ':' + vars[keys[i]] + '|';
  return out;
}

function createDefaultMiniPlayerVisual() {
  return {
    pulseEnabled: true,
    pulseStrength: 1,
    glowEnabled: true,
    glowStrength: 1,
    hoverExpand: true,
    radius: 12,
  };
}

function normalizeMiniPlayerVisual(source, fallback) {
  const next = { ...(fallback || createDefaultMiniPlayerVisual()) };
  if (!source || typeof source !== 'object') return next;
  if (Object.prototype.hasOwnProperty.call(source, 'pulseEnabled')) next.pulseEnabled = source.pulseEnabled === true;
  if (Object.prototype.hasOwnProperty.call(source, 'pulseStrength')) {
    const strength = Number(source.pulseStrength);
    if (Number.isFinite(strength)) next.pulseStrength = Math.max(0, Math.min(MAX_MINI_PLAYER_EFFECT_STRENGTH, strength));
  }
  if (Object.prototype.hasOwnProperty.call(source, 'glowEnabled')) next.glowEnabled = source.glowEnabled === true;
  if (Object.prototype.hasOwnProperty.call(source, 'glowStrength')) {
    const strength = Number(source.glowStrength);
    if (Number.isFinite(strength)) next.glowStrength = Math.max(0, Math.min(MAX_MINI_PLAYER_EFFECT_STRENGTH, strength));
  }
  if (Object.prototype.hasOwnProperty.call(source, 'hoverExpand')) next.hoverExpand = source.hoverExpand !== false;
  if (Object.prototype.hasOwnProperty.call(source, 'radius')) {
    const radius = Number(source.radius);
    if (Number.isFinite(radius)) next.radius = Math.max(4, Math.min(22, radius));
  }
  return next;
}

/**
 * 创建不持有歌曲或封面引用的迷你播放器初始状态。
 * @returns {{title:string, artist:string, cover:string, playing:boolean, hasTrack:boolean, desktopLyrics:boolean, metaSignature:string}} 空状态。
 */
function createEmptyMiniPlayerState() {
  return {
    themeVars: {},
    title: 'Mineradio',
    artist: '',
    cover: '',
    playing: false,
    hasTrack: false,
    desktopLyrics: false,
    pulse: 0,
    visual: createDefaultMiniPlayerVisual(),
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
    if (Object.prototype.hasOwnProperty.call(source, 'pulse')) {
      const pulse = Number(source.pulse);
      next.pulse = Number.isFinite(pulse) ? Math.max(0, Math.min(1, pulse)) : 0;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'visual')) next.visual = normalizeMiniPlayerVisual(source.visual, next.visual);
    if (Object.prototype.hasOwnProperty.call(source, 'themeVars')) next.themeVars = normalizeMiniPlayerThemeVars(source.themeVars);
    if (Object.prototype.hasOwnProperty.call(source, 'metaSignature')) next.metaSignature = String(source.metaSignature || '').slice(0, 240);
    this.value = next;
    return true;
  }
}

module.exports = { MiniPlayerStateCache, normalizeMiniPlayerThemeVars, miniPlayerThemeSignature };
