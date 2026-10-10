import { describe, expect, it } from 'vitest';
import { parseAiThemeJsonInput } from '@/utils/aiThemePrompts';

// test/unit/theme/aiThemePrompts.test.ts
// Verifies manual AI theme JSON import parsing for raw, fenced, and prose-wrapped model output.

const themeJson = {
    light: {
        name: '晨光',
        backgroundColor: '#fff7ed',
        primaryColor: '#1f2937',
        accentColor: '#f97316',
        secondaryColor: '#4b5563',
        wordColors: [{ word: 'sun', color: '#f97316' }],
        lyricsIcons: ['Sun'],
    },
    dark: {
        name: '夜航',
        backgroundColor: '#111827',
        primaryColor: '#f9fafb',
        accentColor: '#38bdf8',
        secondaryColor: '#d1d5db',
        wordColors: [{ word: 'moon', color: '#38bdf8' }],
        lyricsIcons: ['Moon'],
    },
};

describe('aiThemePrompts', () => {
    it('parses raw dual theme JSON', () => {
        expect(parseAiThemeJsonInput(JSON.stringify(themeJson))).toEqual(themeJson);
    });

    it('parses AI output wrapped in a JSON code fence', () => {
        const input = `Here is the theme:

\`\`\`json
${JSON.stringify(themeJson, null, 2)}
\`\`\`
`;

        expect(parseAiThemeJsonInput(input)).toEqual(themeJson);
    });

    it('parses prose-wrapped AI output by extracting the first complete object', () => {
        const input = `Result:
${JSON.stringify(themeJson)}
Hope this works.`;

        expect(parseAiThemeJsonInput(input)).toEqual(themeJson);
    });

    it('rejects malformed JSON and non-theme objects', () => {
        expect(() => parseAiThemeJsonInput('{bad json')).toThrow('Invalid AI theme JSON format');
        expect(() => parseAiThemeJsonInput('{"theme":"missing dual shape"}')).toThrow('Invalid AI theme JSON format');
    });
});
