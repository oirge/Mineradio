import { describe, expect, it } from 'vitest';
import { createRng } from '@/components/visualizer/lumiere/lumiereRandom';
import type { IconNode } from 'lucide-react';
import { ICON_VIEWBOX, iconNodeToPolylines, lucideIconPolylines, svgPathToPolylines } from '@/components/visualizer/lumiere/lineart/iconPaths';
import { buildShotIconArts, buildThemeIconArt, placeThemeIcons } from '@/components/visualizer/lumiere/lineart/themeIcons';

// test/unit/visualizer/lumiere/lumiereThemeIcons.test.ts
// 绘光的主题图标：lucide 图标的 SVG 节点展平成折线（圆、直线段、压缩写法的弧），未知名字忽略；
// 落点按种子确定、避开文字区；没有图标或开关关闭时一枚都不画（不退回默认花）。
const inViewBox = (points: Array<[number, number]>, tolerance = 0.05) => points.every(([x, y]) => (
    x >= -tolerance && x <= ICON_VIEWBOX + tolerance && y >= -tolerance && y <= ICON_VIEWBOX + tolerance
));

describe('图标 → 折线', () => {
    it('path 的直线段与相对命令', () => {
        expect(svgPathToPolylines('M12 2v2')).toEqual([{ points: [[12, 2], [12, 4]], closed: false }]);
        expect(svgPathToPolylines('m4.93 4.93 1.41 1.41')[0]!.points[1]![0]).toBeCloseTo(6.34, 5);
        const closed = svgPathToPolylines('M2 2h4v4z');
        expect(closed[0]!.closed).toBe(true);
        expect(closed[0]!.points.at(-1)).toEqual([2, 2]);
    });

    it('弧的标志位紧挨着写也能解析，终点精确落在目标上', () => {
        const [arc] = svgPathToPolylines('M10 12a2 2 0 014 0');
        expect(arc!.points.length).toBeGreaterThan(8);
        expect(arc!.points.at(-1)).toEqual([14, 12]);
        // 半圆：中点在圆心 (12, 12) 上方或下方 2 个单位。
        const middle = arc!.points[Math.floor(arc!.points.length / 2)]!;
        expect(Math.abs(Math.hypot(middle[0] - 12, middle[1] - 12) - 2)).toBeLessThan(0.05);
    });

    it('Sun：一个圆 + 八道光芒，点数合理且都在 viewBox 里', () => {
        const polylines = lucideIconPolylines('Sun')!;
        expect(polylines).toHaveLength(9);
        const circle = polylines.find(polyline => polyline.closed)!;
        expect(circle.points.length).toBeGreaterThanOrEqual(24);
        expect(circle.points.length).toBeLessThanOrEqual(80);
        circle.points.forEach(([x, y]) => expect(Math.hypot(x - 12, y - 12)).toBeCloseTo(4, 5));
        expect(polylines.filter(polyline => polyline.points.length === 2)).toHaveLength(8);
        polylines.forEach(polyline => expect(inViewBox(polyline.points)).toBe(true));
    });

    it('Flower（花瓣是压缩写法的弧）与带圆角矩形的图标都在 viewBox 里', () => {
        for (const name of ['Flower', 'Square', 'Moon', 'Music', 'Heart']) {
            const polylines = lucideIconPolylines(name);
            expect(polylines, name).not.toBeNull();
            polylines!.forEach(polyline => {
                expect(polyline.points.length, name).toBeGreaterThan(1);
                expect(polyline.points.length, name).toBeLessThan(400);
                expect(inViewBox(polyline.points), name).toBe(true);
            });
        }
        const petals = lucideIconPolylines('Flower')!.reduce((most, polyline) => Math.max(most, polyline.points.length), 0);
        expect(petals).toBeGreaterThan(40);
    });

    it('未知图标名返回 null，结果按名字缓存', () => {
        expect(lucideIconPolylines('NotAnIconAtAll')).toBeNull();
        expect(lucideIconPolylines('icons')).toBeNull();
        expect(lucideIconPolylines('Sun')).toBe(lucideIconPolylines('Sun'));
    });
});

