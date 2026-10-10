import type { PersonalFmRequestOptions } from '../../types/onlineMusic';

// src/services/onlineMusic/fmModes.ts
// Personal FM mode catalogue, shared by the command palette surface and the request layer so a
// mode looks and behaves the same wherever it is offered. Ids mirror NetEase's `/personal/fm/mode`
// parameters verbatim; only NetEase implements them, other providers ignore the selection.

export type PersonalFmModeId = 'DEFAULT' | 'FAMILIAR' | 'EXPLORE' | 'SCENE_RCMD' | 'PUZZLE_MODE_RCMD';
export type PersonalFmSceneCategory = 'mood' | 'activity' | 'genre' | 'language';

export type PersonalFmModeEntry = {
    id: PersonalFmModeId;
    labelKey: string;
    labelFallback: string;
    /** Pinyin, full and initials, so the picker answers to a keyboard that types no Chinese. */
    keywords: string[];
};

export type PersonalFmSceneEntry = {
    id: string;
    category: PersonalFmSceneCategory;
    labelKey: string;
    labelFallback: string;
    keywords: string[];
};

export type PersonalFmSelection = {
    mode: PersonalFmModeId;
    /** Only meaningful for SCENE_RCMD; every other mode rejects a submode. */
    scene: string | null;
};

export const DEFAULT_PERSONAL_FM_SELECTION: PersonalFmSelection = { mode: 'DEFAULT', scene: null };

const mode = (id: PersonalFmModeId, labelFallback: string, ...keywords: string[]): PersonalFmModeEntry => ({
    id,
    labelKey: `personalFmMode.mode.${id}`,
    labelFallback,
    keywords,
});

// SCENE_RCMD sits last: it is the only mode the scene row can select on the user's behalf, so the
// row below it reads as its continuation.
export const PERSONAL_FM_MODES: PersonalFmModeEntry[] = [
    mode('DEFAULT', 'Default', 'moren', 'mr'),
    mode('FAMILIAR', 'Familiar', 'shuxi', 'sx'),
    mode('EXPLORE', 'Explore', 'tansuo', 'ts'),
    mode('PUZZLE_MODE_RCMD', 'Puzzle', 'pintu', 'pt'),
    mode('SCENE_RCMD', 'Scene', 'changjing', 'cj'),
];

const scene = (
    id: string,
    category: PersonalFmSceneCategory,
    labelFallback: string,
    ...keywords: string[]
): PersonalFmSceneEntry => ({
    id,
    category,
    labelKey: `personalFmMode.scene.${id}`,
    labelFallback,
    keywords,
});

export const PERSONAL_FM_SCENE_CATEGORIES: { id: PersonalFmSceneCategory; labelKey: string; labelFallback: string }[] = [
    { id: 'mood', labelKey: 'personalFmMode.category.mood', labelFallback: 'Mood' },
    { id: 'activity', labelKey: 'personalFmMode.category.activity', labelFallback: 'Moment' },
    { id: 'genre', labelKey: 'personalFmMode.category.genre', labelFallback: 'Genre' },
    { id: 'language', labelKey: 'personalFmMode.category.language', labelFallback: 'Language' },
];

