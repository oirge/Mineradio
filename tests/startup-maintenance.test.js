'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanupProfileSessionStagingInBackground } = require('../desktop/startup-maintenance');

test('startup snapshots stale entries before yielding and continues while recursive cleanup is pending', async () => {
  const root = path.resolve(__dirname, '../tmp/staging-probe');
  const events = [];
  let finishRemoval;
  let scans = 0;
  const entries = [{ name: 'previous-launch' }];
  const fileSystem = {
    readdirSync(directory) {
      assert.equal(directory, root);
      scans++;
      events.push('snapshot');
      return entries.slice();
    },
    promises: {
      rm(directory, options) {
        assert.equal(directory, path.join(root, 'previous-launch'));
        assert.deepEqual(options, { recursive: true, force: true });
        events.push('remove-started');
        return new Promise(resolve => { finishRemoval = resolve; });
      },
    },
  };
  const cleanup = cleanupProfileSessionStagingInBackground(root, fileSystem);
  events.push('player-started');
  // A new migration can create its own directory while old-tree deletion is in flight.
  entries.push({ name: 'current-launch' });
  assert.deepEqual(events, ['snapshot', 'remove-started', 'player-started']);
  finishRemoval();
  assert.equal(await cleanup, 1);
  assert.equal(scans, 1, 'cleanup must never rescan and collect this launch\'s new session');
});

test('failed stale deletion does not stop later entries and escaped targets cannot be deleted', async () => {
  const root = path.resolve(__dirname, '../tmp/staging-probe');
  const removed = [];
  const cleanup = cleanupProfileSessionStagingInBackground(root, {
    readdirSync: () => [{ name: '..' }, { name: 'locked-old-session' }, { name: 'other-old-session' }],
    promises: { rm: async directory => {
      removed.push(directory);
      if (directory.endsWith('locked-old-session')) throw new Error('EPERM');
    } },
  });
  assert.equal(await cleanup, 1);
  assert.deepEqual(removed, [path.join(root, 'locked-old-session'), path.join(root, 'other-old-session')]);
});

test('empty or missing staging is a no-op; unexpected discovery failures settle as rejection', async () => {
  let scans = 0;
  const fileSystem = {
    readdirSync: () => { scans++; throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
    promises: { rm: () => { throw new Error('must not remove anything'); } },
  };
  assert.equal(await cleanupProfileSessionStagingInBackground('', fileSystem), 0);
  assert.equal(scans, 0);
  assert.equal(await cleanupProfileSessionStagingInBackground(path.join(__dirname, 'missing'), fileSystem), 0);
  assert.equal(scans, 1);
  fileSystem.readdirSync = () => { throw new Error('unreadable'); };
  await assert.rejects(cleanupProfileSessionStagingInBackground(__dirname, fileSystem), /unreadable/);
});

test('ready starts cleanup without awaiting it, retaining shell recovery and migration before navigation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../desktop/main.js'), 'utf8');
  const ready = source.slice(source.indexOf('app.whenReady().then(async () => {'));
  assert.match(ready, /void cleanupProfileSessionStagingInBackground\(PROFILE_STATE_MIGRATION_STAGING_ROOT\)\.catch/);
  assert.doesNotMatch(ready, /(?:await |\b)cleanupProfileSessionStaging\(/);
  assert.match(ready, /migratePrimaryDesktopShellSettings\(\);\s*applySavedDesktopShellSettings\(\);/);
  const createWindow = source.slice(source.indexOf('async function createWindow()'));
  assert.ok(createWindow.indexOf('await migratePrimaryProfileState(port)') < createWindow.indexOf('await mainWindow.loadURL('));
});
