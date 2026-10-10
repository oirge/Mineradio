import { describe, expect, it } from 'vitest';
import { runLyricSourceOffsetAudit } from '../../manual/lyric-audit/lyric_source_offset_audit';

// test/unit/lyrics/lyricSourceOffsetAudit.test.ts

const shouldRunRealAudit = process.env.RUN_REAL_LYRIC_AUDIT === '1';
const auditIt = shouldRunRealAudit ? it : it.skip;
const auditSongId = Number(process.env.LYRIC_AUDIT_SONG_ID || '488642006');
const auditOutputPath = process.env.LYRIC_AUDIT_OUTPUT_PATH || undefined;

describe('lyric source offset audit', () => {
    auditIt(`audits song ${auditSongId} across NetEase / QQ / Kugou`, async () => {
        const report = await runLyricSourceOffsetAudit({
            songId: auditSongId,
            outputPath: auditOutputPath,
        });

        const availableSources = report.sourceAudits.filter(source => source.lyrics.available);
        expect(availableSources.map(source => source.source)).toEqual(['netease', 'qq', 'kugou']);
        expect(report.pairwise.every(pair => pair.matchedKeys > 0)).toBe(true);
    }, 300000);
});
