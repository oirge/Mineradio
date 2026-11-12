'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTranslationSettingsStore, normalizeTranslationEndpoint } = require('../desktop/translation-settings');
const temporaryRoots = [];
function directory() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-translation-')); temporaryRoots.push(root); return root; }
test.after(() => { for (const root of temporaryRoots) {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('mnr-translation-'));
  fs.rmSync(root, { recursive: true, force: true });
} });
const encryptedStorage = { isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from('encrypted:' + [...value].reverse().join('')),
  decryptString: value => [...value.toString().slice('encrypted:'.length)].reverse().join('') };
const savedInput = { endpoint: 'https://translation.invalid/v1', model: 'user-model', enabled: true, apiKey: 'synthetic-test-credential' };
test('translation starts unconfigured and never returns credentials', () => {
  const store = createTranslationSettingsStore({ userDataPath: directory(), safeStorage: encryptedStorage });
  assert.deepEqual(store.get(), { endpoint: '', model: '', enabled: false, revision: 0, hasApiKey: false, configured: false, keyPersistent: false, keyUnavailable: false, defaultAvailable: false, translationReady: false });
  assert.equal('apiKey' in store.get(), false);
});
test('OpenAI base URLs and full endpoint paths normalize consistently', () => {
  assert.equal(normalizeTranslationEndpoint('https://translation.invalid/v1/'), 'https://translation.invalid/v1/chat/completions');
  assert.equal(normalizeTranslationEndpoint('http://127.0.0.1:8000/v1/chat/completions'), 'http://127.0.0.1:8000/v1/chat/completions');
  assert.equal(normalizeTranslationEndpoint('https://translation.invalid/v1?api-version=2026'), 'https://translation.invalid/v1/chat/completions?api-version=2026');
  for (const endpoint of ['file:///settings.json', 'https://user:password@translation.invalid/v1', 'invalid', 'https://translation.invalid/#secret']) assert.throws(() => normalizeTranslationEndpoint(endpoint));
  for (const key of ['api_key', 'key', 'token', 'access-token', 'authorization', 'password']) {
    assert.throws(() => normalizeTranslationEndpoint('https://translation.invalid/v1?' + key + '=synthetic-credential'), /API Key/);
  }
});
test('saved API keys are OS-encrypted and restored without disclosure', () => {
  const root = directory(), store = createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage });
  const result = store.save(savedInput);
  assert.equal(result.keyPersistent, true); assert.equal(result.hasApiKey, true); assert.equal(result.revision, 1);
  const disk = fs.readFileSync(path.join(root, 'translation-settings.json'), 'utf8');
  assert.ok(!disk.includes(savedInput.apiKey)); assert.equal('apiKey' in JSON.parse(disk), false);
  const restored = createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage });
  assert.equal(restored.configuration().apiKey, savedInput.apiKey); assert.equal('apiKey' in restored.get(), false);
});
test('blank key preserves a saved key and explicit clear removes it', () => {
  const store = createTranslationSettingsStore({ userDataPath: directory(), safeStorage: encryptedStorage });
  store.save(savedInput); store.save({ ...savedInput, apiKey: '' });
  assert.equal(store.configuration().apiKey, savedInput.apiKey);
  const cleared = store.save({ ...savedInput, apiKey: '', clearApiKey: true });
  assert.equal(cleared.hasApiKey, false); assert.equal(cleared.keyPersistent, false); assert.equal(cleared.revision, 3);
});
test('unavailable or insecure encryption keeps credentials only in the running session', () => {
  for (const safeStorage of [{ isEncryptionAvailable: () => false }, { ...encryptedStorage, getSelectedStorageBackend: () => 'basic_text' },
    { ...encryptedStorage, encryptString: () => { throw new Error('unavailable'); } }]) {
    const root = directory(), store = createTranslationSettingsStore({ userDataPath: root, safeStorage });
    const result = store.save(savedInput);
    assert.equal(result.keyPersistent, false); assert.equal(result.hasApiKey, true);
    assert.equal(store.configuration().apiKey, savedInput.apiKey);
    assert.ok(!fs.readFileSync(path.join(root, 'translation-settings.json'), 'utf8').includes(savedInput.apiKey));
    assert.equal(createTranslationSettingsStore({ userDataPath: root, safeStorage }).get().hasApiKey, false);
  }
});
test('local endpoints work without keys and invalid saves preserve the prior configuration', () => {
  const store = createTranslationSettingsStore({ userDataPath: directory(), safeStorage: encryptedStorage });
  store.save({ endpoint: 'http://127.0.0.1:1234/v1', model: 'local-model', enabled: true });
  const prior = store.get(); assert.equal(prior.configured, true); assert.equal(prior.hasApiKey, false);
  assert.throws(() => store.save({ endpoint: '', model: 'partial-model', enabled: true }));
  assert.throws(() => store.save({ ...savedInput, apiKey: 'invalid\nheader' }));
  assert.deepEqual(store.get(), prior);
});

