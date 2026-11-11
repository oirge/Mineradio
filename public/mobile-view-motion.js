/* Navigation snapshots preserve existing page DOM and use the shared animation owner. */
(function (global) {
  'use strict';
  var doc = global.document, motion = global.MineradioMobileMotion, tokens = motion.tokens;
  var ids = { home: 'empty-home', search: 'search-results', library: 'playlist-panel', settings: 'fx-panel' };
  var order = ['home', 'search', 'player', 'library', 'settings'];
  function page(name) { return doc.getElementById(ids[name]); }
  function captureView(previous, next, reverse) {
    if (previous === next || !motion.isMobile()) return null;
    var source = page(previous), target = page(next);
    var snapshot = {
      source: source, target: target,
      sourceFrom: source ? motion.visual(source, ['opacity', 'translate']) : null,
      targetFrom: target && motion.isAnimating(target) ? motion.visual(target, ['opacity', 'translate']) : null,
      direction: typeof reverse === 'number' ? reverse : reverse ? -1 : (order.indexOf(next) >= order.indexOf(previous) ? 1 : -1)
    };
    Object.keys(ids).forEach(function (name) {
      var node = page(name);
      if (node && node !== source && node !== target) motion.cancel(node, true);
    });
    motion.nextListScope();
    return snapshot;
  }
  function finishView(snapshot) {
    if (!snapshot) return;
    var source = snapshot.source, target = snapshot.target, direction = snapshot.direction;
    if (source) {
      motion.cancel(source, false);
      var inert = source.inert;
      source.setAttribute('data-mobile-motion-leaving', '');
      source.inert = true;
      motion.animate(source, { opacity: 0, translate: -direction * tokens.distance + 'px 0px' }, 'page', {
        from: snapshot.sourceFrom,
        cleanup: function () { source.removeAttribute('data-mobile-motion-leaving'); source.inert = inert; }
      });
    }
    if (target) {
      motion.cancel(target, false);
      target.setAttribute('data-mobile-motion-view', doc.body.getAttribute('data-mobile-view'));
      motion.animate(target, { opacity: 1, translate: '0px 0px' }, 'page', {
        from: snapshot.targetFrom && Number(snapshot.targetFrom.opacity) > 0 ? snapshot.targetFrom :
          { opacity: 0, translate: direction * tokens.distance + 'px 0px' }
      });
    }
  }
  function captureQueueRemoval(index) {
    if (!motion.isMobile() || motion.reducedMotion || doc.body.classList.contains('folia-interface-active')) return null;
    var list = doc.getElementById('queue-list'), row = list && list.querySelector('[data-queue-index="' + index + '"]');
    if (!row) return null;
    var rect = row.getBoundingClientRect();
    if (!rect.height || rect.bottom < 0 || rect.top > global.innerHeight || global.getComputedStyle(list).visibility === 'hidden') return null;
    var following = [], node = row.nextElementSibling;
    while (node && following.length < tokens.listLimit) {
      if (node.matches('.queue-item')) following.push({ index: Number(node.dataset.queueIndex) - 1, top: node.getBoundingClientRect().top });
      node = node.nextElementSibling;
    }
    return { list: list, ghost: row.cloneNode(true), rect: rect, following: following };
  }
  function finishQueueRemoval(snapshot) {
    if (!snapshot) return;
    var ghost = snapshot.ghost, rect = snapshot.rect;
    ghost.removeAttribute('onclick'); ghost.removeAttribute('draggable'); ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add('mobile-row-leaving');
    ghost.style.cssText = 'position:fixed;box-sizing:border-box;pointer-events:none;z-index:26;margin:0;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px';
    doc.body.appendChild(ghost);
    motion.animate(ghost, { opacity: 0, translate: '0px -4px' }, 'component', { cleanup: function () { ghost.remove(); } });
    snapshot.following.forEach(function (entry) {
      var node = snapshot.list.querySelector('[data-queue-index="' + entry.index + '"]');
      if (!node) return;
      var offset = entry.top - node.getBoundingClientRect().top;
      if (Math.abs(offset) < 1) return;
      motion.animate(node, { translate: '0px 0px' }, 'component', { from: { translate: '0px ' + offset + 'px' } });
    });
  }
  function enhanceFolds() {
    if (!motion.isMobile()) return;
    doc.querySelectorAll('.fx-fold-body:not([data-mobile-motion-fold])').forEach(function (body) {
      var head = body.parentElement.querySelector('.fx-fold-head');
      // The current settings use always-open cards with hidden fold heads.
      if (!head || global.getComputedStyle(head).display === 'none') return;
      var padding = global.getComputedStyle(body);
      var clip = doc.createElement('div'), content = doc.createElement('div');
      clip.className = 'mobile-fold-clip'; content.className = 'mobile-fold-content';
      content.style.paddingTop = padding.paddingTop;
      content.style.paddingBottom = padding.paddingBottom;
      while (body.firstChild) content.appendChild(body.firstChild);
      clip.appendChild(content); body.appendChild(clip);
      body.setAttribute('data-mobile-motion-fold', '');
    });
  }
  Object.assign(motion, {
    captureView: captureView, finishView: finishView,
    captureQueueRemoval: captureQueueRemoval, finishQueueRemoval: finishQueueRemoval,
    enhanceFolds: enhanceFolds
  });
})(window);