export const PERSONAL_FM_SCENES: PersonalFmSceneEntry[] = [
    scene('NIGHT_EMO', 'mood', 'Melancholy', 'shanggan', 'sg'),
    scene('CURE', 'mood', 'Healing', 'zhiyu', 'zy'),
    scene('CHEERFUL', 'mood', 'Cheerful', 'huankuai', 'hk'),
    scene('LYRICAL', 'mood', 'Lyrical', 'shuqing', 'sq'),
    scene('INSPIRATIONAL', 'mood', 'Inspirational', 'lizhi', 'lz'),
    scene('RELAX', 'mood', 'Relax', 'fangsong', 'fs'),
    scene('SWEET', 'mood', 'Love Songs', 'qingge', 'qg'),

    scene('EXERCISE', 'activity', 'Workout', 'yundong', 'yd'),
    scene('FOCUS', 'activity', 'Focus', 'zhuanzhu', 'zz'),
    scene('SLEEP_HELP', 'activity', 'Sleep', 'zhumian', 'zm'),
    scene('TAKE_SHOWER', 'activity', 'Shower', 'xizao', 'xz'),
    scene('COMMUTE', 'activity', 'Commute', 'chuxing', 'cx'),
    scene('COFFEE_SHOP', 'activity', 'Coffee Shop', 'kafeiguan', 'kfg'),
    scene('GAMES', 'activity', 'Gaming', 'youxi', 'yx'),
    scene('DANCE', 'activity', 'Dance', 'wudao', 'wd'),
    scene('RAINY', 'activity', 'Rainy Day', 'yutian', 'yt'),

    scene('RHYTHM_BLUES', 'genre', 'R&B', 'rb', 'randb'),
    scene('RAP', 'genre', 'Rap', 'shuochang', 'sc'),
    scene('K_POP', 'genre', 'K-Pop', 'kpop'),
    scene('ELECTRONIC', 'genre', 'Electronic', 'dianyin', 'dy'),
    scene('ROCK', 'genre', 'Rock', 'yaogun', 'yg'),
    scene('FOLK', 'genre', 'Folk', 'minyao', 'my'),
    scene('GUDIAN', 'genre', 'Classical', 'gudian', 'gd'),
    scene('JAZZ', 'genre', 'Jazz', 'jueshi', 'js'),
    scene('BLUE', 'genre', 'Blues', 'landiao', 'ld'),
    scene('PUNK', 'genre', 'Funk', 'fangke', 'fk'),
    scene('COUNTRY', 'genre', 'Country', 'xiangcunyue', 'xcy'),
    scene('LIGHT', 'genre', 'Light Music', 'qingyinyue', 'qyy'),
    scene('GUOFENG', 'genre', 'Guofeng', 'guofeng', 'gf'),
    scene('MANYAO', 'genre', 'Slow DJ', 'manyao', 'manyaodj', 'my'),
    scene('MUSICAL', 'genre', 'Musical', 'yinyueju', 'yyj'),
    scene('ACG', 'genre', 'ACG', 'erciyuan', 'ecy'),
    scene('JINGDIAN', 'genre', 'Classics', 'jingdian', 'jd'),
    scene('ORIGINAL_MUSICIAL', 'genre', 'Indie Original', 'baozangyuanchuang', 'bzyc'),
    scene('YINGSHI', 'genre', 'Soundtrack', 'yingshi', 'ys'),

    scene('CHINESE', 'language', 'Mandarin', 'huayu', 'hy'),
    scene('ENGLISH', 'language', 'Western', 'oumei', 'om'),
    scene('YUEYU', 'language', 'Cantonese', 'yueyu', 'yy'),
    scene('JAPANESE', 'language', 'Japanese', 'riyu', 'ry'),
    scene('FRANCH', 'language', 'French', 'fayu', 'fy'),
    scene('LATIN', 'language', 'Latin', 'lading', 'ld'),
    scene('GLOBAL', 'language', 'Global', 'quanqiu', 'qq'),
];

const MODE_IDS = new Set<string>(PERSONAL_FM_MODES.map(entry => entry.id));
const SCENE_IDS = new Set<string>(PERSONAL_FM_SCENES.map(entry => entry.id));

export const getPersonalFmSceneEntry = (id: string | null | undefined): PersonalFmSceneEntry | null => (
    PERSONAL_FM_SCENES.find(entry => entry.id === id) ?? null
);

/** Drops a scene that no longer exists, and a scene attached to a mode that cannot carry one. */
export const normalizePersonalFmSelection = (raw: unknown): PersonalFmSelection => {
    const candidate = raw as Partial<PersonalFmSelection> | null | undefined;
    const modeId = typeof candidate?.mode === 'string' && MODE_IDS.has(candidate.mode)
        ? candidate.mode as PersonalFmModeId
        : DEFAULT_PERSONAL_FM_SELECTION.mode;
    if (modeId !== 'SCENE_RCMD') {
        return { mode: modeId, scene: null };
    }
    const sceneId = typeof candidate?.scene === 'string' && SCENE_IDS.has(candidate.scene) ? candidate.scene : null;
    // SCENE_RCMD without a submode is rejected by the API, so it degrades to the default mode.
    return sceneId ? { mode: 'SCENE_RCMD', scene: sceneId } : DEFAULT_PERSONAL_FM_SELECTION;
};

export const isSamePersonalFmSelection = (left: PersonalFmSelection, right: PersonalFmSelection) => (
    left.mode === right.mode && left.scene === right.scene
);

export const isDefaultPersonalFmSelection = (selection: PersonalFmSelection) => (
    isSamePersonalFmSelection(selection, DEFAULT_PERSONAL_FM_SELECTION)
);

export const toPersonalFmRequestOptions = (selection: PersonalFmSelection): PersonalFmRequestOptions => ({
    mode: selection.mode,
    submode: selection.scene,
});

/** "Scene · Sleep" for SCENE_RCMD, the plain mode name otherwise. */
export const getPersonalFmSelectionLabel = (
    selection: PersonalFmSelection,
    t: (key: string, fallback?: string) => string,
): string => {
    const modeEntry = PERSONAL_FM_MODES.find(entry => entry.id === selection.mode) ?? PERSONAL_FM_MODES[0];
    const modeLabel = t(modeEntry.labelKey, modeEntry.labelFallback);
    const sceneEntry = getPersonalFmSceneEntry(selection.scene);
    return sceneEntry ? `${modeLabel} · ${t(sceneEntry.labelKey, sceneEntry.labelFallback)}` : modeLabel;
};
