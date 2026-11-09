/* A bounded animation owner for mobile UI. Playback and visualizer frames stay independent. */
(function (global) {
  'use strict';
  var doc = global.document, tokens = global.MineradioMotionTokens;
  var media = global.matchMedia('(prefers-reduced-motion: reduce)');
  var records = new Map(), modalStates = new WeakMap(), listScopes = new WeakMap();
  var artworkScopes = new WeakMap(), activeArtwork = 0;
  var epoch = 0, destroyed = false;
  var api = global.MineradioMobileMotion = { tokens: tokens };

  function isMobile() { return !destroyed && doc.body.classList.contains('mobile-layout'); }
  function enabled() { return isMobile() && !doc.hidden && !media.matches; }
  function visual(node, names) {
    var style = global.getComputedStyle(node), result = {};
    names.forEach(function (name) {
      var value = style[name];
      if (name === 'translate' && (!value || value === 'none')) value = '0px 0px';
      if (name === 'scale' && (!value || value === 'none')) value = '1';
      result[name] = value;
    });
    return result;
  }
  function release(node, complete) {
    var record = records.get(node);
    if (!record) return;
    records.delete(node);
    record.animation.onfinish = null;
    record.animation.cancel();
    if (record.cleanup) record.cleanup();
    if (complete && record.complete) record.complete();
  }
  function animate(node, to, kind, options) {
    options = options || {};
    if (!node) { if (options.complete) options.complete(); return; }
    // Read before cancel so a reversed or superseded transition starts where it is drawn.
    var from = records.has(node) ? visual(node, Object.keys(to)) : (options.from || visual(node, Object.keys(to)));
    release(node, false);
    if (!enabled() || !node.isConnected || !node.animate) {
      if (options.cleanup) options.cleanup();
      if (options.complete) options.complete();
      return;
    }
    var animation = node.animate([from, to], {
      duration: tokens[kind] || tokens.component,
      delay: Math.min(tokens.maxStagger, Math.max(0, options.delay || 0)),
      easing: 'cubic-bezier(' + (kind === 'page' ? tokens.pageEase : tokens.ease).join(',') + ')',
      fill: 'both'
    });
    animation.id = 'mineradio-mobile-' + kind;
    var record = { animation: animation, cleanup: options.cleanup, complete: options.complete };
    records.set(node, record);
    animation.onfinish = function () { if (records.get(node) === record) release(node, true); };
    return animation;
  }
  function finishAll() { Array.from(records.keys()).forEach(function (node) { release(node, true); }); }
  function cancelWithin(container, except) {
    Array.from(records.keys()).forEach(function (node) {
      if (node !== container && node !== except && container.contains(node)) release(node, true);
    });
  }
  function killLegacyModalMotion(mask, panel) {
    if (!global.gsap) return;
    global.gsap.killTweensOf(mask);
    if (panel) global.gsap.killTweensOf(panel);
    global.gsap.set(mask, { clearProps: 'display,visibility,opacity' });
    if (panel) global.gsap.set(panel, { clearProps: 'opacity,visibility,transform,filter' });
  }
  function openModal(mask) {
    if (!mask) return;
    var panel = mask.querySelector('.modal'), state = modalStates.get(mask);
    var maskFrom = records.has(mask) ? visual(mask, ['opacity']) : { opacity: mask.classList.contains('show') ? 1 : 0 };
    var panelFrom = panel && (records.has(panel) || mask.classList.contains('show')) ? visual(panel, ['opacity', 'translate', 'scale']) :
      { opacity: 0, translate: '0px ' + tokens.distance + 'px', scale: String(tokens.scale) };
    release(mask, false); if (panel) release(panel, false);
    killLegacyModalMotion(mask, panel);
    state = { returnFocus: state ? state.returnFocus : doc.activeElement, inert: state ? state.inert : mask.inert, closing: false, callbacks: [] };
    modalStates.set(mask, state);
    mask.inert = state.inert;
    mask.removeAttribute('data-mobile-motion-modal');
    mask.classList.add('show');
    animate(mask, { opacity: 1 }, 'dialog', { from: maskFrom });
    if (panel) animate(panel, { opacity: 1, translate: '0px 0px', scale: '1' }, 'dialog', { from: panelFrom });
  }
  function closeModal(mask, afterClose) {
    var state = mask && modalStates.get(mask);
    if (!mask || (!mask.classList.contains('show') && !(state && state.closing))) { if (afterClose) afterClose(); return; }
    var panel = mask.querySelector('.modal');
    if (!state) state = { inert: mask.inert, returnFocus: null, closing: false, callbacks: [] };
    modalStates.set(mask, state);
    if (typeof afterClose === 'function' && state.callbacks.indexOf(afterClose) < 0) state.callbacks.push(afterClose);
    if (state.closing) return;
    cancelWithin(mask, panel);
    state.closing = true;
    mask.inert = true;
    mask.setAttribute('data-mobile-motion-modal', 'closing');
    mask.classList.remove('show');
    if (mask.contains(doc.activeElement) && doc.activeElement.blur) doc.activeElement.blur();
    function finish() {
      if (modalStates.get(mask) !== state) return;
      if (panel) release(panel, false);
      mask.classList.remove('show');
      mask.removeAttribute('data-mobile-motion-modal');
      mask.inert = state.inert;
      modalStates.delete(mask);
      var focus = state.returnFocus;
      var activeFocus = doc.activeElement, activeModal = doc.querySelector('.modal-mask.show');
      if (focus && focus.isConnected && !focus.closest('[inert]') &&
          (!activeModal || activeModal.contains(focus)) &&
          (!activeFocus || activeFocus === doc.body || activeFocus === doc.documentElement || mask.contains(activeFocus))) {
        focus.focus({ preventScroll: true });
      }
      state.callbacks.forEach(function (callback) { callback(); });
    }
    if (panel) animate(panel, { opacity: 0, translate: '0px ' + tokens.distance + 'px', scale: String(tokens.scale) }, 'dialog');
    animate(mask, { opacity: 0 }, 'dialog', { complete: finish });
  }
  function enterList(container, selector, options) {
    if (!enabled() || !container) return;
    options = options || {};
    var scope = epoch + ':' + (container.id === 'search-results' ? (doc.getElementById('search-input').value || '') : '');
    if (listScopes.get(container) === scope) return;
    var targets = [], children = container.children;
    // Inspect a small window; don't query or measure the entire music library.
    for (var i = 0; i < Math.min(children.length, 32) && targets.length < tokens.listLimit; i++) {
      var node = children[i];
      if (!node.matches(selector)) continue;
      var rect = node.getBoundingClientRect();
      if (rect.height && rect.bottom > 0 && rect.top < global.innerHeight) targets.push(node);
    }
    if (!targets.length) return;
    listScopes.set(container, scope);
    targets.forEach(function (node, index) {
      if (global.gsap) { global.gsap.killTweensOf(node); global.gsap.set(node, { clearProps: 'opacity,visibility,transform' }); }
      animate(node, { opacity: 1, translate: '0px 0px' }, 'component', {
        from: { opacity: 0, translate: '0px ' + tokens.distance + 'px' }, delay: index * tokens.stagger
      });
    });
  }
  function feedback(node) {
    if (!enabled() || !node || node.closest('[inert]')) return;
    animate(node, { scale: '1' }, 'micro', { from: { scale: '0.97' } });
  }
  // Each real image load gets at most one fade. Only a small visible window is animated.
  function revealArtwork(node, source) {
    if (!node || !source) { if (node) { artworkScopes.delete(node); release(node, false); } return; }
    if (!enabled() || node.closest('[inert]') || doc.body.classList.contains('folia-interface-active') || activeArtwork >= tokens.listLimit ||
        artworkScopes.get(node) === source) return;
    var rect = node.getBoundingClientRect();
    if (!rect.height || rect.bottom <= 0 || rect.top >= global.innerHeight) return;
    artworkScopes.set(node, source);
    activeArtwork++;
    animate(node, { opacity: 1 }, 'status', {
      from: { opacity: 0.35 }, cleanup: function () { activeArtwork--; }
    });
  }
  function artworkLoaded(event) {
    var node = event.target;
    if (node && node.matches && node.matches('#thumb-cover,.queue-item img,.pl-card img,.mini-queue-item img,#track-detail-modal img')) {
      revealArtwork(node, node.currentSrc || node.src);
    }
  }
  function preferencesChanged() {
    doc.documentElement.setAttribute('data-mobile-reduced-motion', String(media.matches));
    if (media.matches) {
      finishAll();
      if (isMobile()) clearLegacyFeedback();
    }
  }
  function clearLegacyFeedback() {
    if (!global.gsap) return;
    var controls = doc.querySelectorAll('#bottom-bar .ctrl-btn,#bottom-bar .ctrl-btn svg,#bottom-bar .lyrics-word-icon,'
      + '#bottom-bar #quality-btn-label,#fx-panel .fx-reset-one,#cover-crop-stage,#update-entry,#update-entry .update-ring');
    global.gsap.killTweensOf(controls);
    global.gsap.set(controls, { clearProps: 'transform,boxShadow,filter' });
    if (global.updatePreviewState && typeof global.stopUpdateIconBreathing === 'function') global.stopUpdateIconBreathing(true);
  }
  function visibilityChanged() { if (doc.hidden) finishAll(); }
  var wasMobile = isMobile();
  var observer = new global.MutationObserver(function () {
    var mobile = isMobile();
    if (!mobile) finishAll();
    else if (!wasMobile) clearLegacyFeedback();
    wasMobile = mobile;
  });
  observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', preferencesChanged);
  doc.addEventListener('visibilitychange', visibilityChanged);
  doc.addEventListener('load', artworkLoaded, true);
  global.addEventListener('pagehide', finishAll);
  global.addEventListener('resize', finishAll, { passive: true });
  preferencesChanged();
  Object.assign(api, {
    isMobile: isMobile, animate: animate, visual: visual, cancel: release, finishAll: finishAll,
    isAnimating: function (node) { return records.has(node); },
    openModal: openModal, closeModal: closeModal, enterList: enterList, feedback: feedback, revealArtwork: revealArtwork,
    nextListScope: function () { epoch++; },
    diagnostics: function () { return { reducedMotion: media.matches, activeAnimations: records.size }; },
    destroy: function () {
      finishAll(); destroyed = true; observer.disconnect();
      media.removeEventListener('change', preferencesChanged);
      doc.removeEventListener('visibilitychange', visibilityChanged);
      doc.removeEventListener('load', artworkLoaded, true);
      global.removeEventListener('pagehide', finishAll);
      global.removeEventListener('resize', finishAll);
    }
  });
  Object.defineProperties(api, {
    reducedMotion: { get: function () { return media.matches; } },
    activeAnimations: { get: function () { return records.size; } }
  });
})(window);
