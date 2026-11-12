"""Shared sanitized desktop IPC fixture for translation UI acceptance."""

DESKTOP_IPC = r"""(() => {
  if (window.top !== window) return;
  localStorage.setItem('mineradio-visual-guide-seen-v2', '1');
  let savedKey = '';
  let state = {configured:false, enabled:false, endpoint:'', model:'', hasApiKey:false, keyPersistent:true, revision:0, defaultAvailable:true, translationReady:true};
  const calls = window.__translationUiCalls = {reads:0, saves:0, tests:0, suppliedKeys:0, clears:0};
  const publicState = () => ({...state});
  window.desktopWindow = {
    isDesktop:false,
    getApiSessionToken: async () => 'ui-verification-session',
    getTranslationSettings: async () => {calls.reads++; return publicState();},
    saveTranslationSettings: async value => {
      calls.saves++;
      let endpoint;
      try {endpoint = new URL(value.endpoint);} catch {return {ok:false,message:'Endpoint URL is required.'};}
      if (!/^https?:$/.test(endpoint.protocol) || !value.model) return {ok:false,message:'Endpoint and model are required.'};
      if (value.clearApiKey) {savedKey=''; calls.clears++;}
      else if (value.apiKey) {savedKey=value.apiKey; calls.suppliedKeys++;}
      state = {configured:true, enabled:!!value.enabled, endpoint:endpoint.href.replace(/\/$/, ''),
        model:value.model, hasApiKey:!!savedKey, keyPersistent:true, revision:state.revision+1, defaultAvailable:true, translationReady:true};
      return {ok:true,...publicState()};
    },
    testTranslationSettings: async () => {calls.tests++; return {ok:state.configured && state.enabled};}
  };
})();"""
