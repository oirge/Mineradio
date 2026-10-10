#!/usr/bin/env node
// dev/folium/api-docs.mjs
// Generates docs/folium/api.md, the Folium API reference, from the public
// contract in src/mods/folium/contract.ts (the single source of the client
// API). The contract is written in a regular style (JSDoc, `// ----` section
// markers, one member per `;`), so a small scanner is enough; TypeScript's JS
// compiler API is not available with the native TypeScript 7 package.
//
//   node dev/folium/api-docs.mjs           write docs/folium/api.md
//   node dev/folium/api-docs.mjs --check   exit 1 when the file is out of date
//
// test/unit/mod-system/foliumApiDocs.test.ts runs the check, so a contract
// change without regenerating the reference fails the unit tests.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTRACT_PATH = path.join(ROOT, 'src', 'mods', 'folium', 'contract.ts');
export const OUTPUT_PATH = path.join(ROOT, 'docs', 'folium', 'api.md');

// ---------------------------------------------------------------- scanning

/* Index just past the comment or string starting at `i`, or -1 when none starts there. */
const skipCommentOrString = (text, i) => {
    if (text.startsWith('//', i)) {
        const end = text.indexOf('\n', i);
        return end === -1 ? text.length : end;
    }
    if (text.startsWith('/*', i)) return text.indexOf('*/', i + 2) + 2;
    const quote = text[i];
    if (quote === '\'' || quote === '"' || quote === '`') {
        let j = i + 1;
        while (j < text.length && text[j] !== quote) j += text[j] === '\\' ? 2 : 1;
        return j + 1;
    }
    return -1;
};

/* Index of the first `stop` character at bracket depth 0 from `start` (strings and comments skipped). */
const findAtDepthZero = (text, start, stops) => {
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
        const skipped = skipCommentOrString(text, i);
        if (skipped !== -1) {
            i = skipped - 1;
            continue;
        }
        const char = text[i];
        if (depth === 0 && stops.includes(char)) return i;
        if ('({['.includes(char)) depth += 1;
        else if (')}]'.includes(char)) depth -= 1;
    }
    return -1;
};

/* JSDoc or line-comment text without comment markers, one paragraph per blank line. */
const cleanComment = (raw) => raw
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(\*|\/\/)\s?/, '').trimEnd())
    .join('\n')
    .trim();

const squash = (value) => value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/,\s*\)/g, ')').replace(/\s+\)/g, ')').trim();

/*
 * Splits an interface body into members. Comments directly above a member
 * (no blank line between) become its description.
 */
