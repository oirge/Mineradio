'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const overlay = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'desktop-lyrics.html'),
  'utf8',
);
const renderer = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'index.html'),
  'utf8',
);
const main = fs.readFileSync(
  path.join(__dirname, '..', 'desktop', 'main.js'),
  'utf8',
);

test('stable desktop lyrics mode is wired through the renderer payload', () => {
  assert.match(overlay, /body\.stable \.line\.in\{animation:lyr-in-stable/);
  assert.match(overlay, /var stableLock = state\.stable === true/);
  assert.match(overlay, /var floatY = stableLock \? 0/);
  assert.match(overlay, /var bobX = stableLock \? 0/);
  assert.match(overlay, /id="stableToggleBtn"/);
  assert.match(overlay, /setLyricsStableState/);
  assert.match(overlay, /id="glowDownBtn"/);
  assert.match(overlay, /id="glowUpBtn"/);
  assert.match(overlay, /setLyricsGlowStrength/);
  assert.match(renderer, /desktopLyricsStable: false/);
  assert.match(renderer, /payload\.stable = fx\.desktopLyricsStable === true/);
  assert.match(renderer, /parts\[i\+\+\] = payload\.stable \? 1 : 0/);
  assert.match(renderer, /onDesktopLyricsStableRequest/);
  assert.match(renderer, /showToast\(nextStable \? '桌面歌词已固定' : '桌面歌词浮动已恢复'\)/);
  assert.match(renderer, /onDesktopLyricsGlowStrengthRequest/);
  assert.match(renderer, /showToast\('歌词光效 ' \+ Math\.round\(nextStrength \* 100\) \+ '%'/);
  assert.match(renderer, /desktopLyricsClickThrough'[\s\S]*desktopLyricsStable/);
  assert.match(main, /desktopLyricsBounds/);
  assert.match(main, /writeDesktopShellSettings\(\{[\s\S]*desktopLyricsBounds/);
  assert.match(main, /savedDesktopLyricsBounds\(saved\.desktopLyricsBounds\)/);
  assert.match(main, /mineradio-desktop-lyrics-set-stable-state/);
  assert.match(main, /mineradio-desktop-lyrics-set-glow-strength/);
});

test('desktop lyrics flowing glow is rendered on the overlay canvas', () => {
  assert.match(overlay, /canvas\{position:fixed/);
  assert.match(overlay, /drawAura\(rect, motion\)/);
  assert.match(overlay, /drawGlowText\(rect, motion\)/);
  assert.match(overlay, /drawHighlightBloom\(rect, progress\)/);
  assert.match(overlay, /drawParticles\(rect, motion, now\)/);
  assert.match(overlay, /body\.highlight \.line,body\.flowing \.line/);
  assert.match(overlay, /var\(--lyric-progress\)/);
  assert.match(overlay, /colorWithAlpha\(state\.displayColors\.highlight, \.42\)/);
  assert.match(overlay, /alpha:\.88, stroke/);
});
