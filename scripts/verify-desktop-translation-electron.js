'use strict';

// Native DPAPI and Node fetch acceptance only; never opens the player's windows.
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') {
  throw new Error('Native translation acceptance is restricted to Windows GitHub Actions.');
}

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { app, safeStorage } = require('electron');
const { createTranslationSettingsStore } = require('../desktop/translation-settings');
const { testTranslationConfiguration, redactTranslationMessage } = require('../desktop/translation-client');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'ui-language', 'video-export');
const TEMP_ROOT = fs.realpathSync(os.tmpdir());
const PROFILE = fs.mkdtempSync(path.join(TEMP_ROOT, 'mineradio-translation-ci-'));
const OWNER_FILE = path.join(PROFILE, '.mineradio-translation-ci-owner');
const OWNER = crypto.randomBytes(32).toString('hex');
const SYNTHETIC_KEY = 'synthetic-ci-' + crypto.randomBytes(32).toString('hex');
const MODEL = 'mineradio-native-translation-ci';
const checks = [], failures = [];
let fixture, finished = false, requireKey = true, fixtureRequests = 0;
const observed = { model: false, authorization: false, noKey: false, requestFormat: false };

fs.writeFileSync(OWNER_FILE, OWNER, { encoding: 'utf8', mode: 0o600 });
fs.mkdirSync(OUT, { recursive: true });
app.setName('Mineradio translation CI');
app.setPath('userData', PROFILE);
app.setPath('sessionData', path.join(PROFILE, 'session'));
app.disableHardwareAcceleration();

function check(name, condition) {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
}
function removeOwnedProfile() {
  const absolute = path.resolve(PROFILE), real = fs.realpathSync(PROFILE);
  const same = (left, right) => left.toLowerCase() === right.toLowerCase();
  assert.ok(same(path.dirname(absolute), TEMP_ROOT), 'Temporary profile must remain inside the resolved temp directory');
  assert.ok(path.basename(absolute).startsWith('mineradio-translation-ci-'), 'Temporary profile must retain its task prefix');
  assert.ok(!fs.lstatSync(absolute).isSymbolicLink() && same(real, absolute), 'Temporary profile must not be redirected');
  assert.ok(fs.readFileSync(OWNER_FILE, 'utf8') === OWNER, 'Temporary profile ownership marker must match');
  fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
}
async function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  if (error) failures.push(redactTranslationMessage(error.message || 'Native translation acceptance failed', { apiKey: SYNTHETIC_KEY }));
  if (fixture) {
    await new Promise(resolve => { fixture.close(resolve); fixture.closeAllConnections(); });
  }
  try { removeOwnedProfile(); }
  catch (_) { failures.push('Owned temporary translation profile cleanup failed'); }
  const report = { platform: process.platform, electron: process.versions.electron || '', runtime: 'native-electron',
    windowsCreated: 0, realExternalServicesUsed: false, checks, fixtureRequests, observed, failures };
  fs.writeFileSync(path.join(OUT, 'translation-native-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write('Native translation checks: ' + checks.length + '; failures: ' + failures.length + '\n');
  app.exit(failures.length ? 1 : 0);
}
const watchdog = setTimeout(() => { void finish(new Error('Native translation acceptance exceeded its 60-second budget')); }, 60000);
watchdog.unref();

async function run() {
  check('Real Electron runtime and Windows secure storage are available', !!process.versions.electron && safeStorage.isEncryptionAvailable());
  fixture = http.createServer((req, res) => {
    let text = '';
    req.on('data', chunk => {
      text += chunk;
      if (text.length > 8192) req.destroy();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(text);
        const format = req.method === 'POST' && req.url === '/v1/chat/completions'
          && data.stream === false && Array.isArray(data.messages) && data.messages.length === 1 && data.messages[0].role === 'user';
        const model = data.model === MODEL;
        const authorization = requireKey ? req.headers.authorization === 'Bearer ' + SYNTHETIC_KEY : req.headers.authorization === undefined;
        fixtureRequests++;
        observed.requestFormat = observed.requestFormat || format;
        observed.model = observed.model || model;
        if (requireKey) observed.authorization = observed.authorization || authorization;
        else observed.noKey = observed.noKey || authorization;
        res.writeHead(format && model && authorization ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(format && model && authorization ? { choices: [{ message: { content: 'OK' } }] }
          : { error: { message: 'Synthetic fixture rejected the request' } }));
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid synthetic fixture request' } }));
      }
    });
  });
  await new Promise((resolve, reject) => { fixture.once('error', reject); fixture.listen(0, '127.0.0.1', resolve); });
  const endpoint = 'http://127.0.0.1:' + fixture.address().port + '/v1';
  const store = createTranslationSettingsStore({ userDataPath: PROFILE, safeStorage });
  check('No default service or API key is configured', !store.get().configured && !store.get().hasApiKey);
  const saved = store.save({ endpoint, model: MODEL, apiKey: SYNTHETIC_KEY, enabled: true });
  check('Native OS encryption persists the supplied key', saved.configured && saved.hasApiKey && saved.keyPersistent && !saved.keyUnavailable);
  const settingsFile = path.join(PROFILE, 'translation-settings.json');
  const disk = fs.readFileSync(settingsFile, 'utf8'), parsed = JSON.parse(disk);
  check('Settings contain ciphertext and no plaintext API key', !disk.includes(SYNTHETIC_KEY) && !Object.hasOwn(parsed, 'apiKey')
    && typeof parsed.encryptedApiKey === 'string' && parsed.encryptedApiKey.length > 0);
  check('DPAPI decrypts the saved ciphertext correctly', safeStorage.decryptString(Buffer.from(parsed.encryptedApiKey, 'base64')) === SYNTHETIC_KEY);
  check('Public settings disclose neither plaintext nor encrypted credentials', !Object.hasOwn(saved, 'apiKey')
    && !Object.hasOwn(saved, 'encryptedApiKey') && !JSON.stringify(saved).includes(SYNTHETIC_KEY));
  const restored = createTranslationSettingsStore({ userDataPath: PROFILE, safeStorage });
  check('A new settings store restores the real encrypted key', restored.configuration().apiKey === SYNTHETIC_KEY
    && restored.get().keyPersistent && !restored.get().keyUnavailable);
  restored.save({ endpoint, model: MODEL, apiKey: '', enabled: true });
  check('An empty key field preserves the existing native credential', restored.configuration().apiKey === SYNTHETIC_KEY);
  const reply = await testTranslationConfiguration(restored.configuration(), { timeoutMs: 10000 });
  check('Real Electron fetch reaches the synthetic OpenAI fixture', reply.ok && observed.model && observed.authorization && observed.requestFormat);
  check('Connection test returns no API key', !JSON.stringify(reply).includes(SYNTHETIC_KEY));
  const cleared = restored.save({ endpoint, model: MODEL, apiKey: '', clearApiKey: true, enabled: true });
  const clearDisk = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  check('Explicit clearing removes the key from memory and encrypted storage', !cleared.hasApiKey && !cleared.keyPersistent
    && restored.configuration().apiKey === '' && clearDisk.encryptedApiKey === '');
  requireKey = false;
  const local = await testTranslationConfiguration(restored.configuration(), { timeoutMs: 10000 });
  check('A keyless local service works through real Electron fetch', local.ok && observed.noKey && fixtureRequests === 2);
}

app.whenReady().then(run).then(() => finish(), error => finish(error));
