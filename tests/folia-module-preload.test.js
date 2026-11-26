'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.resolve(__dirname, '../public/vendor/folia/assets');

// tests/folia-module-preload.test.js
// Check the shipped chunks: a transitive icon graph previously produced ~1,900 scans per import.
test('Folia dynamic imports keep synchronous preload work bounded', () => {
  let imports = 0;
  const excessive = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(assets, name), 'utf8');
    for (const call of source.matchAll(/__vite__mapDeps\(\[([\d,]*)\]\)/g)) {
      imports++;
      const dependencies = call[1] ? call[1].split(',').length : 0;
      // Allow several CSS/JS companions, without traversing the full entry graph on every switch.
      if (dependencies > 16) excessive.push({ name, dependencies });
    }
  }
  assert.ok(imports > 0, 'inspect the real production preload calls');
  assert.deepEqual(excessive, [], 'large preload lists repeatedly scan the existing link collection');
});

test('Folia startup loads only a small portion of the theme icon catalog', () => {
  const files = fs.readdirSync(assets);
  const player = files.find(name => /^local-mount-.*\.js$/.test(name));
  const isIconCatalog = name => /^lucide-icons[-~].*\.js$/.test(name);
  assert.ok(player, 'inspect the shipped player mount');
  assert.ok(files.some(isIconCatalog), 'theme icon chunks must still ship with the player');

  const startup = new Set([player]);
  // A set iterator visits dependencies added while walking the static import graph.
  for (const name of startup) {
    const source = fs.readFileSync(path.join(assets, name), 'utf8');
    for (const [, dependency] of source.matchAll(/\b(?:from|import)\s*['"]\.\/([^'"]+\.js)['"]/g)) {
      startup.add(dependency);
    }
  }
  const iconBytes = [...startup].filter(isIconCatalog).reduce((total, name) => total + fs.statSync(path.join(assets, name)).size, 0);
  // The controls share a few groups with effects. Leave room for more UI icons without loading the bulk catalog.
  assert.ok(iconBytes <= 128 * 1024, `startup requested ${iconBytes} bytes of theme icon chunks`);
});
