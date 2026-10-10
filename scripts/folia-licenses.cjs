'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// scripts/folia-licenses.cjs
// Follow only bundled module owners; never inventory unrelated installed dependencies.
const LICENSE_FILE = 'THIRD-PARTY-LICENSES.txt';
const fallbackRoot = path.resolve(__dirname, '../third-party/folia-license-fallbacks');
const fallbacks = JSON.parse(fs.readFileSync(path.join(fallbackRoot, 'manifest.json'), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const portable = value => value.replaceAll('\\', '/');
const isNotice = name => /^(?:licen[cs]es?|copying|notices?|copyright|third[-_ ]party[-_ ]notices?)(?:$|[._ -])/i.test(name);

function bundledPackageDirectory(id) {
  if (!id || id.startsWith('\0')) return null;
  const file = portable(id.split('?')[0]);
  const offset = file.lastIndexOf('/node_modules/');
  if (offset < 0) return null;
  const parts = file.slice(offset + 14).split('/');
  const owner = parts[0]?.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1);
  if (!owner.length || owner.some(part => !part || part === '.' || part === '..') || owner[0].startsWith('.')) return null;
  return path.resolve(file.slice(0, offset + 14), ...owner);
}

function noticeFiles(directory) {
  const result = [];
  const readLicenseDirectory = relative => {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isFile()) result.push(next);
      else if (entry.isDirectory()) readLicenseDirectory(next);
    }
  };
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!isNotice(entry.name)) continue;
    if (entry.isFile()) result.push(entry.name);
    else if (entry.isDirectory()) readLicenseDirectory(entry.name);
  }
  return result.sort(compare).map(file => ({ path: portable(file), text: fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n?/g, '\n') }));
}

function fallbackNotice(metadata) {
  const entry = fallbacks[`${metadata.name}@${metadata.version}`];
  if (!entry) return [];
  if (entry.license !== metadata.license || path.basename(entry.file) !== entry.file) {
    throw new Error(`Invalid pinned license fallback for ${metadata.name}@${metadata.version}`);
  }
  const text = fs.readFileSync(path.join(fallbackRoot, entry.file), 'utf8').replace(/\r\n?/g, '\n');
  if (sha256(text) !== entry.sha256) throw new Error('Pinned license fallback content changed: ' + entry.file);
  return [{ path: `license-fallbacks/${entry.file}`, text, sourceUrl: entry.sourceUrl, sourceCommit: entry.sourceCommit }];
}

const packageHeading = entry => `Package: ${entry.name}@${entry.version}\nSource: ${entry.directory}\nDeclared license: ${entry.license}\n`;
const fileHeading = file => `--- ${file.path} (SHA-256 ${file.sha256}) ---\n`
  + (file.sourceUrl ? `Original notice: ${file.sourceUrl}\nSource commit: ${file.sourceCommit}\n` : '');

function collectBundledLicenses(projectRoot, moduleIds) {
  const directories = [...new Set([...moduleIds].map(bundledPackageDirectory).filter(Boolean))].sort(compare);
  const packages = [], sections = [], missing = [];
  for (const directory of directories) {
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (!metadata.name || !metadata.version) throw new Error('Bundled dependency lacks package identity: ' + directory);
    let files = noticeFiles(directory);
    if (!files.length) files = fallbackNotice(metadata);
    if (!files.length || files.some(file => !file.text.trim())) {
      missing.push(`${metadata.name}@${metadata.version} (${directory})`);
      continue;
    }
    const entry = {
      name: metadata.name, version: metadata.version, directory: portable(path.relative(projectRoot, directory)),
      license: typeof metadata.license === 'string' ? metadata.license : JSON.stringify(metadata.license || metadata.licenses || 'See included notices'),
      files: files.map(file => ({ path: file.path, sha256: sha256(file.text),
        ...(file.sourceUrl ? { sourceUrl: file.sourceUrl, sourceCommit: file.sourceCommit } : {}),
      })),
    };
    packages.push(entry);
    sections.push('='.repeat(78) + '\n' + packageHeading(entry) + '\n' + files.map((file, index) => fileHeading(entry.files[index]) + file.text + '\n').join('\n'));
  }
  if (missing.length) throw new Error('Bundled dependency lacks non-empty LICENSE/NOTICE text:\n' + missing.join('\n'));
  if (!packages.length) throw new Error('Folia build did not record any bundled dependency licenses');
  const text = 'Folia embedded local player — bundled third-party licenses\n'
    + 'Generated from modules included in the application and worker output chunks.\n'
    + 'Package versions and copyright/permission notices below retain their original terms.\n\n'
    + sections.join('\n');
  return { text, manifest: { fileName: LICENSE_FILE, sha256: sha256(text), packages } };
}

function verifyBundledLicenses(manifest, text) {
  if (!manifest || manifest.fileName !== LICENSE_FILE || !Array.isArray(manifest.packages) || !manifest.packages.length) {
    throw new Error('Folia bundled dependency license manifest is missing; rebuild Folia');
  }
  if (sha256(text) !== manifest.sha256) throw new Error('Folia bundled dependency license text does not match its build manifest');
  const identities = new Set();
  for (const entry of manifest.packages) {
    const identity = `${entry.name}@${entry.version}:${entry.directory}`;
    if (!entry.name || !entry.version || !entry.directory || !entry.license || identities.has(identity)
        || !Array.isArray(entry.files) || !entry.files.length || !text.includes(packageHeading(entry))) {
      throw new Error('Invalid bundled dependency license record: ' + identity);
    }
    identities.add(identity);
    for (const file of entry.files) {
      if (!file.path || !/^[a-f0-9]{64}$/.test(file.sha256) || !text.includes(fileHeading(file))) {
        throw new Error('Missing bundled license notice: ' + identity + '/' + file.path);
      }
    }
  }
}

module.exports = { collectBundledLicenses, verifyBundledLicenses, LICENSE_FILE };
