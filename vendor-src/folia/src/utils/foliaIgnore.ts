// src/utils/foliaIgnore.ts
// Parses root-level .foliaignore rules and matches import-relative file-system paths.

interface FoliaIgnoreRule {
    negated: boolean;
    directoryOnly: boolean;
    matcher: RegExp;
}

export interface FoliaIgnoreMatcher {
    isIgnored: (relativePath: string, isDirectory: boolean) => boolean;
    getDecision: (relativePath: string, isDirectory: boolean) => boolean | null;
    ruleCount: number;
}

const normalizePath = (value: string) => value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+|\/+$/g, '');

const escapeRegexCharacter = (character: string) => (
    /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character
);

// Compiles the glob subset used by gitignore for path and basename matching.
const compileGlobBody = (glob: string): string => {
    let result = '';
    for (let index = 0; index < glob.length; index += 1) {
        const character = glob[index];
        if (character === '*') {
            if (glob[index + 1] === '*') {
                index += 1;
                if (glob[index + 1] === '/') {
                    index += 1;
                    result += '(?:.*/)?';
                } else {
                    result += '.*';
                }
            } else {
                result += '[^/]*';
            }
            continue;
        }
        if (character === '?') {
            result += '[^/]';
            continue;
        }
        if (character === '[') {
            const closingIndex = glob.indexOf(']', index + 1);
            if (closingIndex > index + 1) {
                const rawClass = glob.slice(index + 1, closingIndex);
                const normalizedClass = rawClass.startsWith('!')
                    ? `^${rawClass.slice(1)}`
                    : rawClass;
                result += `[${normalizedClass.replace(/\\/g, '\\\\')}]`;
                index = closingIndex;
                continue;
            }
        }
        result += escapeRegexCharacter(character);
    }
    return result;
};

const parseRule = (sourceLine: string): FoliaIgnoreRule | null => {
    let line = sourceLine.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) return null;
    const escapedLeadingMarker = line.startsWith('\\#') || line.startsWith('\\!');
    if (escapedLeadingMarker) line = line.slice(1);

    const negated = !escapedLeadingMarker && line.startsWith('!');
    if (negated) line = line.slice(1);
    if (!line) return null;

    const directoryOnly = line.endsWith('/');
    if (directoryOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/');
    if (anchored) line = line.slice(1);
    const normalizedPattern = normalizePath(line);
    if (!normalizedPattern) return null;

    const patternHasSlash = normalizedPattern.includes('/');
    const body = compileGlobBody(normalizedPattern);
    const matcher = anchored || patternHasSlash
        ? new RegExp(`^${body}$`)
        : new RegExp(`(?:^|/)${body}$`);
    return { negated, directoryOnly, matcher };
};

export const createFoliaIgnoreMatcher = (
    contents: string,
    baseDirectory = '',
): FoliaIgnoreMatcher => {
    const rules = contents
        .replace(/^\uFEFF/, '')
        .split('\n')
        .map(parseRule)
        .filter((rule): rule is FoliaIgnoreRule => Boolean(rule));

    const normalizedBaseDirectory = normalizePath(baseDirectory);
    const getDecision = (relativePath: string, isDirectory: boolean): boolean | null => {
        const normalizedPath = normalizePath(relativePath);
        const localPath = normalizedBaseDirectory
            ? normalizedPath.startsWith(`${normalizedBaseDirectory}/`)
                ? normalizedPath.slice(normalizedBaseDirectory.length + 1)
                : normalizedPath === normalizedBaseDirectory ? '' : null
            : normalizedPath;
        if (!localPath) return null;

        let decision: boolean | null = null;
        for (const rule of rules) {
            if (rule.directoryOnly && !isDirectory) continue;
            if (rule.matcher.test(localPath)) decision = !rule.negated;
        }
        return decision;
    };

    return {
        ruleCount: rules.length,
        getDecision,
        isIgnored: (relativePath, isDirectory) => getDecision(relativePath, isDirectory) === true,
    };
};

export const isIgnoredByFoliaMatchers = (
    matchers: readonly FoliaIgnoreMatcher[],
    relativePath: string,
    isDirectory: boolean,
): boolean => {
    let ignored = false;
    for (const matcher of matchers) {
        const decision = matcher.getDecision(relativePath, isDirectory);
        if (decision !== null) ignored = decision;
    }
    return ignored;
};
