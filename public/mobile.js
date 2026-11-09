/* Mobile navigation shares the existing library, settings and audio engine. */
(function () {
  'use strict';
  var body = document.body;
  var root = document.documentElement;
  var nav = document.getElementById('mobile-nav');
  var search = document.getElementById('search-input');
  var playlist = document.getElementById('playlist-panel');
  var settings = document.getElementById('fx-panel');
  var bar = document.getElementById('bottom-bar');
  var more = document.getElementById('mobile-player-more');
  var compact = window.matchMedia('(max-width: 900px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)');
  var view = 'home';
  var changingView = false;
  var frame = 0;
  var unfocusedHeight = 0;
  var viewportWidth = 0;
  var api = window.MineradioMobile = { active: false };
  var motion = window.MineradioMobileMotion;
  var moreExpanded = false;
  var historyIndex = Number(history.state && history.state.mineradioMobileIndex) || 0;
  var entryDirection = Number(history.state && history.state.mineradioMobileDirection) || 1;

  function hasTrack() {
    return typeof currentIdx === 'number' && currentIdx >= 0 &&
      typeof playQueue !== 'undefined' && !!playQueue[currentIdx];
  }

  function updateViewport() {
    if (!api.active) return;
    var viewport = window.visualViewport;
    var height = viewport ? viewport.height : window.innerHeight;
    var editing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (!editing || Math.abs(window.innerWidth - viewportWidth) > 80) unfocusedHeight = height;
    viewportWidth = window.innerWidth;
    var keyboard = editing && Math.max(window.innerHeight - height, unfocusedHeight - height) > 120;
    body.classList.toggle('mobile-keyboard-open', keyboard);
    root.style.setProperty('--mobile-viewport-height', (viewport ? viewport.height : window.innerHeight) + 'px');
    root.style.setProperty('--mobile-viewport-top', (viewport ? viewport.offsetTop : 0) + 'px');
    var top = document.getElementById('search-area').getBoundingClientRect().bottom + 16;
    var bottom = hasTrack() && bar.getClientRects().length ? bar.getBoundingClientRect().top - 16 : nav.getBoundingClientRect().top - 16;
    api.lyricStageHeight = Math.max(.15, (bottom - top) / Math.max(1, height));
    api.lyricStageCenterY = (height / 2 - (top + bottom) / 2) / Math.max(1, height);
  }

  function closePanel(panel, key) {
    if (typeof peekTimers !== 'undefined' && peekTimers[key]) {
      clearTimeout(peekTimers[key]);
      peekTimers[key] = null;
    }
    panel.classList.remove('show', 'peek', 'closing', 'playlist-panel-closing');
  }

  function markView(next) {
    view = next;
    body.setAttribute('data-mobile-view', view);
    nav.querySelectorAll('[data-mobile-view]').forEach(function (button) {
      var selected = button.getAttribute('data-mobile-view') === view;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function openView(next, options) {
    options = options || {};
    if (!api.active || !/^(home|search|player|library|settings)$/.test(next)) return;
    var previous = view;
    var transition = motion && motion.captureView(previous, next, options.direction || options.reverse);
    changingView = true;
    markView(next);
    closePanel(playlist, 'pl');
    closePanel(settings, 'fx');
    if (typeof closeMiniQueue === 'function') closeMiniQueue();
    if (next !== 'search') search.blur();
    if (typeof immersiveMode !== 'undefined' && immersiveMode && typeof toggleImmersiveMode === 'function') {
      toggleImmersiveMode(false);
    }
    if (next === 'home') {
      if (typeof emptyHomeActive !== 'undefined' && !emptyHomeActive) goHome();
    } else {
      if (typeof dismissHomePage === 'function') dismissHomePage();
      if (next === 'library') {
        playlist.dataset.preserveTabOnOpen = '1';
        setPeek(playlist, true, 'pl');
        switchPlaylistTab(options.tab || 'playlists');
      } else if (next === 'settings') {
        toggleFxPanel(true);
      } else if (next === 'search') {
        setPeek(document.getElementById('search-area'), true, 'search');
        if (typeof doSearch === 'function') doSearch(search.value, { immediate: true });
        if (options.focus !== false) search.focus();
      }
    }
    if (options.history !== false && previous !== next) {
      historyIndex++;
      entryDirection = transition ? transition.direction : 1;
      var state = Object.assign({}, history.state, {
        mineradioMobileView: next, mineradioMobileIndex: historyIndex, mineradioMobileDirection: entryDirection
      });
      history.pushState(state, '');
    }
    changingView = false;
    refresh();
    if (motion) motion.finishView(transition);
  }
  api.openView = openView;

  function refresh() {
    frame = 0;
    if (!api.active) return;
    body.classList.toggle('mobile-has-track', hasTrack());
    if (!changingView) {
      var next = settings.matches('.show, .peek') ? 'settings' : playlist.matches('.show, .peek') ? 'library' : view;
      if (next !== view) {
        var transition = motion && motion.captureView(view, next);
        markView(next);
        if (motion) motion.finishView(transition);
      }
    }
    updateViewport();
  }

  function scheduleRefresh() {
    if (api.active && !frame) frame = requestAnimationFrame(refresh);
  }

  function applyLayout() {
    var desktop = window.desktopWindow && window.desktopWindow.isDesktop;
    var enabled = !!(compact.matches || (window.Capacitor && window.Capacitor.isNativePlatform())) && !desktop;
    if (enabled === api.active) { updateViewport(); return; }
    api.active = enabled;
    body.classList.toggle('mobile-layout', enabled);
    nav.hidden = !enabled;
    if (enabled) {
      markView(typeof emptyHomeActive !== 'undefined' && emptyHomeActive ? 'home' : 'player');
      closePanel(playlist, 'pl');
      closePanel(settings, 'fx');
      history.replaceState(Object.assign({}, history.state, {
        mineradioMobileView: view, mineradioMobileIndex: historyIndex, mineradioMobileDirection: entryDirection
      }), '');
      refresh();
      if (motion) motion.enhanceFolds();
    } else {
      if (motion) motion.finishAll();
      moreExpanded = false;
      var modes = bar.querySelector('.control-cluster.modes');
      if (modes) { modes.inert = false; modes.removeAttribute('aria-hidden'); modes.removeAttribute('data-mobile-motion-more'); }
      closePanel(playlist, 'pl');
      closePanel(settings, 'fx');
      body.classList.remove('mobile-has-track', 'mobile-controls-expanded', 'mobile-keyboard-open');
      body.removeAttribute('data-mobile-view');
      more.setAttribute('aria-expanded', 'false');
      root.style.removeProperty('--mobile-viewport-height');
      root.style.removeProperty('--mobile-viewport-top');
    }
  }

  function addCloseButton(container, label) {
    if (!container) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-panel-close';
    button.setAttribute('aria-label', label);
    button.textContent = '×';
    button.addEventListener('click', function () { openView(hasTrack() ? 'player' : 'home'); });
    container.appendChild(button);
  }
  addCloseButton(settings.querySelector('.fx-head'), '关闭设置');
  addCloseButton(playlist.querySelector('.queue-head-act'), '关闭歌单');

  var searchClose = document.createElement('button');
  searchClose.type = 'button';
  searchClose.id = 'mobile-search-close';
  searchClose.className = 'icon-btn';
  searchClose.textContent = '×';
  searchClose.setAttribute('aria-label', '结束搜索');
  searchClose.addEventListener('click', function () { openView(hasTrack() ? 'player' : 'home'); });
  document.getElementById('upload-actions').appendChild(searchClose);

  var foliaSwitch = document.createElement('button');
  foliaSwitch.id = 'mobile-folia-switch';
  foliaSwitch.type = 'button';
  foliaSwitch.className = 'icon-btn';
  foliaSwitch.textContent = 'F';
  foliaSwitch.setAttribute('aria-label', '切换到 Folia 界面');
  foliaSwitch.title = 'Folia';
  foliaSwitch.addEventListener('click', function () {
    search.blur();
    if (window.MineradioFoliaHost) window.MineradioFoliaHost.setInterface('folia');
  });
  document.getElementById('upload-actions').appendChild(foliaSwitch);

  nav.addEventListener('click', function (event) {
    var button = event.target.closest('[data-mobile-view]');
    if (button) openView(button.getAttribute('data-mobile-view'));
  });
  // Only the small grid changes height; every control row retains its natural touch geometry.
  function setMoreExpanded(expanded) {
    var modes = bar.querySelector('.control-cluster.modes');
    moreExpanded = expanded;
    more.setAttribute('aria-expanded', String(expanded));
    if (!modes) return;
    var controls = modes.parentElement;
    // Capture both drawn values before releasing the paired transition on a reversal.
    var from = motion && motion.isAnimating(modes) ? motion.visual(modes, ['opacity', 'translate']) : null;
    var heightFrom = motion && motion.isAnimating(controls) ? motion.visual(controls, ['height']) :
      { height: controls.getBoundingClientRect().height + 'px' };
    if (motion) { motion.cancel(controls, false); motion.cancel(modes, false); }
    if (expanded) { modes.inert = false; modes.removeAttribute('aria-hidden'); }
    else {
      modes.setAttribute('aria-hidden', 'true');
      if (modes.contains(document.activeElement)) more.focus({ preventScroll: true });
      modes.inert = true;
    }
    // Measure the destination with the original CSS, then keep the live row until exit completes.
    // These synchronous class changes cannot paint the temporary collapsed measurement.
    body.classList.toggle('mobile-controls-expanded', expanded);
    var height = controls.getBoundingClientRect().height;
    body.classList.add('mobile-controls-expanded');
    var phase = expanded ? 'entering' : 'leaving';
    controls.setAttribute('data-mobile-motion-more', phase);
    modes.setAttribute('data-mobile-motion-more', phase);
    function cleanup() {
      if (motion) motion.cancel(modes, false);
      controls.removeAttribute('data-mobile-motion-more');
      modes.removeAttribute('data-mobile-motion-more');
    }
    function finish() {
      if (moreExpanded !== expanded) return;
      cleanup();
      body.classList.toggle('mobile-controls-expanded', expanded);
      scheduleRefresh();
    }
    if (!motion) { finish(); return; }
    // The outer owner commits state and clears both effects on finish, cancellation or reduced motion.
    var transition = motion.animate(controls, { height: height + 'px' }, 'component', {
      from: heightFrom, cleanup: cleanup, complete: finish
    });
    if (transition) {
      motion.animate(modes, { opacity: expanded ? 1 : 0, translate: expanded ? '0px 0px' : '0px 8px' }, 'component', {
        from: from || { opacity: expanded ? 0 : 1, translate: expanded ? '0px 8px' : '0px 0px' }
      });
    }
  }
  more.addEventListener('click', function () {
    if (api.active) setMoreExpanded(!moreExpanded);
  });

  // Capture these existing entry points so their touch behavior matches the tabs.
  document.addEventListener('click', function (event) {
    if (!api.active || body.classList.contains('folia-interface-active')) return;
    var target = event.target.closest('#mini-queue-btn, #home-btn, #fx-fab, #search-input');
    if (!target) return;
    if (target === search) {
      if (view !== 'search') openView('search', { focus: false });
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.id === 'mini-queue-btn') openView('library', { tab: 'queue' });
    else openView(target.id === 'home-btn' ? 'home' : 'settings');
  }, true);
  document.addEventListener('keydown', function (event) {
    if (api.active && event.key === 'Escape' && !document.querySelector('.modal-mask.show')) {
      openView(hasTrack() ? 'player' : 'home');
    }
  });
  window.addEventListener('popstate', function (event) {
    if (!api.active) return;
    var state = event.state || {};
    var nextIndex = Number(state.mineradioMobileIndex) || 0;
    var nextDirection = Number(state.mineradioMobileDirection) || 1;
    var direction = nextIndex < historyIndex ? -entryDirection : nextDirection;
    historyIndex = nextIndex;
    entryDirection = nextDirection;
    openView(state.mineradioMobileView || (hasTrack() ? 'player' : 'home'), {
      history: false, focus: false, direction: direction
    });
  });
  window.addEventListener('resize', applyLayout, { passive: true });
  if (compact.addEventListener) compact.addEventListener('change', applyLayout);
  else compact.addListener(applyLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewport, { passive: true });
    window.visualViewport.addEventListener('scroll', updateViewport, { passive: true });
  }
  search.addEventListener('focus', updateViewport);
  search.addEventListener('blur', updateViewport);
  new MutationObserver(scheduleRefresh).observe(bar, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  new MutationObserver(scheduleRefresh).observe(playlist, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(scheduleRefresh).observe(settings, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(scheduleRefresh).observe(document.getElementById('control-title'), { childList: true, characterData: true, subtree: true });
  applyLayout();
})();