const parseMembers = (body) => {
    const members = [];
    let i = 0;
    let doc = [];
    while (i < body.length) {
        const char = body[i];
        if (char === '\n' && /^\n[ \t]*\n/.test(body.slice(i))) doc = [];
        if (/\s/.test(char)) {
            i += 1;
            continue;
        }
        if (body.startsWith('/*', i) || body.startsWith('//', i)) {
            const end = skipCommentOrString(body, i);
            doc.push(cleanComment(body.slice(i, end)));
            i = end;
            continue;
        }
        const end = findAtDepthZero(body, i, [';']);
        const raw = body.slice(i, end === -1 ? body.length : end).trim();
        i = end === -1 ? body.length : end + 1;
        const match = /^(readonly\s+)?('[^']+'|"[^"]+"|[A-Za-z_$][\w$]*)(\?)?\s*([\s\S]*)$/.exec(raw);
        if (!match) continue;
        const [, readonly, name, optional, rest] = match;
        const isMethod = rest.startsWith('(') || rest.startsWith('<');
        members.push({
            name: name.replace(/^['"]|['"]$/g, ''),
            readonly: Boolean(readonly),
            optional: Boolean(optional),
            method: isMethod,
            type: squash(isMethod ? rest : rest.replace(/^:\s*/, '')),
            doc: doc.join('\n\n'),
        });
        doc = [];
    }
    return members;
};

/*
 * Reads the contract into sections of declarations. Declarations before the
 * first `// ----` marker land in a 'Basics' section.
 */
export const parseContract = (text) => {
    const sections = [{ title: 'Basics', items: [] }];
    let i = 0;
    let doc = [];
    while (i < text.length) {
        if (text[i] === '\n' && /^\n[ \t]*\n/.test(text.slice(i))) doc = [];
        if (/\s/.test(text[i])) {
            i += 1;
            continue;
        }
        const marker = /^\/\/ -{8,} (.+)$/m.exec(text.slice(i, text.indexOf('\n', i) === -1 ? undefined : text.indexOf('\n', i)));
        if (marker && text.startsWith('// --', i)) {
            sections.push({ title: marker[1].trim(), items: [] });
            i = text.indexOf('\n', i);
            doc = [];
            continue;
        }
        if (text.startsWith('/*', i) || text.startsWith('//', i)) {
            const end = skipCommentOrString(text, i);
            doc.push(cleanComment(text.slice(i, end)));
            i = end;
            continue;
        }
        const head = /^export (interface|type|const) ([A-Za-z_$][\w$]*)/.exec(text.slice(i, i + 200));
        if (!head) {
            const lineEnd = text.indexOf('\n', i);
            i = lineEnd === -1 ? text.length : lineEnd;
            doc = [];
            continue;
        }
        const [, kind, name] = head;
        const section = sections[sections.length - 1];
        const description = doc.join('\n\n');
        doc = [];
        if (kind === 'interface') {
            const open = text.indexOf('{', i);
            const header = squash(text.slice(i + 'export interface '.length, open));
            const close = findAtDepthZero(text, open + 1, ['}']);
            section.items.push({ kind, name, header, doc: description, members: parseMembers(text.slice(open + 1, close)) });
            i = close + 1;
        } else {
            const end = findAtDepthZero(text, i, [';']);
            const source = text.slice(i + 'export '.length, end).trim();
            section.items.push({ kind, name, source: kind === 'type' ? squash(source) : source, doc: description });
            i = end + 1;
        }
    }
    return sections.filter((section) => section.items.length > 0);
};

// ---------------------------------------------------------------- rendering

// Contract section → reference heading, lookup order, and a short orientation.
const SECTION_INFO = {
    'Client API': {
        order: 1,
        title: '客户端入口',
        intro: '模组的 `client` 入口默认导出 `activate(folium)`，参数就是 [FoliumClientApi](#foliumclientapi)，所有能力都从这里取。',
    },
    'Registry definitions': {
        order: 2,
        title: '注册表与条目',
        intro: '`folium.registries.<名称>.register(def)` 返回 [FoliumRegistryHandle](#foliumregistryhandle)。条目 id 由宿主加上命名空间成为 `<modid>:<id>`；模组停用时宿主自动撤下它注册的一切。',
    },
    'Host containers': {
        order: 3,
        title: '宿主容器与上下文',
        intro: '界面类条目都是 `mount(container, ctx) => dispose?`：宿主创建并回收容器，通过 `ctx` 提供时钟、主题、设置、音频等只读信息与订阅。',
    },
    Events: {
        order: 4,
        title: '事件',
        intro: '`folium.events.on(type, handler, { priority })`。通知只读、事后发出；钩子让处理器依次修改同一个事件对象。`omni.*` 需要选用实验接口 `omni.hooks`。',
    },
    Services: {
        order: 5,
        title: '服务',
        intro: '`folium.playback` / `folium.ui` / `folium.net`。标注需要权限的方法未在 `mod.json` 声明对应权限时抛 `permission-denied:<权限>`；导出窗口里调用会抛 `*-unavailable-in-export-context`（`ui.icon` 除外）。',
    },
    'Shared helpers': {
        order: 6,
        title: '共享工具',
        intro: '`folium.lyrics` 与 `folium.theme`：内置歌词动画使用的同一批函数，主窗口与导出窗口都可用。`folium.lyrics.parse`（1.4）是唯一的异步方法，走本地歌词文件的解析流程。',
    },
    Parameters: {
        order: 7,
        title: '参数 schema',
        intro: '设置分区、visualizer / background 设置、tunings 与命令参数共用 [FoliumParam](#foliumparam)。读到的值已合并默认值，写入按 schema 校验。',
    },
    DTOs: {
        order: 8,
        title: '数据结构',
        intro: '歌词行与主题与内置 visualizer 收到的 `Line` / `Theme` 同名同义，是宿主投影出的冻结副本。',
    },
    Experimental: {
        order: 9,
        title: '实验接口',
        intro: '需要在 `mod.json` 的 `experimental` 里选用，经 `folium.experimental[name]` 访问；任何 minor 版本都可能变化。',
    },
    Basics: {
        order: 10,
        title: '基础类型',
        intro: '',
    },
};

const anchorOf = (name) => name.toLowerCase();

const escapeCell = (value) => value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

/* Folium type names mentioned in `text`, excluding `self`, that the reference documents. */
const referencedTypes = (text, known, self) => [...new Set(text.match(/\bFolium[A-Z]\w*/g) ?? [])]
    .filter((name) => name !== self && known.has(name));

const renderReferences = (names) => (names.length > 0
    ? `\n相关：${names.map((name) => `[${name}](#${anchorOf(name)})`).join(' · ')}\n`
    : '');

const renderItem = (item, known) => {
    const lines = [`### ${item.name}`, ''];
    if (item.doc) lines.push(item.doc, '');
    if (item.kind === 'interface') {
        const signature = `interface ${item.header}`;
        if (signature !== `interface ${item.name}`) lines.push('```ts', signature, '```', '');
        if (item.members.length > 0) {
            lines.push('| 成员 | 类型 | 说明 |', '| --- | --- | --- |');
            for (const member of item.members) {
                const name = `${member.readonly ? 'readonly ' : ''}${member.name}${member.optional ? '?' : ''}${member.method ? '()' : ''}`;
                lines.push(`| \`${escapeCell(name)}\` | \`${escapeCell(member.type)}\` | ${escapeCell(member.doc)} |`);
            }
        }
        const text = [item.header, ...item.members.map((member) => member.type)].join(' ');
        lines.push(renderReferences(referencedTypes(text, known, item.name)));
    } else {
        lines.push('```ts', item.source, '```');
        lines.push(renderReferences(referencedTypes(item.source, known, item.name)));
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
};

/* The main (Node) entry API: plain JS in electron/modSystem/modApi.cjs, documented by hand. */
const MAIN_ENTRY_API = `## main 入口（Node）

\`mod.json\` 的 \`main\` 指向一个 \`.cjs\` / \`.js\` 文件，导出 \`activate(api)\`，在主进程运行，拥有完整 Node.js 权限。
\`api\` 由 \`electron/modSystem/modApi.cjs\` 创建：

\`\`\`js
module.exports = function activate(api) {
  api.rpc.handle('export', async (spec) => api.render.exportVideo(spec));
  return () => { /* 可选：模组停用时清理 */ };
};
\`\`\`

| 成员 | 说明 |
| --- | --- |
| \`api.manifest\` | 冻结的清单副本 |
| \`api.host\` | \`{ folium: { major, minor }, folia }\`，与客户端的 \`folium.host\` 相同 |
| \`api.log.info / warn / error(message, details?)\` | 写入模组日志；\`error\` 会显示在模组面板 |
| \`api.storage.data.get / set / has / delete / keys\` | 异步；需要 \`filesystem.data\`；与客户端 \`folium.storage\` 共用同一个数据文件（上限 1 MB） |
| \`api.lifecycle.onDeactivate(fn)\` | 模组被停用、重载或应用退出时调用；\`activate\` 返回的函数效果相同 |
| \`api.runtime.getPlaybackSnapshot()\` | 当前播放状态的 [FoliumPlaybackSnapshot](#foliumplaybacksnapshot)，渲染端尚未推送时为 \`null\`；需要 \`runtime.playback\` |
| \`api.rpc.handle(name, fn)\` | 注册客户端 \`folium.rpc.call(name, ...args)\` 调用的函数；名称匹配 \`/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/\`，参数与返回值需可 JSON 序列化 |
| \`api.render.exportVideo(spec)\` | 按当前歌曲、动画模式与参数导出透明视频；需要 \`render.export\` 与 ffmpeg |
| \`api.experimental\` | 预留，目前为空 |
`;

/* The whole reference as markdown. */
export const renderApiDocs = (contractText) => {
    const sections = parseContract(contractText)
        .map((section) => ({ ...section, info: SECTION_INFO[section.title] ?? { order: 99, title: section.title, intro: '' } }))
        .sort((left, right) => left.info.order - right.info.order);
    const known = new Set(sections.flatMap((section) => section.items.map((item) => item.name)));
    const version = /FOLIUM_VERSION = Object\.freeze\(\{ major: (\d+), minor: (\d+) \}\)/.exec(contractText);

    const out = [
        '<!-- 本文件由 `npm run folium:api` 从 src/mods/folium/contract.ts 生成，请勿手动修改。 -->',
        '',
        '# Folium API 参考',
        '',
        `当前契约版本：**Folium ${version ? `${version[1]}.${version[2]}` : '1.x'}**（运行时用 \`folium.host.folium.minor\` 做功能探测）。`,
        '',
        '本文列出模组能用到的全部公开类型，内容直接来自契约文件 [`src/mods/folium/contract.ts`](../../src/mods/folium/contract.ts)，',
        '成员说明保留契约里的原文注释。平台规则（清单、权限、生命周期、安全模型）见 [Folium 规范](../../mods/README.md)，',
        '从零开始写模组、调试与发布到模组市场见 [模组开发与贡献指南](contributing.md)。',
        '',
        '## 目录',
        '',
        ...sections.map((section) => `- **${section.info.title}**：${section.items.map((item) => `[${item.name}](#${anchorOf(item.name)})`).join(' · ')}`),
        '- **main 入口（Node）**：[api 对象](#main-入口node)',
        '',
    ];
    for (const section of sections) {
        out.push(`## ${section.info.title}`, '');
        if (section.info.intro) out.push(section.info.intro, '');
        for (const item of section.items) out.push(renderItem(item, known), '');
    }
    out.push(MAIN_ENTRY_API);
    return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const next = renderApiDocs(fs.readFileSync(CONTRACT_PATH, 'utf8'));
    if (process.argv.includes('--check')) {
        const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
        if (current !== next) {
            console.error('docs/folium/api.md is out of date: run `npm run folium:api`');
            process.exit(1);
        }
        console.log('docs/folium/api.md is up to date');
    } else {
        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, next);
        console.log(`wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
    }
}
