/*
 * The KuGou request-signing flow in this file was adapted from KuGouMusicApi.
 * MIT License, Copyright (c) 2023 MakcRe
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KUGOU_APP_ID = 1005;
const KUGOU_WEB_APP_ID = 1014;
const KUGOU_SOURCE_APP_ID = 2919;
const KUGOU_CLIENT_VERSION = 20489;
const KUGOU_SESSION_VERSION = 1;
const KUGOU_LOGIN_MAX_AGE_MS = 10 * 60 * 1000;
const KUGOU_MAX_PLAYLIST_PAGES = 10;
const KUGOU_MAX_TRACK_PAGES = 20;
const KUGOU_AUTH_ERROR_CODES = new Set(['20010', '20011', '20017', '10009']);
const KUGOU_STREAM_KEY_SALT = '57ae12eb6890223e355ccfcb74edf70d';
const KUGOU_STREAM_LEVELS = Object.freeze({
  auto: [
    { request: 'viper_clear', resolved: 'jymaster', label: '蝰蛇超清', fallbackBitRate: 0 },
    { request: 'high', resolved: 'hires', label: 'Hi-Res', fallbackBitRate: 0 },
    { request: 'flac', resolved: 'lossless', label: '无损 FLAC', fallbackBitRate: 0 },
    { request: 320, resolved: 'exhigh', label: '极高 HQ', fallbackBitRate: 320000 },
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
  jymaster: [
    { request: 'viper_clear', resolved: 'jymaster', label: '蝰蛇超清', fallbackBitRate: 0 },
    { request: 'high', resolved: 'hires', label: 'Hi-Res', fallbackBitRate: 0 },
    { request: 'flac', resolved: 'lossless', label: '无损 FLAC', fallbackBitRate: 0 },
    { request: 320, resolved: 'exhigh', label: '极高 HQ', fallbackBitRate: 320000 },
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
  hires: [
    { request: 'high', resolved: 'hires', label: 'Hi-Res', fallbackBitRate: 0 },
    { request: 'flac', resolved: 'lossless', label: '无损 FLAC', fallbackBitRate: 0 },
    { request: 320, resolved: 'exhigh', label: '极高 HQ', fallbackBitRate: 320000 },
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
  lossless: [
    { request: 'flac', resolved: 'lossless', label: '无损 FLAC', fallbackBitRate: 0 },
    { request: 320, resolved: 'exhigh', label: '极高 HQ', fallbackBitRate: 320000 },
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
  exhigh: [
    { request: 320, resolved: 'exhigh', label: '极高 HQ', fallbackBitRate: 320000 },
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
  standard: [
    { request: 128, resolved: 'standard', label: '标准', fallbackBitRate: 128000 },
  ],
});
const KUGOU_BROWSER_AUDIO_FORMATS = new Set(['', 'mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac']);
const KUGOU_DEVICE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/gbjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`;

function md5(value) {
  return crypto.createHash('md5').update(String(value || ''), 'utf8').digest('hex');
}

function randomString(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let output = '';
  for (let index = 0; index < length; index += 1) output += alphabet[bytes[index] % alphabet.length];
  return output;
}

function stableGuid(value) {
  const hex = md5(`mineradio-kugou-guid:${value}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeStreamLevel(value) {
  const level = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(KUGOU_STREAM_LEVELS, level) ? level : 'auto';
}

function compactTrackIdentity(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const TRACK_VERSION_RULES = Object.freeze([
  { tag: 'remix', pattern: /\bremix(?:ed)?\b|重混|混音/iu },
  { tag: 'dj', pattern: /\bdj\b|电音|舞曲/iu },
  { tag: 'live', pattern: /\blive\b|现场(?:版)?|演唱会(?:版)?/iu },
  { tag: 'cover', pattern: /\bcover\b|\btribute\b|翻唱|致敬/iu },
  { tag: 'instrumental', pattern: /\binstrumental\b|伴奏|纯音乐|无人声/iu },
  { tag: 'male', pattern: /男声|男版/iu },
  { tag: 'female', pattern: /女声|女版/iu },
  { tag: 'sped-up', pattern: /\bsped\s*up\b|加速|倍速|变速/iu },
  { tag: 'slowed', pattern: /\bslowed\b|慢速|降速/iu },
  { tag: 'acoustic', pattern: /\bacoustic\b|不插电|弹唱/iu },
  { tag: 'demo', pattern: /\bdemo\b|试听/iu },
  { tag: 'edit', pattern: /剪辑版|短版|片段版?/iu },
  { tag: 'karaoke', pattern: /\bktv\b|卡拉\s*ok/iu },
  { tag: 'remaster', pattern: /\bremaster(?:ed)?\b|重制/iu },
  { tag: 'cantonese', pattern: /粤语/iu },
  { tag: 'mandarin', pattern: /国语/iu },
  { tag: 'english', pattern: /英文版?/iu },
  { tag: 'japanese', pattern: /日语版?/iu },
  { tag: 'korean', pattern: /韩语版?/iu },
  { tag: 'piano', pattern: /钢琴(?:版)?|\bpiano\b/iu },
  { tag: 'guitar', pattern: /吉他(?:版)?|\bguitar\b/iu },
  { tag: 'traditional', pattern: /古筝版|琵琶版|二胡版|戏腔/iu },
  { tag: 'original', pattern: /原唱|原版|\boriginal\b/iu },
  { tag: 'studio', pattern: /录音室(?:版)?|\bstudio\b/iu },
]);
const NEUTRAL_TRACK_VERSION_TAGS = new Set(['original', 'studio']);

function trackVersionSignals(value) {
  const text = String(value || '').normalize('NFKC').toLowerCase();
  const signals = new Set();
  TRACK_VERSION_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) signals.add(rule.tag);
  });
  return signals;
}

function trackTitleBase(value) {
  let text = String(value || '').normalize('NFKC').toLowerCase();
  text = text.replace(/[（(【\[].*?[）)】\]]/gu, ' ');
  TRACK_VERSION_RULES.forEach((rule) => {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    text = text.replace(new RegExp(rule.pattern.source, flags), ' ');
  });
  text = text.replace(/\b(?:version|ver)\.?\s*\d*\b|完整版|正式版|官方版|音频版|高音质|无损/giu, ' ');
  return compactTrackIdentity(text);
}

function trackVersionSignalsMatch(expectedName, returnedName) {
  const expected = trackVersionSignals(expectedName);
  const returned = trackVersionSignals(returnedName);
  NEUTRAL_TRACK_VERSION_TAGS.forEach((tag) => {
    expected.delete(tag);
    returned.delete(tag);
  });
  if (expected.size !== returned.size) return false;
  for (const tag of expected) {
    if (!returned.has(tag)) return false;
  }
  return true;
}

function splitStreamFileName(value) {
  const fileName = String(value || '').trim().replace(/\.[a-z0-9]{2,5}$/i, '');
  const parts = fileName.split(/\s+-\s+/);
  if (parts.length < 2) return { artist: '', name: fileName };
  return {
    artist: parts.shift().trim(),
    name: parts.join(' - ').trim(),
  };
}

function splitArtistIdentities(value) {
  return String(value || '')
    .split(/\s*(?:\/|、|,|，|&|＆|;|；|\+|\bx\b|\bfeat\.?\b|\bft\.?\b)\s*/i)
    .map(compactTrackIdentity)
    .filter(Boolean);
}

