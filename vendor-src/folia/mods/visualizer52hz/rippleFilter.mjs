// mods/visualizer52hz/rippleFilter.mjs
// The ring field, one full-screen pass. Nothing per ring is stored: a ring
// now at distance d from the glyphs was born `d / speed` seconds ago, so the
// shader reads two history strips at that moment: how loud the music was, and
// how far it was from the nearest beat. A growth line is drawn where the birth
// time sits on a beat, so rings come out on the rhythm; loud beats give thicker,
// brighter rings — a tree-ring record of the song spreading outward along the
// shape of the lyric.
//
// Up to SLOT_COUNT lines can be on screen at once: each slot holds one lyric
// line's distance field and the song-time window during which it emitted, so
// rings born under an earlier line keep that line's shape as they travel on.

export const SLOT_COUNT = 4;
export const HISTORY_SIZE = 1024;
export const HISTORY_RATE = 60;

// Pixi compiles a program as GLSL ES 3.00 only when the source says so; without
// the directive it treats it as WebGL1 and texelFetch / textureSize fail.
const vertex = `#version 300 es
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

const fragment = `#version 300 es
in vec2 vTextureCoord;
out vec4 finalColor;

uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

uniform sampler2D uField0;
uniform sampler2D uField1;
uniform sampler2D uField2;
uniform sampler2D uField3;
uniform sampler2D uHistory;
uniform sampler2D uBeats;   // seconds from each sample to the nearest ring birth (beat)

uniform vec2 uScreen;       // CSS px
uniform float uCell;        // CSS px per field cell
uniform vec2 uWindow0;      // song-time [start, end] each slot emitted rings
uniform vec2 uWindow1;
uniform vec2 uWindow2;
uniform vec2 uWindow3;
uniform float uTime;        // song time, s
uniform float uHistoryStart;
uniform float uSpeed;       // CSS px per second
uniform float uFadeDistance; // CSS px at which a ring has faded out (the screen edge)
uniform float uOpacity;
uniform vec3 uColorNear;
uniform vec3 uColorFar;

const float HISTORY_SIZE = ${HISTORY_SIZE}.0;
const float HISTORY_RATE = ${HISTORY_RATE}.0;

