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

test('stable desktop lyrics mode is wired through the renderer payload', () => {
  assert.match(overlay, /body\.stable \.line\.in\{animation:lyr-in-stable/);
  assert.match(overlay, /var stableLock = state\.stable === true/);
  assert.match(overlay, /var floatY = stableLock \? 0/);
  assert.match(overlay, /var bobX = stableLock \? 0/);
  assert.match(renderer, /desktopLyricsStable: false/);
  assert.match(renderer, /payload\.stable = fx\.desktopLyricsStable === true/);
  assert.match(renderer, /parts\[i\+\+\] = payload\.stable \? 1 : 0/);
});

test('desktop lyrics flowing glow is rendered on the overlay canvas', () => {
  assert.match(overlay, /canvas\{position:fixed/);
  assert.match(overlay, /drawAura\(rect, motion\)/);
  assert.match(overlay, /drawHighlightBloom\(rect, progress\)/);
  assert.match(overlay, /drawParticles\(rect, motion, now\)/);
  assert.match(overlay, /body\.highlight \.line\{[\s\S]*var\(--lyric-progress\)/);
});