function stripArtistPrefixFromTitle(value, artistValue) {
  const original = String(value || '').trim();
  const split = splitStreamFileName(original);
  if (!split.artist || !split.name) return original;
  const prefixArtists = splitArtistIdentities(split.artist);
  const expectedArtists = splitArtistIdentities(artistValue);
  if (!prefixArtists.length || !expectedArtists.length) return original;
  return prefixArtists.some((artist) => expectedArtists.includes(artist)) ? split.name : original;
}

function streamIdentityMatches(fileName, expectedName, expectedArtist) {
  const cleanExpectedName = stripArtistPrefixFromTitle(expectedName, expectedArtist);
  const expectedTitle = trackTitleBase(cleanExpectedName);
  if (!expectedTitle) return true;
  const returned = splitStreamFileName(fileName);
  if (!returned.name || trackTitleBase(returned.name) !== expectedTitle) return false;
  if (!trackVersionSignalsMatch(cleanExpectedName, returned.name)) return false;
  const expectedArtists = splitArtistIdentities(expectedArtist);
  const returnedArtists = splitArtistIdentities(returned.artist);
  if (!expectedArtists.length || !returnedArtists.length) return true;
  return expectedArtists.some((artist) => returnedArtists.includes(artist));
}

function searchTrackIdentityScore(track, expectedName, expectedArtist) {
  if (!track || typeof track !== 'object') return -1;
  const cleanExpectedName = stripArtistPrefixFromTitle(expectedName, expectedArtist);
  const cleanTrackName = stripArtistPrefixFromTitle(track.name, track.artist);
  if (!trackTitleBase(cleanExpectedName) || trackTitleBase(cleanTrackName) !== trackTitleBase(cleanExpectedName)) return -1;
  const versionText = [cleanTrackName, track.versionText, track.album].filter(Boolean).join(' ');
  if (!trackVersionSignalsMatch(cleanExpectedName, versionText)) return -1;
  const expectedArtists = splitArtistIdentities(expectedArtist);
  const returnedArtists = splitArtistIdentities(track.artist);
  if (expectedArtists.length && returnedArtists.length
      && !expectedArtists.some((artist) => returnedArtists.includes(artist))) return -1;
  let score = 100;
  if (compactTrackIdentity(cleanTrackName) === compactTrackIdentity(cleanExpectedName)) score += 20;
  if (compactTrackIdentity(track.artist) === compactTrackIdentity(expectedArtist)) score += 30;
  else if (expectedArtists.some((artist) => returnedArtists.includes(artist))) score += 18;
  if (track.fileName && streamIdentityMatches(track.fileName, cleanExpectedName, expectedArtist)) score += 12;
  return score;
}

