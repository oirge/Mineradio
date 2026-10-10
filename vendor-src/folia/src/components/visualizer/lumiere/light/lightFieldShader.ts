// Copyright (c) 2026 chthollyphile
import type { Container } from 'pixi.js';
import { MAX_BEAMS, WAVE_MODE_ID, type LightRig, type ResolvedBeam } from './rig';

// 光场数据步长的参考值。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((105 ^ lumiereScaleMask) + Math.imul(97 ^ lumiereScaleMask, 0xbafc3e03 ^ lumiereScaleMask))
    - ((105 ^ lumiereScaleMask) + Math.imul(97 ^ lumiereScaleMask, 0xbafc3e03 ^ lumiereScaleMask));



// src/components/visualizer/lumiere/light/lightFieldShader.ts
// 光场：一个覆盖画面的 Mesh，片元着色器里算多束体积光 × 烟雾密度（丁达尔）、烟雾底色、光源眩光、暗场底。
// 光束公式与 rig.ts 的 beamMask 一字不差（改一边要改另一边，单测对拍）。
//
// 输出是合法的预乘颜色、alpha = 三通道最大值：普通混合下 = c + dst·(1 - max(c))，近似 screen，
// 不依赖 add 混合，场景容器挂了淡入淡出 / 模糊 filter、叠在透明底上时都一样（见 lumisynth docs/LUMIERE.md 第七节）。
type PixiModule = typeof import('pixi.js');

const vertex = `
in vec2 aPosition;
out vec2 vPos;
out float vAlpha;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;

void main(void) {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vPos = aPosition;
    vAlpha = uColor.a * uWorldColorAlpha.a;
}
`;

