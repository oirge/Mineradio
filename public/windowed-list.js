(function (global) {
  'use strict';

  // Keep the full scroll extent and original row markup while mounting a bounded viewport window.
  var states = new WeakMap(), MIN_COUNT = 120, OVERSCAN = 7;
  function range(count, top, height, stride) {
    stride = Math.max(1, stride);
    var visible = Math.max(1, Math.ceil(Math.max(1, height) / stride));
    var start = Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, top) / stride)) - OVERSCAN);
    return { start: start, end: Math.min(count, start + visible + OVERSCAN * 2 + 1) };
  }
  function supported(root, count) {
    return count > MIN_COUNT && root && root.ownerDocument && typeof root.getBoundingClientRect === 'function';
  }
  function offset(state) {
    if (state.root === state.scroller) return 0;
    return state.root.getBoundingClientRect().top - state.scroller.getBoundingClientRect().top
      + state.scroller.scrollTop - state.scroller.clientTop;
  }
  function spacer(root, side) {
    var node = root.ownerDocument.createElement('div');
    node.setAttribute('data-windowed-spacer', side); node.setAttribute('aria-hidden', 'true');
    node.style.cssText = 'flex-shrink:0;min-height:0;margin:0;padding:0;border:0;pointer-events:none;overflow-anchor:none';
    return node;
  }
  function rowNode(state, html, index) {
    var template = state.root.ownerDocument.createElement('template');
    template.innerHTML = html;
    var node = template.content.firstElementChild;
    node.setAttribute('data-windowed-index', String(index));
    // Mounted rows already have overscan; do not measure content-visibility's offscreen placeholder.
    node.style.contentVisibility = 'visible';
    return node;
  }
  function schedule(state) {
    if (state.frame) return;
    state.frame = global.requestAnimationFrame(function () { state.frame = 0; sync(state, false); });
  }
  function sync(state, force, measured) {
    if (states.get(state.root) !== state || !state.root.isConnected || !state.root.getClientRects().length) return;
    var options = state.options, listTop = offset(state);
    var next = range(options.count, state.scroller.scrollTop - listTop, state.scroller.clientHeight, state.stride);
    if (!force && next.start === state.start && next.end === state.end) return;
    var paint = options.prepare ? options.prepare(next.start, next.end) : options.renderRow;
    var desired = [], rows = new Map();
    if (next.start) {
      state.top.style.height = Math.max(0, next.start * state.stride - state.gap) + 'px'; desired.push(state.top);
    }
    for (var index = next.start; index < next.end; index++) {
      var html = paint(index), previous = state.rows.get(index);
      var node = state.dragged && Number(state.dragged.getAttribute('data-windowed-index')) === index ? state.dragged
        : previous && previous.html === html ? previous.node : rowNode(state, html, index);
      rows.set(index, { html: node === state.dragged ? state.dragHtml : html, node: node }); desired.push(node);
    }
    if (next.end < options.count) {
      state.bottom.style.height = Math.max(0, (options.count - next.end) * state.stride - state.gap) + 'px'; desired.push(state.bottom);
    }
    // Native HTML drag must retain its source node while scrolling beyond that row's mounted window.
    if (state.dragged && !desired.includes(state.dragged)) {
      state.dragged.style.position = 'fixed'; state.dragged.style.top = '-10000px';
      desired.push(state.dragged);
    } else if (state.dragged) {
      state.dragged.style.position = state.dragStyle.position; state.dragged.style.top = state.dragStyle.top;
    }
    var cursor = state.root.firstChild;
    for (var item = 0; item < desired.length; item++) {
      var child = desired[item];
      if (child === cursor) cursor = cursor.nextSibling;
      else state.root.insertBefore(child, cursor);
    }
    while (cursor) { var following = cursor.nextSibling; state.root.removeChild(cursor); cursor = following; }
    state.rows = rows; state.start = next.start; state.end = next.end;
    state.root.setAttribute('data-windowed-count', String(options.count));
    var first = rows.get(next.start);
    if (first && !measured) {
      var style = global.getComputedStyle(first.node), rect = first.node.getBoundingClientRect();
      var stride = rect.height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0) + state.gap;
      if (stride > 1 && Math.abs(stride - state.stride) > 0.25) {
        var oldStride = state.stride;
        state.stride = stride;
        // Preserve the row under the scroll anchor when width/font changes its measured stride.
        var relative = state.scroller.scrollTop - listTop;
        if (relative > oldStride) state.scroller.scrollTop += relative / oldStride * (stride - oldStride);
        sync(state, true, true);
      }
    }
  }
  function clear(root) {
    var state = states.get(root);
    if (!state) return;
    states.delete(root);
    if (state.frame) global.cancelAnimationFrame(state.frame);
    state.scroller.removeEventListener('scroll', state.scroll);
    root.removeEventListener('keydown', state.keydown);
    root.removeEventListener('dragstart', state.dragstart);
    root.removeEventListener('dragend', state.dragend);
    if (state.resize) state.resize.disconnect();
    root.removeAttribute('data-windowed-count');
    state.rows.clear(); state.options = null;
  }
  function reveal(root, index, align) {
    var state = states.get(root);
    if (!state || index < 0 || index >= state.options.count) return;
    var top = offset(state) + index * state.stride;
    state.scroller.scrollTop = Math.max(0, top - Math.max(0, state.scroller.clientHeight - state.stride) * (align == null ? 0.42 : align));
    if (typeof state.scroller.__syncSmoothWheelTarget === 'function') state.scroller.__syncSmoothWheelTarget(state.scroller.scrollTop);
    sync(state, true);
  }
  function render(root, options) {
    if (!supported(root, options.count)) { clear(root); return false; }
    var state = states.get(root);
    if (!state || state.scroller !== options.scroller || state.options.key !== options.key) {
      clear(root);
      state = { root: root, scroller: options.scroller, options: options, stride: options.stride || 64,
        gap: parseFloat(global.getComputedStyle(root).rowGap) || 0, rows: new Map(), start: -1, end: -1, frame: 0,
        top: spacer(root, 'top'), bottom: spacer(root, 'bottom'), dragged: null };
      states.set(root, state);
      state.scroll = function () { schedule(state); };
      state.scroller.addEventListener('scroll', state.scroll, { passive: true });
      state.dragstart = function (event) {
        state.dragged = event.target.closest('[data-windowed-index]');
        if (state.dragged) {
          state.dragStyle = { position: state.dragged.style.position, top: state.dragged.style.top };
          var record = state.rows.get(Number(state.dragged.getAttribute('data-windowed-index')));
          state.dragHtml = record && record.html;
        }
      };
      state.dragend = function () {
        if (state.dragged) { state.dragged.style.position = state.dragStyle.position; state.dragged.style.top = state.dragStyle.top; }
        state.dragged = null; sync(state, true);
      };
      state.keydown = function (event) {
        if (event.key !== 'Tab') return;
        var row = event.target.closest('[data-windowed-index]');
        if (!row) return;
        var index = Number(row.getAttribute('data-windowed-index')), backwards = event.shiftKey;
        if (backwards ? index !== state.start || index === 0 : index !== state.end - 1 || index + 1 >= state.options.count) return;
        var selector = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]';
        var focusable = row.querySelectorAll(selector);
        if (event.target !== focusable[backwards ? 0 : focusable.length - 1]) return;
        event.preventDefault(); index += backwards ? -1 : 1;
        reveal(root, index);
        var nextRow = state.rows.get(index);
        if (nextRow) {
          var targets = nextRow.node.querySelectorAll(selector);
          var target = targets[backwards ? targets.length - 1 : 0];
          if (target) target.focus({ preventScroll: true });
        }
      };
      root.addEventListener('keydown', state.keydown);
      root.addEventListener('dragstart', state.dragstart);
      root.addEventListener('dragend', state.dragend);
      if (typeof global.ResizeObserver === 'function') {
        state.resize = new global.ResizeObserver(function () { state.start = -1; schedule(state); });
        state.resize.observe(state.scroller);
      }
    }
    state.options = options;
    root.style.overflowAnchor = 'none';
    sync(state, true);
    return true;
  }
  global.MineradioWindowedList = { render: render, clear: clear, reveal: reveal, supported: supported, range: range };
})(window);