function uniqueStreamIdVariants(albumId, albumAudioId) {
  const variants = [
    { albumId, albumAudioId },
    { albumId, albumAudioId: 0 },
    { albumId: 0, albumAudioId },
    { albumId: 0, albumAudioId: 0 },
  ];
  const seen = new Set();
  return variants.filter((item) => {
    const key = `${item.albumId}:${item.albumAudioId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function encryptDevicePayload(data) {
  const key = randomString(6);
  const digest = md5(key);
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from(digest.slice(0, 16), 'utf8'),
    Buffer.from(digest.slice(16, 32), 'utf8'),
  );
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return { key, data: encrypted.toString('base64') };
}

function decryptDevicePayload(buffer, key) {
  const digest = md5(key);
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    Buffer.from(digest.slice(0, 16), 'utf8'),
    Buffer.from(digest.slice(16, 32), 'utf8'),
  );
  const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

function signatureWeb(params) {
  const salt = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
  const serialized = Object.keys(params)
    .map((key) => `${key}=${params[key]}`)
    .sort()
    .join('');
  return md5(`${salt}${serialized}${salt}`);
}

function signatureAndroid(params, dataText) {
  const salt = 'OIlwieks28dk2k092lksi2UIkp';
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]}`)
    .join('');
  return md5(`${salt}${serialized}${dataText || ''}${salt}`);
}

function firstValue(source, keys, fallback = '') {
  if (!source || typeof source !== 'object') return fallback;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return fallback;
}

function imageUrl(value, size = 240) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.replace(/\{size\}/g, String(size)).replace(/^http:\/\//i, 'https://');
}

function cleanTrackText(value) {
  return String(value || '')
    .replace(/<\/?em\b[^>]*>/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function apiError(body, fallback) {
  const code = firstValue(body, ['error_code', 'errcode', 'code'], 'KUGOU_REQUEST_FAILED');
  const message = firstValue(body, ['error_msg', 'errmsg', 'msg', 'message'], fallback || `KUGOU_API_${code}`);
  const error = new Error(typeof message === 'string' ? message : fallback || 'KUGOU_REQUEST_FAILED');
  error.code = String(code);
  return error;
}

function normalizePlaylist(raw, userId) {
  if (!raw || typeof raw !== 'object') return null;
  const globalId = String(firstValue(raw, [
    'global_collection_id',
    'list_create_gid',
    'parent_global_collection_id',
    'collection_id',
  ], '') || '');
  const listId = String(firstValue(raw, ['listid', 'list_id', 'list_create_listid', 'specialid'], '') || '');
  const id = globalId || listId;
  const name = String(firstValue(raw, ['name', 'listname', 'specialname', 'title'], '') || '').trim();
  if (!id || !name) return null;
  const ownerId = String(firstValue(raw, ['list_create_userid', 'userid', 'user_id'], '') || '');
  const mine = Number(raw.is_mine) === 1 || (!!ownerId && ownerId === String(userId || ''));
  const count = Number(firstValue(raw, ['count', 'song_count', 'songs_count', 'track_count', 'total'], 0)) || 0;
  return {
    id,
    globalId,
    listId,
    name,
    cover: imageUrl(firstValue(raw, ['pic', 'imgurl', 'cover', 'image'], '')),
    trackCount: count,
    creator: String(firstValue(raw, ['list_create_username', 'username', 'nickname', 'creator'], mine ? '我的酷狗账号' : '酷狗音乐') || ''),
    subscribed: !mine,
  };
}

function collectPlaylistCandidates(value, userId, output, depth = 0) {
  if (depth > 5 || value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectPlaylistCandidates(item, userId, output, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;
  const playlist = normalizePlaylist(value, userId);
  if (playlist) output.push(playlist);
  Object.keys(value).forEach((key) => {
    const child = value[key];
    if (child && typeof child === 'object') collectPlaylistCandidates(child, userId, output, depth + 1);
  });
}

function normalizeTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let artist = '';
  const singerRows = Array.isArray(raw.singerinfo) ? raw.singerinfo : (Array.isArray(raw.Singers) ? raw.Singers : []);
  if (singerRows.length) {
    artist = singerRows
      .map((item) => firstValue(item, ['name', 'Name', 'singername', 'SingerName'], ''))
      .filter(Boolean)
      .join(' / ');
  }
  artist = cleanTrackText(artist || firstValue(raw, [
    'author_name', 'singername', 'singer_name', 'artist', 'singer', 'SingerName',
  ], ''));
  let name = cleanTrackText(firstValue(raw, [
    'name', 'songname', 'audio_name', 'OriSongName', 'SongName', 'AudioName', 'filename', 'FileName',
  ], ''));
  name = stripArtistPrefixFromTitle(name, artist);
  if (!artist && name.includes(' - ')) {
    const parts = name.split(' - ');
    artist = parts.shift().trim();
    name = parts.join(' - ').trim();
  }
  if (!name) return null;
  const albumInfo = raw.albuminfo && typeof raw.albuminfo === 'object'
    ? raw.albuminfo
    : (raw.AlbumInfo && typeof raw.AlbumInfo === 'object' ? raw.AlbumInfo : {});
  const durationMs = Number(firstValue(raw, ['timelen', 'duration', 'duration_ms', 'Duration'], 0)) || 0;
  return {
    id: String(firstValue(raw, ['audio_id', 'Audioid', 'mixsongid', 'MixSongID', 'fileid', 'hash', 'FileHash'], '') || ''),
    hash: String(firstValue(raw, ['hash', 'FileHash'], '') || ''),
    albumId: String(firstValue(
      raw,
      ['album_id', 'albumid', 'AlbumID'],
      firstValue(albumInfo, ['id', 'album_id', 'AlbumID'], '0'),
    ) || '0'),
    albumAudioId: String(firstValue(raw, ['album_audio_id', 'audio_id', 'Audioid', 'mixsongid', 'MixSongID'], '0') || '0'),
    name,
    artist: artist || '未知歌手',
    album: cleanTrackText(firstValue(albumInfo, ['name', 'Name'], firstValue(raw, ['album_name', 'album', 'AlbumName'], ''))),
    duration: durationMs > 10000 ? Math.round(durationMs / 1000) : durationMs,
    cover: imageUrl(firstValue(
      raw,
      ['cover', 'album_img', 'imgurl', 'Image', 'AlbumImage'],
      firstValue(raw.trans_param, ['union_cover'], ''),
    )),
    fileName: cleanTrackText(firstValue(raw, ['filename', 'FileName'], '')),
    versionText: cleanTrackText(firstValue(raw, ['OtherName', 'Suffix', 'Auxiliary', 'TagContent'], '')),
  };
}

function searchTrackRows(body) {
  const data = body && body.data && typeof body.data === 'object' ? body.data : body;
  const candidates = [
    data && data.info,
    data && data.lists,
    data && data.items,
    data && data.songs,
    body && body.info,
  ];
  for (const rows of candidates) {
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function sessionPublicView(session, persistent = true) {
  if (!session || !session.userid || !session.token) {
    return { ok: true, loggedIn: false, persistent };
  }
  return {
    ok: true,
    loggedIn: true,
    persistent,
    userid: String(session.userid),
    nickname: String(session.nickname || `酷狗用户 ${session.userid}`),
    avatar: imageUrl(session.avatar || '', 180),
  };
}

function createKugouSync(options) {
  const fetchImpl = options && options.fetchImpl;
  const userDataPath = options && options.userDataPath;
  const safeStorage = options && options.safeStorage;
  if (typeof fetchImpl !== 'function') throw new Error('KUGOU_FETCH_UNAVAILABLE');
  if (!userDataPath) throw new Error('KUGOU_USER_DATA_PATH_EMPTY');

  const sessionFile = path.join(userDataPath, 'kugou-session-v1.json');
  const mid = md5(`mineradio-kugou:${path.resolve(userDataPath)}`);
  let cachedSession;
  let pendingLogin = null;

  function encryptionAvailable() {
    try {
      return !!(safeStorage && safeStorage.isEncryptionAvailable());
    } catch (_e) {
      return false;
    }
  }

  function readSession() {
    if (cachedSession !== undefined) return cachedSession;
    cachedSession = null;
    try {
      if (!fs.existsSync(sessionFile) || !encryptionAvailable()) return cachedSession;
      const stored = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      if (!stored || stored.version !== KUGOU_SESSION_VERSION || !stored.data) return cachedSession;
      const decrypted = safeStorage.decryptString(Buffer.from(stored.data, 'base64'));
      const session = JSON.parse(decrypted);
      if (session && session.userid && session.token) cachedSession = session;
    } catch (_e) {
      cachedSession = null;
    }
    return cachedSession;
  }

  function writeSession(session) {
    cachedSession = session && session.userid && session.token ? session : null;
    if (!cachedSession || !encryptionAvailable()) return false;
    const encrypted = safeStorage.encryptString(JSON.stringify(cachedSession));
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({
      version: KUGOU_SESSION_VERSION,
      encrypted: true,
      data: encrypted.toString('base64'),
    }), { encoding: 'utf8', mode: 0o600 });
    return true;
  }

  function clearSession() {
    cachedSession = null;
    pendingLogin = null;
    try {
      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    } catch (_e) {}
  }

  async function request({ baseURL = 'https://gateway.kugou.com', url, method = 'GET', params, data, encryptType = 'android', headers, cookie, responseType, encryptKey, clearDefaultParams = false, notSign = false }) {
    const clienttime = Math.floor(Date.now() / 1000);
    const requestCookie = cookie && typeof cookie === 'object' ? cookie : {};
    const requestDfid = String(requestCookie.dfid || '-');
    const requestMid = String(requestCookie.mid || mid);
    const requestGuid = String(requestCookie.guid || requestCookie.KUGOU_API_GUID || '-');
    const defaults = clearDefaultParams ? {} : {
      dfid: requestDfid,
      mid: requestMid,
      uuid: requestGuid,
      appid: KUGOU_APP_ID,
      clientver: KUGOU_CLIENT_VERSION,
      clienttime,
    };
    if (!clearDefaultParams && requestCookie.token) defaults.token = requestCookie.token;
    if (!clearDefaultParams && requestCookie.userid) defaults.userid = requestCookie.userid;
    const query = Object.assign({}, defaults, params || {});
    const dataText = data && typeof data === 'object' ? JSON.stringify(data) : String(data || '');
    if (encryptKey) {
      query.key = md5(`${String(query.hash || '')}${KUGOU_STREAM_KEY_SALT}${query.appid}${query.mid}${query.userid || 0}`);
    }
    if (!notSign) query.signature = encryptType === 'web' ? signatureWeb(query) : signatureAndroid(query, dataText);
    const target = new URL(url, baseURL);
    Object.keys(query).forEach((key) => {
      if (query[key] !== undefined && query[key] !== null) target.searchParams.set(key, String(query[key]));
    });
    const response = await fetchImpl(target.toString(), {
      method,
      headers: Object.assign({
        'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
        'Content-Type': 'application/json',
        dfid: requestDfid,
        mid: requestMid,
        clienttime: String(clienttime),
        'kg-rc': '1',
        'kg-thash': '5d816a0',
        'kg-rec': '1',
        'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
      }, headers || {}),
      body: method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD' ? undefined : dataText,
    });
    if (responseType === 'arrayBuffer') {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!response.ok) throw new Error(`KUGOU_HTTP_${response.status}`);
      return buffer;
    }
    if (responseType === 'text') {
      const text = await response.text();
      if (!response.ok) throw new Error(`KUGOU_HTTP_${response.status}`);
      return text;
    }
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (_e) {
      throw new Error('KUGOU_RESPONSE_INVALID');
    }
    if (!response.ok || Number(body.status) === 0 || (body.error_code !== undefined && Number(body.error_code) !== 0)) {
      const error = apiError(body, `KUGOU_HTTP_${response.status}`);
      if (KUGOU_AUTH_ERROR_CODES.has(String(error.code))) clearSession();
      throw error;
    }
    return body;
  }

  async function ensureRegisteredDevice(session) {
    if (!session) throw new Error('KUGOU_NOT_LOGGED_IN');
    if (!session.guid) session.guid = stableGuid(path.resolve(userDataPath));
    if (session.dfid && session.dfid !== '-') {
      writeSession(session);
      return session;
    }
    const devicePayload = {
      availableRamSize: 4983533568,
      availableRomSize: 48114719,
      availableSDSize: 48114717,
      basebandVer: '',
      batteryLevel: 100,
      batteryStatus: 3,
      brand: 'Redmi',
      buildSerial: 'unknown',
      device: 'marble',
      imei: session.guid,
      imsi: '',
      manufacturer: 'Xiaomi',
      uuid: session.guid,
      accelerometer: false,
      accelerometerValue: '',
      gravity: false,
      gravityValue: '',
      gyroscope: false,
      gyroscopeValue: '',
      light: false,
      lightValue: '',
      magnetic: false,
      magneticValue: '',
      orientation: false,
      orientationValue: '',
      pressure: false,
      pressureValue: '',
      step_counter: false,
      step_counterValue: '',
      temperature: false,
      temperatureValue: '',
    };
    const encrypted = encryptDevicePayload(devicePayload);
    const encryptedSession = crypto.publicEncrypt({
      key: KUGOU_DEVICE_PUBLIC_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, Buffer.from(JSON.stringify({ aes: encrypted.key, uid: session.userid, token: session.token }), 'utf8')).toString('hex');
    const responseBuffer = await request({
      baseURL: 'https://userservice.kugou.com',
      url: '/risk/v2/r_register_dev',
      method: 'POST',
      params: { part: 1, platid: 1, p: encryptedSession },
      data: encrypted.data,
      cookie: session,
      responseType: 'arrayBuffer',
    });
    const body = decryptDevicePayload(responseBuffer, encrypted.key);
    const dfid = String(body && body.data && body.data.dfid || '');
    if (Number(body && body.status) !== 1 || !dfid) throw apiError(body, 'KUGOU_DEVICE_REGISTER_FAILED');
    session.dfid = dfid;
    session.updatedAt = Date.now();
    writeSession(session);
    return session;
  }

  async function findSearchFallbackTracks(expectedName, expectedArtist) {
    const cleanName = stripArtistPrefixFromTitle(expectedName, expectedArtist);
    if (!trackTitleBase(cleanName)) return [];
    const firstArtist = String(expectedArtist || '')
      .split(/\s*(?:\/|、|,|，|&|＆|;|；|\+|\bx\b|\bfeat\.?\b|\bft\.?\b)\s*/i)
      .map((value) => value.trim())
      .find(Boolean) || '';
    const queries = [];
    const combined = `${cleanName} ${firstArtist}`.trim();
    if (combined) queries.push(combined);
    if (cleanName && cleanName !== combined) queries.push(cleanName);
    const candidates = new Map();
    for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
      const result = await searchTracks({ query: queries[queryIndex], page: 1, pageSize: 30 });
      const tracks = Array.isArray(result && result.tracks) ? result.tracks : [];
      tracks.forEach((candidate) => {
        const score = searchTrackIdentityScore(candidate, cleanName, expectedArtist);
        if (score < 0) return;
        const key = String(candidate.hash || '').toLowerCase();
        const previous = candidates.get(key);
        if (!previous || score > previous.score) candidates.set(key, { track: candidate, score });
      });
      if (candidates.size >= 3) break;
    }
    return Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.track);
  }

  async function getStreamUrl(track, internalOptions) {
    internalOptions = internalOptions || {};
    let session = readSession();
    if (!session) return { ok: false, loggedIn: false, error: 'KUGOU_NOT_LOGGED_IN' };
    const hash = String(track && track.hash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(hash)) return { ok: false, error: 'KUGOU_TRACK_HASH_INVALID' };
    session = await ensureRegisteredDevice(session);
    const albumId = Number(track && track.albumId) || 0;
    const albumAudioId = Number(track && track.albumAudioId) || 0;
    const expectedName = String(track && track.name || '').trim();
    const expectedArtist = String(track && track.artist || '').trim();
    const requestedLevel = normalizeStreamLevel(track && track.quality);
    const qualityCandidates = KUGOU_STREAM_LEVELS[requestedLevel];
    const idVariants = uniqueStreamIdVariants(albumId, albumAudioId);
    let lastError = null;
    let identityMismatchError = null;
    for (let qualityIndex = 0; qualityIndex < qualityCandidates.length; qualityIndex += 1) {
      const qualityCandidate = qualityCandidates[qualityIndex];
      for (let variantIndex = 0; variantIndex < idVariants.length; variantIndex += 1) {
        const idVariant = idVariants[variantIndex];
        try {
          const body = await request({
            url: '/v5/url',
            params: {
              album_id: idVariant.albumId,
              area_code: 1,
              hash,
              ssa_flag: 'is_fromtrack',
              version: 11430,
              page_id: 151369488,
              quality: qualityCandidate.request,
              album_audio_id: idVariant.albumAudioId,
              behavior: 'play',
              pid: 2,
              cmd: 26,
              pidversion: 3001,
              IsFreePart: 0,
              ppage_id: '463467626,350369493,788954147',
              cdnBackup: 1,
              module: '',
              clientver: 11430,
            },
            headers: { 'x-router': 'trackercdn.kugou.com' },
            cookie: session,
            encryptKey: true,
          });
          const candidates = []
            .concat(Array.isArray(body && body.url) ? body.url : [])
            .concat(Array.isArray(body && body.backupUrl) ? body.backupUrl : [])
            .filter((value) => /^https?:\/\//i.test(String(value || '')));
          const format = String(body && body.extName || '').replace(/^\./, '').toLowerCase();
          const fileName = String(body && body.fileName || '').trim();
          if (candidates.length && KUGOU_BROWSER_AUDIO_FORMATS.has(format)) {
            if (!streamIdentityMatches(fileName, expectedName, expectedArtist)) {
              const mismatchError = new Error('KUGOU_STREAM_IDENTITY_MISMATCH');
              mismatchError.code = 'KUGOU_STREAM_IDENTITY_MISMATCH';
              mismatchError.actualFileName = fileName.slice(0, 300);
              identityMismatchError = mismatchError;
              lastError = mismatchError;
              continue;
            }
            return {
              ok: true,
              loggedIn: true,
              url: String(candidates[0]),
              requestedLevel,
              resolvedLevel: qualityCandidate.resolved,
              qualityLabel: qualityCandidate.label,
              downgraded: requestedLevel !== 'auto' && qualityIndex > 0,
              bitRate: Number(body.bitRate) || qualityCandidate.fallbackBitRate,
              duration: Number(body.timeLength) || 0,
              format,
              fileName,
              identityVerified: !!expectedName,
            };
          }
          lastError = new Error(candidates.length ? 'KUGOU_STREAM_FORMAT_UNSUPPORTED' : 'KUGOU_STREAM_URL_EMPTY');
        } catch (error) {
          lastError = error;
        }
      }
    }
    if (!internalOptions.skipSearchFallback && expectedName) {
      try {
        const fallbackTracks = await findSearchFallbackTracks(expectedName, expectedArtist);
        for (let fallbackIndex = 0; fallbackIndex < fallbackTracks.length; fallbackIndex += 1) {
          const fallbackTrack = fallbackTracks[fallbackIndex];
          const sameHash = String(fallbackTrack.hash || '').toLowerCase() === hash;
          const sameIds = Number(fallbackTrack.albumId) === albumId
            && Number(fallbackTrack.albumAudioId) === albumAudioId;
          if (sameHash && sameIds) continue;
          try {
            const fallbackResult = await getStreamUrl({
              ...fallbackTrack,
              name: expectedName,
              artist: expectedArtist || fallbackTrack.artist,
              quality: requestedLevel,
            }, { skipSearchFallback: true });
            return {
              ...fallbackResult,
              matchedBySearch: true,
              matchedTrack: {
                hash: fallbackTrack.hash,
                albumId: fallbackTrack.albumId,
                albumAudioId: fallbackTrack.albumAudioId,
              },
            };
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }
      } catch (searchError) {
        if (!lastError) lastError = searchError;
      }
    }
    throw identityMismatchError || lastError || new Error('KUGOU_STREAM_URL_EMPTY');
  }

  async function searchTracks(input) {
    let session = readSession();
    if (!session) return { ok: false, loggedIn: false, error: 'KUGOU_NOT_LOGGED_IN', tracks: [] };
    const keyword = String(input && (input.query || input.keyword) || '').trim().slice(0, 120);
    if (!keyword) return { ok: true, loggedIn: true, tracks: [], total: 0 };
    const page = Math.max(1, Math.min(20, Number(input && input.page) || 1));
    const pageSize = Math.max(1, Math.min(30, Number(input && input.pageSize) || 20));
    session = await ensureRegisteredDevice(session);
    const body = await request({
      url: '/v3/search/song',
      params: {
        albumhide: 0,
        iscorrection: 1,
        keyword,
        nocollect: 0,
        page,
        pagesize: pageSize,
        platform: 'AndroidFilter',
      },
      headers: { 'x-router': 'complexsearch.kugou.com' },
      cookie: session,
    });
    const rows = searchTrackRows(body);
    const tracks = [];
    const seen = new Set();
    for (const row of rows) {
      const track = normalizeTrack(row);
      if (!track || !/^[a-f0-9]{32}$/i.test(track.hash)) continue;
      const key = String(track.hash).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push(track);
    }
    const data = body && body.data && typeof body.data === 'object' ? body.data : {};
    const total = Number(firstValue(data, ['total', 'total_count', 'count'], tracks.length)) || tracks.length;
    return { ok: true, loggedIn: true, tracks, total, page, pageSize };
  }

  async function getLyrics(track) {
    let session = readSession();
    if (!session) return { ok: false, loggedIn: false, error: 'KUGOU_NOT_LOGGED_IN', lyric: '' };
    const hash = String(track && track.hash || '').trim().toUpperCase();
    const albumAudioId = Math.max(0, Number(track && track.albumAudioId) || 0);
    const duration = Math.max(0, Math.round(Number(track && track.duration) || 0));
    const name = String(track && track.name || '').trim().slice(0, 300);
    const artist = String(track && track.artist || '').trim().slice(0, 300);
    if (!hash && !albumAudioId && !name) return { ok: false, loggedIn: true, error: 'KUGOU_LYRIC_ID_EMPTY', lyric: '' };
    session = await ensureRegisteredDevice(session);
    const getLegacyLyrics = async () => {
      if (!hash) return '';
      const text = await request({
        baseURL: 'https://m.kugou.com',
        url: '/app/i/krc.php',
        params: {
          cmd: 100,
          hash,
          timelength: duration > 0 ? duration * 1000 : 0,
        },
        headers: {
          Referer: 'https://www.kugou.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mineradio/1.0',
        },
        responseType: 'text',
        clearDefaultParams: true,
        notSign: true,
      });
      return String(text || '').replace(/^\uFEFF/, '').trim();
    };
    let searchBody;
    try {
      searchBody = await request({
        baseURL: 'https://lyrics.kugou.com',
        url: '/v1/search',
        params: {
          album_audio_id: albumAudioId,
          appid: KUGOU_APP_ID,
          clientver: KUGOU_CLIENT_VERSION,
          duration,
          hash,
          keyword: [name, artist].filter(Boolean).join(' - '),
          lrctxt: 1,
          man: 'no',
        },
        headers: {
          Referer: 'https://www.kugou.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mineradio/1.0',
        },
        cookie: session,
        clearDefaultParams: true,
        notSign: true,
      });
    } catch (searchError) {
      const lyric = await getLegacyLyrics().catch(() => '');
      if (lyric) {
        return {
          ok: true,
          loggedIn: true,
          lyric,
          source: 'kugou-lrc',
          candidate: { id: '', hash, duration },
        };
      }
      throw searchError;
    }
    const candidates = Array.isArray(searchBody && searchBody.candidates)
      ? searchBody.candidates
      : (Array.isArray(searchBody && searchBody.data && searchBody.data.candidates) ? searchBody.data.candidates : []);
    if (!candidates.length) {
      const lyric = await getLegacyLyrics().catch(() => '');
      return lyric
        ? { ok: true, loggedIn: true, lyric, source: 'kugou-lrc', candidate: { id: '', hash, duration } }
        : { ok: true, loggedIn: true, lyric: '', error: 'KUGOU_LYRIC_NOT_FOUND' };
    }
    const exactHash = hash && candidates.find((item) => String(firstValue(item, ['hash', 'filehash'], '')).trim().toUpperCase() === hash);
    const exactAudio = albumAudioId && candidates.find((item) => Number(firstValue(item, ['album_audio_id', 'audio_id'], 0)) === albumAudioId);
    const candidate = exactHash || exactAudio || candidates[0];
    const id = String(firstValue(candidate, ['id', 'lyric_id'], '') || '').trim();
    const accesskey = String(firstValue(candidate, ['accesskey', 'access_key'], '') || '').trim();
    if (!id || !accesskey) return { ok: true, loggedIn: true, lyric: '', error: 'KUGOU_LYRIC_ACCESS_EMPTY' };
    const downloadParams = {
      ver: 1,
      client: 'android',
      id,
      accesskey,
      fmt: 'lrc',
      charset: 'utf8',
    };
    let downloadBody;
    try {
      downloadBody = await request({
        baseURL: 'https://lyrics.kugou.com',
        url: '/download',
        params: downloadParams,
        cookie: session,
      });
    } catch (signedError) {
      try {
        downloadBody = await request({
          baseURL: 'https://lyrics.kugou.com',
          url: '/download',
          params: Object.assign({}, downloadParams, { client: 'pc' }),
          headers: {
            Referer: 'https://www.kugou.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mineradio/1.0',
          },
          clearDefaultParams: true,
          notSign: true,
        });
      } catch (_unsignedError) {
        throw signedError;
      }
    }
    if (!downloadBody || !downloadBody.content) {
      downloadBody = await request({
        baseURL: 'https://lyrics.kugou.com',
        url: '/download',
        params: Object.assign({}, downloadParams, { client: 'pc' }),
        headers: {
          Referer: 'https://www.kugou.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Mineradio/1.0',
        },
        clearDefaultParams: true,
        notSign: true,
      });
    }
    let lyric = '';
    try {
      lyric = Buffer.from(String(downloadBody && downloadBody.content || ''), 'base64').toString('utf8').replace(/^\uFEFF/, '').trim();
    } catch (_error) {
      lyric = '';
    }
    return {
      ok: true,
      loggedIn: true,
      lyric,
      source: lyric ? 'kugou-lrc' : 'none',
      candidate: {
        id,
        hash: String(firstValue(candidate, ['hash', 'filehash'], hash) || hash),
        duration: Number(firstValue(candidate, ['duration'], duration)) || duration,
      },
    };
  }

  async function startLogin() {
    const body = await request({
      baseURL: 'https://login-user.kugou.com',
      url: '/v2/qrcode',
      params: {
        appid: KUGOU_WEB_APP_ID,
        type: 1,
        plat: 4,
        qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KUGOU_APP_ID}&`,
        srcappid: KUGOU_SOURCE_APP_ID,
      },
      encryptType: 'web',
    });
    const data = body && body.data || {};
    const key = String(data.qrcode || '');
    if (!key) throw new Error('KUGOU_QR_KEY_EMPTY');
    pendingLogin = { key, createdAt: Date.now() };
    return {
      ok: true,
      image: String(data.qrcode_img || ''),
      loginUrl: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
      expiresIn: Math.round(KUGOU_LOGIN_MAX_AGE_MS / 1000),
    };
  }

  async function checkLogin() {
    if (!pendingLogin) return { ok: false, status: 'missing', message: '请先刷新登录二维码' };
    if (Date.now() - pendingLogin.createdAt > KUGOU_LOGIN_MAX_AGE_MS) {
      pendingLogin = null;
      return { ok: true, status: 'expired', message: '二维码已过期，请刷新' };
    }
    const body = await request({
      baseURL: 'https://login-user.kugou.com',
      url: '/v2/get_userinfo_qrcode',
      params: {
        plat: 4,
        appid: KUGOU_APP_ID,
        srcappid: KUGOU_SOURCE_APP_ID,
        qrcode: pendingLogin.key,
      },
      encryptType: 'web',
    });
    const data = body && body.data || {};
    const status = Number(data.status);
    if (status === 0) {
      pendingLogin = null;
      return { ok: true, status: 'expired', message: '二维码已过期，请刷新' };
    }
    if (status === 1) return { ok: true, status: 'waiting', message: '请使用酷狗音乐 App 扫码' };
    if (status === 2) return { ok: true, status: 'confirming', message: '已扫码，请在手机上确认登录' };
    if (status !== 4) return { ok: true, status: 'waiting', message: '等待酷狗确认登录' };
    const token = String(data.token || '');
    const userid = String(data.userid || '');
    if (!token || !userid) throw new Error('KUGOU_LOGIN_SESSION_EMPTY');
    const session = {
      token,
      userid,
      nickname: String(firstValue(data, ['nickname', 'username', 'user_name', 'nick_name'], '') || ''),
      avatar: imageUrl(firstValue(data, ['pic', 'avatar', 'user_pic'], ''), 180),
      updatedAt: Date.now(),
    };
    const persistent = writeSession(session);
    pendingLogin = null;
    return Object.assign({ status: 'authorized', message: '酷狗登录成功' }, sessionPublicView(session, persistent));
  }

  async function getPlaylists() {
    const session = readSession();
    if (!session) return { ok: false, loggedIn: false, error: 'KUGOU_NOT_LOGGED_IN' };
    const pageSize = 100;
    const collected = [];
    let total = 0;
    for (let page = 1; page <= KUGOU_MAX_PLAYLIST_PAGES; page += 1) {
      const body = await request({
        url: '/v7/get_all_list',
        method: 'POST',
        params: { plat: 1, userid: Number(session.userid), token: session.token },
        data: {
          userid: Number(session.userid),
          token: session.token,
          total_ver: 979,
          type: 2,
          page,
          pagesize: pageSize,
        },
        headers: { 'x-router': 'cloudlist.service.kugou.com' },
      });
      const data = body && body.data || {};
      total = Math.max(total, Number(firstValue(data, ['total', 'count', 'total_count'], 0)) || 0);
      const pageItems = [];
      collectPlaylistCandidates(data, session.userid, pageItems);
      collected.push(...pageItems);
      if (!pageItems.length || pageItems.length < pageSize || (total && collected.length >= total)) break;
    }
    const seen = new Set();
    const playlists = collected.filter((playlist) => {
      const key = `${playlist.globalId || ''}:${playlist.listId || ''}:${playlist.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ok: true, loggedIn: true, playlists, total: total || playlists.length, syncedAt: Date.now() };
  }

  async function getPlaylistTracks(playlist) {
    const session = readSession();
    if (!session) return { ok: false, loggedIn: false, error: 'KUGOU_NOT_LOGGED_IN' };
    const globalId = String(playlist && (playlist.globalId || playlist.id) || '');
    const listId = String(playlist && playlist.listId || '');
    if (!globalId && !listId) return { ok: false, error: 'KUGOU_PLAYLIST_ID_EMPTY' };
    const pageSize = 100;
    const tracks = [];
    let total = 0;
    for (let page = 1; page <= KUGOU_MAX_TRACK_PAGES; page += 1) {
      let body;
      if (globalId && globalId.includes('collection_')) {
        body = await request({
          url: '/pubsongs/v2/get_other_list_file_nofilt',
          params: {
            area_code: 1,
            begin_idx: (page - 1) * pageSize,
            plat: 1,
            type: 1,
            mode: 1,
            personal_switch: 1,
            extend_fields: 'abtags,hot_cmt,popularization',
            pagesize: pageSize,
            global_collection_id: globalId,
            token: session.token,
            userid: Number(session.userid),
          },
        });
      } else {
        body = await request({
          url: '/v4/get_list_all_file',
          method: 'POST',
          data: {
            listid: listId || globalId,
            userid: Number(session.userid),
            area_code: 1,
            show_relate_goods: 0,
            pagesize: pageSize,
            allplatform: 1,
            show_cover: 1,
            type: 0,
            token: session.token,
            page,
          },
          headers: { 'x-router': 'cloudlist.service.kugou.com' },
        });
      }
      const data = body && body.data || {};
      const rows = Array.isArray(data.songs) ? data.songs
        : Array.isArray(data.info) ? data.info
          : Array.isArray(data.list) ? data.list
            : [];
      total = Math.max(total, Number(firstValue(data, ['count', 'total', 'total_count'], 0)) || 0);
      rows.forEach((row) => {
        const track = normalizeTrack(row);
        if (track) tracks.push(track);
      });
      if (!rows.length || rows.length < pageSize || (total && tracks.length >= total)) break;
    }
    const seen = new Set();
    const deduped = tracks.filter((track) => {
      const key = track.hash || `${track.name}\n${track.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ok: true, loggedIn: true, tracks: deduped, total: total || deduped.length };
  }

  return {
    getStatus: async () => sessionPublicView(readSession(), encryptionAvailable()),
    startLogin,
    checkLogin,
    getPlaylists,
    getPlaylistTracks,
    searchTracks,
    getStreamUrl,
    getLyrics,
    logout: async () => {
      clearSession();
      return { ok: true, loggedIn: false };
    },
  };
}

module.exports = {
  createKugouSync,
  __test: Object.freeze({
    searchTrackIdentityScore,
    streamIdentityMatches,
    stripArtistPrefixFromTitle,
    trackTitleBase,
    trackVersionSignalsMatch,
  }),
};
