import type { CoverPalette } from './coverPaletteAnalysis';

// src/utils/builtinTheme/themeDescriptionTable.ts
// Atmosphere one-liners for built-in themes, bucketed by color family and light/dark. Style and
// length follow the AI theme contract's description rule (first-person, 15-30 Chinese chars) so a
// generated theme reads the same as an AI one inside Theme Park.

type DescriptionFamily = 'warm' | 'gold' | 'green' | 'blue' | 'purple' | 'neutral';

const NEUTRAL_SATURATION_CEILING = 0.12;

const LIGHT_DESCRIPTIONS: Record<DescriptionFamily, string[]> = {
    warm: [
        '阳光落在窗台上，我忽然想起了那年的夏天。',
        '橘子汽水的味道，一整个下午都没有散去。',
        '我把心事晒在阳台，风一吹就全都跑掉了。',
        '热气腾腾的黄昏里，我们谁也没有先开口。',
        '像是握着一颗刚出炉的糖，烫手却舍不得放。',
    ],
    gold: [
        '麦田的风从耳边掠过，我又想起那条回家的路。',
        '午后的光把一切都镀成蜜色，时间慢得像糖。',
        '我把耳机塞进耳朵，整个世界忽然温柔起来。',
        '阳光穿过树叶的缝隙，落成一地细碎的金子。',
        '骑车经过那条巷子时，风里全是稻草的味道。',
    ],
    green: [
        '雨后的青草味钻进鼻腔，我忽然想去很远的地方。',
        '推开窗，整个春天都涌了进来，我却说不出话。',
        '阳光落在叶脉上，我数着它们发呆了一下午。',
        '山间的风很轻，把我心里的褶皱也抚平了。',
        '我躺在草地上，听见这个世界安静地生长。',
    ],
    blue: [
        '海风吹过晾晒的白衬衫，那年夏天还没有结束。',
        '推开窗是一整片蓝，我忽然不想去任何地方了。',
        '天空蓝得不像话，我把心事都寄给了云。',
        '清晨的水汽还没散，整座城市都是浅蓝色的。',
        '我沿着河堤走了很久，风一直安静地陪着我。',
    ],
    purple: [
        '薰衣草的味道很淡，像一段快要忘掉的心事。',
        '黄昏把云染成淡紫，我站在原地看了很久。',
        '梦醒之后天光微紫，我还留在昨夜的情节里。',
        '紫丁香开了满树，我却只想起一个人的名字。',
        '我把那封信折成四折，藏进了春天的口袋里。',
    ],
    neutral: [
        '灰白的天空下，我把耳机音量调到了最大。',
        '雾还没散，整座城市都像一张过曝的旧照片。',
        '我在空荡的房间里坐着，阳光淡得几乎没有。',
        '所有颜色都退去了，只剩下我和这段旋律。',
        '冬天的早晨很安静，我听见自己呼吸的声音。',
    ],
};

const DARK_DESCRIPTIONS: Record<DescriptionFamily, string[]> = {
    warm: [
        '余温还留在指尖，夜色已经漫过了整条街。',
        '炉火熄了，我仍坐在原地想那句没说完的话。',
        '深夜的红灯一闪一闪，像谁没能说出口的爱。',
        '我在暗处点了一支烟，把心事烧成了灰烬。',
        '热烈过后的沉默里，我听见自己的心跳。',
    ],
    gold: [
        '路灯把影子拉得很长，我一个人慢慢走回去。',
        '夜里的灯火像散落的碎金，我数着它们入睡。',
        '我在黑暗里回忆那个金色的下午，久久不愿醒。',
        '秋夜的风有点凉，可我还是不想早点回家。',
        '屋里只剩一盏暖灯，照着我还没写完的信。',
    ],
    green: [
        '深林的夜没有星星，只有风穿过树梢的声音。',
        '我在暗绿色的夜里走着，像走进了一场旧梦。',
        '夜露沾湿了裤脚，我还舍不得离开这片安静。',
        '整座山都睡着了，只有我的心事还醒着。',
        '苔藓在黑暗里悄悄蔓延，像我没说出口的思念。',
    ],
    blue: [
        '深夜的海把所有声音都吞掉了，只剩下呼吸。',
        '我在蓝色的黑暗里漂着，谁也找不到我。',
        '窗外下着雨，我把整个夜晚都听成了潮声。',
        '星星沉在海底，我在岸上等一句晚安。',
        '午夜的车窗外一片深蓝，我不想到站。',
    ],
    purple: [
        '暮色一寸寸沉下去，我的心事也跟着沉了。',
        '紫色的夜里我做了一个梦，梦里全是旧时光。',
        '霓虹把夜色染成暧昧的紫，我不敢多看一眼。',
        '我在深夜反复播放这首歌，像反复回到了过去。',
        '月光穿过窗帘的缝，把我的孤独照得很轻。',
    ],
    neutral: [
        '黑白的夜里，我把所有心事都调成了静音。',
        '墨色漫过窗台，我在这片安静里慢慢沉下去。',
        '我关掉了所有的灯，只留这首歌陪着我。',
        '深夜的房间没有颜色，只有旋律在轻轻发亮。',
        '世界安静得像一场默片，而我是唯一的观众。',
    ],
};

const resolveDescriptionFamily = ({ baseHue, baseSaturation }: CoverPalette): DescriptionFamily => {
    if (baseSaturation < NEUTRAL_SATURATION_CEILING) return 'neutral';
    if (baseHue < 45 || baseHue >= 330) return 'warm';
    if (baseHue < 105) return 'gold';
    if (baseHue < 165) return 'green';
    if (baseHue < 255) return 'blue';
    return 'purple';
};

const pickFrom = (items: readonly string[], random: () => number) => (
    items[Math.min(items.length - 1, Math.floor(random() * items.length))]
);

// Both sides draw from the same color family so the pair reads as one theme seen day and night.
export const pickBuiltinThemeDescriptions = (
    palette: CoverPalette,
    random: () => number,
): { light: string; dark: string; } => {
    const family = resolveDescriptionFamily(palette);

    return {
        light: pickFrom(LIGHT_DESCRIPTIONS[family], random),
        dark: pickFrom(DARK_DESCRIPTIONS[family], random),
    };
};
