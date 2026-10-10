// Copyright (c) 2026 chthollyphile
import type { Theme } from '../../../types';
import { profileOf } from './catalog';
import { cameraBetween, type Affine, type LumiereAudioFrame } from './lumiereKernel';
import type { LightSprites } from './light/sprites';
import type { LumiereParagraph, LumiereShot } from './program';
import { createLumiereScene, type LumiereScene, type SceneShot } from './scene';
import type { WindowTypography } from './text/lyricWindow';
import type { LumiereSceneTuning } from './types';

// src/components/visualizer/lumiere/lumiereUnit.ts
// 一个段落 → 一个场景单元：把编译出的 LumiereParagraph 换成 createLumiereScene 的参数（镜头覆盖的行换成
// 单元内的下标、熄灯转场换成场景的收光窗口、按程序种子与段落 id 播种），再给出运镜矩阵与当前镜头。
// 对应 lumisynth 绘光 adapter 的 buildUnit；运行时（phase B）每个可见段落建一个，按播放时间调 update。
type PixiModule = typeof import('pixi.js');

export interface LumiereUnitOptions {
    paragraph: LumiereParagraph;
    /** 画面逻辑尺寸（CSS 像素）与渲染倍率（devicePixelRatio × 画质缩放）。 */
    width: number;
    height: number;
    resolution: number;
    /** 程序种子（LumiereProgram.seed）；场景按 `${programSeed}:${paragraph.id}` 播种。 */
    programSeed: string;
    theme: Theme;
    tuning: LumiereSceneTuning;
    /** 全局共享的光点纹理（createLightSprites），由运行时持有与销毁。 */
    sprites: LightSprites;
    audioAt?: (time: number) => LumiereAudioFrame;
    /** 统一覆盖排版（不给则按光位）。 */
    typography?: WindowTypography;
}

export interface LumiereUnit {
    paragraph: LumiereParagraph;
    scene: LumiereScene;
    update: (time: number) => void;
    /**
     * 时刻 time 的运镜矩阵：把没有运镜时的画面坐标映射到有运镜时的坐标（场景自己已经套过运镜）。
     * 别的图层要跟着场景运镜时，用 `container.setFromMatrix(new pixi.Matrix(m.a, m.b, m.c, m.d, m.tx, m.ty))`。
     */
    cameraMatrix: (time: number) => Affine;
    /** 时刻 time 的镜头（第一个镜头之前算第一个）。 */
    shotAt: (time: number) => LumiereShot | undefined;
    destroy: () => void;
}

/** 段落的镜头 → 场景镜头：行号换成单元内的下标（options.lines = paragraph.lines）。 */
export const buildLumiereSceneShots = (paragraph: LumiereParagraph): SceneShot[] => {
    const localLine = new Map(paragraph.lineIndices.map((lineIndex, index) => [lineIndex, index]));
    const shots: SceneShot[] = paragraph.shots.map(shot => ({
        profile: profileOf(shot.kind),
        startTime: shot.startTime,
        endTime: shot.endTime,
        lines: shot.lineIndices.map(index => localLine.get(index)).filter((index): index is number => index !== undefined),
    }));
    if (shots.length === 0) {
        // 编译器保证每段至少一个镜头；防御：给一个覆盖整段的天井。
        shots.push({ profile: profileOf(''), startTime: paragraph.startTime, endTime: paragraph.endTime, lines: [] });
    }
    return shots;
};

export const createLumiereUnit = (pixi: PixiModule, options: LumiereUnitOptions): LumiereUnit => {
    const { paragraph } = options;
    const scene = createLumiereScene(pixi, {
        width: options.width,
        height: options.height,
        resolution: options.resolution,
        seed: `${options.programSeed}:${paragraph.id}`,
        theme: options.theme,
        tuning: options.tuning,
        lines: paragraph.lines,
        shots: buildLumiereSceneShots(paragraph),
        startTime: paragraph.startTime,
        endTime: paragraph.endTime,
        sprites: options.sprites,
        opening: paragraph.opening,
        fadeOut: paragraph.transitionOut?.kind === 'lights-out'
            ? { start: paragraph.transitionOut.startTime, end: paragraph.transitionOut.endTime }
            : null,
        audioAt: options.audioAt,
        typography: options.typography,
        sections: paragraph.sections,
    });
    const shotAt = (time: number) => {
        let found = paragraph.shots[0];
        for (const shot of paragraph.shots) if (shot.startTime <= time) found = shot;
        return found;
    };
    return {
        paragraph,
        scene,
        update: time => scene.update(time),
        cameraMatrix: time => cameraBetween(scene.rest, scene.camera(time)),
        shotAt,
        destroy: () => scene.destroy(),
    };
};
