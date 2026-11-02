// src/components/visualizer/nebbia/nebbiaGlUtils.ts
// 雾笺 WebGL2 的小工具：着色器编译、程序提交和链接结果检查、纹理创建，以及主着色器每帧的 uniform 类型（从 nebbiaGl.ts 拆出）。

export interface Tex { t: WebGLTexture; unit: number; fb?: WebGLFramebuffer }
export interface NebbiaUniforms {
    time: number; mist: number; edge: number; refract: number; bus: number; glint: number; neon: number;
    glassShift: [number, number]; sceneShift: [number, number];
    spotSrc: [number, number]; spotSrc2: [number, number]; spotTgt: [number, number]; spotR: number; spotI: number;
}

/** 提交编译，不等结果（结果在链接时一起查，见 checkLinked）。 */
export const compileShader = (gl: WebGL2RenderingContext, type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
};

/** 提交链接，不等结果：属性位置先绑死，VAO 不必等程序编好就能建。 */
export const startProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader, attribs: Record<string, number>) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    for (const [name, index] of Object.entries(attribs)) gl.bindAttribLocation(p, index, name);
    gl.linkProgram(p);
    return p;
};

/** 链接结果：失败时把着色器的报错一起抛出。查 LINK_STATUS 会等到编完，所以先确认编好了再调。 */
export const checkLinked = (gl: WebGL2RenderingContext, p: WebGLProgram) => {
    if (gl.getProgramParameter(p, gl.LINK_STATUS)) return;
    const shaderLogs = (gl.getAttachedShaders(p) ?? []).map(s => gl.getShaderInfoLog(s)).filter(Boolean).join('\n');
    throw new Error(`Nebbia program: ${gl.getProgramInfoLog(p)}${shaderLogs ? `\n${shaderLogs}` : ''}`);
};

/** 一张线性过滤、边缘夹紧的纹理，挂在采样单元 `unit` 上（程序编好后再把采样器指过来）。 */
export const makeTex = (gl: WebGL2RenderingContext, unit: number): Tex => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { t, unit };
};
