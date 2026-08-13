'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function readMetadataApplySource() {
  const start = source.indexOf('function isLocalSourcePlaceholderMetadata(');
  const end = source.indexOf('/**\n * 按需解析单曲本地标签', start);
  assert.ok(start >= 0 && end > start, '未找到本地元数据来源占位过滤逻辑');
  return source.slice(start, end);
}

function readMetadataApplySource() {
  const helperStart = source.indexOf('function isLocalSourcePlaceholderMetadata(');
  const applyStart = source.indexOf('function applyLocalMetadataTags(');
  const applyEnd = source.indexOf('function refreshLocalMetadataUi(', applyStart);
  assert.ok(helperStart >= 0 && applyStart > helperStart && applyEnd > applyStart, '未找到本地元数据来源占位过滤逻辑');
  return source.slice(helperStart, applyStart) + source.slice(applyStart, applyEnd);
}

test('FLAC 下载来源占位标签不会覆盖文件名歌曲信息', () => {
  const context = {
    String,
    updateLocalAudioQualityInfo() {},
  };
  vm.runInNewContext(readMetadataApplySource() + '\nthis.applyTags = applyLocalMetadataTags;', context);

  const song = {
    type: 'local',
    name: '歌手 - 真正的歌曲',
    artist: '歌手',
    album: '',
    albumArtist: '',
    trackNumber: '',
    year: '',
  };
  context.applyTags(song, {
    title: 'kuwo',
    artist: 'kuwo',
    album: '真实专辑',
  });

  assert.equal(song.name, '歌手 - 真正的歌曲');
  assert.equal(song.artist, '歌手');
  assert.equal(song.album, '真实专辑');
});

test('正常 FLAC 标签仍然覆盖文件名回退信息', () => {
  const context = {
    String,
    updateLocalAudioQualityInfo() {},
  };
  vm.runInNewContext(readMetadataApplySource() + '\nthis.applyTags = applyLocalMetadataTags;', context);

  const song = {
    type: 'local',
    name: 'fallback',
    artist: '',
    album: '',
    albumArtist: '',
    trackNumber: '',
    year: '',
  };
  context.applyTags(song, { title: '真实标题', artist: '真实歌手' });

  assert.equal(song.name, '真实标题');
  assert.equal(song.artist, '真实歌手');
});
