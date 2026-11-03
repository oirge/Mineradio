'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// tests/folia-module-preload.test.js
// Check the shipped chunks: a transitive icon graph previously produced ~1,900 scans per import.
test('Folia dynamic imports keep synchronous preload work bounded', () => {
  const assets = path.resolve(__dirname, '../public/vendor/folia/assets');
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
