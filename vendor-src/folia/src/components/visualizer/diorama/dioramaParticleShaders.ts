import {
    DIORAMA_SHAPE_DISSOLVE_END,
    DIORAMA_SHAPE_DISSOLVE_START,
    DIORAMA_SHAPE_FADE_IN_END,
    DIORAMA_SHAPE_FADE_IN_START,
} from './cameraPath';
import { DIORAMA_RIPPLE_COUNT } from './dioramaParticleModel';

// src/components/visualizer/diorama/dioramaParticleShaders.ts
// One self-lit soft-point shader shared by both geometry modes and both render layers (opaque contrast
// points + additive glow halo, via uGlowPass).
//
// DISPLACEMENT — EVERY displacement below is a fraction of `aScale.z`, the primitive's OWN radius, so
// uAmplitude means the same thing on a small cloud, a 3.4x pillar and the radius-7.4 tunnel. A world-
// constant throw is what erased the shapes: a ~2-unit offset is a wisp on the tunnel and total
// obliteration for a 0.7-unit cloud.
//
// Both modes share ONE shape of displacement - `basePos + normalDir * (swell * localRadius)` - where the
// swell is a SCALAR field. That shape is what makes sharp-edged geometry safe, on two conditions the
// lattice guarantees (see dioramaParticleSurfaces.ts): the field is a continuous function of position,
// and `normalDir` is a continuous function of position too. Two points either side of a cube's edge then
// read almost the same swell and almost the same direction, and two COINCIDENT points read exactly the
// same of both - so faces physically cannot separate, whatever the amplitude.
//
// BOTH MODES ARE NOW RIPPLE-DRIVEN, off the same sources and the same packet maths. Audio never deforms
// anything directly; it only spawns sources (see DioramaParticleField). Each live source contributes an
// expanding, oscillating, decaying packet centred on its origin, so one hit lifts a whole contiguous band
// of surface into a crest that spreads and settles - not a scatter of individual points sticking out.
// Because the motion after a spawn is autonomous (driven by uTime, not by this frame's band value), it
// physically cannot twitch. The packet's sin() inside a Gaussian envelope is the elasticity and inertia:
// the surface overshoots, rings, and falls back. The two modes differ ONLY in the space the distance to a
// source is measured in - 3D for a cloud, the tunnel's (along, around) surface for the corridor.
//
// THE CORRIDOR SEAM. The tunnel's angular coordinate runs 0..2*PI and then wraps back to 0. Any function
// that reads that raw angle must close on itself after one full turn, or the wall does not match up where
// the sampling wraps - which is a seam that exists with the audio muted, and reads exactly as "a plane
// rolled into a cylinder". The previous field did not: it used sin(w.y * 1.8) and sin(w.y * 2.3), and
// neither 1.8 nor 2.3 closes after 2*PI, so the wave value stepped by ~0.6 across the seam (about two
// world units of radial offset at the tunnel's radius). aPhase carried the same bug via `angle * 0.35`.
// Two rules fix it for good, and everything angular below obeys one of them:
//   1. Ripples measure the angular offset through corridorSurfaceDelta, which wraps it to [-PI, PI]. That
//      is exactly periodic, so the seam is not a place - the two sides are simply neighbours, as they
//      physically are on the wall.
//   2. The idle breath and the detail field use INTEGER harmonics of the angle only. An integer multiple
//      of a full turn is a full number of cycles, so the function closes on itself by construction.
//
// NYQUIST. uWaveNumberMax is derived from the buffer's ACTUAL lattice spacing (see resolveWaveNumberMax)
// and clamps every wavenumber here. It is not taste: a wavelength below ~4 lattice steps puts neighbouring
// points on opposite phases, and the crest stops reading as a surface and becomes the random scatter we
// are required not to produce. Detail therefore scales with the density slider, honestly, instead of being
// a constant that only holds at one density.
//
// Both modes feed one `d` (0..1 "how hard is the music pushing this point"). It is built from the AUDIO
// swell ONLY - the idle breath is deliberately excluded - so size, colour and glow track real audio energy
// and a still surface stays still and dark.
export const DIORAMA_PARTICLE_VERTEX_SHADER = `
#define RIPPLE_COUNT ${DIORAMA_RIPPLE_COUNT}

attribute vec3 aNormal;
attribute vec3 aAnchor;
attribute vec3 aScale;   // (uniformScale, yStretch, localRadius = this primitive's own size)
attribute float aPhase;
attribute vec3 aStyle;
attribute vec2 aWave;    // corridor: (along the tunnel in radius units, angle around it). clouds: dissolve seed.

uniform float uTime;
uniform float uCorridor;      // 0 = formation clouds, 1 = path tunnel
uniform float uAmplitude;     // displacement per unit of swell, as a FRACTION of the primitive's own radius
uniform float uMaxSwell;      // the DISPLACEMENT that counts as full reach - normalises d. Reading d off
                              // the raw wave instead let a point glow while the amplitude held it
                              // perfectly still (audio response at 0: no motion, full halo).
uniform float uWaveNumberMax; // finest wavenumber this buffer's lattice can carry without aliasing
uniform float uDetail;        // 0..1 sustained treble: fine surface texture ON EXISTING CRESTS only
// Ripple sources. Audio writes these and nothing else; the surface motion is autonomous after.
//   clouds:   xyz = origin on the shape's unit sphere
//   corridor: xy  = origin as (along, angle) on the tunnel wall
uniform vec4 uRippleSource[RIPPLE_COUNT];  // origin, w = birth time
uniform vec4 uRippleShape[RIPPLE_COUNT];   // x = strength, y = speed, z = packet width, w = wavenumber
uniform float uOffsetGain;    // whole-body sway gain, driven by mid energy
uniform float uFlow;          // how much the corridor's idle breath travels on its own
uniform float uFormation;     // 1 = formed, 0 = fully scattered/dissolved (song-change dissolve)
uniform float uScatter;       // how far points fly out when dissolving
uniform float uPulse;         // gentle whole-body beat scale
uniform float uSpectralCentroid;
uniform float uViewportHeight;
uniform float uSizeBase;
uniform float uSizeGain;
uniform float uGlow;
uniform float uGlowPass;
uniform vec3 uPrimaryColor;
uniform vec3 uAccentColor;
uniform vec3 uSecondaryColor;

varying vec3 vColor;
varying float vAlpha;
varying float vReaction;

float hermite(float value) { return value * value * (3.0 - 2.0 * value); }
float hash11(float n) { return fract(sin(n) * 43758.5453123); }

float resolveLife(float distanceToCamera) {
    float farT = clamp((${DIORAMA_SHAPE_FADE_IN_END.toFixed(1)} - distanceToCamera) / ${(
        DIORAMA_SHAPE_FADE_IN_END - DIORAMA_SHAPE_FADE_IN_START
    ).toFixed(1)}, 0.0, 1.0);
    float nearT = clamp((distanceToCamera - ${DIORAMA_SHAPE_DISSOLVE_END.toFixed(1)}) / ${(
        DIORAMA_SHAPE_DISSOLVE_START - DIORAMA_SHAPE_DISSOLVE_END
    ).toFixed(1)}, 0.0, 1.0);
    return hermite(farT) * hermite(nearT);
}

/**
 * One ripple's contribution at distance r from its origin - the whole elastic behaviour, in four terms:
 *   dr   = how far this point is from the ring the wave has expanded to (age * speed)
 *   sin  = the crest/trough, so the surface overshoots and rings back (elasticity + inertia)
 *   exp  = the packet's width, then the decay in time and in distance (birth, spread, settle)
 * Every term is a smooth function of r, so neighbouring points - including across a cube's edge or the
 * tunnel's seam - move together as one wavefront. Shared by both modes: only r is measured differently.
 */
float ripplePacket(float r, float age, vec4 shape) {
    float dr = r - age * shape.y;
    float k = min(shape.w, uWaveNumberMax);
    float packet = exp(-(dr * dr) / (shape.z * shape.z)) * sin(dr * k);
    // The age decay has to outlast the wave's own travel, or it dies before it has visibly crossed the
    // surface - and the propagation is the entire point.
    return shape.x * packet * exp(-age * 1.15) * exp(-r * 0.35);
}

/** Clouds: sum of every live ripple, in the shape's own unit space. Each cluster spins the origin by its
 *  own phase, so neighbouring clouds are struck in the same instant but not at the same spot. */
float cloudRipples(vec3 unitPos, float phase) {
    float spin = cos(phase);
    float spun = sin(phase);
    float total = 0.0;
    for (int i = 0; i < RIPPLE_COUNT; i += 1) {
        vec4 source = uRippleSource[i];
        vec4 shape = uRippleShape[i];
        float age = uTime - source.w;
        if (shape.x <= 0.0 || age < 0.0) continue;
        vec3 origin = vec3(
            source.x * spin - source.z * spun,
            source.y,
            source.x * spun + source.z * spin
        );
        total += ripplePacket(distance(unitPos, origin), age, shape);
    }
    return total;
}

/**
 * Offset from a source to this point ON THE TUNNEL WALL, as (along, arc), both in radius units so the
 * result is directly comparable to a cloud's 3D distance and one set of ripple parameters drives both.
 * The angular term is wrapped to [-PI, PI] by atan(sin, cos), which is EXACTLY periodic - that is what
 * makes a ripple cross the seam without noticing it, and lets it spread round the circumference and meet
 * itself on the far side. See the seam note at the top of this file.
 */
vec2 corridorSurfaceDelta(vec2 w, vec2 origin) {
    float dAngle = w.y - origin.y;
    return vec2(w.x - origin.x, atan(sin(dAngle), cos(dAngle)));
}

/** Corridor: the same ripples, measured across the wall - so a hit lifts a contiguous patch of cylinder
 *  that then travels both round the ring and along the tunnel. */
float corridorRipples(vec2 w) {
    float total = 0.0;
    for (int i = 0; i < RIPPLE_COUNT; i += 1) {
        vec4 source = uRippleSource[i];
        vec4 shape = uRippleShape[i];
        float age = uTime - source.w;
        if (shape.x <= 0.0 || age < 0.0) continue;
        total += ripplePacket(length(corridorSurfaceDelta(w, source.xy)), age, shape);
    }
    return total;
}

// A slow continuous breath so a cloud is alive between hits. Still one smooth field of position, so it
// cannot separate anything; deliberately far below the ripples in scale, and excluded from d so it never
// lights the shape up.
float cloudIdle(vec3 unitPos) {
    return 0.11 * sin(unitPos.x * 1.7 + uTime * 0.5) * cos(unitPos.z * 1.4 - uTime * 0.37)
         + 0.06 * sin(unitPos.y * 2.1 - uTime * 0.66);
}

// The corridor's equivalent: a slow region envelope carrying finer travelling waves along the tunnel.
// Every ANGULAR term is an integer harmonic (2.0, 3.0) so it closes on itself after a full turn.
float corridorIdle(vec2 w) {
    float t = uTime * uFlow;
    float region = 0.6 + 0.4 * sin(w.x * 0.42 - t * 0.33);
    float ripple = 0.62 * sin(w.x * 1.25 - t * 1.15)
                 + 0.30 * sin(w.x * 0.8 + w.y * 2.0 - t * 0.8)
                 + 0.08 * sin(w.y * 3.0 + t * 0.5);
    return region * ripple;
}

// Fine surface texture for sustained treble. Products of sines beat together into diagonal components
// above the nominal frequency, so these run at 0.7 of the lattice ceiling to leave that headroom.
float cloudDetail(vec3 p) {
    float k = uWaveNumberMax * 0.7;
    return sin(p.x * k + uTime * 3.1)
         * sin(p.y * k - uTime * 2.6)
         * sin(p.z * k + uTime * 2.2);
}

// Same, on the wall. The angular harmonic is floored to an integer so it closes round the circle.
float corridorDetail(vec2 w) {
    float k = uWaveNumberMax * 0.7;
    float n = max(1.0, floor(k));
    return sin(w.x * k + uTime * 3.1) * sin(w.y * n - uTime * 2.4);
}

void main() {
    float colorSlot = aStyle.y;
    float isFar = aStyle.z;
    vec3 normalDir = normalize(aNormal);
    // How big this primitive actually is, in its own local units. Everything below moves by a fraction
    // of it, never by a world-constant number of units.
    float localRadius = aScale.z;

    // Stretch the base shape FIRST, then displace: scaling AFTER would multiply the displacement by
    // aScale.y too, and a tall pillar's caps would travel ~3.4x further than its sides.
    vec3 basePos = position;
    basePos.y *= aScale.y;

    // ONE scalar swell per mode, then ONE displacement shape for both. Nothing here is per-face.
    // The field is read from the UNSTRETCHED position in the shape's own unit space, so one set of ripple
    // parameters fits every primitive and a 3.4x pillar reads the same wavefront across its width as
    // along its length.
    vec3 unitPos = position / localRadius;
    bool corridor = uCorridor > 0.5;
    float audio = corridor ? corridorRipples(aWave) : cloudRipples(unitPos, aPhase);
    float idle = corridor ? corridorIdle(aWave) : cloudIdle(unitPos);

    // HIGH FREQUENCY. Gated by the swell that is ALREADY there, so sustained treble can only sharpen the
    // texture of a crest that exists - on a still surface the gate is 0 and it cannot manufacture noise.
    // It is a continuous field like everything else, so neighbours share it and it cannot flicker or
    // scatter; and it is deliberately a fraction of the low-frequency travel, so it layers on top of the
    // big swell instead of competing with it.
    float detail = uDetail * smoothstep(0.06, 0.45, abs(audio));
    audio += (corridor ? corridorDetail(aWave) : cloudDetail(unitPos)) * detail * 0.3;

    // Safety net only: several sources peaking together must not throw a point clear of its own body.
    float swell = clamp(audio + idle, -1.6, 1.6) * uAmplitude;
    vec3 displaced = basePos + normalDir * (swell * localRadius);
    // d = how far the music ACTUALLY moved this point, against a fixed full-reach displacement. Two things
    // it must not be: the raw wave (a point held still by a zero amplitude would still glow), or the total
    // swell (the idle breath would light the shape up with no music playing). Both were true before.
    float d = clamp(abs(clamp(audio, -1.6, 1.6) * uAmplitude) / max(uMaxSwell, 0.0001), 0.0, 1.0);

    // Whole-body sway on mid energy (the reference's offsetGain): a RIGID translation of the entire
    // cluster along a FIXED local axis, exactly as the reference does it (newpos.z += ...). Along
    // normalDir it would translate each face in its own direction - a per-face displacement, which is the
    // very thing that splits a cube open. On the corridor aPhase is now ring-constant, so a ring sways as
    // one rigid ring rather than shearing itself open at the seam.
    displaced.z += sin(uTime * 0.6 + aPhase) * 0.12 * uOffsetGain * localRadius;

    // Dissolve: as uFormation falls to 0 the points fly apart into the surroundings (and fade below), so a
    // corridor leaves by dispersing and arrives by gathering back in - never a flat alpha cut.
    float scatter = 1.0 - uFormation;
    if (scatter > 0.001) {
        float r1 = hash11(aPhase * 12.9898 + aWave.x * 78.233);
        float r2 = hash11(aPhase * 39.346 + aWave.y * 11.135 + 3.7);
        float r3 = hash11(r1 * 91.7 + r2 * 47.3);
        vec3 spread = normalize(normalDir * 0.75 + vec3(r1 - 0.5, r2 - 0.5, r3 - 0.5) * 1.6);
        displaced += spread * (scatter * scatter * uScatter * (0.55 + r3 * 0.9));
    }

    displaced *= aScale.x * uPulse;
    vec3 worldPosition = aAnchor + displaced;

    float life = resolveLife(distance(worldPosition, cameraPosition));
    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);

    // The reaching points GROW - in the reference this size gain, not the travel, is what reads as the
    // amplitude. Treble adds a further, smaller, SMOOTH size lift over its (continuous) detail region -
    // never a per-point random scale, which would read as the flicker we must avoid. The glow layer draws
    // the same points as wide soft haloes.
    float glowScale = mix(1.0, 1.9 + uGlow * 1.3, uGlowPass);
    float sizeWorld = (uSizeBase + (pow(d, 3.0) + detail * 0.35) * uSizeGain) * glowScale;
    float projected = sizeWorld * uViewportHeight * projectionMatrix[1][1] * 0.5 / max(-mvPosition.z, 0.1);
    gl_PointSize = clamp(projected, mix(1.4, 2.0, uGlowPass), mix(26.0, 64.0, uGlowPass));
    gl_Position = projectionMatrix * mvPosition;

    // Palette drift through primary/accent/secondary; reaching points re-tint toward the hot accent so
    // active regions read as coloured bands. Treble pushes its detail region further along that shift, so
    // a cymbal colours a continuous patch of surface that travels and fades with the ripple under it.
    float gradientPhase = (
        dot(basePos, vec3(0.2, 0.16, 0.13))
        + aPhase * 0.05
        + colorSlot * 0.5
        + uTime * 0.02
        + uSpectralCentroid * 0.3
    ) * 6.283;
    vec3 wgt = max(vec3(0.0), 0.5 + 0.5 * cos(gradientPhase - vec3(0.0, 2.094, 4.188)));
    wgt *= wgt; wgt /= max(wgt.x + wgt.y + wgt.z, 0.001);
    vec3 baseColor = uPrimaryColor * wgt.x + uAccentColor * wgt.y + uSecondaryColor * wgt.z;
    vec3 hotColor = mix(uAccentColor, uSecondaryColor, smoothstep(0.2, 0.9, uSpectralCentroid));
    float hot = min(1.0, smoothstep(0.1, 0.75, d) * 0.75 + detail * 0.3);
    vColor = mix(baseColor, hotColor, hot) * (0.92 + d * 0.5);

    float layerBase = mix(0.72, 0.5, isFar);
    // Contrast layer: a readable body plus a reach lift, so the geometry is legible even in silence.
    // Glow layer: bound to the DISPLACED region and nothing else. It starts at zero - a point the music is
    // not moving does not glow at all - and rises smoothly with d, which is itself a continuous field, so
    // the halo fades outward from a crest and travels and decays with it instead of blinking.
    float formed = smoothstep(0.0, 0.45, uFormation);
    vAlpha = formed * (uGlowPass > 0.5
        ? life * smoothstep(0.1, 0.8, d) * 1.15
        : life * min(1.0, layerBase + d * 0.28));
    vReaction = d;
}
`;

