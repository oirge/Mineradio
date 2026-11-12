'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeTranslationEndpoint } = require('./translation-settings');

// Private release configuration is loaded only in the main process and never returned over IPC.
function validateDefaultTranslationConfiguration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid private translation configuration');
  const endpoint = normalizeTranslationEndpoint(value.endpoint);
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const apiKey = typeof value.apiKey === 'string' ? value.apiKey.trim() : '';
  if (!endpoint || !model || model.length > 200 || !apiKey || apiKey.length > 8192 || /[\x00-\x1f\x7f]/.test(model + apiKey)) {
    throw new Error('Incomplete private translation configuration');
  }
  return Object.freeze({ endpoint, model, apiKey });
}
function loadDefaultTranslationConfiguration(filePath = path.join(__dirname, 'default-translation.json')) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > 16384) return null;
    return validateDefaultTranslationConfiguration(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (_) { return null; }
}

module.exports = { validateDefaultTranslationConfiguration, loadDefaultTranslationConfiguration };
