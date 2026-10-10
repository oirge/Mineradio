var e=(e,t)=>{let n=new e.UniformGroup({uDistortion:{value:t.distortion,type:`f32`},uDispersion:{value:t.dispersion,type:`f32`}});return new e.Filter({glProgram:e.GlProgram.from({vertex:`
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
`,fragment:`
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;
uniform highp vec4 uOutputFrame;
uniform float uDistortion;
uniform float uDispersion;

vec2 screenToTextureUv(vec2 screenUv) {
    return screenUv * uOutputFrame.zw * uInputSize.zw;
}

vec4 sampleInside(vec2 uv) {
    if (uv.x < uInputClamp.x || uv.y < uInputClamp.y
        || uv.x > uInputClamp.z || uv.y > uInputClamp.w) {
        return vec4(0.0);
    }
    return texture(uTexture, uv);
}

void main(void) {
    vec2 screenUv = vTextureCoord * uInputSize.xy / max(uOutputFrame.zw, vec2(1.0));
    vec2 centered = screenUv - 0.5;
    float aspect = uOutputFrame.z / max(uOutputFrame.w, 1.0);
    centered.x *= aspect;

    float radiusSquared = dot(centered, centered);
    // Keep the low end subtle but leave enough headroom for the broad barrel warp in the
    // reference look; the UI/store expose this as a 0..2 amount.
    float curvature = uDistortion * 0.32;
    float radialScale = 1.0 - curvature * radiusSquared
        + curvature * 0.16 * radiusSquared * radiusSquared;
    vec2 lensCentered = centered * radialScale;
    lensCentered.x /= aspect;
    vec2 lensUv = lensCentered + 0.5;

    float radius = sqrt(radiusSquared);
    vec2 radialDirection = radius > 0.0001 ? centered / radius : vec2(0.0);
    float edgeWeight = smoothstep(0.12, 0.9, radius);
    vec2 dispersion = radialDirection * uDispersion * 0.012 * edgeWeight;
    dispersion.x /= aspect;

    vec4 center = sampleInside(screenToTextureUv(lensUv));
    vec4 redSample = sampleInside(screenToTextureUv(lensUv + dispersion));
    vec4 blueSample = sampleInside(screenToTextureUv(lensUv - dispersion));
    float alpha = max(center.a, max(redSample.a, blueSample.a));
    float coreWeight = 0.84 - clamp(uDispersion, 0.0, 1.0) * 0.18;
    vec3 core = center.rgb * coreWeight;
    vec3 separated = vec3(redSample.r, center.g, blueSample.b);
    // Keep a neutral core for thin MG strokes, then add the displaced channels as colored
    // fringes. Without this fallback, a one-pixel line can sample transparent red/blue texels
    // and become an unintended green-only stroke.
    vec3 color = max(core, separated);

    // Pixi render textures are premultiplied; the max channel values remain premultiplied.
    finalColor = vec4(color, alpha);
}
`,name:`sonnet-lens-distortion`}),resources:{lensUniforms:n},antialias:`on`})},t=`
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
`,n=`
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
`,r=`
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
`,i=`
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
`,a=(e,n,r,i)=>new e.Filter({glProgram:e.GlProgram.from({vertex:t,fragment:r,name:n}),resources:{printUniforms:new e.UniformGroup({uAmount:{value:i,type:`f32`}})},antialias:`on`}),o=(e,t)=>{let o=[];return t.rgbShift>0&&o.push(a(e,`sonnet-print-rgb-shift`,n,t.rgbShift)),t.halftone>0&&o.push(a(e,`sonnet-print-halftone`,r,t.halftone)),t.vignette>0&&o.push(a(e,`sonnet-print-vignette`,i,t.vignette)),o},s=e=>{let t=[...e.children??[]];for(;t.length>0;){let e=t.pop();e.children?.length&&t.push(...e.children),e.context?.unload?.(),e.unload?.()}},c=(e,t)=>{let n=e.visible!==!1;e.visible=t,n&&!t&&s(e)},l=e=>{let t=[],n=[e];for(;n.length>0;){let e=n.pop();t.push(e),e.children?.length&&n.push(...e.children)}for(let e=t.length-1;e>=0;--e)t[e].destroy?.()},u=e=>{e.removeChildren().forEach(l)};export{o as a,s as i,l as n,e as o,c as r,u as t};