const fragment = `
precision highp float;
in vec2 vPos;
in float vAlpha;
out vec4 finalColor;

#define MAX_BEAMS ${MAX_BEAMS}

uniform vec4 uBeamA[MAX_BEAMS]; // ox, oy, dx, dy
uniform vec4 uBeamB[MAX_BEAMS]; // halfWidth, tanSpread, softness, length
uniform vec4 uBeamC[MAX_BEAMS]; // intensity, streaks, streakFreq, streakPhase
uniform vec4 uBeamD[MAX_BEAMS]; // r, g, b, core
uniform vec4 uBeamE[MAX_BEAMS]; // 窗影：pattern, frequency, duty, phase
uniform vec4 uBeamF[MAX_BEAMS]; // 色散, 射程, 0, 0
uniform vec4 uFrame;            // width, height, time, beamCount
uniform vec4 uFogA;             // density, tyndallBase, scale, warp
uniform vec4 uFogB;             // driftX, driftY, ambient, octaves
uniform vec3 uFogColor;
uniform vec4 uGlare;            // x, y, radius, intensity
uniform vec4 uGlareB;           // streak, 0, 0, 0
uniform vec3 uGlareColor;
uniform vec4 uDark;             // 暗场底：预乘颜色 rgb、alpha
uniform vec4 uCaustic;          // 焦散：scale, speed, inBeam, enabled
uniform vec4 uCausticFloor;     // 池底：cx, cy, rx, ry（高度单位）
uniform vec4 uCausticB;         // 池底亮度, 0, 0, 0
uniform vec4 uWave;             // 干涉：mode, frequency, speed, strength
uniform vec4 uWaveB;            // cx, cy, radius, separation（高度单位）
uniform vec4 uShield;           // 文字区：cx, cy, rx, ry（高度单位）
uniform vec4 uShieldB;          // x：文字区里条纹压暗多少

float hash11(float x) {
    float p = fract(x * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise1(float x) {
    float i = floor(x);
    float f = x - i;
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash11(i), hash11(i + 1.0), u);
}

float valueNoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, float octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) {
        if (float(i) >= octaves) break;
        sum += amp * valueNoise2(p);
        norm += amp;
        p = rot * p * 2.03 + vec2(17.1, 9.2);
        amp *= 0.5;
    }
    return sum / max(norm, 1e-4);
}

float fog(vec2 p, float t) {
    vec2 drift = uFogB.xy * t;
    vec2 q = (p - drift) * uFogA.z;
    float octaves = uFogB.w;
    vec2 w = vec2(
        fbm(q + vec2(0.0, t * 0.07), 3.0),
        fbm(q + vec2(5.2, 1.3) - vec2(t * 0.05, 0.0), 3.0)
    );
    float n = fbm(q + uFogA.w * (w - 0.5) * 2.0, octaves);
    // 拉开对比：烟是一缕一缕的，不是均匀的灰。
    return smoothstep(0.28, 0.82, n);
}

// 透光条：fract(x) 落在 [0, duty) 里为 1，边缘柔化（与 rig.ts 的 band 相同）。
float band(float x, float duty) {
    float f = fract(x);
    return min(1.0, 1.0 - smoothstep(duty - 0.06, duty + 0.06, f) + smoothstep(0.94, 1.0, f));
}

// 窗影图样：u 为截面横向位置 -1..1，v 为沿光束的距离。
float goboPattern(vec4 E, float u, float v) {
    float pattern = E.x;
    if (pattern < 1.5) return band(u * E.y * 0.5 + E.w, E.z);
    if (pattern < 2.5) return smoothstep(E.z * 0.5, E.z * 0.5 + 0.08, abs(u));
    if (pattern < 3.5) return band(u * E.y * 0.5 + v * E.y * 0.8 + E.w, E.z) * band(u * E.y * 0.5 - v * E.y * 0.8 - E.w, E.z);
    return smoothstep(E.z - 0.12, E.z + 0.12, valueNoise2(vec2(u * E.y, v * E.y * 0.6 + E.w)));
}

// 窗影（与 rig.ts 的 goboMask 相同）：影子里仍透过 12% 的散射光。
float goboMask(vec4 E, float u, float v) {
    if (E.x < 0.5) return 1.0;
    return 0.12 + 0.88 * goboPattern(E, u, v);
}

// 数组下标只能用循环变量（GLSL ES 1.0 的限制），所以按分量传进来。返回 (强度, 截面横向位置 -1..1)。
vec2 beamMask(vec4 A, vec4 B, vec4 C, float coreAmount, vec4 E, float reach, vec2 p) {
    vec2 d = p - A.xy;
    float along = dot(d, A.zw);
    if (along <= 0.0) return vec2(0.0);
    float signedPerp = d.x * -A.w + d.y * A.z;
    // 取绝对值：会聚的光束过了焦点再散开。
    float half_ = abs(B.x + along * B.y) + 1e-4;
    float s = abs(signedPerp) / half_;
    float edge = smoothstep(1.0, 1.0 - max(B.z, 0.02), s);
    if (edge <= 0.0) return vec2(0.0);
    float signedS = s * sign(signedPerp);
    float streak = 1.0 - C.y + C.y * valueNoise1(signedS * C.z + C.w);
    float core = 1.0 - coreAmount + coreAmount * (1.0 - s * s);
    float falloff = exp(-along / max(B.w, 0.001));
    float reachMask = reach > 0.0 ? 1.0 - smoothstep(reach - max(0.04, half_ * 2.5), reach, along) : 1.0;
    float start = smoothstep(0.0, abs(B.x) * 2.0 + 0.01, along);
    return vec2(edge * streak * core * falloff * goboMask(E, signedS, along) * reachMask * start * C.x, signedS);
}

// 色散：截面横向位置 -> 光谱色（红在一侧、紫在另一侧）。
vec3 spectrumColor(float u) {
    float h = clamp(0.5 + 0.5 * u, 0.0, 1.0) * 0.8;
    vec3 k = clamp(abs(fract(vec3(h) + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    return mix(vec3(1.0), k, 0.85);
}

// 焦散（水面焦散的经典迭代，去掉取模，连续不接缝）。
float causticField(vec2 p, float t) {
    vec2 q = p * uCaustic.x * 6.2831853 - 250.0;
    vec2 i = q;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
        float tt = t * (1.0 - (3.5 / float(n + 1)));
        i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 3.0);
}

// 干涉与衍射：在一块圆形区域里发光的条纹。
float wavePattern(vec2 p, float t) {
    vec2 d = p - uWaveB.xy;
    float radius = max(uWaveB.z, 1e-3);
    float r = length(d) / radius;
    float mask = smoothstep(1.0, 0.55, r);
    float mode = uWave.x;
    float f = uWave.y;
    float phase = t * uWave.z;
    float v;
    if (mode < 1.5) {
        v = 0.5 + 0.5 * cos(r * r * f * 6.0 - phase);
    } else if (mode < 2.5) {
        // 双缝：条纹离中心越远越弯（双曲线），包络是椭圆，不是矩形。
        float x = d.x / radius;
        float y = d.y / radius;
        float xc = x * (1.0 + 0.35 * y * y);
        v = pow(cos(xc * f * 3.0 - phase * 0.3), 2.0) * exp(-xc * xc * 2.5);
        mask = smoothstep(1.0, 0.25, length(vec2(x * 0.85, y * 1.5)));
    } else if (mode < 3.5) {
        vec2 s1 = vec2(-uWaveB.w * 0.5, 0.0);
        float d1 = length(d - s1);
        float d2 = length(d + s1);
        v = (0.5 + 0.5 * cos((d1 - d2) * f * 20.0)) * (0.5 + 0.5 * cos((d1 + d2) * f * 6.0 - phase));
    } else {
        float x = r * f * 4.0 + 1e-3;
        float sc = sin(x) / x;
        v = min(sc * sc * 4.0, 1.5);
    }
    // 文字区里压暗，字压在条纹上还读得清。
    vec2 q = (p - uShield.xy) / max(uShield.zw, vec2(1e-3));
    float shield = 1.0 - uShieldB.x * smoothstep(1.0, 0.35, length(q));
    return v * mask * shield * uWave.w;
}

void main(void) {
    float H = uFrame.y;
    float t = uFrame.z;
    vec2 p = vPos / H;

    float density = fog(p, t);
    float tyndall = uFogA.y + (1.0 - uFogA.y) * density * uFogA.x;

    float caustic = uCaustic.w > 0.5 ? causticField(p, t * uCaustic.y + 23.0) : 0.0;
    float causticLift = mix(1.0, 0.25 + 1.5 * caustic, uCaustic.w > 0.5 ? uCaustic.z : 0.0);

    vec3 light = vec3(0.0);
    int count = int(uFrame.w + 0.5);
    for (int i = 0; i < MAX_BEAMS; i++) {
        if (i >= count) break;
        vec4 D = uBeamD[i];
        vec2 m = beamMask(uBeamA[i], uBeamB[i], uBeamC[i], D.w, uBeamE[i], uBeamF[i].y, p);
        vec3 color = D.rgb;
        float spectrum = uBeamF[i].x;
        if (spectrum > 0.0) color = mix(color, spectrumColor(m.y) * max(max(color.r, color.g), color.b), spectrum);
        light += color * m.x;
    }
    light *= tyndall * causticLift;

    // 池底的焦散光斑（不靠烟，直接亮）。
    if (uCaustic.w > 0.5 && uCausticB.x > 0.0) {
        vec2 e = (p - uCausticFloor.xy) / max(uCausticFloor.zw, vec2(1e-3));
        light += uFogColor * caustic * uCausticB.x * smoothstep(1.0, 0.6, length(e));
    }
    // 干涉条纹。
    if (uWave.x > 0.5) light += uFogColor * wavePattern(p, t);

    // 光束之外的烟：很淡，只给暗场一点空间感。
    light += uFogColor * density * uFogB.z;

    // 光源眩光：亮核 + 大半径柔光 + 横向拉丝。
    if (uGlare.w > 0.0) {
        vec2 g = p - uGlare.xy;
        float r = max(uGlare.z, 1e-3);
        float dist = length(g);
        float glare = exp(-dist / r) * 0.55 + exp(-(dist * dist) / (r * r * 0.03));
        float streak = exp(-abs(g.y) / (r * 0.035)) * exp(-abs(g.x) / (r * 7.0)) * uGlareB.x;
        light += uGlareColor * (glare + streak) * uGlare.w;
    }

    // 保持色相的压缩：按最大通道压到 0..1，只在极亮处微微发白（逐通道压缩会把金色压成白色）。
    float peak = max(max(light.r, light.g), light.b);
    float mapped = 1.0 - exp(-peak);
    vec3 c = peak > 1e-5 ? light / peak * mapped : vec3(0.0);
    c = mix(c, vec3(mapped), 0.3 * mapped * mapped * mapped);
    // 抖动，免得暗部渐变在 8 位视频里出色带（按像素坐标，确定性）。
    c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
    c = clamp(c, 0.0, 1.0);
    float a = max(max(c.r, c.g), c.b);

    // 叠在暗场底上（预乘的 over）。
    vec3 rgb = c + uDark.rgb * (1.0 - a);
    float alpha = a + uDark.a * (1.0 - a);
    finalColor = vec4(rgb, alpha) * vAlpha;
}
`;

