import { describe, expect, it } from 'vitest';
import { resolveSettingLabelKey, resolveSettingValueLabelKey } from '@/utils/settingLabelLookup';
import zhCN from '@/i18n/locales/zh-CN';

// test/unit/utils/settingLabelLookup.test.ts
// Deriving a panel's own label key from a tuning field, instead of copying the pairs into a table
// that grows with every new slider. The keys below are the real ones from the locale files, so this
// also pins the naming patterns the resolver relies on.

const REAL_KEYS = new Set([
    'options.monetBackgroundSource',
    'options.monetBackgroundLayout',
    'options.monetHalfPaneOffsetX',
    'options.monetBackgroundBlur',
    'options.monetBackgroundOverlayOpacity',
    'options.monetBackgroundGrayscale',
    'options.monetBackgroundSaturation',
    'options.monetBackgroundWash',
    'options.monetBackgroundWashColorMode',
    'options.latentDitheringSize',
    'options.latentDitheringOpacity',
    'options.latentMeshSwirl',
    'options.monetPortraitSource',
    'options.monetAudioStyle',
    'options.monetShowAudioVisualization',
]);

const has = (key: string) => REAL_KEYS.has(key);
const resolve = (owner: string, leaf: string) => resolveSettingLabelKey(owner, leaf, has);

describe('resolveSettingLabelKey', () => {
    // prefix + field name, unchanged.
    it('finds a key that is just the prefix and the field', () => {
        expect(resolve('monetBackgroundTuning', 'backgroundSaturation')).toBe('options.monetBackgroundSaturation');
        expect(resolve('monetBackgroundTuning', 'backgroundWash')).toBe('options.monetBackgroundWash');
    });

    // The panel drops the unit because the slider prints it next to the value.
    it('finds a key whose field lost its unit suffix', () => {
        expect(resolve('monetBackgroundTuning', 'backgroundBlurPx')).toBe('options.monetBackgroundBlur');
    });

    // The prefix already says "background", so the panel does not repeat it.
    it('finds a key whose field dropped a segment the prefix already carries', () => {
        expect(resolve('monetBackgroundTuning', 'backgroundHalfPaneOffsetX')).toBe('options.monetHalfPaneOffsetX');
    });

    it('resolves other tunings by the same rules', () => {
        expect(resolve('latentBackgroundTuning', 'ditheringSize')).toBe('options.latentDitheringSize');
        expect(resolve('latentBackgroundTuning', 'meshSwirl')).toBe('options.latentMeshSwirl');
        expect(resolve('monetTuning', 'portraitSource')).toBe('options.monetPortraitSource');
        expect(resolve('monetTuning', 'audioStyle')).toBe('options.monetAudioStyle');
        expect(resolve('monetTuning', 'showAudioVisualization')).toBe('options.monetShowAudioVisualization');
    });

    // Nested groups are labelled by their own leaf.
    it('uses the last segment of a nested path', () => {
        expect(resolve('monetBackgroundTuning', 'group.backgroundSaturation')).toBe('options.monetBackgroundSaturation');
    });

    // A guess must never be shown as if it were a label.
    it('returns null when the panel has no label for the field', () => {
        expect(resolve('monetBackgroundTuning', 'somethingNobodyNamed')).toBeNull();
        expect(resolve('dioramaTuning', 'soulIntensity')).toBeNull();
    });

    it('never returns a key the caller said does not exist', () => {
        expect(resolveSettingLabelKey('monetBackgroundTuning', 'backgroundSaturation', () => false)).toBeNull();
    });

    // Shortening can land two distinct fields on one key, and two rows under one label cannot be
    // told apart. The field name is worse to read but it is at least unambiguous.
    describe('ambiguous matches', () => {
        const siblingHas = (key: string) => key === 'options.latentAudioSpeed';
        const resolveWith = (leaf: string, siblings: string[]) =>
            resolveSettingLabelKey('latentBackgroundTuning', leaf, siblingHas, siblings);

        it('drops a key two shortened siblings would share', () => {
            const siblings = ['ditheringAudioSpeed', 'meshAudioSpeed'];
            expect(resolveWith('ditheringAudioSpeed', siblings)).toBeNull();
            expect(resolveWith('meshAudioSpeed', siblings)).toBeNull();
        });

        it('drops a key two same-named leaves under different groups would share', () => {
            const siblings = ['dithering.audioSpeed', 'mesh.audioSpeed'];
            expect(resolveWith('dithering.audioSpeed', siblings)).toBeNull();
        });

        it('keeps the key when nothing else resolves to it', () => {
            expect(resolveWith('ditheringAudioSpeed', ['ditheringAudioSpeed', 'meshSwirl']))
                .toBe('options.latentAudioSpeed');
        });

        it('keeps the key when no siblings are supplied at all', () => {
            expect(resolveSettingLabelKey('latentBackgroundTuning', 'ditheringAudioSpeed', siblingHas))
                .toBe('options.latentAudioSpeed');
        });
    });

    // Dropping a leading `disable`/`hide` turns the field into its own opposite, and the dialog
    // renders the value as on/off against whatever label comes back.
    describe('negated fields', () => {
        const fumeHas = (key: string) => key === 'options.fumeGeometricBackground' || key === 'options.fumeHidePrintSymbols';

        it('does not strip a negation to reach a positive label', () => {
            expect(resolveSettingLabelKey('fumeTuning', 'disableGeometricBackground', fumeHas)).toBeNull();
        });

        it('still finds a key that spells the negation out', () => {
            expect(resolveSettingLabelKey('fumeTuning', 'hidePrintSymbols', fumeHas)).toBe('options.fumeHidePrintSymbols');
        });

        it('keeps stripping segments that only describe', () => {
            expect(resolveSettingLabelKey('monetBackgroundTuning', 'backgroundHalfPaneOffsetX', has))
                .toBe('options.monetHalfPaneOffsetX');
        });
    });
});

