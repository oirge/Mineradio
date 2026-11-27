/* Size-aware rim refraction for settings surfaces. The player control bar glass stays independent. */
(function () {
  'use strict';
  if (!window.ResizeObserver || !window.MutationObserver || !window.CSS ||
      !CSS.supports('backdrop-filter', 'url(#settings-glass)')) return;

  var selector = '[data-liquid-glass],#fx-panel,.modal,.cover-color-pop,.color-lab-pop';
  var namespace = 'http://www.w3.org/2000/svg';
  var surfaces = new Map();
  var maps = new Map();
  var serial = 0;
  var svg, defs;

  function element(name, attributes) {
    var node = document.createElementNS(namespace, name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, attributes[key]);
    });
    return node;
  }

  function ensureDefinitions() {
    if (defs) return;
    svg = element('svg', { 'aria-hidden': 'true', focusable: 'false', width: 0, height: 0 });
    svg.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;left:0;top:0';
    defs = element('defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  // A rounded rectangle distance field bends only its inner rim; the centre is neutral.
  function displacementMap(width, height, radius) {
    var key = width + ':' + height + ':' + radius;
    if (maps.has(key)) return maps.get(key);
    var resolution = Math.min(1, 640 / Math.max(width, height), Math.sqrt(150000 / (width * height)));
    var canvas = document.createElement('canvas');
    var columns = canvas.width = Math.max(2, Math.round(width * resolution));
    var rows = canvas.height = Math.max(2, Math.round(height * resolution));
    var context = canvas.getContext('2d');
    if (!context) return null;
    var pixels = context.createImageData(columns, rows);
    var rgba = pixels.data;
    var halfWidth = width / 2, halfHeight = height / 2;
    var rim = Math.min(18, radius, halfWidth / 2, halfHeight / 2);
    for (var y = 0, i = 0; y < rows; y++) {
      var py = (y + .5) * height / rows - halfHeight;
      var oy = Math.max(Math.abs(py) - halfHeight + radius, 0);
      var signY = Math.sign(py);
      for (var x = 0; x < columns; x++, i += 4) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 128;
        rgba[i + 3] = 255;
        var px = (x + .5) * width / columns - halfWidth;
        var ox = Math.max(Math.abs(px) - halfWidth + radius, 0);
        // The rim is no wider than the corner radius; the centre stays neutral.
        if (ox === 0 && oy === 0) continue;
        var length = Math.sqrt(ox * ox + oy * oy);
        var inset = radius - length;
        if (inset <= 0 || inset >= rim) continue;
        var bend = Math.sin(inset / rim * Math.PI) * .7;
        rgba[i] = Math.round(128 + Math.sign(px) * (ox / length) * bend * 127);
        rgba[i + 1] = Math.round(128 + signY * (oy / length) * bend * 127);
      }
    }
    context.putImageData(pixels, 0, 0);
    var href = canvas.toDataURL();
    maps.set(key, href);
    if (maps.size > 12) maps.delete(maps.keys().next().value);
    return href;
  }

  function prepare(surface, record, width, height) {
    if (width < 2 || height < 2 || !surface.isConnected) return;
    width = Math.round(width); height = Math.round(height);
    var radius = Math.round(Math.min(parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 28, width / 2, height / 2));
    var key = width + ':' + height + ':' + radius;
    if (record.key === key) return;
    var href = displacementMap(width, height, radius);
    if (!href) return;
    ensureDefinitions();
    if (!record.filter) {
      var id = 'mineradio-settings-glass-' + (++serial);
      record.filter = element('filter', {
        id: id, x: '-8%', y: '-8%', width: '116%', height: '116%',
        'color-interpolation-filters': 'sRGB'
      });
      record.image = element('feImage', { x: 0, y: 0, width: '100%', height: '100%', preserveAspectRatio: 'none', result: 'rim' });
      record.filter.appendChild(record.image);
      // Mild RGB dispersion belongs to the rim, never to text or inner controls.
      [18, 16, 14].forEach(function (scale, index) {
        var channel = ['red', 'green', 'blue'][index];
        record.filter.appendChild(element('feDisplacementMap', {
          in: 'SourceGraphic', in2: 'rim', scale: scale,
          xChannelSelector: 'R', yChannelSelector: 'G', result: channel + '-shift'
        }));
        var matrix = new Array(20).fill(0);
        matrix[index * 5 + index] = 1;
        matrix[18] = 1;
        record.filter.appendChild(element('feColorMatrix', {
          in: channel + '-shift', type: 'matrix', values: matrix.join(' '), result: channel
        }));
      });
      record.filter.appendChild(element('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'red-green' }));
      record.filter.appendChild(element('feBlend', { in: 'red-green', in2: 'blue', mode: 'screen' }));
      defs.appendChild(record.filter);
      surface.style.setProperty('--settings-refraction', 'url(#' + id + ')');
    }
    record.image.setAttribute('href', href);
    record.key = key;
    surface.setAttribute('data-settings-glass-ready', 'true');
  }

  var resize = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var record = surfaces.get(entry.target);
      if (!record) return;
      var box = entry.borderBoxSize && entry.borderBoxSize[0];
      prepare(entry.target, record, box ? box.inlineSize : entry.target.offsetWidth, box ? box.blockSize : entry.target.offsetHeight);
    });
  });

  function attach(surface) {
    if (surfaces.has(surface) || !surface.isConnected) return;
    if (surface.parentElement && surface.parentElement.closest(selector)) return;
    surfaces.set(surface, { key: '', filter: null, image: null });
    resize.observe(surface);
  }

  function visit(node, callback) {
    if (node.nodeType !== 1) return;
    if (node.matches(selector)) callback(node);
    node.querySelectorAll(selector).forEach(callback);
  }

  var mutations = new MutationObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.addedNodes.forEach(function (node) { visit(node, attach); });
      entry.removedNodes.forEach(function (node) {
        visit(node, function (surface) {
          if (surface.isConnected) return;
          var record = surfaces.get(surface);
          if (!record) return;
          resize.unobserve(surface);
          if (record.filter) record.filter.remove();
          surfaces.delete(surface);
          surface.style.removeProperty('--settings-refraction');
          surface.removeAttribute('data-settings-glass-ready');
        });
      });
    });
  });

  function start() {
    visit(document.body, attach);
    mutations.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('pagehide', function (event) {
    if (event.persisted) return;
    resize.disconnect(); mutations.disconnect(); maps.clear(); surfaces.clear();
    if (svg) svg.remove();
  }, { once: true });
}());
