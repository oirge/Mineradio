// Copyright (c) 2026 chthollyphile
import type { Container } from 'pixi.js';
import type { Theme } from '../../../types';
import { createLumiereCredits, hasLumiereCredits, resolveLumiereCreditsFrame, type LumiereCredits } from './credits';
import type { CreditsFrame, SongMetadata } from './lumiereKernel';
import type { LumiereProgram } from './lumiereProgram';
import { applyLumiereSceneQuality, type LumiereSceneQuality } from './lumiereSceneEntry';
import type { LightSprites } from './light/sprites';
import type { LumiereSceneTuning } from './types';

// src/components/visualizer/lumiere/lumiereCreditsLayer.ts
// 运行时里的片尾卡层：最后一句唱完前几秒才建（它有自己的光场、线稿和曲名光栅化，整首歌都挂着不划算），
// 歌曲信息、主题、尺寸或需要重建的 tuning 变了就作废，下次需要时再建。纯音乐（lyricEndTime 为 null）
// 与没有任何歌曲信息时没有片尾卡，歌词也不会淡出。
type PixiModule = typeof import('pixi.js');

/** 最后一句唱完前多少秒开始预建。 */
const PREBUILD_SECONDS = 4;

const INACTIVE: CreditsFrame = { active: false, lyricAlpha: 1, lyricBlur: 0, posterAlpha: 0, posterOffsetY: 0, posterScale: 1 };

export interface LumiereCreditsMetadata {
    title?: string | null;
    artist?: string | null;
    album?: string | null;
}

export interface LumiereCreditsBuildContext {
    width: number;
    height: number;
    resolution: number;
    theme: Theme;
    metadata: LumiereCreditsMetadata;
    tuning: LumiereSceneTuning;
    quality: LumiereSceneQuality;
}

const toSongMetadata = (metadata: LumiereCreditsMetadata): SongMetadata => ({
    title: metadata.title ?? null,
    artist: metadata.artist ?? null,
    album: metadata.album ?? null,
});

export class LumiereCreditsLayer {
    readonly holder: Container;
    private credits: LumiereCredits | null = null;
    private lyricEndTime = 0;

    constructor(private readonly pixi: PixiModule, private readonly sprites: LightSprites) {
        this.holder = new pixi.Container();
        this.holder.visible = false;
    }

    get built() {
        return this.credits !== null;
    }

    hasMetadata(metadata: LumiereCreditsMetadata) {
        return hasLumiereCredits(toSongMetadata(metadata));
    }

    /** 片尾时间线帧；没有片尾卡时恒为 inactive（歌词不淡出）。 */
    resolveFrame(time: number, program: LumiereProgram, metadata: LumiereCreditsMetadata): CreditsFrame {
        if (program.lyricEndTime === null || !this.hasMetadata(metadata)) return INACTIVE;
        this.lyricEndTime = program.lyricEndTime;
        return resolveLumiereCreditsFrame(time, program.lyricEndTime);
    }

    needsBuild(time: number, program: LumiereProgram, metadata: LumiereCreditsMetadata) {
        return !this.credits
            && program.lyricEndTime !== null
            && time >= program.lyricEndTime - PREBUILD_SECONDS
            && this.hasMetadata(metadata);
    }

    build(context: LumiereCreditsBuildContext) {
        this.invalidate();
        this.credits = createLumiereCredits(this.pixi, {
            width: context.width,
            height: context.height,
            resolution: context.resolution,
            theme: context.theme,
            metadata: toSongMetadata(context.metadata),
            tuning: context.tuning,
            sprites: this.sprites,
        });
        applyLumiereSceneQuality(this.credits, context.quality);
        this.holder.addChild(this.credits.view);
        this.holder.pivot.set(context.width / 2, context.height / 2);
    }

    applyQuality(quality: LumiereSceneQuality) {
        if (this.credits) applyLumiereSceneQuality(this.credits, quality);
    }

    /** 片尾卡以画面中心缩放、上下偏移；没激活时整层不画。 */
    update(time: number, frame: CreditsFrame, width: number, height: number) {
        const credits = this.credits;
        this.holder.visible = Boolean(credits) && frame.active && frame.posterAlpha > 0.002;
        if (!credits || !this.holder.visible) return;
        this.holder.alpha = frame.posterAlpha;
        this.holder.position.set(width / 2, height / 2 + frame.posterOffsetY * height);
        this.holder.scale.set(frame.posterScale);
        credits.update(time - this.lyricEndTime);
    }

    /** 作废当前片尾卡（下次需要时重建）。 */
    invalidate() {
        if (!this.credits) return;
        const credits = this.credits;
        this.credits = null;
        this.holder.removeChild(credits.view);
        // 运行时挂的共享直通 filter 不归片尾卡销毁。
        credits.graphics.filters = [];
        credits.destroy();
        this.holder.visible = false;
    }

    destroy() {
        this.invalidate();
        this.holder.destroy({ children: true });
    }
}
