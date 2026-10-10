import type { Filter } from 'pixi.js';

// src/components/visualizer/sonnet/sonnetPrintFilters.ts
// Fixed-parameter print-style scene filters (RGB shift, halftone screen, ordered dither,
// vignette). Single full-screen pass each, no runtime uniforms — the post-process toggle
// in sonnet tuning enables or disables the whole group as-is.
type PixiModule = typeof import('pixi.js');

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

// Subtle constant chromatic aberration: ~1.25px split along a fixed 25-degree axis.
const rgbShiftFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uAmount;

vec4 sampleInside(vec2 uv) {
    if (uv.x < uInputClamp.x || uv.y < uInputClamp.y
        || uv.x > uInputClamp.z || uv.y > uInputClamp.w) {
        return vec4(0.0);
    }
    return texture(uTexture, uv);
}

void main(void) {
    vec2 offset = vec2(0.9063, 0.4226) * uAmount * 3.0 * uInputSize.zw;
    vec4 redSample = sampleInside(vTextureCoord + offset);
    vec4 center = sampleInside(vTextureCoord);
    vec4 blueSample = sampleInside(vTextureCoord - offset);
    float alpha = max(center.a, max(redSample.a, blueSample.a));
    float coreWeight = 0.84 - clamp(uAmount, 0.0, 1.0) * 0.18;
    vec3 core = center.rgb * coreWeight;
    vec3 separated = vec3(redSample.r, center.g, blueSample.b);
    // Preserve a neutral core for thin strokes so transparent red/blue offset samples cannot
    // collapse a white MG line into an unintended green-only result.
    finalColor = vec4(max(core, separated), alpha);
}
`;

// Single-sample halftone screen: dots are screened per RGB channel at classic CMYK
// angles, so dark areas stay dark and no paper color is introduced.
const halftoneFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uAmount;

float dotScreen(vec2 fragCoord, float angle, float value, float cellSize) {
    float c = cos(angle);
    float s = sin(angle);
    vec2 rotated = mat2(c, s, -s, c) * fragCoord;
    float dist = length(fract(rotated / cellSize) - 0.5) * cellSize;
    float radius = sqrt(clamp(value, 0.0, 1.0)) * cellSize * 0.62;
    return 1.0 - smoothstep(radius - 1.2, radius + 1.2, dist);
}

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    if (color.a > 0.0) {
        color.rgb /= color.a;
    }
    float cellSize = 5.0;
    vec3 screened = vec3(
        dotScreen(gl_FragCoord.xy, radians(15.0), color.r, cellSize),
        dotScreen(gl_FragCoord.xy, radians(75.0), color.g, cellSize),
        dotScreen(gl_FragCoord.xy, radians(0.0), color.b, cellSize)
    );
    color.rgb = mix(color.rgb, screened, uAmount);
    color.rgb *= color.a;
    finalColor = color;
}
`;

// Fixed vignette: darkens toward the screen edges. Computed in screen space (the input
// texture can extend past the viewport while the camera pans), and blended toward opaque
// black so it also reads over the scene's transparent background.
const vignetteFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uAmount;

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    // The filtered container uses a viewport-sized filterArea, so this recovers stable
    // 0..1 viewport coordinates instead of coordinates derived from lyric bounds.
    vec2 screenUv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    vec2 centered = screenUv - 0.5;
    centered.x *= uOutputFrame.z / uOutputFrame.w;
    float vignette = clamp(smoothstep(0.52, 1.08, length(centered)) * uAmount * 0.6, 0.0, 1.0);
    finalColor = mix(color, vec4(0.0, 0.0, 0.0, 1.0), vignette);
}
`;

const createPass = (pixi: PixiModule, name: string, fragment: string, amount: number): Filter =>
    new pixi.Filter({
        glProgram: pixi.GlProgram.from({ vertex, fragment, name }),
        resources: {
            printUniforms: new pixi.UniformGroup({
                uAmount: { value: amount, type: 'f32' },
            }),
        },
        // The app canvas is MSAA (antialias: true), but filter passes render into an
        // offscreen texture that is not multisampled by default — thin strokes would
        // lose their AA and turn jagged. Keep MSAA on for these scene-wide passes.
        antialias: 'on',
    });

export interface SonnetPrintEffectAmounts {
    rgbShift: number;
    halftone: number;
    vignette: number;
}

export const createSonnetPrintFilters = (pixi: PixiModule, amounts: SonnetPrintEffectAmounts): Filter[] => {
    const filters: Filter[] = [];
    if (amounts.rgbShift > 0) filters.push(createPass(pixi, 'sonnet-print-rgb-shift', rgbShiftFragment, amounts.rgbShift));
    if (amounts.halftone > 0) filters.push(createPass(pixi, 'sonnet-print-halftone', halftoneFragment, amounts.halftone));
    if (amounts.vignette > 0) filters.push(createPass(pixi, 'sonnet-print-vignette', vignetteFragment, amounts.vignette));
    return filters;
};
