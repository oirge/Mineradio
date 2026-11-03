/* public/folia-audio-settings.js — project and edit the host's existing audio chain. */
(function (global) {
  'use strict';
  function create(host) {
    function fail(code, message) { var error = new Error(message); error.code = code; throw error; }
    function invoke(name) {
      if (typeof host[name] !== 'function') fail('HOST_NOT_READY', '音频设置尚未准备好');
      return host[name].apply(host, Array.prototype.slice.call(arguments, 1));
    }
    function snapshot() {
      var settings = host.audioChainSettings && typeof host.normalizeAudioChainSettings === 'function'
        ? host.normalizeAudioChainSettings(host.audioChainSettings) : undefined;
      var output = host.outputDeviceSetting, runtime = host.outputDeviceRuntime || {};
      if (settings) settings.preset = invoke('matchAudioChainPreset', settings.gains);
      return { audioChain: settings, outputDevice: output ? {
        supported: typeof host.outputDeviceSelectionSupported === 'function' && host.outputDeviceSelectionSupported(),
        deviceId: output.deviceId || '', label: output.label || '', actualId: runtime.actualId || '',
        status: runtime.status || 'idle', needsPermission: !!runtime.needsPermission, errorName: runtime.errorName || ''
      } : undefined };
    }
    async function options() {
      if (typeof host.refreshOutputDevices === 'function') await host.refreshOutputDevices();
      return {
        frequencies: (host.AUDIO_CHAIN_BAND_FREQUENCIES || []).slice(),
        presets: (host.AUDIO_CHAIN_PRESETS || []).filter(function (preset) { return Array.isArray(preset.gains); })
          .map(function (preset) { return { id: preset.id, label: preset.label }; }),
        limits: { gain: [host.AUDIO_CHAIN_BAND_GAIN_MIN, host.AUDIO_CHAIN_BAND_GAIN_MAX],
          preamp: [host.AUDIO_CHAIN_PREAMP_MIN, host.AUDIO_CHAIN_PREAMP_MAX],
          threshold: [host.AUDIO_CHAIN_LIMITER_MIN, host.AUDIO_CHAIN_LIMITER_MAX],
          width: [host.AUDIO_CHAIN_WIDTH_MIN, host.AUDIO_CHAIN_WIDTH_MAX] },
        devices: (host.outputDeviceList || []).map(function (device) {
          return { deviceId: device.deviceId, label: device.label, fallbackIndex: device.fallbackIndex || 0 };
        })
      };
    }
    // Validate the complete edit before committing, so a malformed compound command cannot partly apply.
    function update(params) {
      if (!host.audioChainSettings) fail('HOST_NOT_READY', '音频设置尚未准备好');
      var booleans = ['enabled', 'autoPreamp', 'limiterEnabled', 'spatialEnabled'];
      var numbers = ['preampDb', 'limiterThresholdDb', 'widthRatio'];
      var band = params.band, preset;
      if (booleans.some(function (key) { return params[key] !== undefined && typeof params[key] !== 'boolean'; })
        || numbers.some(function (key) { return params[key] !== undefined && (typeof params[key] !== 'number' || !Number.isFinite(params[key])); })
        || (band !== undefined && (!band || !Number.isInteger(band.index) || band.index < 0
          || band.index >= host.AUDIO_CHAIN_BAND_FREQUENCIES.length || typeof band.gain !== 'number' || !Number.isFinite(band.gain)))) {
        fail('INVALID_AUDIO_CHAIN', '音效设置无效');
      }
      if (params.preset !== undefined) {
        preset = typeof params.preset === 'string' ? invoke('audioChainPresetById', params.preset) : null;
        if (!preset || !Array.isArray(preset.gains)) fail('INVALID_AUDIO_CHAIN', '音效预设无效');
      }
      var next = Object.assign({}, host.audioChainSettings);
      booleans.concat(numbers).forEach(function (key) { if (params[key] !== undefined) next[key] = params[key]; });
      if (preset) { next.gains = preset.gains.slice(); next.profileName = preset.label; }
      if (band) {
        next.gains = next.gains.slice(); next.gains[band.index] = band.gain;
        if (invoke('matchAudioChainPreset', next.gains) === 'custom') next.profileName = '';
      }
      host.audioChainSettings = invoke('normalizeAudioChainSettings', next);
      invoke('commitAudioChainSettings');
    }
    async function selectOutput(params) {
      var id = params.deviceId;
      if (typeof id !== 'string' || id.length > 1024 || (id && id !== (host.outputDeviceSetting || {}).deviceId
        && !(host.outputDeviceList || []).some(function (device) { return device.deviceId === id; }))) {
        fail('INVALID_OUTPUT_DEVICE', '输出设备无效，请刷新设备列表');
      }
      if (!invoke('outputDeviceSelectionSupported')) fail('OUTPUT_DEVICE_UNSUPPORTED', '当前环境不支持切换输出设备');
      await invoke('setOutputDevice', id, { toast: false });
    }
    return { snapshot: snapshot, options: options, update: update, selectOutput: selectOutput };
  }
  global.MineradioFoliaAudioSettings = { create: create };
  if (typeof module === 'object' && module.exports) module.exports = { create: create };
})(typeof window === 'object' ? window : globalThis);
