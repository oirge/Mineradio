'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('桌面歌词工具栏包含播放控制和符号关闭按钮', () => {
  const html = read('public/desktop-lyrics.html');

  assert.match(html, /id="previousTrackBtn"[^>]*上一首/);
  assert.match(html, /id="playPauseBtn"[^>]*播放/);
  assert.match(html, /id="nextTrackBtn"[^>]*下一首/);
  assert.match(html, /id="closeLyricsBtn"[^>]*>×<\/button>/);
  assert.match(html, /state\.playing === true/);
  assert.match(html, /requestPlaybackCommand\('toggle-play'\)/);
  assert.match(html, /requestPlaybackCommand\('previous'\)/);
  assert.match(html, /requestPlaybackCommand\('next'\)/);
});

test('桌面歌词播放命令经过 preload 和主进程白名单转发', () => {
  const preload = read('desktop/overlay-preload.js');
  const main = read('desktop/main.js');

  assert.match(preload, /playbackCommand:\s*\(action\)\s*=>\s*ipcRenderer\.invoke\('mineradio-desktop-lyrics-playback-command'/);
  assert.match(main, /ipcMain\.handle\('mineradio-desktop-lyrics-playback-command', handleDesktopLyricsPlaybackCommand\)/);
  assert.match(main, /isCurrentDesktopLyricsWindowSender\(event\)/);
  assert.match(main, /\['toggle-play', 'previous', 'next'\]\.includes\(command\)/);
  assert.match(main, /mainWindow\.webContents\.send\('mineradio-mini-player-command', \{ action: command \}\)/);
});
