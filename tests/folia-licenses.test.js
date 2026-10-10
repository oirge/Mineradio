'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectBundledLicenses, verifyBundledLicenses } = require('../scripts/folia-licenses.cjs');

// tests/folia-licenses.test.js
// Check the dependency selection and release artifact integrity without building the application.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-folia-licenses-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('mineradio-folia-licenses-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const add = (relative, name, version, files) => {
    const directory = path.join(root, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version, license: 'MIT' }));
    fs.writeFileSync(path.join(directory, 'index.js'), 'export const value = 1;');
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), text);
    }
    return path.join(directory, 'index.js');
  };
  return { root, add };
}

test('records only bundled packages, deduplicates modules, and retains full copyright and NOTICE text', t => {
  const { root, add } = fixture(t);
  const permission = 'Copyright (c) Test Author\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n';
  const a = add('node_modules/used', 'used', '1.0.0', { LICENSE: permission, 'NOTICE.txt': 'Additional upstream notice\n' });
  add('node_modules/not-bundled', 'not-bundled', '9.0.0', { LICENSE: 'Must not appear' });
  const result = collectBundledLicenses(root, [a, a + '?commonjs-proxy', path.join(root, 'src/index.ts'), '\0virtual-runtime']);
  assert.equal(result.manifest.packages.length, 1);
  assert.equal(result.manifest.packages[0].name, 'used');
  assert.equal(result.manifest.packages[0].files.length, 2);
  assert.ok(result.text.includes(permission));
  assert.ok(result.text.includes('Additional upstream notice'));
  assert.ok(!result.text.includes('not-bundled'));
  assert.doesNotThrow(() => verifyBundledLicenses(result.manifest, result.text));
});

test('scoped, nested and worker module owners keep distinct versions and nested license notices', t => {
  const { root, add } = fixture(t);
  const rootModule = add('node_modules/@scope/shared', '@scope/shared', '1.0.0', { 'LICENSE-MIT': 'Root notice' });
  const nestedModule = add('node_modules/worker/node_modules/@scope/shared', '@scope/shared', '2.0.0', {
    'licenses/MIT.txt': 'Nested notice', 'licenses/third-party/NOTICE': 'Nested third party notice',
  });
  const result = collectBundledLicenses(root, [rootModule, nestedModule]);
  assert.deepEqual(result.manifest.packages.map(entry => entry.version), ['1.0.0', '2.0.0']);
  assert.equal(result.manifest.packages[1].directory, 'node_modules/worker/node_modules/@scope/shared');
  assert.ok(result.text.includes('Nested third party notice'));
  assert.doesNotThrow(() => verifyBundledLicenses(result.manifest, result.text));
});

test('collection is deterministic and line-ending differences do not change the notice manifest', t => {
  const { root, add } = fixture(t);
  const a = add('node_modules/a', 'a', '1.0.0', { LICENSE: 'Copyright A\r\nPermission A\r\n' });
  const b = add('node_modules/b', 'b', '2.0.0', { LICENSE: 'Copyright B\nPermission B\n' });
  const first = collectBundledLicenses(root, [b, a]);
  fs.writeFileSync(path.join(path.dirname(a), 'LICENSE'), 'Copyright A\nPermission A\n');
  assert.deepEqual(collectBundledLicenses(root, [a, b]), first);
});

test('missing or empty package licenses fail collection instead of shipping only an SPDX label', t => {
  const { root, add } = fixture(t);
  const missing = add('node_modules/missing', 'missing', '1.0.0', {});
  const empty = add('node_modules/empty', 'empty', '1.0.0', { LICENSE: '   ' });
  assert.throws(() => collectBundledLicenses(root, [missing]), /lacks non-empty LICENSE\/NOTICE/);
  assert.throws(() => collectBundledLicenses(root, [empty]), /lacks non-empty LICENSE\/NOTICE/);
  assert.throws(() => collectBundledLicenses(root, []), /did not record any/);
});

