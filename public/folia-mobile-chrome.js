/* Phone Folia chrome follows the desktop idle delay without touch hover/focus locks. */
(function (global) {
  'use strict';
  var HIDDEN = 'mineradio-mobile-chrome-hidden', DELAY = 2500;
  var CONTROLS = '.local-mobile-header,.local-mobile-nav,.local-controls,.local-current-track';
  var MENUS = '.local-mobile-more,.local-slot-menu,.local-playlist-menu,[role="dialog"]';
  var STAGES = '.local-player[data-panel="closed"] .local-visualizer,.local-player[data-panel="closed"] .local-record-wall,.local-player[data-panel="closed"] .lattice-root,.local-welcome,.local-no-lyrics';
  var MOTION = 440, EASING = 'cubic-bezier(.22,1,.36,1)';

  function create(doc, enabled) {
    var view = doc.defaultView, timer = 0, pointers = new Set();
    var keyboard = false, focused = false, wakeClick = false, panel = false;
    var stageMotion = new Map(), reducedMotion = view.matchMedia('(prefers-reduced-motion:reduce)');
    var style = doc.getElementById('mineradio-mobile-chrome-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'mineradio-mobile-chrome-style';
      style.textContent = '.local-mobile .local-mobile-header,.local-mobile .local-mobile-nav,.local-mobile .local-controls,.local-mobile .local-current-track{transition:opacity .42s ' + EASING + ',transform .42s ' + EASING + ',visibility 0s!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-mobile-header{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(-8px)!important;transition-delay:0s,0s,.42s!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-mobile-nav,.local-mobile body.' + HIDDEN + ' .local-controls,.local-mobile body.' + HIDDEN + ' .local-current-track{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(8px)!important;transition-delay:0s,0s,.42s!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-visualizer,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-record-wall,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .lattice-root{inset:0!important;height:auto!important}'
        + '.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-welcome,.local-mobile body.' + HIDDEN + ' .local-player[data-panel="closed"] .local-no-lyrics{top:50%!important}'
        + '@media(prefers-reduced-motion:reduce){.local-mobile .local-mobile-header,.local-mobile .local-mobile-nav,.local-mobile .local-controls,.local-mobile .local-current-track{transition:none!important}}';
      doc.head.appendChild(style);
    }
    function cancelStageMotion() {
      stageMotion.forEach(function (record) { record.animation.cancel(); record.restore(); });
      stageMotion.clear();
    }
    function hidden(value, instant) {
      value = !!value;
      if (doc.body.classList.contains(HIDDEN) === value) return;
      var animate = !instant && enabled() && !doc.hidden && !reducedMotion.matches;
      var previous = animate ? Array.from(doc.querySelectorAll(STAGES)).map(function (node) {
        return { node: node, rect: node.getBoundingClientRect() };
      }) : [];
      // Measure the current visual position before cancelling, including a
      // partially completed transition, so a quick wake reverses continuously.
      cancelStageMotion();
      doc.body.classList.toggle(HIDDEN, value);
      previous.forEach(function (entry) {
        var node = entry.node;
        if (!node.isConnected || !node.animate) return;
        var next = node.getBoundingClientRect();
        if (!next.width || !next.height || !entry.rect.width || !entry.rect.height) return;
        var saved = [], restored = false;
        // Keep the full background while controls fade back in. Restoring the
        // smaller viewport immediately would leave an empty strip above it.
        if (!value && entry.rect.height > next.height + 1
            && node.matches('.local-visualizer,.local-record-wall,.lattice-root')) {
          ['top', 'right', 'bottom', 'left', 'height'].forEach(function (name) {
            saved.push({ name: name, value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) });
            node.style.setProperty(name, name === 'height' ? 'auto' : '0px', 'important');
          });
        }
        function restore() {
          if (restored) return;
          restored = true;
          saved.forEach(function (item) {
            if (item.value) node.style.setProperty(item.name, item.value, item.priority);
            else node.style.removeProperty(item.name);
          });
        }
        var layout = saved.length ? node.getBoundingClientRect() : next;
        var x = entry.rect.left + entry.rect.width / 2 - layout.left - layout.width / 2;
        var y = entry.rect.top + entry.rect.height / 2 - layout.top - layout.height / 2;
        var endX = next.left + next.width / 2 - layout.left - layout.width / 2;
        var endY = next.top + next.height / 2 - layout.top - layout.height / 2;
        if (!saved.length && Math.abs(x) < .5 && Math.abs(y) < .5) return;
        // Resize the visual runtime once; animate only its centre. Scaling the
        // stage stretches lyrics, while animating its size reallocates canvases
        // and reruns lyric fitting every frame. Individual translate preserves
        // the visualizer's existing transform and word animations.
        var animation = node.animate([{ translate: x + 'px ' + y + 'px' }, { translate: endX + 'px ' + endY + 'px' }],
          { duration: MOTION, easing: EASING });
        animation.id = 'mineradio-mobile-chrome-stage';
        var record = { animation: animation, restore: restore };
        stageMotion.set(node, record);
        animation.onfinish = function () {
          if (stageMotion.get(node) !== record) return;
          stageMotion.delete(node);
          animation.cancel();
          restore();
        };
      });
    }
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
    function reset() { cancelStageMotion(); pointers.clear(); focused = wakeClick = false; hidden(false, true); schedule(); }
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
      clearTimer(); observer.disconnect(); cancelStageMotion(); hidden(false, true); pointers.clear();
      Object.keys(handlers).forEach(function (name) { doc.removeEventListener(name, handlers[name], true); });
      view.removeEventListener('blur', reset); view.removeEventListener('resize', reset);
    } };
  }
  global.MineradioFoliaMobileChrome = { create: create };
})(window);
