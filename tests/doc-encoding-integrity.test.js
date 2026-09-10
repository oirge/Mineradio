'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// 这些文档是纯文本产物，必须始终是可解码的 UTF-8，并且不能残留 GBK 误解码的乱码。
// 历史事故：一次重写把 RELEASE.md 一大段中文按 GBK 编解码错位，变成「鏈湴璧勪骇」这类
// 乱码；文件在 UTF-8 下仍然合法，`node --check`、回归测试和发布工作流全都看不见，
// 一直活到第 4 个版本之后才被人工发现。这里把它钉成回归。
const SCANNED_FILES = [
  'RELEASE.md',
  'CHANGELOG.md',
  'README.md',
  'README_EN.md',
  'AGENTS.md',
  'NOTICE.md',
  'AI_HANDOFF.md',
  'docs/PROJECT_MEMORY.md',
  'docs/HANDOFF_NEXT_CHAT.md',
];

// 乱码检测原理：真正的乱码是「UTF-8 字节被当成 GBK 解码」。把一行按 GBK 编码回字节、
// 再按 UTF-8 解码，就能还原出原本的中文。反过来，一段正常中文这样变换后得到的几乎全是
// 无法映射的 '?' 或非法序列 U+FFFD，不会凭空长出成片 CJK。判据：还原后 CJK 足够多，
// 且「还原失败」（'?' 与 U+FFFD 合计）占比很低，才认定为乱码。
// 实测：损坏的 RELEASE.md 命中 121 行，修好后的文件与更早的干净版本命中 0 行。
function createDetector() {
  const decoder = new TextDecoder('gbk', { fatal: false });
  const reverseMap = new Map();
  for (let byte = 0; byte < 0x100; byte++) {
    const char = decoder.decode(Uint8Array.of(byte));
    if (char.length === 1 && char !== '\uFFFD') reverseMap.set(char, Uint8Array.of(byte));
  }
  for (let high = 0x81; high <= 0xfe; high++) {
    for (let low = 0x40; low <= 0xfe; low++) {
      if (low === 0x7f) continue;
      const char = decoder.decode(Uint8Array.of(high, low));
      if (char.length === 1 && char !== '\uFFFD' && !reverseMap.has(char)) {
        reverseMap.set(char, Uint8Array.of(high, low));
      }
    }
  }

  function reverse(line) {
    const bytes = [];
    let unmapped = 0;
    for (const char of line) {
      const mapped = reverseMap.get(char);
      if (mapped) bytes.push(...mapped);
      else {
        unmapped++;
        bytes.push(0x3f); // '?'
      }
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes));
    const invalidSequences = (text.match(/\uFFFD/g) || []).length;
    return { text, unrecovered: unmapped + invalidSequences };
  }

  const countCjk = (text) => (text.match(/[\u4e00-\u9fff]/g) || []).length;

  return {
    reverse,
    isMojibake(line) {
      if (!line) return false;
      const result = reverse(line);
      const length = line.length || 1;
      return result.unrecovered / length < 0.15 && countCjk(result.text) >= 6;
    },
  };
}

const detector = createDetector();

function readFileText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath)).toString('utf8');
}

test('文档在 UTF-8 下必须可解码且不含替换字符', () => {
  for (const relativePath of SCANNED_FILES) {
    const text = readFileText(relativePath);
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    assert.equal(replacementCount, 0, `${relativePath} 出现 ${replacementCount} 个 U+FFFD 替换字符，可能不是合法 UTF-8`);
  }
});

test('文档不得残留 GBK 误解码乱码', () => {
  for (const relativePath of SCANNED_FILES) {
    const flagged = [];
    const lines = readFileText(relativePath).split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (detector.isMojibake(lines[index])) flagged.push(`${index + 1}:${lines[index].slice(0, 40)}`);
    }
    assert.equal(flagged.length, 0, `${relativePath} 有 ${flagged.length} 行疑似 GBK 乱码，例如 ${flagged.slice(0, 3).join(' | ')}`);
  }
});

test('乱码检测器能识别真实的 GBK 误解码样本', () => {
  // 用干净中文反推出损坏形态：UTF-8 编码后当 GBK 解码，正是事故里的错位方式。
  // 取偶数个汉字，让 3 字节/字的 UTF-8 正好落成 2 字节/字的 GBK，不引入截断字节。
  const clean = '本地资产与桌面状态内存优化';
  const corrupted = new TextDecoder('gbk', { fatal: false }).decode(new TextEncoder().encode(clean));

  assert.notEqual(corrupted, clean, '样本必须确实被错位');
  assert.equal(detector.isMojibake(corrupted), true, '损坏样本必须被判为乱码');
  assert.match(detector.reverse(corrupted).text, /本地资产与桌面状态/, '反向变换必须能还原出原本中文');
});

test('正常中文不会被误判为乱码', () => {
  const samples = [
    '## v2.0.3 SSA 歌词与发布链路加固',
    '- 本地同名歌词新增 .ssa 支持，与 .ass 共用解析和字幕优先级。',
    '这是一个测试句子。',
    '# 发布流程',
  ];
  for (const sample of samples) {
    assert.equal(detector.isMojibake(sample), false, `正常中文被误判：${sample}`);
  }
});

test('文档不带 BOM', () => {
  for (const relativePath of SCANNED_FILES) {
    const buffer = fs.readFileSync(path.join(ROOT, relativePath));
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    assert.equal(hasBom, false, `${relativePath} 不应带 UTF-8 BOM`);
  }
});