// r32float is not filterable everywhere, so the fields are NEAREST and
// interpolated here.
float fieldAt(sampler2D field, vec2 cell) {
    ivec2 size = textureSize(field, 0);
    vec2 p = clamp(cell - 0.5, vec2(0.0), vec2(size - 1));
    ivec2 i0 = ivec2(floor(p));
    ivec2 i1 = min(i0 + 1, size - 1);
    vec2 f = fract(p);
    float a = texelFetch(field, i0, 0).r;
    float b = texelFetch(field, ivec2(i1.x, i0.y), 0).r;
    float c = texelFetch(field, ivec2(i0.x, i1.y), 0).r;
    float d = texelFetch(field, i1, 0).r;
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float stripAt(sampler2D strip, float birth) {
    float index = birth * HISTORY_RATE;
    float i0 = floor(index);
    float w = index - i0;
    float a = texelFetch(strip, ivec2(int(mod(i0, HISTORY_SIZE)), 0), 0).r;
    float b = texelFetch(strip, ivec2(int(mod(i0 + 1.0, HISTORY_SIZE)), 0), 0).r;
    return mix(a, b, w);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Rings from one slot at this pixel; also reports the nearest ring distance for coloring.
float rings(sampler2D field, vec2 window, vec2 cell, float grain, inout float nearestOut) {
    if (window.y < window.x) return 0.0;
    float rawDistance = fieldAt(field, cell) * uCell;
    // Negative: inside the gap a source keeps clear around itself.
    if (rawDistance < 0.0) return 0.0;
    // Uneven growth, like wood: fixed in space, so each ring wobbles the same way
    // as it travels, and stronger the farther it is from the glyphs.
    float distancePx = rawDistance + grain * min(rawDistance, 600.0) * 0.22;
    if (distancePx >= uFadeDistance) return 0.0;
    float age = distancePx / uSpeed;
    float birth = uTime - age;
    if (birth < uHistoryStart) return 0.0;
    // Soft edges where the slot started / stopped emitting.
    float inWindow = smoothstep(window.x - 0.02, window.x + 0.25, birth)
        * (1.0 - smoothstep(window.y - 0.25, window.y + 0.02, birth));
    if (inWindow <= 0.0) return 0.0;

    float energy = stripAt(uHistory, birth);
    // Distance to the ring born on the nearest beat, in pixels on screen.
    float fromLinePx = stripAt(uBeats, birth) * uSpeed;
    // Thin lines, 1-5 px wide depending on how loud the beat was.
    float halfWidthPx = mix(0.5, 2.4, pow(energy, 1.5));
    float line = 1.0 - smoothstep(halfWidthPx, halfWidthPx + 1.2, fromLinePx);
    float band = energy * energy * 0.05;
    // Faded by distance, not age, so rings are gone by the screen edge at any speed.
    float fade = pow(1.0 - distancePx / uFadeDistance, 1.8)
        * smoothstep(0.0, 24.0, rawDistance);   // rings surface softly at the gap's edge
    nearestOut = min(nearestOut, distancePx);
    return (line * (0.25 + 0.75 * energy) + band) * fade * inWindow;
}

void main(void) {
    vec2 screenUv = vTextureCoord * uInputSize.xy / max(uOutputFrame.zw, vec2(1.0));
    vec2 cell = screenUv * uScreen / uCell;
    vec2 grainUv = screenUv * uScreen / 260.0;
    float grain = valueNoise(grainUv) * 0.7 + valueNoise(grainUv * 2.3 + 7.1) * 0.3 - 0.5;
    float nearest = 1e9;
    float total = rings(uField0, uWindow0, cell, grain, nearest)
        + rings(uField1, uWindow1, cell, grain, nearest)
        + rings(uField2, uWindow2, cell, grain, nearest)
        + rings(uField3, uWindow3, cell, grain, nearest);
    float alpha = (1.0 - exp(-total * 1.6)) * uOpacity;
    vec3 color = mix(uColorNear, uColorFar, clamp(nearest / uFadeDistance * 1.6, 0.0, 1.0));
    finalColor = vec4(color * alpha, alpha);
}
`;

const createFloatSource = (pixi, data, width, height) => new pixi.BufferImageSource({
  resource: data,
  width,
  height,
  format: 'r32float',
  scaleMode: 'nearest',
  autoGenerateMipmaps: false,
  alphaMode: 'no-premultiply-alpha',
});

/** A field source for one slot (grid-sized, all "infinitely far" until filled). */
export const createFieldSource = (pixi, width, height) => {
  const data = new Float32Array(width * height).fill(1e6);
  return createFloatSource(pixi, data, width, height);
};

export const createHistorySource = (pixi) => createFloatSource(pixi, new Float32Array(HISTORY_SIZE), HISTORY_SIZE, 1);

/** "No beat anywhere near": larger than any gap the shader could draw a line in. */
export const FAR_FROM_BEAT = 99;

export const createRippleFilter = (pixi, { fieldSources, historySource, beatSource }) => {
  const uniforms = new pixi.UniformGroup({
    uScreen: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uCell: { value: 4, type: 'f32' },
    uWindow0: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
    uWindow1: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
    uWindow2: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
    uWindow3: { value: new Float32Array([1, 0]), type: 'vec2<f32>' },
    uTime: { value: 0, type: 'f32' },
    uHistoryStart: { value: 0, type: 'f32' },
    uSpeed: { value: 120, type: 'f32' },
    uFadeDistance: { value: 800, type: 'f32' },
    uOpacity: { value: 0.85, type: 'f32' },
    uColorNear: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uColorFar: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
  });
  const filter = new pixi.Filter({
    glProgram: pixi.GlProgram.from({ vertex, fragment, name: 'visualizer52hz-rings' }),
    resources: {
      ringUniforms: uniforms,
      uField0: fieldSources[0],
      uField1: fieldSources[1],
      uField2: fieldSources[2],
      uField3: fieldSources[3],
      uHistory: historySource,
      uBeats: beatSource,
    },
  });
  return { filter, uniforms: uniforms.uniforms };
};