export const DIORAMA_PARTICLE_FRAGMENT_SHADER = `
uniform float uGlow;
uniform float uGlowPass;

varying vec3 vColor;
varying float vAlpha;
varying float vReaction;

// three hands a ShaderMaterial its uniforms in the LINEAR working space and expects the sRGB conversion
// on the way out; for its own materials the colorspace_fragment chunk does it. That chunk is useless here
// - it expands to linearToOutputTexel(), which the ShaderMaterial prefix does not define, and including it
// compiles the shader to solid black (measured, not assumed). So this shader has to convert its own output,
// and until now it did not: it wrote linear values raw into an sRGB framebuffer and every point rendered
// far darker and more saturated than the theme colour it was handed - measured #c8783c -> #932f0c, a 3.1x
// drop in luminance, while an ordinary meshBasicMaterial on the same colour read back exactly #c8783c.
// That is what made the adaptive contrast in dioramaParticleMaterials.ts a guarantee about a colour that
// never reached the screen: it binary-searches the theme colour up to a >= 4.6 WCAG ratio, and then the
// point drew three times darker than the value it had just cleared.
vec3 dioramaLinearToSRGB(vec3 linear) {
    vec3 safe = max(linear, vec3(0.0));
    return mix(
        pow(safe, vec3(0.41666)) * 1.055 - vec3(0.055),
        safe * 12.92,
        vec3(lessThanEqual(safe, vec3(0.0031308)))
    );
}

void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);

    if (uGlowPass > 0.5) {
        // Additive soft halo: a wide falloff whose strength rides the glow slider and the point's reach.
        // Hard-capped so several overlapping crests cannot stack into a blown-out white blob.
        float halo = pow(clamp(1.0 - radius * 2.0, 0.0, 1.0), 1.7);
        float alpha = min(0.5, halo * vAlpha * uGlow * 0.4);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(dioramaLinearToSRGB(vColor * (1.0 + uGlow * 0.25)), alpha);
        return;
    }

    // Contrast layer: a soft-edged but near-opaque disc so the theme-adapted colour actually reads.
    float core = 1.0 - smoothstep(0.14, 0.48, radius);
    float alpha = core * vAlpha;
    if (alpha < 0.01) discard;
    float emission = 0.95 + vReaction * 0.22;
    gl_FragColor = vec4(dioramaLinearToSRGB(vColor * emission), alpha);
}
`;
