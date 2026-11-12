'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateDefaultTranslationConfiguration } = require('../desktop/default-translation');

// CI injects the release secret after checkout; credentials never enter tracked source files.
let configuration;
try {
  configuration = validateDefaultTranslationConfiguration(JSON.parse(process.env.MINERADIO_DEFAULT_TRANSLATION_CONFIG || 'null'));
} catch (_) {
  // JSON parser diagnostics can contain fragments of malformed secrets.
  throw new Error('Private default translation configuration is missing or invalid');
}
fs.writeFileSync(path.join(__dirname, '../desktop/default-translation.json'), JSON.stringify(configuration), { mode: 0o600 });
console.log('Private default translation configuration is ready.');
