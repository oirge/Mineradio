import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runLyricSourceOffsetAudit } from './lyric_source_offset_audit';
import { runPlot } from './lyric_duration_diff_plot';

// test/manual/lyric-audit/index.ts

const DEFAULT_SONG_ID = '488642006';

const usage = `Usage:
  npm run audit:lyrics-sources -- <songId> [options]
  npx tsx test/manual/lyric-audit/index.ts <songId> [options]

Options:
  --out <path>   Write/read the JSON report to/from a custom path.
  -h, --help     Show this help.
`;

function readValue(args: string[], index: number, optionName: string): string {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`${optionName} requires a value.`);
    }
    return value;
}

/**
 * 解析命令行参数，返回结构化的选项对象。
 */
function parseArgs(args: string[]) {
    const positional: string[] = [];
    let outputPath: string | undefined;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (arg === '-h' || arg === '--help') {
            return { help: true };
        }

        if (arg === '--out') {
            outputPath = readValue(args, index, arg);
            index += 1;
            continue;
        }

        if (arg.startsWith('--')) {
            throw new Error(`Unknown option: ${arg}`);
        }

        positional.push(arg);
    }

    const songId = positional[0] || DEFAULT_SONG_ID;
    if (!/^\d+$/.test(songId) || Number(songId) <= 0) {
        throw new Error('songId must be a positive integer.');
    }

    return {
        help: false,
        songId,
        outputPath,
    };
}

/**
 * 主执行函数：如果不存在对应的歌词分析 JSON 文件，则先运行比对分析；
 * 接着调用绘图模块生成交互式 HTML 仪表盘。
 */
async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if ('help' in parsed && parsed.help) {
        console.log(usage);
        return;
    }

    const songId = parsed.songId as string;
    const outputPath = parsed.outputPath as string | undefined;

    const targetJsonPath = outputPath
        ? path.resolve(process.cwd(), outputPath)
        : path.resolve(process.cwd(), `test/manual/lyric-audit-output/${songId}.json`);

    if (!fs.existsSync(targetJsonPath)) {
        console.log(`JSON report not found at ${targetJsonPath}. Running lyric source audit analysis first...`);
        await runLyricSourceOffsetAudit({
            songId: Number(songId),
            outputPath: targetJsonPath,
        });
    } else {
        console.log(`Found existing JSON report at ${targetJsonPath}. Skipping audit analysis.`);
    }

    console.log(`Generating interactive HTML dashboard...`);
    runPlot(songId, targetJsonPath);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
});
