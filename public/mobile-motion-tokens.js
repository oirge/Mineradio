/* Shared by the host and the embedded Folia bundle; durations are milliseconds. */
(function (global) {
  'use strict';
  var tokens = {
    micro: 150,
    component: 200,
    page: 280,
    dialog: 240,
    sheet: 280,
    menu: 200,
    status: 200,
    distance: 8,
    scale: 0.985,
    stagger: 12,
    maxStagger: 84,
    listLimit: 8,
    ease: Object.freeze([0.22, 1, 0.36, 1]),
    pageEase: Object.freeze([0.4, 0, 0.2, 1])
  };
  global.MineradioMotionTokens = Object.freeze(tokens);
  if (!global.document) return;
  var style = global.document.documentElement.style;
  ['micro', 'component', 'page', 'dialog', 'sheet', 'menu', 'status'].forEach(function (kind) {
    style.setProperty('--mobile-motion-' + kind, tokens[kind] + 'ms');
  });
  style.setProperty('--mobile-motion-ease', 'cubic-bezier(' + tokens.ease.join(',') + ')');
  style.setProperty('--mobile-motion-page-ease', 'cubic-bezier(' + tokens.pageEase.join(',') + ')');
})(globalThis);
