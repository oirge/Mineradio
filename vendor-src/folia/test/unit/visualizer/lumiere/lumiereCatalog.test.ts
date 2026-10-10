import { describe, expect, it } from 'vitest';
import { createRng } from '@/components/visualizer/lumiere/lumiereRandom';
import { hasProfile, LUMIERE_FAMILY_DESCRIPTIONS, LUMIERE_FAMILY_LABELS, LUMIERE_KINDS, LUMIERE_PROFILES, profileOf } from '@/components/visualizer/lumiere/catalog';
import { MAX_BEAMS, resolveBeams } from '@/components/visualizer/lumiere/light/rig';

// test/unit/visualizer/lumiere/lumiereCatalog.test.ts
// 绘光的光位目录：100 种（10 族 × 10），mood 合计与设计文档一致，每族排版 4 横 / 3 竖 / 3 纵横，每个光位都画得出来
// （移植自 lumisynth test/unit/packs/lumiereCatalog.test.ts；文档表格在 lumisynth 仓库里，这里改为核对合计）。
describe('绘光光位目录', () => {
    it('10 族 × 10 种，kind 不重复、带族前缀，每族有名字与说明', () => {
        expect(LUMIERE_PROFILES).toHaveLength(100);
        expect(new Set(LUMIERE_KINDS).size).toBe(100);
        expect(Object.keys(LUMIERE_FAMILY_LABELS)).toHaveLength(10);
        for (const family of Object.keys(LUMIERE_FAMILY_LABELS)) {
            const members = LUMIERE_PROFILES.filter(profile => profile.family === family);
            expect(members, family).toHaveLength(10);
            expect(LUMIERE_FAMILY_DESCRIPTIONS[family], family).toBeTruthy();
            members.forEach(profile => {
                expect(profile.kind.startsWith(`${family}-`), profile.kind).toBe(true);
                expect(profile.label.length, profile.kind).toBeGreaterThan(0);
            });
        }
    });

    it('mood 合计 q 32 / n 37 / l 31（设计文档第二节）', () => {
        const count = (mood: string) => LUMIERE_PROFILES.filter(profile => profile.mood === mood).length;
        expect([count('quiet'), count('neutral'), count('loud')]).toEqual([32, 37, 31]);
    });

    it('每族排版 4 横 / 3 竖 / 3 纵横', () => {
        for (const family of Object.keys(LUMIERE_FAMILY_LABELS)) {
            const members = LUMIERE_PROFILES.filter(profile => profile.family === family);
            const count = (typography: string) => members.filter(profile => profile.typography === typography).length;
            expect([count('horizontal'), count('vertical'), count('crossed')], family).toEqual([4, 3, 3]);
        }
    });

    it('未知的 kind 退回天井', () => {
        expect(hasProfile('nope')).toBe(false);
        expect(profileOf('nope').kind).toBe('zenith-shaft');
        expect(hasProfile('motes-aurora')).toBe(true);
    });

    it.each(LUMIERE_PROFILES.map(profile => [profile.kind, profile] as const))('%s：光束合法、文字区在画内、线稿有限', (_kind, profile) => {
        const aspect = 16 / 9;
        const context = { aspect, random: createRng(`catalog:${profile.kind}`) };
        const light = profile.light(context);
        expect(light.beams.length).toBeGreaterThan(0);
        expect(light.beams.length).toBeLessThanOrEqual(MAX_BEAMS);
        const beams = resolveBeams(light, 3, aspect, { intensity: 1, bass: 0, color: [1, 1, 1], local: 2 });
        beams.forEach(beam => {
            expect([beam.ox, beam.oy, beam.dx, beam.dy, beam.halfWidth, beam.length, beam.intensity].every(Number.isFinite)).toBe(true);
            expect(beam.length).toBeGreaterThan(0);
        });
        const { cx, cy, w, h } = profile.region;
        expect(cx - w / 2).toBeGreaterThanOrEqual(0);
        expect(cx + w / 2).toBeLessThanOrEqual(1);
        expect(cy - h / 2).toBeGreaterThanOrEqual(0);
        expect(cy + h / 2).toBeLessThanOrEqual(1);
        expect(profile.heroSize).toBeGreaterThan(0);
        const art = profile.lineArt(context);
        expect(art.paths.length + art.nodes.length).toBeGreaterThan(0);
        expect(art.paths.every(p => p.points.length > 1 && p.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))).toBe(true);
        expect(art.nodes.every(n => Number.isFinite(n.at[0]) && Number.isFinite(n.at[1]))).toBe(true);
    });

    it('光位按种子确定：同一个种子得到同样的光束与线稿', () => {
        for (const profile of LUMIERE_PROFILES) {
            const build = () => {
                const context = { aspect: 16 / 9, random: createRng(`same:${profile.kind}`) };
                return { light: profile.light(context), art: profile.lineArt(context) };
            };
            expect(build(), profile.kind).toEqual(build());
        }
    });
});
