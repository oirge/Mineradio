/* Phone Folia chrome follows the desktop idle delay without touch hover/focus locks. */
(function (global) {
  'use strict';
  var HIDDEN = 'mineradio-mobile-chrome-hidden', DELAY = 2500;
  var CONTROLS = '.local-mobile-header,.local-mobile-nav,.local-controls,.local-current-track';
  var MENUS = '.local-mobile-more,.local-slot-menu,.local-playlist-menu,[role="dialog"]';

  function create(doc, enabled) {
    var view = doc.defaultView, timer = 0, pointers = new Set();
    var keyboard = false, focused = false, wakeClick = false, panel = false;
    var style = doc.getElementById('mineradio-mobile-chrome-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'mineradio-mobile-chrome-style';
      style.textContent = '.local-mobile .local-mobile-header,.local-mobile .local-mobile-nav,.local-mobile .local-controls,.local-mobile .local-current-track{transition:opacity .25s ease,transform .25s ease,visibility .25s!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-mobile-header{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(-16px)!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-mobile-nav,.local-mobile body.' + HIDDEN + ' .local-controls,.local-mobile body.' + HIDDEN + ' .local-current-track{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(16px)!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-visualizer,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-record-wall,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .lattice-root{inset:0!important;height:auto!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-welcome,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-no-lyrics{top:50%!important}'
        + '@media(prefers-reduced-motion:reduce){.local-mobile .local-mobile-header,.local-mobile .local-mobile-nav,.local-mobile .local-controls,.local-mobile .local-current-track{transition:none!important}}';
      doc.head.appendChild(style);
    }
    function hidden(value) { doc.body.classList.toggle(HIDDEN, !!value); }
    function clearTimer() { if (timer) { view.clearTimeout(timer); timer = 0; } }
    function protectedSurface() { return !!doc.querySelector('.local-player[data-panel="open"],' + MENUS); }
    function schedule() {
      clearTimer();
      if (!enabled() || doc.hidden || pointers.size || focused || protectedSurface()) return;
      timer = view.setTimeout(function () {
        timer = 0;
        if (enabled() && !doc.hidden && !pointers.size && !focused && !protectedSurface()) hidden(true);
      }, DELAY);
    }
    function reveal() { hidden(false); schedule(); }
    function consume(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    function down(event) {
      if (!enabled()) return;
      var wasHidden = doc.body.classList.contains(HIDDEN);
      keyboard = focused = false;
      pointers.add(event.pointerId);
      wakeClick = wasHidden;
      reveal();
      // The first tap only wakes chrome; it must not activate a newly revealed button.
      if (wasHidden) consume(event);
    }
    function up(event) {
      if (!enabled()) return;
      pointers.delete(event.pointerId);
      if (event.type === 'pointercancel') wakeClick = false;
      else if (wakeClick) consume(event);
      schedule();
    }
    function click(event) { if (enabled() && wakeClick) { wakeClick = false; consume(event); } }
    function move(event) { if (enabled() && event.pointerType === 'mouse') reveal(); }
    function key() {
      if (!enabled()) return;
      keyboard = true;
      focused = !!(doc.activeElement && doc.activeElement.closest && doc.activeElement.closest(CONTROLS));
      reveal();
    }
    function focusIn(event) {
      if (!enabled()) return;
      focused = keyboard && !!event.target.closest(CONTROLS);
      reveal();
    }
    function focusOut(event) {
      if (!enabled()) return;
      focused = keyboard && !!(event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(CONTROLS));
      schedule();
    }
    function reset() { pointers.clear(); focused = wakeClick = false; reveal(); }
    function relevantNode(node) {
      return node.nodeType === 1 && (node.matches('.local-player,' + MENUS) || node.querySelector(MENUS));
    }
    panel = protectedSurface();
    // Only panel/menu changes reset inactivity; lyric and analyser updates leave the timer alone.
    var observer = new view.MutationObserver(function (records) {
      if (!records.some(function (record) {
        return record.type === 'attributes' || Array.from(record.addedNodes).some(relevantNode) || Array.from(record.removedNodes).some(relevantNode);
      })) return;
      var next = protectedSurface();
      if (next !== panel) { panel = next; reveal(); }
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-panel'] });
    var handlers = { pointerdown: down, pointerup: up, pointercancel: up, click: click,
      pointermove: move, keydown: key, focusin: focusIn, focusout: focusOut, visibilitychange: reset };
    Object.keys(handlers).forEach(function (name) { doc.addEventListener(name, handlers[name], true); });
    view.addEventListener('blur', reset);
    view.addEventListener('resize', reset);
    reveal();
    return { destroy: function () {
      clearTimer(); observer.disconnect(); hidden(false); pointers.clear();
      Object.keys(handlers).forEach(function (name) { doc.removeEventListener(name, handlers[name], true); });
      view.removeEventListener('blur', reset); view.removeEventListener('resize', reset);
    } };
  }
  global.MineradioFoliaMobileChrome = { create: create };
})(window);