describe('图标的落点', () => {
    const aspect = 16 / 9;
    const avoid = { cx: aspect / 2, cy: 0.55, w: aspect * 0.5, h: 0.4 };

    it('避开文字区与画面边缘，彼此不重叠', () => {
        for (let seed = 0; seed < 40; seed += 1) {
            const icons = placeThemeIcons({ names: ['Sun', 'Moon', 'Star'], aspect, avoid, random: createRng(seed), count: 3 });
            expect(icons.length).toBeGreaterThan(0);
            icons.forEach(icon => {
                const half = icon.size / 2;
                const clearX = Math.abs(icon.cx - avoid.cx) >= half + avoid.w / 2;
                const clearY = Math.abs(icon.cy - avoid.cy) >= half + avoid.h / 2;
                expect(clearX || clearY).toBe(true);
                expect(icon.cx - half).toBeGreaterThan(0);
                expect(icon.cx + half).toBeLessThan(aspect);
                expect(icon.cy - half).toBeGreaterThan(0);
                expect(icon.cy + half).toBeLessThan(1);
            });
            for (let i = 0; i < icons.length; i += 1) {
                for (let j = i + 1; j < icons.length; j += 1) {
                    expect(Math.hypot(icons[i]!.cx - icons[j]!.cx, icons[i]!.cy - icons[j]!.cy)).toBeGreaterThan((icons[i]!.size + icons[j]!.size) / 2);
                }
            }
        }
    });

    it('同一个种子得到同样的落点，不同种子不同', () => {
        const place = (seed: string) => placeThemeIcons({ names: ['Sun', 'Moon'], aspect, avoid, random: createRng(seed) });
        expect(place('a')).toEqual(place('a'));
        expect(place('a')).not.toEqual(place('b'));
    });

    it('未知名字被忽略，只用有效图标', () => {
        const icons = placeThemeIcons({ names: ['NotAnIconAtAll', 'Moon'], aspect, avoid, random: createRng(3), count: 3 });
        expect(icons.length).toBeGreaterThan(0);
        expect(icons.every(icon => icon.name === 'Moon')).toBe(true);
    });

    it('线稿的折线落在图标自己的方框里，带闪点与错开的描线时刻', () => {
        const random = createRng('art');
        const art = buildThemeIconArt({ names: ['Sun'], aspect, avoid, random, count: 1 });
        const [icon] = placeThemeIcons({ names: ['Sun'], aspect, avoid, random: createRng('art'), count: 1 });
        expect(art.paths).toHaveLength(9);
        expect(art.nodes.length).toBeGreaterThanOrEqual(1);
        const reach = icon!.size * 0.72;
        art.paths.forEach(path => path.points.forEach(([x, y]) => {
            expect(Math.abs(x - icon!.cx)).toBeLessThanOrEqual(reach);
            expect(Math.abs(y - icon!.cy)).toBeLessThanOrEqual(reach);
        }));
        expect(new Set(art.paths.map(path => path.delay)).size).toBeGreaterThan(1);
    });
});

describe('场景单元的主题图标', () => {
    const base = { shotKinds: ['zenith-a', 'optics-b'], seed: 'unit', aspect: 16 / 9, avoid: { cx: 0.89, cy: 0.5, w: 0.8, h: 0.35 } };

    it('每个镜头一组，按种子确定', () => {
        const arts = buildShotIconArts({ ...base, icons: ['moon', 'Star'], enabled: true });
        expect(arts).toHaveLength(2);
        arts.forEach(art => expect(art.paths.length).toBeGreaterThan(0));
        expect(buildShotIconArts({ ...base, icons: ['moon', 'Star'], enabled: true })).toEqual(arts);
    });

    it('没有图标、图标名全无效或开关关掉时一枚都不画（不退回默认花）', () => {
        expect(buildShotIconArts({ ...base, icons: undefined, enabled: true })).toEqual([]);
        expect(buildShotIconArts({ ...base, icons: [], enabled: true })).toEqual([]);
        expect(buildShotIconArts({ ...base, icons: ['NotAnIconAtAll'], enabled: true })).toEqual([]);
        expect(buildShotIconArts({ ...base, icons: ['Moon'], enabled: false })).toEqual([]);
    });
});

describe('图标节点：lucide-react 1.48 的节点格式', () => {
    it('带子节点的 g 递归展开（1.48 的节点可以带第三项子节点）', () => {
        const node = [['g', {}, [['line', { x1: '1', y1: '2', x2: '3', y2: '4' }], ['circle', { cx: '12', cy: '12', r: '2' }]]]] as unknown as IconNode;
        const polylines = iconNodeToPolylines(node);
        expect(polylines).toHaveLength(2);
        expect(polylines[0]).toEqual({ points: [[1, 2], [3, 4]], closed: false });
        expect(polylines[1]!.closed).toBe(true);
    });
});
