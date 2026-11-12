'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateDefaultTranslationConfiguration } = require('../desktop/default-translation');

// CI injects the release secret after checkout; credentials never enter tracked source files.
const configuration = validateDefaultTranslationConfiguration(JSON.parse(process.env.MINERADIO_DEFAULT_TRANSLATION_CONFIG || 'null'));
fs.writeFileSync(path.join(__dirname, '../desktop/default-translation.json'), JSON.stringify(configuration), { mode: 0o600 });
console.log('Private default translation configuration is ready.');
