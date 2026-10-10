import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

// test/unit/mod-system/modSystemDiscovery.test.ts
// Discovery accepts the same layouts as a zip install: mod.json in the entry
// under mods/, or in exactly one subfolder of it (a downloaded zip extracted
// by hand keeps its top-level folder).

const require = createRequire(import.meta.url);

const persisted = new Map<string, unknown>();
class FakeStore {
    get(key: string) { return persisted.get(key); }
    set(key: string, value: unknown) { persisted.set(key, JSON.parse(JSON.stringify(value))); }
}
const stubModule = (name: string, exports: unknown) => {
    const resolved = require.resolve(name);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } as NodeJS.Module;
};
stubModule('electron', {
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    ipcMain: { handle: () => {}, removeHandler: () => {} },
    protocol: { handle: () => {} },
    shell: { openPath: async () => '' },
});
stubModule('electron-store', FakeStore);

const { createModSystem } = require('../../../electron/modSystem/modSystem.cjs');
const { computeModDigest } = require('../../../electron/modSystem/modDigest.cjs');

let root = '';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-discovery-'));
    persisted.clear();
});

/* Writes a mod under userData/mods/<relative> and returns its directory. */
const writeMod = (relative: string, modId: string) => {
    const directory = path.join(root, 'userData/mods', relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'mod.json'), JSON.stringify({ folium: 1, id: modId, name: modId, version: '1.0.0', client: 'client.mjs' }));
    fs.writeFileSync(path.join(directory, 'client.mjs'), 'export default function activate(folium) {}\n');
    return directory;
};

const launch = () => {
    const system = createModSystem({
        app: {
            getPath: () => path.join(root, 'userData'),
            getAppPath: () => path.join(root, 'app'),
            getVersion: () => '0.8.0',
            isPackaged: true,
        },
        BrowserWindow: { getAllWindows: () => [] },
        getMainWindow: () => null,
        getLocaleKey: () => 'en',
        isFeatureEnabled: () => true,
    });
    system.loadAll();
    return system;
};

interface ListedMod { id: string; status: string; error: string | null }
const stateOf = (system: { listMods: () => ListedMod[] }, modId: string) => system.listMods().find((mod) => mod.id === modId);

describe('mod directory layout', () => {
    it('loads a mod whose mod.json sits one folder down', () => {
        const directory = writeMod('nested-mod-1.0.0/nested-mod', 'nested-mod');
        // The approval is bound to the digest of the inner folder, so a loaded
        // mod proves the inner folder is the mod root.
        persisted.set('mods.enabled.nested-mod', { enabled: true, digest: computeModDigest(directory) });
        expect(stateOf(launch(), 'nested-mod')).toMatchObject({ status: 'loaded', error: null });
    });

    it('prefers mod.json in the entry itself over a subfolder', () => {
        writeMod('outer', 'outer-mod');
        writeMod('outer/inner', 'inner-mod');
        const system = launch();
        expect(stateOf(system, 'outer-mod')).toBeDefined();
        expect(stateOf(system, 'inner-mod')).toBeUndefined();
    });

    it('reports a missing mod.json when more than one subfolder has one', () => {
        writeMod('bundle/first', 'first-mod');
        writeMod('bundle/second', 'second-mod');
        const state = stateOf(launch(), 'bundle');
        expect(state?.status).toBe('error');
        expect(state?.error).toMatch(/cannot read mod\.json/);
    });
});