test('private defaults translate without disclosing or persisting service configuration', () => {
  const root = directory(), defaultConfiguration = { endpoint: 'https://private-default.invalid/v1/chat/completions', model: 'private-model', apiKey: 'private-synthetic-key' };
  const store = createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage, defaultConfiguration });
  const snapshot = store.get();
  assert.equal(snapshot.translationReady, true); assert.equal(snapshot.defaultAvailable, true);
  assert.equal(snapshot.endpoint, ''); assert.equal(snapshot.model, ''); assert.equal(snapshot.hasApiKey, false);
  for (const value of Object.values(defaultConfiguration)) assert.ok(!JSON.stringify(snapshot).includes(value));
  assert.equal(store.configuration().apiKey, defaultConfiguration.apiKey);
  store.save({ endpoint: '', model: '', enabled: true });
  const disk = fs.readFileSync(path.join(root, 'translation-settings.json'), 'utf8');
  for (const value of Object.values(defaultConfiguration)) assert.ok(!disk.includes(value));
  store.save(savedInput);
  assert.equal(store.configuration().model, savedInput.model); assert.equal(store.configuration().builtin, undefined);
  store.save({ ...savedInput, enabled: false, apiKey: '' });
  assert.equal(store.configuration().builtin, true);
  assert.equal(store.get().model, savedInput.model, 'Custom inputs remain available when the default is active');
});

test('an unreadable custom key does not silently send lyrics to the default service', () => {
  const root = directory();
  createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage }).save(savedInput);
  const store = createTranslationSettingsStore({ userDataPath: root, safeStorage: { isEncryptionAvailable: () => false },
    defaultConfiguration: { endpoint: 'https://private-default.invalid/v1/chat/completions', model: 'private-model', apiKey: 'private-synthetic-key' } });
  assert.equal(store.get().translationReady, false); assert.equal(store.configuration().keyUnavailable, true);
  assert.equal(store.configuration().builtin, undefined);
});
test('temporary OS decryption failure preserves the encrypted credential until explicit replacement or clearing', () => {
  const root = directory();
  createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage }).save(savedInput);
  const file = path.join(root, 'translation-settings.json'), encrypted = JSON.parse(fs.readFileSync(file, 'utf8')).encryptedApiKey;
  const unavailable = createTranslationSettingsStore({ userDataPath: root, safeStorage: { isEncryptionAvailable: () => false } });
  assert.equal(unavailable.get().configured, false); assert.equal(unavailable.get().keyUnavailable, true); assert.equal(unavailable.configuration().keyUnavailable, true);
  unavailable.save({ ...savedInput, apiKey: '', enabled: false });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).encryptedApiKey, encrypted);
  assert.equal(createTranslationSettingsStore({ userDataPath: root, safeStorage: encryptedStorage }).configuration().apiKey, savedInput.apiKey);
  unavailable.save({ ...savedInput, apiKey: '', clearApiKey: true });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).encryptedApiKey, '');
});
