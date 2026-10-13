'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const bootstrap = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
const themeBootstrap = fs.readFileSync(path.join(root, 'public', 'startup-theme-colors.js'), 'utf8');
const defaultSource = app.slice(app.indexOf('var fxDefaults = {'), app.indexOf('var PACKAGED_DEFAULT_FX_SNAPSHOT'));
const colorKeys = ['uiAccentColor', 'homeAccentColor', 'homeIconColor', 'visualIconColor'];
const defaults = Object.fromEntries(colorKeys.map(key => [
  key, defaultSource.match(new RegExp(`${key}:\\s*['"](#[0-9a-f]+)['"]`, 'i'))[1]
]));

function firstPaint(saved, denied = false) {
  const properties = new Map();
  const context = {
    document: {
      documentElement: {
        classList: { add() {} },
        style: { setProperty(name, value) { properties.set(name, value); } }
      }
    },
    localStorage: {
      getItem(key) {
        if (key !== 'mineradio-lyric-layout-v1') return null;
        if (denied) throw new Error('Storage unavailable');
        return saved;
      },
      setItem() { assert.fail('First paint must not rewrite settings'); },
      removeItem() { assert.fail('First paint must not remove settings'); }
    }
  };
  assert.doesNotThrow(() => vm.runInNewContext(bootstrap, context));
  assert.doesNotThrow(() => vm.runInNewContext(themeBootstrap, context));
  return properties;
}

function colors(properties) {
  return {
    uiAccentColor: properties.get('--fc-accent'),
    homeAccentColor: properties.get('--home-accent'),
    homeIconColor: properties.get('--home-icon-color'),
    visualIconColor: properties.get('--visual-icon-color')
  };
}

test('first paint uses the current packaged colors before the player script runs', () => {
  assert.deepEqual(colors(firstPaint(null)), defaults);
  assert.match(html, /<script src="startup-theme-colors\.js"><\/script>/);
  assert.ok(html.indexOf('src="startup-theme-colors.js"') < html.indexOf('href="app.css"'));
});

test('first paint restores saved white colors instead of the old teal and gold CSS defaults', () => {
  const saved = Object.fromEntries(colorKeys.map(key => [key, '#ffffff']));
  const properties = firstPaint(JSON.stringify(saved));
  assert.deepEqual(colors(properties), saved);
  for (const name of ['--fc-accent-rgb', '--home-accent-rgb', '--home-icon-rgb', '--visual-icon-rgb']) {
    assert.equal(properties.get(name), '255,255,255', name);
  }
});

test('first paint preserves independent custom colors and normalizes short hex values', () => {
  const properties = firstPaint(JSON.stringify({
    uiAccentColor: ' #AbC ',
    homeAccentColor: '#00F5D4',
    homeIconColor: '#FEDCBA',
    visualIconColor: '#123456',
    '--untrusted-style': 'url(https://example.invalid)'
  }));
  assert.deepEqual(colors(properties), {
    uiAccentColor: '#aabbcc', homeAccentColor: '#00f5d4',
    homeIconColor: '#fedcba', visualIconColor: '#123456'
  });
  assert.equal(properties.get('--fc-accent-rgb'), '170,187,204');
  assert.equal(properties.get('--home-accent-rgb'), '0,245,212');
  assert.equal(properties.get('--home-icon-rgb'), '254,220,186');
  assert.equal(properties.get('--visual-icon-rgb'), '18,52,86');
  assert.equal(properties.has('--untrusted-style'), false);
});

test('legacy missing color fields retain the runtime restore fallbacks', () => {
  assert.deepEqual(colors(firstPaint('{}')), {
    uiAccentColor: '#00f5d4', homeAccentColor: '#00f5d4',
    homeIconColor: defaults.homeIconColor, visualIconColor: defaults.visualIconColor
  });
});

test('malformed or inaccessible saved settings leave the packaged colors intact', () => {
  for (const properties of [firstPaint('{'), firstPaint(null, true)]) {
    assert.deepEqual(colors(properties), defaults);
  }
});

test('saved colors cannot inject CSS and invalid colors match the player normalization', () => {
  const properties = firstPaint(JSON.stringify({
    uiAccentColor: 'red;--other:red',
    homeAccentColor: 'url(https://example.invalid)',
    homeIconColor: '#12345678',
    visualIconColor: ['red']
  }));
  assert.deepEqual(colors(properties), {
    uiAccentColor: '#00f5d4', homeAccentColor: '#a9b8c8',
    homeIconColor: '#f4d28a', visualIconColor: '#7fd8ff'
  });
});
