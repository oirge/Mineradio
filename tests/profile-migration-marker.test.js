'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  isProfileMigrationMarkerCurrent,
  profileModifiedAt,
} = require('../desktop/profile-state-migration');

test('legacy profile updates or new sources invalidate the migration marker', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-profile-marker-'));
  try {
    const first = path.join(temp, 'Mineradio');
    const second = path.join(temp, 'Mineradio-path-second');
    fs.mkdirSync(first, { recursive: true });
    fs.mkdirSync(second, { recursive: true });
    fs.writeFileSync(path.join(first, 'desktop-ui-state.json'), JSON.stringify({ updatedAt: 1000, values: {} }), 'utf8');
    fs.writeFileSync(path.join(second, 'desktop-ui-state.json'), JSON.stringify({ updatedAt: 1000, values: {} }), 'utf8');

    const firstProfile = { userDataPath: first, sessionDataPath: first };
    const secondProfile = { userDataPath: second, sessionDataPath: second };
    const recordedModifiedAt = profileModifiedAt(first, first);
    const marker = {
      schema: 2,
      completedAt: Date.now(),
      sources: [{ userDataPath: first, modifiedAt: recordedModifiedAt }],
    };

    assert.equal(isProfileMigrationMarkerCurrent(marker, [firstProfile]), true);
    assert.equal(isProfileMigrationMarkerCurrent(marker, [firstProfile, secondProfile]), false);

    fs.writeFileSync(
      path.join(first, 'desktop-ui-state.json'),
      JSON.stringify({ updatedAt: recordedModifiedAt + 10000, values: {} }),
      'utf8',
    );
    assert.equal(isProfileMigrationMarkerCurrent(marker, [firstProfile]), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
