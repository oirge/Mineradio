'use strict';

// Restore the complete declarative theme before the body can paint.
try {
  (function(global){
    var manifest = global.MineradioPluginManifest;
    var doc = global.document;
    if (!manifest || !doc || !doc.head) return;
    var records = manifest.normalizePluginRecords(global.localStorage.getItem('mineradio-plugins-v1') || '');
    var active = null;
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (!record.enabled || record.manifest.kind !== 'theme') continue;
      if (!active || record.updatedAt > active.updatedAt) active = record;
    }
    var node = doc.getElementById('mineradio-plugin-theme-style');
    if (!active || !active.theme) {
      if (node) node.textContent = '';
      return;
    }
    if (!node) {
      node = doc.createElement('style');
      node.id = 'mineradio-plugin-theme-style';
      doc.head.appendChild(node);
    }
    var vars = active.theme.vars;
    var names = Object.keys(vars);
    var declarations = [];
    for (var k = 0; k < names.length; k++) declarations.push(names[k] + ':' + vars[names[k]]);
    node.textContent = (names.length ? ':root{' + declarations.join(';') + '}\n' : '') + active.theme.css;
  })(typeof globalThis !== 'undefined' ? globalThis : this);
} catch (e) {}
