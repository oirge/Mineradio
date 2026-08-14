'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

test('DIY 控制栏为完整按钮组预留宽度', () => {
  assert.match(cssSource, /body\.desktop-shell\.diy-mode #bottom-bar,[\s\S]*?width:min\(1240px,calc\(100vw - 72px\)\)/);
  assert.match(cssSource, /@media \(max-width:1280px\) and \(min-width:921px\)\{[\s\S]*?control-cluster\.transport\{gap:8px\}[\s\S]*?control-cluster\.modes\{gap:7px\}/);
  assert.match(cssSource, /@media \(max-width:920px\)\{[\s\S]*?body\.desktop-shell\.diy-mode #bottom-bar,[\s\S]*?width:calc\(100vw - 28px\)/);
});
