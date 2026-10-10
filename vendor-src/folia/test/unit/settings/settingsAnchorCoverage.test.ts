import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_ANCHOR_DEFINITIONS, SETTINGS_ANCHOR_SECTION } from '../../../src/components/modal/settings/navigation/settingsAnchorModel';

// test/unit/settings/settingsAnchorCoverage.test.ts
// The sidebar table of contents only lists sections wrapped in <SettingsAnchor>. Two of these live
// in files rendered by a different subview (PinnedCommandSettings, TransitionSettingsSection), so a
// plain <section> slipping back in is easy to miss by eye and invisible until the entry disappears.

const SETTINGS_DIR = path.join(process.cwd(), 'src/components/modal/settings');

const settingsFiles = fs.readdirSync(SETTINGS_DIR)
    .filter(name => name.endsWith('.tsx'))
    .map(name => path.join(SETTINGS_DIR, name));

describe('settings section anchors', () => {
    it.each(settingsFiles.map(file => [path.basename(file), file]))('uses SettingsAnchor instead of a bare section in %s', (_name, file) => {
        expect(fs.readFileSync(file, 'utf8')).not.toMatch(/<section[\s>]/);
    });

    it('registers a unique anchor id per rendered section', () => {
        const ids = settingsFiles.flatMap(file => (
            [...fs.readFileSync(file, 'utf8').matchAll(/<SettingsAnchor anchorId="([^"]+)"/g)].map(match => match[1])
        ));

        expect(ids.length).toBeGreaterThan(20);

        // stageMode is declared twice on purpose: the Electron and web panels are mutually exclusive.
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        expect(duplicates).toEqual(['stageMode']);
    });

    // A settings command that names an anchor also names, through this table, the page to open it
    // on. Both halves are invisible when wrong: the command still runs, it just lands somewhere
    // else. So the table is held against the anchors actually rendered, in both directions.
    it('declares a section for exactly the anchors that are rendered', () => {
        const rendered = new Set(settingsFiles.flatMap(file => (
            [...fs.readFileSync(file, 'utf8').matchAll(/<SettingsAnchor anchorId="([^"]+)"/g)].map(match => match[1])
        )));
        const declared = new Set(Object.keys(SETTINGS_ANCHOR_SECTION));

        expect([...rendered].filter(id => !declared.has(id))).toEqual([]);
        expect([...declared].filter(id => !rendered.has(id))).toEqual([]);
    });

    it('keeps playback navigation in the same order as the rendered settings', () => {
        const source = fs.readFileSync(path.join(SETTINGS_DIR, 'PlaybackSettingsSubview.tsx'), 'utf8');
        const renderedOrder = [
            ['queueSettings', 'anchorId="queueSettings"'],
            ['scrobbleSettings', 'anchorId="scrobbleSettings"'],
            ['transitionSettings', '<TransitionSettingsSection'],
            ['replayGainSettings', 'anchorId="replayGainSettings"'],
            ['lyrics', 'anchorId="lyrics"'],
            ['audioOutputSettings', 'anchorId="audioOutputSettings"'],
        ]
            .map(([id, marker]) => {
                expect(source, `${marker} missing`).toContain(marker);
                return { id, position: source.indexOf(marker) };
            })
            .sort((a, b) => a.position - b.position)
            .map(entry => entry.id);
        const navigationOrder = Object.entries(SETTINGS_ANCHOR_DEFINITIONS)
            .filter(([, definition]) => definition.section === 'playback')
            .map(([id]) => id);

        expect(renderedOrder).toEqual(navigationOrder);
    });
});