export interface LightFieldFrame {
    beams: readonly ResolvedBeam[];
    rig: LightRig;
    time: number;
    /** 烟雾的整体浓度倍率（tuning）。 */
    fogScale: number;
    /** 光色（0..1），给烟雾底色与眩光。 */
    color: [number, number, number];
    /** 眩光的整体倍率（进退场、tuning）。 */
    glareScale: number;
    /** 暗场底：预乘颜色与 alpha。 */
    dark: [number, number, number, number];
    /** 烟雾倍频数（画质档）。 */
    octaves: number;
    /** 文字区（画面比例的中心与宽高），干涉条纹在这里压暗。 */
    textRegion?: { cx: number; cy: number; w: number; h: number };
}

export interface LightField {
    view: Container;
    update: (frame: LightFieldFrame) => void;
    destroy: () => void;
}

/**
 * margin：四边各外扩多少逻辑像素。场景的运镜（手持浮动、呼吸缩放可以略小于 1、平移）会把画框边缘露出来，
 * 亮色主题下暗场底一露边就是一条亮缝；外扩的部分按同样的像素坐标继续算光场，接缝看不出来。
 */
export const createLightField = (pixi: PixiModule, width: number, height: number, margin = 0): LightField => {
    const x0 = -margin;
    const y0 = -margin;
    const x1 = width + margin;
    const y1 = height + margin;
    const geometry = new pixi.Geometry({
        attributes: {
            aPosition: [x0, y0, x1, y0, x1, y1, x0, y1],
        },
        indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const uniforms = new pixi.UniformGroup({
        uBeamA: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uBeamB: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uBeamC: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uBeamD: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uBeamE: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uBeamF: { value: new Float32Array(MAX_BEAMS * 4), type: 'vec4<f32>', size: MAX_BEAMS },
        uFrame: { value: new Float32Array([width, height, 0, 0]), type: 'vec4<f32>' },
        uFogA: { value: new Float32Array(4), type: 'vec4<f32>' },
        uFogB: { value: new Float32Array(4), type: 'vec4<f32>' },
        uFogColor: { value: new Float32Array(3), type: 'vec3<f32>' },
        uGlare: { value: new Float32Array(4), type: 'vec4<f32>' },
        uGlareB: { value: new Float32Array(4), type: 'vec4<f32>' },
        uGlareColor: { value: new Float32Array(3), type: 'vec3<f32>' },
        uDark: { value: new Float32Array(4), type: 'vec4<f32>' },
        uCaustic: { value: new Float32Array(4), type: 'vec4<f32>' },
        uCausticFloor: { value: new Float32Array(4), type: 'vec4<f32>' },
        uCausticB: { value: new Float32Array(4), type: 'vec4<f32>' },
        uWave: { value: new Float32Array(4), type: 'vec4<f32>' },
        uWaveB: { value: new Float32Array(4), type: 'vec4<f32>' },
        uShield: { value: new Float32Array(4), type: 'vec4<f32>' },
        uShieldB: { value: new Float32Array(4), type: 'vec4<f32>' },
    });
    const shader = new pixi.Shader({
        glProgram: pixi.GlProgram.from({ vertex, fragment, name: 'lumiere-light-field' }),
        resources: { lightUniforms: uniforms },
    });
    const mesh = new pixi.Mesh({ geometry, shader });

    const u = uniforms.uniforms as Record<string, Float32Array>;

    const update = (frame: LightFieldFrame) => {
        const { beams, rig, time } = frame;
        const A = u.uBeamA, B = u.uBeamB, C = u.uBeamC, D = u.uBeamD, E = u.uBeamE, F = u.uBeamF;
        A.fill(0); B.fill(0); C.fill(0); D.fill(0); E.fill(0); F.fill(0);
        beams.forEach((beam, index) => {
            const o = index * (4 + LUMIERE_NEUTRAL_OFFSET);
            A[o] = beam.ox; A[o + 1] = beam.oy; A[o + 2] = beam.dx; A[o + 3] = beam.dy;
            B[o] = beam.halfWidth; B[o + 1] = beam.tanSpread; B[o + 2] = beam.softness; B[o + 3] = beam.length;
            C[o] = beam.intensity; C[o + 1] = beam.streaks; C[o + 2] = beam.streakFreq; C[o + 3] = beam.streakPhase;
            D[o] = beam.r; D[o + 1] = beam.g; D[o + 2] = beam.b; D[o + 3] = beam.core;
            E[o] = beam.goboPattern; E[o + 1] = beam.goboFreq; E[o + 2] = beam.goboDuty; E[o + 3] = beam.goboPhase;
            F[o] = beam.spectrum;
            F[o + 1] = beam.reach;
        });
        u.uFrame[0] = width;
        u.uFrame[1] = height;
        u.uFrame[2] = time;
        u.uFrame[3] = beams.length;
        const fog = rig.fog;
        u.uFogA[0] = fog.density * frame.fogScale;
        u.uFogA[1] = fog.tyndallBase;
        u.uFogA[2] = fog.scale;
        u.uFogA[3] = fog.warp;
        u.uFogB[0] = fog.driftX;
        u.uFogB[1] = fog.driftY;
        u.uFogB[2] = fog.ambient * frame.fogScale;
        u.uFogB[3] = frame.octaves;
        u.uFogColor[0] = frame.color[0];
        u.uFogColor[1] = frame.color[1];
        u.uFogColor[2] = frame.color[2];
        const glare = rig.glare;
        const aspect = width / height;
        u.uGlare[0] = glare ? glare.x * aspect : 0;
        u.uGlare[1] = glare ? glare.y : 0;
        u.uGlare[2] = glare ? glare.radius : 0;
        u.uGlare[3] = glare ? glare.intensity * frame.glareScale : 0;
        u.uGlareB[0] = glare ? glare.streak : 0;
        u.uGlareColor[0] = frame.color[0];
        u.uGlareColor[1] = frame.color[1];
        u.uGlareColor[2] = frame.color[2];
        u.uDark.set(frame.dark);
        const caustic = rig.caustic;
        u.uCaustic[0] = caustic?.scale ?? 0;
        u.uCaustic[1] = caustic?.speed ?? 0;
        u.uCaustic[2] = caustic?.inBeam ?? 0;
        u.uCaustic[3] = caustic ? 1 : 0;
        u.uCausticFloor[0] = (caustic?.floor?.cx ?? 0) * aspect;
        u.uCausticFloor[1] = caustic?.floor?.cy ?? 0;
        u.uCausticFloor[2] = (caustic?.floor?.rx ?? 0) * aspect;
        u.uCausticFloor[3] = caustic?.floor?.ry ?? 0;
        u.uCausticB[0] = (caustic?.floor?.strength ?? 0) * frame.glareScale;
        const wave = rig.wave;
        u.uWave[0] = wave ? WAVE_MODE_ID[wave.mode] : 0;
        u.uWave[1] = wave?.frequency ?? 0;
        u.uWave[2] = wave?.speed ?? 0;
        u.uWave[3] = (wave?.strength ?? 0) * frame.glareScale;
        u.uWaveB[0] = (wave?.cx ?? 0) * aspect;
        u.uWaveB[1] = wave?.cy ?? 0;
        u.uWaveB[2] = wave?.radius ?? 0;
        u.uWaveB[3] = wave?.separation ?? 0;
        const region = frame.textRegion;
        u.uShield[0] = region ? region.cx * aspect : 0;
        u.uShield[1] = region ? region.cy : 0;
        u.uShield[2] = region ? (region.w * aspect) / 2 : 1;
        u.uShield[3] = region ? region.h / 2 : 1;
        u.uShieldB[0] = region && wave ? wave.shield ?? 0.45 : 0;
        uniforms.update();
    };

    return {
        view: mesh,
        update,
        destroy: () => {
            mesh.destroy();
            // 传 true 连顶点 / 索引缓冲一起销毁；Geometry.destroy() 默认不动缓冲，要等 Pixi 的 GC 空闲 60 秒才删。
            geometry.destroy(true);
            shader.destroy();
        },
    };
};
