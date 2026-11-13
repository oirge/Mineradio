'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Remove only staging entries that existed before this launch starts its migration. */
async function cleanupProfileSessionStagingInBackground(stagingRoot, fileSystem = fs) {
  if (!stagingRoot) return 0;
  const targetRoot = path.resolve(String(stagingRoot));
  let entries;
  try {
    // Take the snapshot synchronously, before yielding to createWindow or a new migration.
    // Recursive removal is the expensive part and must not block the first player window.
    entries = fileSystem.readdirSync(targetRoot, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return 0;
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    const target = path.resolve(targetRoot, entry.name);
    if (path.dirname(target).toLowerCase() !== targetRoot.toLowerCase()) continue;
    try {
      await fileSystem.promises.rm(target, { recursive: true, force: true });
      removed++;
    } catch (_error) {}
  }
  return removed;
}

module.exports = { cleanupProfileSessionStagingInBackground };
