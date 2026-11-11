'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Android's real Java bridge is also exercised by verify-android.py on an emulator.
const native = fs.readFileSync(path.join(__dirname, '../public/mobile-native.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

/** Create the production range reader around a bounded native transport. */
function reader(bytes) {
  const requests = [];
  const context = {
    plugin: { async readRange(request) {
      requests.push(request);
      const part = bytes.subarray(request.start, Math.min(request.end, bytes.length));
      const base64Chunks = [];
      for (let i = 0; i < part.length; i += 32768) base64Chunks.push(part.subarray(i, i + 32768).toString('base64'));
      return { ok: true, byteLength: part.length, base64Chunks };
    } },
  };
  const start = native.indexOf('  var NATIVE_READER_VERSION =');
  const end = native.indexOf('  window.MineradioNativeLibraryApi =', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(native.slice(start, end), context);
  return { context, requests, read: context.readNativeFileRange };
}

/** Decode each returned bridge chunk independently, matching the real wire format. */
function decode(result) {
  return Buffer.concat(Array.from(result.base64Chunks, value => Buffer.from(value, 'base64')));
}

test('native range reading preserves nonzero offsets and exact lengths', async () => {
  const bytes = Buffer.from('RIFF0000WAVElyrics');
  const transport = reader(bytes);
  const result = await transport.read('content://music/1', 8, 12);
  assert.equal(result.byteLength, 4);
  assert.equal(decode(result).toString(), 'WAVE');
  assert.deepEqual(transport.requests.map(item => [item.start, item.end]), [[8, 12]]);
});

test('native metadata ranges larger than 8 MiB arrive complete in bounded messages', async () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024 + 71, 0x4a);
  bytes.write('lyrics after artwork', bytes.length - 20);
  const transport = reader(bytes);
  const result = await transport.read('content://music/2', 17, bytes.length);
  assert.deepEqual(decode(result), bytes.subarray(17));
  assert.equal(result.byteLength, bytes.length - 17);
  assert.ok(transport.requests.length > 8);
  assert.ok(transport.requests.every(item => item.end - item.start <= 1024 * 1024));
});

test('native reads without a known file size stop at EOF and retain the tail', async () => {
  const bytes = Buffer.alloc(1024 * 1024 + 19, 0x53);
  const transport = reader(bytes);
  assert.deepEqual(decode(await transport.read('content://music/3', 0, null)), bytes);
  assert.equal(transport.requests.length, 2);
});

test('native read failures remain failures rather than cached successful empty reads', async () => {
  const transport = reader(Buffer.alloc(0));
  transport.context.plugin.readRange = async () => ({ ok: false });
  await assert.rejects(transport.read('content://music/4', 0, 10), /NATIVE_FILE_RANGE_FAILED/);
});

/** Extract one production function, including any nested callbacks. */
function functionSource(name) {
  const start = app.indexOf('function ' + name + '(');
  const closing = app.indexOf('\n}', start);
  const end = closing + 2;
  assert.ok(start >= 0 && closing > start, name);
  return app.slice(start, end);
}

/** Execute cache application with real signatures and minimal rendering dependencies. */
function cacheContext() {
  const context = {
    localLibraryPathKeyFromFile: file => file.fullPath,
    localLibraryPathKeyFromSong: song => song.localFile.fullPath,
    localFileSize: file => Number(file.size) || 0,
    localFileLastModified: file => Number(file.lastModified) || 0,
    localAssetFileSignature: () => '',
    canUseCachedLocalMetadata: () => false,
    LOCAL_METADATA_TEXT_FIELDS: [],
    LOCAL_METADATA_VALUE_FIELDS: [],
    syncLocalSongAssetFields() {},
    invalidateSongCoverCache() {},
  };
  vm.runInNewContext(functionSource('localLibraryFileSignatureFromFile')
    + functionSource('localLibraryFileSignatureFromSong')
    + functionSource('localLibraryRecordFileSignature')
    + functionSource('localLibraryRecordMatchesSong')
    + functionSource('applyLocalLibraryIndexToSong')
    + functionSource('applyLocalAssetCacheToSong'), context);
  return context;
}

test('Android reader upgrades reject old negative caches while preserving song identity', () => {
  const context = cacheContext();
  const file = { fullPath: 'content://music/restored', size: 4000, lastModified: 7, nativeReaderVersion: 1 };
  const song = { localKey: 'unchanged-key', localFile: file };
  const oldSignature = 'content://music/restored|4000|7';
  const oldCache = { id: song.localKey, localLibraryFileSignature: oldSignature, localLyricLoaded: true };
  assert.equal(context.applyLocalAssetCacheToSong(song, oldCache), false);
  assert.equal(song.localLyricLoaded, undefined);
  assert.equal(song.localKey, 'unchanged-key');
  const signature = context.localLibraryFileSignatureFromFile(file);
  assert.notEqual(signature, oldSignature);
  assert.equal(context.localLibraryFileSignatureFromSong(song), signature);
});

test('Android cache hydration ignores stale lyric records even with fresh metadata', () => {
  const context = cacheContext();
  const song = { localKey: 'same-key', localFile: { fullPath: 'content://music/restored', nativeReaderVersion: 1 } };
  const signature = context.localLibraryFileSignatureFromSong(song);
  const metadata = { id: song.localKey, localLibraryFileSignature: signature };
  const lyrics = { localLibraryFileSignature: 'old-reader', localLyricLoaded: true };
  context.applyLocalAssetCacheToSong(song, metadata, { lyricRecord: lyrics });
  assert.equal(song.localLyricLoaded, undefined);
  lyrics.localLibraryFileSignature = signature;
  lyrics.localLyricText = '[00:00.00]Recovered embedded lyrics';
  context.applyLocalAssetCacheToSong(song, metadata, { lyricRecord: lyrics });
  assert.equal(song.localLyricLoaded, true);
  assert.equal(song.localLyricText, lyrics.localLyricText);
});

test('Android upgrades reject stale negative library indexes even with the same song key', () => {
  const context = cacheContext();
  const file = { fullPath: 'content://music/indexed', size: 4000, lastModified: 7, nativeReaderVersion: 1 };
  const song = { localKey: 'stable-key', localFile: file };
  const index = { key: song.localKey, fileSignature: 'content://music/indexed|4000|7', lyricStatus: 'none', coverStatus: 'none' };
  assert.equal(context.localLibraryRecordMatchesSong(index, song), false);
  assert.equal(context.applyLocalLibraryIndexToSong(song, index), false);
  assert.equal(song.localLyricLoaded, undefined);
  assert.equal(song.localCoverLoaded, undefined);
  assert.equal(song.localKey, 'stable-key');
  index.fileSignature = context.localLibraryFileSignatureFromSong(song);
  assert.equal(context.localLibraryRecordMatchesSong(index, song), true);
  assert.equal(context.applyLocalLibraryIndexToSong(song, index), true);
  assert.equal(song.localLyricLoaded, true);
});
