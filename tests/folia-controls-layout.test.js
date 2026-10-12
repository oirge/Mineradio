'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/folia-host.css'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public/app.css'), 'utf8');

test('browser Folia entry sits below Home without changing the active Folia view', () => {
  const rule = css.match(/body:not\(\.desktop-shell\):not\(\.folia-interface-active\) #folia-floating-switch\{([^}]+)\}/);
  assert.ok(rule, 'The browser player needs its own non-overlapping switch position');
  assert.match(rule[1], /top:90px/);
  assert.match(rule[1], /right:24px/);
  assert.match(css, /body\.folia-interface-active #folia-floating-switch\{top:10px;right:16px\}/);
});

test('compact fullscreen moves only the Folia entry below the search and control row', () => {
  const rule = css.match(/@media\(max-width:1600px\)\{([^}]+\{[^}]+\})\}/);
  assert.ok(rule, 'Compact fullscreen must not place Folia over the search or import controls');
  assert.match(rule[1], /html:fullscreen body\.desktop-shell:not\(\.folia-interface-active\) #folia-floating-switch/);
  assert.match(rule[1], /body\.desktop-shell\.desktop-fullscreen:not\(\.folia-interface-active\) #folia-floating-switch/);
  assert.match(rule[1], /top:108px;right:24px/);
  assert.match(css, /@media\(max-width:720px\)\{[^}]*body:not\(\.desktop-shell\):not\(\.folia-interface-active\) #folia-floating-switch[^}]*right:12px/);
});

test('narrow simple fullscreen clears the taller search row in both fullscreen paths', () => {
  assert.match(css, /@media\(max-width:720px\)\{html:fullscreen body\.desktop-shell\.simple-mode:not\(\.folia-interface-active\) #folia-floating-switch,body\.desktop-shell\.desktop-fullscreen\.simple-mode:not\(\.folia-interface-active\) #folia-floating-switch\{top:124px\}\}/);
});

test('windowed desktop search clears the Folia titlebar row', () => {
  assert.match(appCss, /body\.desktop-shell #search-area\.peek\{top:44px\}/);
  assert.match(appCss, /body\.desktop-shell #search-area\.stage-mode\.peek\{top:42px\}/);
});

test('wide fullscreen keeps measured alignment and windowed desktop keeps one Folia entry', () => {
  assert.match(css, /right:var\(--folia-fs-switch-right,312px\)/);
  assert.match(css, /body\.desktop-shell:not\(\.desktop-fullscreen\) #folia-floating-switch\{display:none\}/);
  assert.match(css, /body\.folia-interface-active\.folia-chrome-hidden #folia-floating-switch/);
});