test('artifact checking rejects removed text, wrong package/file records and absent manifests', t => {
  const { root, add } = fixture(t);
  const module = add('node_modules/used', 'used', '1.0.0', { LICENSE: 'Complete copyright and permission text\n' });
  const { manifest, text } = collectBundledLicenses(root, [module]);
  assert.throws(() => verifyBundledLicenses(manifest, text.slice(0, -12)), /does not match/);
  assert.throws(() => verifyBundledLicenses(undefined, text), /manifest is missing/);
  const wrongPackage = structuredClone(manifest);
  wrongPackage.packages[0].version = '7.0.0';
  assert.throws(() => verifyBundledLicenses(wrongPackage, text), /Invalid bundled/);
  const wrongFile = structuredClone(manifest);
  wrongFile.packages[0].files[0].path = 'missing-NOTICE';
  assert.throws(() => verifyBundledLicenses(wrongFile, text), /Missing bundled license/);
});

test('omitted npm license uses its exact-version pinned upstream notice without patching the package', t => {
  const { root, add } = fixture(t);
  const exact = add('node_modules/@pixi/colord', '@pixi/colord', '2.9.6', {});
  const result = collectBundledLicenses(root, [exact]);
  assert.ok(result.text.includes('Copyright (c) 2020 Vlad Shilov omgovich@ya.ru'));
  assert.ok(result.text.includes('Permission is hereby granted'));
  assert.equal(result.manifest.packages[0].files[0].sourceCommit, '5344fbf77b736f81cd33c21050021bc09bc9dd1d');
  assert.equal(fs.existsSync(path.join(path.dirname(exact), 'LICENSE')), false);
  assert.doesNotThrow(() => verifyBundledLicenses(result.manifest, result.text));
  fs.writeFileSync(path.join(path.dirname(exact), 'package.json'), JSON.stringify({ name: '@pixi/colord', version: '2.9.7', license: 'MIT' }));
  assert.throws(() => collectBundledLicenses(root, [exact]), /lacks non-empty LICENSE\/NOTICE/);
});

test('reports every missing bundled dependency in one failure', t => {
  const { root, add } = fixture(t);
  const a = add('node_modules/missing-a', 'missing-a', '1.0.0', {});
  const b = add('node_modules/missing-b', 'missing-b', '2.0.0', {});
  assert.throws(() => collectBundledLicenses(root, [a, b]), error => error.message.includes('missing-a@1.0.0') && error.message.includes('missing-b@2.0.0'));
});

test('fiber 9.8.1 retains its published-commit notice and rejects other versions or license declarations', t => {
  const { root, add } = fixture(t);
  const exact = add('node_modules/@react-three/fiber', '@react-three/fiber', '9.8.1', {});
  const result = collectBundledLicenses(root, [exact]);
  assert.ok(result.text.includes('Copyright (c) 2019-2025 Poimandres'));
  assert.ok(result.text.includes('Permission is hereby granted'));
  assert.ok(result.text.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
  const notice = result.manifest.packages[0].files[0];
  assert.equal(notice.sha256, '9c35b5de7b7493a707fffe4eb23bd2f7f449153c1911f7c6eefb4e591fd5349a');
  assert.equal(notice.sourceCommit, '53ec672ac4a7189711766b87ece18889abbb32d4');
  assert.equal(notice.sourceUrl, 'https://raw.githubusercontent.com/pmndrs/react-three-fiber/53ec672ac4a7189711766b87ece18889abbb32d4/LICENSE');
  assert.equal(fs.existsSync(path.join(path.dirname(exact), 'LICENSE')), false);
  assert.doesNotThrow(() => verifyBundledLicenses(result.manifest, result.text));
  const packageFile = path.join(path.dirname(exact), 'package.json');
  fs.writeFileSync(packageFile, JSON.stringify({ name: '@react-three/fiber', version: '9.8.2', license: 'MIT' }));
  assert.throws(() => collectBundledLicenses(root, [exact]), /lacks non-empty LICENSE\/NOTICE/);
  fs.writeFileSync(packageFile, JSON.stringify({ name: '@react-three/fiber', version: '9.8.1', license: 'Apache-2.0' }));
  assert.throws(() => collectBundledLicenses(root, [exact]), /Invalid pinned license fallback/);
});
