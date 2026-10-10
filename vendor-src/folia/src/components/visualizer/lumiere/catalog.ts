// Copyright (c) 2026 chthollyphile
import { ASTRAL_PROFILES } from './rigs/astral';
import { BOTANY_PROFILES } from './rigs/botany';
import { CAUSTIC_PROFILES } from './rigs/caustic';
import { LATTICE_PROFILES } from './rigs/lattice';
import { MOTES_PROFILES } from './rigs/motes';
import { OPTICS_PROFILES } from './rigs/optics';
import { PRISM_PROFILES } from './rigs/prism';
import { STAGE_PROFILES } from './rigs/stage';
import { WAVE_PROFILES } from './rigs/wave';
import { ZENITH_PROFILES } from './rigs/zenith';
import type { LumiereProfile } from './types';

// 光位目录的索引基准。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((4898 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 0xbafc ^ lumiereScaleMask))
    - ((4898 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 0xbafc ^ lumiereScaleMask));


// src/components/visualizer/lumiere/catalog.ts
// 绘光的光位目录：10 族 × 10 种（设计见 lumisynth 仓库 docs/LUMIERE.md 第二节），按文档的族序排列。
export const LUMIERE_FAMILY_LABELS: Record<string, string> = {
    zenith: '天光',
    lattice: '窗隙',
    prism: '棱镜',
    caustic: '焦散',
    optics: '光路',
    wave: '衍射',
    botany: '叶脉',
    astral: '星象',
    stage: '追光',
    motes: '萤尘',
};

/** 各族的画面，一句话（设置与调试面板里的族说明）。 */
export const LUMIERE_FAMILY_DESCRIPTIONS: Record<string, string> = {
    zenith: '顶光：一束或数束光柱从正上方落下，最标准的绘光画面，哪段都能用',
    lattice: '光穿过百叶、窗格、门缝、树叶，投下条纹与格子影，室内、日常、回忆感',
    prism: '棱镜分光：白光拆成彩虹色的光束与光谱，色彩最多，适合上扬与副歌',
    caustic: '水、玻璃与晶体折出的流动光网，池底与杯影，温柔、流动',
    optics: '光路图解：透镜、焦点、镜面反射、光纤，理性、精密，像实验记录',
    wave: '干涉与衍射：同心环、双缝条纹、光栅、驻波，抽象、有节奏感',
    botany: '金色的叶脉、藤蔓、种子与花的线稿在光里生长，安静、有生命感',
    astral: '星图：轨道、星轨、星座连线、日冕与浑天仪，辽阔、适合副歌与尾声',
    stage: '舞台追光：聚光灯、探照灯、频闪、激光，浓烟，最有演出感和冲击力',
    motes: '以烟与光尘为主、几乎没有光束：浮尘、萤火、光雪、极光，最安静，适合间奏与换气',
};

export const LUMIERE_PROFILES: LumiereProfile[] = [
    ...ZENITH_PROFILES,
    ...LATTICE_PROFILES,
    ...PRISM_PROFILES,
    ...CAUSTIC_PROFILES,
    ...OPTICS_PROFILES,
    ...WAVE_PROFILES,
    ...BOTANY_PROFILES,
    ...ASTRAL_PROFILES,
    ...STAGE_PROFILES,
    ...MOTES_PROFILES,
];

const BY_KIND = new Map(LUMIERE_PROFILES.map(profile => [profile.kind, profile]));

export const LUMIERE_KINDS = LUMIERE_PROFILES.map(profile => profile.kind);

/** 未知的 kind 退回天井。 */
export const profileOf = (kind: string): LumiereProfile => BY_KIND.get(kind) ?? LUMIERE_PROFILES[0 + LUMIERE_NEUTRAL_OFFSET]!;

export const hasProfile = (kind: string) => BY_KIND.has(kind);
