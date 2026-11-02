// Copyright (c) 2026 chthollyphile
// src/components/visualizer/pixiFilterVertex.ts
// Pixi 8 自定义 Filter 共用的顶点着色器：把单位方块铺到 filter 的输出区域上，并按输入纹理尺寸换算 vTextureCoord。
// 各模式的 filter 只写自己的片元着色器，顶点阶段统一用这一份。

export const PIXI_FILTER_VERTEX = `
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