// Against the shipped locale rather than a stand-in, so a panel that renames its keys fails here
// instead of quietly falling back to field names in the dialog.
describe('resolveSettingLabelKey against the real locale', () => {
    const options = (zhCN as { options: Record<string, string>; }).options;
    const existsForReal = (key: string) => Object.prototype.hasOwnProperty.call(options, key.replace(/^options\./, ''));
    const label = (owner: string, leaf: string, siblings?: string[]) => {
        const key = resolveSettingLabelKey(owner, leaf, existsForReal, siblings);
        return key ? options[key.replace(/^options\./, '')] : null;
    };

    it('names every monet background field the panel exposes', () => {
        expect(label('monetBackgroundTuning', 'backgroundLayout')).toBe('布局模式');
        expect(label('monetBackgroundTuning', 'backgroundHalfPaneOffsetX')).toBe('图片水平偏移');
        expect(label('monetBackgroundTuning', 'backgroundBlurPx')).toBe('背景模糊');
        expect(label('monetBackgroundTuning', 'backgroundSaturation')).toBe('饱和度');
        expect(label('monetBackgroundTuning', 'backgroundGrayscale')).toBe('去色');
        expect(label('monetBackgroundTuning', 'backgroundOverlayOpacity')).toBe('主题叠色强度');
        expect(label('monetBackgroundTuning', 'backgroundWash')).toBe('水洗重着色');
        expect(label('monetBackgroundTuning', 'backgroundSource')).toBe('背景来源');
    });

    it('reaches other tunings without any per-field wiring', () => {
        expect(label('latentBackgroundTuning', 'ditheringSize')).toBe('像素尺寸');
        expect(label('latentBackgroundTuning', 'meshSwirl')).toBe('流体旋涡');
        expect(label('monetTuning', 'portraitSource')).toBe('右侧肖像来源');
        expect(label('monetTuning', 'audioStyle')).toBe('频谱样式');
    });

    // fumeGeometricBackground is a positive label the panel pairs with show/hide options, so reaching
    // it from disableGeometricBackground would state the opposite of the value being applied.
    it('leaves a negated field unlabelled rather than labelling it as its opposite', () => {
        expect(resolveSettingLabelKey('fumeTuning', 'disableGeometricBackground', existsForReal)).toBeNull();
        expect(label('fumeTuning', 'hidePrintSymbols')).toBe('隐藏打印方块');
    });

    // Both are real latentBackgroundTuning fields and both shorten to latentAudioSpeed.
    it('leaves the two audio-speed fields unlabelled rather than identical', () => {
        const siblings = ['ditheringAudioSpeed', 'meshAudioSpeed'];
        expect(resolveSettingLabelKey('latentBackgroundTuning', 'ditheringAudioSpeed', existsForReal, siblings)).toBeNull();
        expect(resolveSettingLabelKey('latentBackgroundTuning', 'meshAudioSpeed', existsForReal, siblings)).toBeNull();
    });

    // buildVisualSettingsConfig always fills visualizerTunings, so THIS is the shape every real
    // import takes -- the per-renderer fields above are skipped whenever the bundle is present.
    // collectVisualizerTunings keys the bundle by mode id, so the renderer name is in the path and
    // the owner field is the plural `visualizerTunings`, which carries no usable prefix of its own.
    describe('under the visualizerTunings bundle', () => {
        const bundled = (path: string, siblings?: string[]) =>
            label('visualizerTunings', path, siblings);

        it('takes the prefix from the path instead of the owner field', () => {
            expect(bundled('monet.portraitSource')).toBe('右侧肖像来源');
            expect(bundled('monet.audioStyle')).toBe('频谱样式');
            expect(bundled('fume.hidePrintSymbols')).toBe('隐藏打印方块');
        });

        it('resolves the same field identically bundled and standalone', () => {
            expect(bundled('monet.portraitSource')).toBe(label('monetTuning', 'portraitSource'));
            expect(bundled('fume.hidePrintSymbols')).toBe(label('fumeTuning', 'hidePrintSymbols'));
        });

        it('keeps the negation guard under a bundle', () => {
            expect(resolveSettingLabelKey('visualizerTunings', 'fume.disableGeometricBackground', existsForReal)).toBeNull();
        });

        // Distinct renderers give distinct prefixes, so a shared leaf name is not ambiguous here.
        it('does not treat the same leaf under two renderers as a collision', () => {
            const siblings = ['monet.audioStyle', 'cadenza.audioStyle'];
            expect(bundled('monet.audioStyle', siblings)).toBe('频谱样式');
        });
    });

    // Panels hang each choice off the field's own key, so a row can word the value the same way the
    // settings panel does instead of printing the store's id next to a translated label.
    describe('enum value labels', () => {
        const valueLabel = (owner: string, path: string, value: unknown) => {
            const fieldKey = resolveSettingLabelKey(owner, path, existsForReal);
            const key = resolveSettingValueLabelKey(fieldKey, value, existsForReal);
            return key ? options[key.replace(/^options\./, '')] : null;
        };

        it('names the choice the panel names', () => {
            expect(valueLabel('visualizerTunings', 'monet.audioStyle', 'bar')).toBe(options.monetAudioStyleBar);
            expect(valueLabel('visualizerTunings', 'monet.audioStyle', 'line')).toBe(options.monetAudioStyleLine);
            expect(valueLabel('tiltTuning', 'colorScheme', 'swap')).toBe(options.tiltColorSchemeSwap);
            expect(valueLabel('tiltTuning', 'colorScheme', 'accentAll')).toBe(options.tiltColorSchemeAccentAll);
        });

        // Better a raw id than a neighbouring option's name.
        it('returns null rather than guessing when the value does not follow the rule', () => {
            // monetBackgroundSource: 'cover-derived' is labelled by ...SourceCover, not ...SourceCover-derived.
            expect(valueLabel('monetBackgroundTuning', 'backgroundSource', 'cover-derived')).toBeNull();
            expect(valueLabel('visualizerTunings', 'monet.audioStyle', 'nonsense')).toBeNull();
        });

        it('stays quiet for values and fields that have no key', () => {
            expect(resolveSettingValueLabelKey(null, 'bar', existsForReal)).toBeNull();
            expect(resolveSettingValueLabelKey('options.monetAudioStyle', 42, existsForReal)).toBeNull();
            expect(resolveSettingValueLabelKey('options.monetAudioStyle', '', existsForReal)).toBeNull();
            expect(resolveSettingValueLabelKey('options.monetAudioStyle', true, existsForReal)).toBeNull();
        });
    });
});
