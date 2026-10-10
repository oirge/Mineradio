import { describe, expect, it } from 'vitest';
import { createTemperaDifferenceFilter } from '@/components/visualizer/tempera/temperaDifferenceFilter';

// test/unit/visualizer/temperaDifferenceFilter.test.ts
// The factory takes the Pixi module as an argument, so the filter contract can be locked
// without a GL context: blendRequired, the uBackTexture placeholder and the color uniforms.
const EMPTY_TEXTURE = { __empty: true };

interface StubProgram { vertex: string; fragment: string; name: string }
interface StubFilter {
    glProgram: StubProgram;
    blendRequired?: boolean;
    padding?: number;
    resolution?: number | 'inherit';
    resources: Record<string, unknown>;
}

const createStubPixi = () => {
    const module = {
        UniformGroup: class {
            constructor(public readonly uniforms: Record<string, { value: unknown; type: string }>) { }
        },
        GlProgram: { from: (program: StubProgram) => program },
        Filter: class {
            constructor(options: StubFilter) {
                Object.assign(this, options);
            }
        },
        Texture: { EMPTY: EMPTY_TEXTURE },
    };
    return module as unknown as typeof import('pixi.js');
};

const buildFilter = (options: Parameters<typeof createTemperaDifferenceFilter>[1]) => (
    createTemperaDifferenceFilter(createStubPixi(), options) as unknown as StubFilter
);

const uniformsOf = (filter: StubFilter) => (
    filter.resources.differenceUniforms as { uniforms: Record<string, { value: unknown; type: string }> }
).uniforms;

describe('Tempera difference filter', () => {
    it('declares the blend requirement and the back texture placeholder', () => {
        const filter = buildFilter({ ink: '#ffffff', paper: '#000000' });

        expect(filter.blendRequired).toBe(true);
        expect(filter.resources.uBackTexture).toBe(EMPTY_TEXTURE);
        expect(filter.padding).toBe(0);
        expect(filter.glProgram.name).toBe('tempera-difference-inversion');
        // Pixi's own default is a hard 1. The back texture always follows the render target's
        // resolution, so anything but 'inherit' makes the two textures different pixel sizes
        // and the shader reads the backdrop from the wrong place.
        expect(filter.resolution).toBe('inherit');
    });

    it('samples the back texture with the same coordinate as the input texture', () => {
        const { fragment } = buildFilter({ ink: '#ffffff', paper: '#000000' }).glProgram;

        expect(fragment).toContain('uniform sampler2D uBackTexture;');
        expect(fragment).toContain('texture(uBackTexture, uv)');
        expect(fragment).toContain('texture(uTexture, vTextureCoord)');
        // Premultiplied render targets must be undone before luminance is read.
        expect(fragment).toContain('back.rgb / max(back.a, 1e-4)');
    });

    it('normalizes the palette colors and their luminance into uniforms', () => {
        const uniforms = uniformsOf(buildFilter({ ink: '#ffffff', paper: '#000000' }));

        expect(Array.from(uniforms.uInkColor.value as Float32Array)).toEqual([1, 1, 1]);
        expect(Array.from(uniforms.uPaperColor.value as Float32Array)).toEqual([0, 0, 0]);
        expect(uniforms.uInkColor.type).toBe('vec3<f32>');
        expect(uniforms.uInkLuminance.value).toBeCloseTo(1, 6);
        expect(uniforms.uPaperLuminance.value).toBeCloseTo(0, 6);
    });

    it('accepts rgba palette strings produced by colorWithAlpha', () => {
        const uniforms = uniformsOf(buildFilter({ ink: 'rgba(255, 0, 0, 0.5)', paper: 'rgb(0, 0, 255)' }));

        expect(Array.from(uniforms.uInkColor.value as Float32Array)).toEqual([1, 0, 0]);
        expect(Array.from(uniforms.uPaperColor.value as Float32Array)).toEqual([0, 0, 1]);
    });

    it('maps the threshold onto a neutral-at-0.5 bias', () => {
        expect(uniformsOf(buildFilter({ ink: '#fff', paper: '#000' })).uBias.value).toBeCloseTo(0, 6);
        expect(uniformsOf(buildFilter({ ink: '#fff', paper: '#000', threshold: 0.7 })).uBias.value).toBeCloseTo(0.2, 6);
    });

    it('leaves the tint off unless a ramp is supplied', () => {
        const uniforms = uniformsOf(buildFilter({ ink: '#fff', paper: '#000' }));
        expect(uniforms.uTintAmount.value).toBe(0);
        expect(uniformsOf(buildFilter({ ink: '#fff', paper: '#000', tint: ['#ff0000'] })).uTintAmount.value)
            .toBe(0);
    });

    it('tints the inversion instead of replacing it when a ramp is supplied', () => {
        const uniforms = uniformsOf(buildFilter({
            ink: '#ffffff',
            paper: '#000000',
            tint: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
        }));
        expect(uniforms.uTintAmount.value).toBe(1);
        expect(Array.from(uniforms.uTintA.value as Float32Array)).toEqual([1, 0, 0]);
        expect(Array.from(uniforms.uTintD.value as Float32Array)).toEqual([1, 1, 0]);

        // The shader must keep the luminance the inversion picked and take only the hue from
        // the ramp; anything else throws away the readability guarantee.
        const { fragment } = buildFilter({ ink: '#fff', paper: '#000' }).glProgram;
        expect(fragment).toContain('toneLuminance / tintLuminance');
    });

    it('keeps the ramp when the inversion is switched off', () => {
        // Gradient mode's lyric colour only exists as this filter's tint, so `textInversion:
        // false` must fall back to a tint-only pass rather than to no filter at all - the
        // latter left the text flat ink and lost the colour mode.
        const filter = buildFilter({
            ink: '#ffffff',
            paper: '#000000',
            tint: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
            inversion: false,
        });

        expect(filter.glProgram.name).toBe('tempera-text-tint');
        expect(uniformsOf(filter).uTintAmount.value).toBe(1);
        expect(filter.glProgram.fragment).toContain('sampleTint(tintPosition(vTextureCoord))');
        // Same ramp geometry as the inverted form: swept across the filter's own bounds.
        expect(filter.glProgram.fragment).toContain('uv.x * uInputSize.x / max(uOutputFrame.z, 1.0)');
        // No backdrop is read, so the pass must not ask Pixi to copy one every frame.
        expect(filter.blendRequired).toBe(false);
        expect(filter.resources.uBackTexture).toBeUndefined();
        expect(filter.glProgram.fragment).not.toContain('uBackTexture');
        // A hard 1 here would rasterize the type below the canvas resolution.
        expect(filter.resolution).toBe('inherit');
    });

    it('carries no time-varying uniform, so a seek needs no filter update', () => {
        const uniforms = uniformsOf(buildFilter({ ink: '#fff', paper: '#000' }));

        expect(Object.keys(uniforms).some(name => /time|frame|seed/i.test(name))).toBe(false);
    });
});
