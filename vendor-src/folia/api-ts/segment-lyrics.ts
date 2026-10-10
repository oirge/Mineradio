import {
    SegmentationRequestError,
    readSegmentationLines,
    segmentLyricLines,
} from '../shared/lyricSegmentationService.mjs';

// 当前文件：Vercel 歌词分词函数的 TypeScript 源文件。
// 与主题生成不同，这里只有一个端点：provider 在 shared/lyricSegmentationService.mjs 内部按
// 部署配置的 env 分支，客户端不需要知道服务端接的是哪家模型。
export const config = {
    runtime: 'edge',
};

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return json({ error: 'Method Not Allowed' }, 405);
    }

    try {
        const lines = readSegmentationLines(await req.json());
        const segmented = await segmentLyricLines(lines, process.env);
        return json({ lines: segmented }, 200);
    } catch (error) {
        const status = error instanceof SegmentationRequestError ? error.status : 500;
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('Error segmenting lyrics:', message);
        return json({ error: message }, status);
    }
}
