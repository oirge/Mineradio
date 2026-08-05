'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function loadReleaseNoteHelpers() {
  const start = serverSource.indexOf('function releaseLineEncodingPenalty(');
  const end = serverSource.indexOf('function pickReleaseAsset(', start);
  assert.ok(start >= 0 && end > start, '未找到更新介绍归一化实现');
  const context = { Buffer };
  vm.runInNewContext(
    serverSource.slice(start, end)
      + '\nthis.extractReleaseNotes = extractReleaseNotes;'
      + '\nthis.normalizeReleaseNotes = normalizeReleaseNotes;',
    context,
  );
  return context;
}

function loadManifestNormalizer() {
  const start = serverSource.indexOf('function normalizeVersion(');
  const end = serverSource.indexOf('async function readUpdateManifest(', start);
  assert.ok(start >= 0 && end > start, '未找到更新 manifest 归一化实现');
  const context = {
    APP_VERSION: '1.2.88',
    UPDATE_FALLBACK_NOTES: ['更新检测已就绪'],
    Buffer,
    URL,
    path,
    assetDigestInfo: () => ({ sha256: '', sha512: '' }),
    downloadCandidateInputs: (...values) => values,
    normalizeDigest: value => String(value || ''),
    publicDownloadUrls: values => values,
    uniqueDownloadCandidates: values => Array.isArray(values) ? values.filter(Boolean) : [],
  };
  vm.runInNewContext(
    serverSource.slice(start, end)
      + '\nthis.normalizeManifestUpdateInfo = normalizeManifestUpdateInfo;',
    context,
  );
  return context.normalizeManifestUpdateInfo;
}

test('更新介绍跳过章节标题并在验证段前停止', () => {
  const { extractReleaseNotes } = loadReleaseNoteHelpers();
  const notes = extractReleaseNotes([
    '## 修复内容',
    '',
    '- 修复桌面歌词重启后关闭的问题。',
    '- 修复桌面歌词位置无法恢复的问题。',
    '',
    '## 验证',
    '- 全量测试通过。',
    '',
    '## 下载',
    '- Mineradio-Setup.exe',
  ].join('\n'));

  assert.deepEqual(Array.from(notes), [
    '修复桌面歌词重启后关闭的问题。',
    '修复桌面歌词位置无法恢复的问题。',
  ]);
});

test('更新介绍修复 BOM 和 UTF-8 被按 Latin-1 解码的乱码', () => {
  const { extractReleaseNotes } = loadReleaseNoteHelpers();
  const expected = '修复更新介绍乱码';
  const garbled = Buffer.from(expected, 'utf8').toString('latin1');
  const notes = extractReleaseNotes('\uFEFF## 更新内容\n- ' + garbled);

  assert.deepEqual(Array.from(notes), [expected]);
});

test('更新介绍去除 Markdown 链接、重复项和校验摘要', () => {
  const { normalizeReleaseNotes } = loadReleaseNoteHelpers();
  const notes = normalizeReleaseNotes([
    '重点更新',
    '[修复更新提示](https://example.com/release)',
    '修复更新提示',
    '安装包 SHA256：0123456789abcdef',
    '保持自动更新兼容。',
  ]);

  assert.deepEqual(Array.from(notes), [
    '修复更新提示',
    '保持自动更新兼容。',
  ]);
});

test('manifest 显式 notes 和 summary 复用同一归一化链路', () => {
  const normalizeManifestUpdateInfo = loadManifestNormalizer();
  const expected = '修复更新介绍乱码';
  const garbled = Buffer.from(expected, 'utf8').toString('latin1');
  const result = normalizeManifestUpdateInfo({
    latestVersion: '1.2.90',
    release: {
      summary: '修复内容',
      notes: ['修复内容', garbled, '验证', '不应混入更新介绍'],
    },
  });

  assert.equal(result.release.summary, expected);
  assert.deepEqual(Array.from(result.release.notes), [expected]);
});
