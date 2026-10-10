import handleRequest from '@yakult-green-tea/qq-music-api/serverless';

// api-ts/qq.ts

/**
 * Vercel 上的 QQ 音乐 API 入口。
 *
 * frameworkless 项目里嵌套 catch-all（`api/qq/[...path].ts`）会被当成字面路由，三条嵌套路径全部
 * `NOT_FOUND`，所以这里是**扁平**入口：`vercel.json` 先把 `/api/qq/login/status`
 * rewrite 成 `/api/qq?path=/login/status`，再由本文件还原成后端认识的 `/login/status`。
 * 注入值写成 `/:path*` 而不是 `:path*`：裸的重复段在新版 path-to-regexp 里非法，`vercel dev`
 * 每次校验 `vercel.json` 都会刷一行 `[vc] PATH TO REGEXP ERROR`；带前缀后两版解析器都认。
 * Folia 侧因此两个平台都只填 `VITE_QQ_API_BASE=/api/qq`，不需要理解平台差异。
 *
 * 跑 Edge Runtime：3.0.0 的 `./serverless` 闭包已经是零 npm 包、零 `node:*`，Edge 能收；
 * 反过来这条约束也是守门人 —— 闭包哪天再混进 `node:*`，部署阶段就会直接被拒，
 * 而不是等到运行时才发现（Cloudflare 有 `nodejs_compat` 可以掩盖，Edge 没有）。
 */

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // rewrite 注入的 `path` 是后端路径，其余 query 是调用方原本就带的，要原样透传。
  const params = new URLSearchParams(url.search);
  const path = params.get('path') ?? '';
  params.delete('path');

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const search = params.toString();
  const target = new URL(`${normalized}${search ? `?${search}` : ''}`, url.origin);

  // 用原请求构造新请求，method / headers / body 全部保留：`X-QQ-Session` 靠这里带到后端。
  return handleRequest(new Request(target, request), {
    QQ_SESSION_SECRET: process.env.QQ_SESSION_SECRET,
    QQ_SESSION_SECRET_PREVIOUS: process.env.QQ_SESSION_SECRET_PREVIOUS,
  });
}
