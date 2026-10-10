// .github/scripts/triage/io/github.mjs
// 基于 Node 内置 fetch 的最小 GitHub REST 客户端。readOnly 模式下任何非 GET 请求直接 throw，
// 从结构上保证 dry-run 和本地回放不会写入仓库（包括不会创建标签）。

export class GitHubError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export function createGitHub({ token, repo, readOnly, apiUrl = 'https://api.github.com' }) {
    const [owner, name] = repo.split('/');
    const base = `${apiUrl}/repos/${owner}/${name}`;

    async function request(method, path, body) {
        if (readOnly && method !== 'GET') throw new Error(`readOnly 模式拒绝写请求：${method} ${path}`);
        const url = path.startsWith('http') ? path : path.startsWith('/search') || path.startsWith('/users') ? `${apiUrl}${path}` : `${base}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'folia-triage',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204) return { data: null, headers: response.headers };
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) throw new GitHubError(response.status, `${method} ${path} → ${response.status} ${data?.message ?? ''}`);
        return { data, headers: response.headers };
    }

    // 跟随 Link 头翻页，limit 防止异常仓库把运行拖死。
    async function paginate(path, limit = 1000) {
        const items = [];
        let next = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
        while (next && items.length < limit) {
            const { data, headers } = await request('GET', next);
            items.push(...(Array.isArray(data) ? data : data.items ?? []));
            next = /<([^>]+)>;\s*rel="next"/.exec(headers.get('link') ?? '')?.[1] ?? null;
        }
        return items.slice(0, limit);
    }

    return {
        repo,
        readOnly,
        request,
        paginate,
        get: path => request('GET', path).then(result => result.data),
        getIssue: number => request('GET', `/issues/${number}`).then(result => result.data),
        listComments: number => paginate(`/issues/${number}/comments`),
        listTimeline: number => paginate(`/issues/${number}/timeline`),
        listPrFiles: number => paginate(`/pulls/${number}/files`, 3000),
        getUser: login => request('GET', `/users/${encodeURIComponent(login)}`).then(result => result.data),
        // search API 每分钟 30 次；这里只取 total_count，不翻页。
        searchCount: query => request('GET', `/search/issues?q=${encodeURIComponent(`repo:${repo} ${query}`)}&per_page=1`).then(result => result.data.total_count),
        searchIssues: (query, limit = 100) => paginate(`/search/issues?q=${encodeURIComponent(`repo:${repo} ${query}`)}`, limit),
    };
}
