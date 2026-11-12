'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');

test('DIY 控制栏为完整按钮组预留宽度', () => {
  assert.match(cssSource, /body\.desktop-shell\.diy-mode #bottom-bar,[\s\S]*?width:min\(1240px,calc\(100vw - 72px\)\)/);
  assert.match(cssSource, /@media \(max-width:1280px\) and \(min-width:921px\)\{[\s\S]*?control-cluster\.transport\{gap:8px\}[\s\S]*?control-cluster\.modes\{gap:7px\}/);
  assert.match(cssSource, /@media \(max-width:920px\)\{[\s\S]*?body\.desktop-shell\.diy-mode #bottom-bar,[\s\S]*?width:calc\(100vw - 28px\)/);
});

test('glass textures retain local geometry while the playback bar is transformed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function updateGlassDisplacementMapForElement(');
  const end = source.indexOf('\nfunction updateControlGlassDisplacementMap(', start);
  const sizes = [], attributes = new Map();
  const scope = { controlGlassState: {}, getComputedStyle: () => ({ borderRadius: '50px' }),
    generateControlGlassDisplacementMap: (...size) => { sizes.push(size); return 'synthetic-map'; } };
  vm.runInNewContext(source.slice(start, end), scope);
  const bar = { offsetWidth: 1054, offsetHeight: 102, getBoundingClientRect() { throw new Error('Transformed coordinates must not size the texture'); } };
  const map = { setAttribute: (key, value) => attributes.set(key, value), setAttributeNS() {} };
  scope.updateGlassDisplacementMapForElement(bar, map, 'bar');
  assert.deepEqual(sizes, [[1054, 102, 50]]);
  scope.updateGlassDisplacementMapForElement(bar, map, 'bar');
  assert.equal(sizes.length, 1, 'An animation with unchanged local dimensions keeps the same map');
  bar.offsetWidth = 732;
  scope.updateGlassDisplacementMapForElement(bar, map, 'bar');
  assert.deepEqual(sizes.at(-1), [732, 102, 50]);
  assert.equal(attributes.get('href'), 'synthetic-map');
});
