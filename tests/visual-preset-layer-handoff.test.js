'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

function runOpaqueCheck(group, opacity) {
  const source = readRendererSource();
  const fnSource = readSourceBetween(
    source,
    'function isSkullParticleLayerOpaque() {',
    '\nfunction resetSkullPresetView'
  );
  const context = {
    skullParticleGroup: group,
    skullParticleOpacity: opacity,
  };
  vm.createContext(context);
  vm.runInContext(fnSource + '\nglobalThis.result = isSkullParticleLayerOpaque();', context);
  return context.result;
}

test('安魂点云没盖住前不算 opaque，主粒子不能先让位', () => {
  assert.equal(runOpaqueCheck(null, 1), false, '点云还没建出来');
  assert.equal(runOpaqueCheck({ visible: false }, 1), false, '点云还没显示');
  assert.equal(runOpaqueCheck({ visible: true }, 0.98), false, '还差一点没淡满');
  assert.equal(runOpaqueCheck({ visible: true }, 0.99), true, '淡满后才算盖住');
});

test('主循环等安魂点云盖住再收粒子，资产加载失败也不会空窗', () => {
  const source = readRendererSource();
  const animate = readSourceBetween(source, 'function animate() {', "\nresumeMainRenderLoop('startup');");
  assert.match(animate, /var skullLayerOpaque = isSkullParticleLayerOpaque\(\);/);
  assert.match(
    animate,
    /var particleLayersVisible = \(!skullPresetActive \|\| !skullLayerOpaque\) && \(!workshopPresetActive \|\| !workshopLayerOpaque\);/
  );
  assert.match(animate, /particles\.visible = particleLayersVisible;/);
  assert.match(animate, /if \(floatGroup\) floatGroup\.visible = particleLayersVisible;/);
  assert.match(animate, /if \(backCoverGroup\) backCoverGroup\.visible = particleLayersVisible;/);
});
