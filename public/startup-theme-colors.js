'use strict';

// Restore the visible shell colors before the styles and player load.
try {
  (function(){
    var colors = {
      uiAccentColor: '#ffffff', homeAccentColor: '#ffffff',
      homeIconColor: '#ffffff', visualIconColor: '#ffffff'
    };
    try {
      var saved = localStorage.getItem('mineradio-lyric-layout-v1');
      if (saved) colors = JSON.parse(saved) || {};
    } catch (e) {}
    var entries = [
      ['uiAccentColor', '--fc-accent', '--fc-accent-rgb', '#00f5d4', '#00f5d4'],
      ['homeAccentColor', '--home-accent', '--home-accent-rgb', '#00f5d4', '#a9b8c8'],
      ['homeIconColor', '--home-icon-color', '--home-icon-rgb', '#ffffff', '#f4d28a'],
      ['visualIconColor', '--visual-icon-color', '--visual-icon-rgb', '#ffffff', '#7fd8ff']
    ];
    var style = document.documentElement.style;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var hex = String(colors[entry[0]] || entry[3]).trim();
      if (/^#[0-9a-f]{3}$/i.test(hex)) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      hex = /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : entry[4];
      var rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)].join(',');
      style.setProperty(entry[1], hex);
      style.setProperty(entry[2], rgb);
      if (i === 0) {
        style.setProperty('--fc-accent-hov', hex);
        style.setProperty('--glass-border', 'rgba(' + rgb + ',.30)');
        style.setProperty('--glass-shadow-focus', '0 24px 72px rgba(0,0,0,.34),0 0 0 1px rgba(' + rgb + ',.13),0 0 42px rgba(' + rgb + ',.075),inset 0 1px 0 rgba(255,255,255,.20)');
      }
    }
  })();
} catch (e) {}
