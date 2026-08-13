'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sanitizeInstanceId(value) {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 48);
}

function hashInstanceIdentity(identity) {
  return crypto.createHash('sha256').update(String(identity || ''), 'utf8').digest('hex').slice(0, 12);
}

function resolveInstanceId(options) {
  const input = options || {};
  const explicit = sanitizeInstanceId(input.instanceId);
  if (explicit) return explicit;
  const executable = path.resolve(String(input.execPath || ''));
  const appRoot = path.resolve(String(input.appRoot || ''));
  const identity = `${process.platform}|${executable}|${appRoot}`.toLowerCase();
  return `path-${hashInstanceIdentity(identity)}`;
}

function isPrimaryPackagedInstance(options) {
  const input = options || {};
  if (sanitizeInstanceId(input.instanceId)) return false;
  return input.isPackaged === true;
}

function resolveInstanceUserDataPath(appDataPath, instanceId, appName) {
  const baseName = sanitizeInstanceId(appName) || 'Mineradio';
  const suffix = sanitizeInstanceId(instanceId) || 'default';
  return path.join(String(appDataPath || ''), `${baseName}-${suffix}`);
}

function resolveInstanceAppUserModelId(baseId, instanceId) {
  const base = String(baseId || 'com.mineradio.desktop').replace(/[^A-Za-z0-9.-]+/g, '.').replace(/[.]+$/g, '');
  const suffix = sanitizeInstanceId(instanceId) || 'default';
  return `${base}.${suffix}`;
}

function resolveInstanceProfile(options) {
  const input = options || {};
  const appName = sanitizeInstanceId(input.appName) || 'Mineradio';
  const baseAppUserModelId = String(input.baseAppUserModelId || 'com.mineradio.desktop');
  const primary = isPrimaryPackagedInstance(input);
  if (primary) {
    const instanceId = sanitizeInstanceId(input.primaryProfileId) || 'oirge';
    const profileName = `${appName}-${instanceId}`;
    const userDataPath = path.join(String(input.appDataPath || ''), profileName);
    return {
      primary: true,
      instanceId,
      appName: profileName,
      userDataPath,
      sessionDataPath: path.join(userDataPath, 'session'),
      appUserModelId: resolveInstanceAppUserModelId(baseAppUserModelId, instanceId),
    };
  }

  const instanceId = resolveInstanceId(input);
  const userDataPath = resolveInstanceUserDataPath(input.appDataPath, instanceId, appName);
  return {
    primary: false,
    instanceId,
    appName: `${appName}-${instanceId}`,
    userDataPath,
    sessionDataPath: path.join(userDataPath, 'session'),
    appUserModelId: resolveInstanceAppUserModelId(baseAppUserModelId, instanceId),
  };
}

function resolveLegacySharedProfile(options) {
  const input = options || {};
  const appName = sanitizeInstanceId(input.appName) || 'Mineradio';
  const userDataPath = path.join(String(input.appDataPath || ''), appName);
  return {
    instanceId: 'legacy-shared',
    userDataPath,
    sessionDataPath: userDataPath,
  };
}

function resolveLegacyPathProfile(options) {
  const input = options || {};
  const appName = sanitizeInstanceId(input.appName) || 'Mineradio';
  const instanceId = resolveInstanceId({
    execPath: input.execPath,
    appRoot: input.appRoot,
  });
  const userDataPath = resolveInstanceUserDataPath(input.appDataPath, instanceId, appName);
  return {
    instanceId,
    userDataPath,
    sessionDataPath: path.join(userDataPath, 'session'),
  };
}

function discoverLegacyPathProfiles(options) {
  const input = options || {};
  const appName = sanitizeInstanceId(input.appName) || 'Mineradio';
  const appDataPath = String(input.appDataPath || '');
  const pattern = new RegExp(`^${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-path-[a-f0-9]{12}$`, 'i');
  const profiles = [];
  try {
    const entries = fs.readdirSync(appDataPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !pattern.test(entry.name)) continue;
      const userDataPath = path.join(appDataPath, entry.name);
      const sessionDataPath = path.join(userDataPath, 'session');
      if (!fs.existsSync(sessionDataPath)) continue;
      profiles.push({
        instanceId: entry.name.slice(appName.length + 1),
        userDataPath,
        sessionDataPath,
      });
    }
  } catch (_e) {}
  profiles.sort((first, second) => first.userDataPath.localeCompare(second.userDataPath));
  return profiles;
}

function resolvePreferredServerPort(options) {
  const input = options || {};
  const explicit = Number(input.port);
  if (Number.isInteger(explicit) && explicit >= 1024 && explicit <= 65535) return explicit;
  const identity = sanitizeInstanceId(input.instanceId) || 'default';
  const value = Number.parseInt(hashInstanceIdentity(identity).slice(0, 8), 16) >>> 0;
  return 32000 + (value % 16000);
}

function resolveDesktopShortcutName(options) {
  const input = options || {};
  const explicit = String(input.shortcutName || '').trim().replace(/[<>:"/\\|?*]+/g, '-');
  if (explicit) return explicit.slice(0, 80);
  const executableName = path.basename(String(input.execPath || ''), path.extname(String(input.execPath || '')))
    .replace(/[<>:"/\\|?*]+/g, '-')
    .trim();
  return (executableName || String(input.defaultName || 'Mineradio')).slice(0, 80);
}

module.exports = {
  sanitizeInstanceId,
  resolveInstanceId,
  resolveInstanceUserDataPath,
  resolveInstanceAppUserModelId,
  resolveInstanceProfile,
  resolveLegacySharedProfile,
  resolveLegacyPathProfile,
  discoverLegacyPathProfiles,
  resolvePreferredServerPort,
  resolveDesktopShortcutName,
};
