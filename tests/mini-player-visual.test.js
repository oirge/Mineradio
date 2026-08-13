'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MiniPlayerStateCache } = require('../desktop/mini-player-state-cache');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('标准迷你播放器包含封面胶囊态和悬停展开动画契约', () => {
  const html = read('public/mini-player.html');

  assert.match(html, /id="cover-wrap" role="button" tabindex="0"/);
  assert.match(html, /data-collapsed="true"/);
  assert.match(html, /data-glow="true"/);
  assert.match(html, /--mini-pulse/);
  assert.match(html, /setExpanded\(true\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /coverWrap\.addEventListener\('mouseenter'/);
});

test('极简迷你播放器继续保持无封面结构', () => {
  const html = read('public/mini-player-compact.html');

  assert.doesNotMatch(html, /id="cover-wrap"/);
  assert.doesNotMatch(html, /class="cover"/);
});

test('迷你播放器律动通过低频采样和增量状态同步', () => {
  const renderer = read('public/app.js');
  const main = read('desktop/main.js');

  assert.match(renderer, /miniPlayerPulseTimer/);
  assert.match(renderer, /setTimeout\(runMiniPlayerPulseTimer, 80\)/);
  assert.match(renderer, /Math\.abs\(state\.pulse - pulse\) >= 0\.035/);
  assert.match(renderer, /miniPlayerPulseStrength/);
  assert.match(main, /next\.pulse !== previous\.pulse/);
  assert.match(main, /next\.visualSignature !== previous\.visualSignature/);
});

test('迷你播放器视觉配置会被边界校正并持久化到状态缓存', () => {
  const cache = new MiniPlayerStateCache(true);
  cache.setResident(true);

  assert.equal(cache.apply({
    pulse: 4,
    visual: {
      pulseEnabled: false,
      pulseStrength: 4,
      glowEnabled: false,
      hoverExpand: false,
      radius: 100,
    },
  }), true);

  assert.equal(cache.value.pulse, 1);
  assert.deepEqual(cache.value.visual, {
    pulseEnabled: false,
    pulseStrength: 1.5,
    glowEnabled: false,
    hoverExpand: false,
    radius: 22,
  });
});
