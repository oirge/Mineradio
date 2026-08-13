'use strict';

const crypto = require('crypto');
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
  resolveDesktopShortcutName,
};
