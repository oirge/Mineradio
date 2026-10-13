'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');
const manifestSource = fs.readFileSync(path.join(publicDir, 'plugin-manifest.js'), 'utf8');
const startupSource = fs.readFileSync(path.join(publicDir, 'startup-plugin-theme.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(publicDir, 'plugin-runtime.js'), 'utf8');
const styleId = 'mineradio-plugin-theme-style';

function record(id, theme, options = {}) {
  return {
    manifest: { id, name: id, kind: 'theme', version: '1.0.0' },
    theme, script: '', enabled: true, installedAt: 1, updatedAt: 1,
    ...options
  };
}

function bootstrap(records, denied = false) {
  const nodes = new Map();
  const writes = [];
  const context = vm.createContext({
    document: {
      head: {
        appendChild(node) {
          assert.equal(nodes.has(node.id), false, 'must reuse the single theme style');
          nodes.set(node.id, node);
        }
      },
      getElementById(id) { return nodes.get(id) || null; },
      createElement(tag) { assert.equal(tag, 'style'); return { id: '', textContent: '' }; }
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'mineradio-plugins-v1');
        if (denied) throw new Error('Storage unavailable');
        return typeof records === 'string' ? records : JSON.stringify(records);
      },
      setItem(...args) { writes.push(args); }
    },
    Worker() { assert.fail('first paint must not execute plugin scripts'); },
    setTimeout() { assert.fail('first paint must not wait for timers'); }
  });
  vm.runInContext(manifestSource, context);
  assert.doesNotThrow(() => vm.runInContext(startupSource, context));
  return { context, nodes, writes };
}

test('full theme variables and CSS are already installed before app.js runs', async () => {
  const theme = { vars: { '--th-panel-bg': '#eef5fa', '--th-text': '#183145' }, css: 'body{color:var(--th-text)}' };
  const result = bootstrap([record('white-theme', theme)]);
  const node = result.nodes.get(styleId);
  assert.equal(node.textContent, ':root{--th-panel-bg:#eef5fa;--th-text:#183145}\nbody{color:var(--th-text)}');
  assert.equal(result.context.MineradioPlugins, undefined, 'theme must exist without the runtime or app');
  assert.equal(result.writes.length, 0, 'preloading must not change settings');
  vm.runInContext(runtimeSource, result.context);
  result.context.MineradioPlugins.init();
  await result.context.MineradioPlugins.applyThemes();
  assert.equal(result.nodes.get(styleId), node, 'runtime must reuse the preloaded style');
  assert.equal(node.textContent, ':root{--th-panel-bg:#eef5fa;--th-text:#183145}\nbody{color:var(--th-text)}');
  assert.equal(result.nodes.size, 1);
});

test('first paint follows the runtime choice of the latest enabled theme without merging old themes', () => {
  const result = bootstrap([
    record('old-theme', { vars: { '--th-panel-bg': '#112233', '--th-old': '#111111' } }, { updatedAt: 2 }),
    record('new-theme', { vars: { '--th-panel-bg': '#ddeeff' } }, { updatedAt: 3 }),
    record('disabled-theme', { vars: { '--th-panel-bg': '#000000' } }, { enabled: false, updatedAt: 4 })
  ]);
  assert.equal(result.nodes.get(styleId).textContent, ':root{--th-panel-bg:#ddeeff}\n');
  assert.equal(result.writes.length, 0);
});

test('disabled, absent, malformed and inaccessible theme stores leave the default appearance intact', () => {
  for (const records of [[], '{', [record('disabled-theme', { vars: { '--th-text': '#123456' } }, { enabled: false })]]) {
    assert.equal(bootstrap(records).nodes.size, 0);
  }
  assert.equal(bootstrap([], true).nodes.size, 0);
});

test('first paint reuses manifest sanitization and never runs stored plugin scripts', () => {
  const result = bootstrap([record('custom-theme', {
    vars: { '--th-text': '#123456', '--bad': 'red;}body{color:red', '--remote': 'url(https://example.invalid)' },
    css: '@import "https://example.invalid";body{background:url(https://example.invalid)}'
  }, { script: 'throw new Error("must not execute");' })]);
  const css = result.nodes.get(styleId).textContent;
  assert.match(css, /--th-text:#123456/);
  assert.doesNotMatch(css, /--bad|--remote|https:\/\/example\.invalid/);
  assert.equal(result.writes.length, 0);
});
