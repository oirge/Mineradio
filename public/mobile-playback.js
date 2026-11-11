/* Serialize native/WebAudio ownership so lifecycle races cannot produce two audible players. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createMineradioNativePlayback = factory;
})(typeof window === 'undefined' ? globalThis : window, function (dependencies) {
  'use strict';
  var phase = 'checking', desiredBackground = false, initialized = false, savedWeb = null;
  var chain = Promise.resolve(), resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });

  async function probe() {
    var state = await dependencies.getNative();
    if (state && state.nativeActive) {
      savedWeb = state; await dependencies.pauseWeb(); phase = 'native';
    } else phase = 'web';
  }

  async function restoreForeground() {
    phase = 'returning';
    // takeNative must stop/release the native output before resolving.
    var state;
    try { state = await dependencies.takeNative(); }
    catch (error) { phase = 'native'; throw error; }
    phase = 'web'; resolveReady();
    await dependencies.restoreWeb(state && state.queue ? state : savedWeb);
    savedWeb = null;
  }
  async function settle() {
    if (phase === 'checking') await probe();
    if (desiredBackground && phase === 'web') {
      var captured = dependencies.capture();
      if (!captured || !captured.playing) return;
      savedWeb = captured; phase = 'entering';
      try { await dependencies.pauseWeb(); await dependencies.startNative(captured); phase = 'native'; }
      catch (error) {
        try { await dependencies.takeNative(); }
        catch (releaseError) { phase = 'native'; dependencies.report(releaseError); return; }
        phase = 'web';
        await dependencies.restoreWeb(savedWeb); savedWeb = null;
        dependencies.report(error);
        return;
      }
    }
    if (!desiredBackground && phase === 'native') await restoreForeground();
  }
  function schedule() {
    chain = chain.catch(dependencies.report).then(settle);
    return chain;
  }
  return {
    ready: ready,
    ownsAudio: function () { return phase !== 'web'; },
    phase: function () { return phase; },
    setBackground: function (value) {
      desiredBackground = !!value;
      return initialized ? schedule() : ready;
    },
    initialize: function () {
      if (initialized) return chain;
      initialized = true;
      chain = chain.then(async function () {
        await probe();
        if (phase === 'native' && !desiredBackground) await restoreForeground();
        resolveReady();
        await settle();
      }).catch(function (error) {
        // A failed native release must never allow WebAudio to start alongside it.
        resolveReady(); dependencies.report(error);
      });
      return chain;
    }
  };
});
