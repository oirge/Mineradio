import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile } from '@electron/asar';
import defaults from '../desktop/default-translation.js';

// Verify the production ASAR without printing private configuration or launching the player.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = fs.readFileSync(path.join(root, 'desktop/default-translation.json'));
const bundled = extractFile(path.join(root, 'dist/win-unpacked/resources/app.asar'), 'desktop/default-translation.json');
if (!expected.equals(bundled)) throw new Error('Bundled private translation configuration differs from the release input');
defaults.validateDefaultTranslationConfiguration(JSON.parse(bundled.toString('utf8')));
console.log('Production ASAR contains the validated private default service.');
