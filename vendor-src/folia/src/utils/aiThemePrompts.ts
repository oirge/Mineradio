import type { DualTheme } from '../types';

// src/utils/aiThemePrompts.ts
// Shared prompt and response helpers for manually generating song themes with AI tools.

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasDualThemeShape = (value: unknown): value is Partial<DualTheme> => (
    isRecord(value) && isRecord(value.light) && isRecord(value.dark)
);

const findBalancedJsonObject = (text: string) => {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
        const char = text[index];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === '\\') {
                isEscaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
    }

    return null;
};

const getJsonCandidates = (input: string) => {
    const trimmed = input.trim();
    const candidates = [trimmed];
    const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;

    while ((match = fencePattern.exec(trimmed)) !== null) {
        candidates.push(match[1].trim());
    }

    const balancedJson = findBalancedJsonObject(trimmed);
    if (balancedJson) {
        candidates.push(balancedJson);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
};

// Parses raw JSON, fenced JSON, or prose-wrapped AI output into a dual theme object.
export const parseAiThemeJsonInput = (input: string): Partial<DualTheme> => {
    let lastError: unknown = null;

    for (const candidate of getJsonCandidates(input)) {
        try {
            const parsed = JSON.parse(candidate);
            if (hasDualThemeShape(parsed)) {
                return parsed;
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error('Invalid AI theme JSON format', { cause: lastError });
};

export const THEME_GENERATION_PROMPT_PREFIX = `Analyze the mood of the provided song source text and generate TWO visual theme configurations for a music player - one for LIGHT mode and one for DARK mode.

DUAL THEME REQUIREMENTS:
1. Generate TWO complete themes: one optimized for LIGHT/DAYLIGHT mode, one for DARK/MIDNIGHT mode.
2. Both themes should capture the SAME emotional essence of the source text, but with appropriate color palettes for their respective modes.
3. The theme names must be in Chinese and strictly limited to 10 characters or less. They should reflect both the mood AND the mode (e.g., "忧郁破晓" for light, "忧郁子夜" for dark).
4. The theme description must be a brief, emotional sentence in Chinese (strictly limited to 15 to 30 Chinese characters) reflecting a stream-of-consciousness style with youth and literary characteristics, capturing a listener's immediate emotional reaction to this song. Do not write formal analytical text. Must be written from a first-person listener perspective.
   GUIDELINES FOR THE EXPRESSIVE STYLE:
   - Stream of Consciousness & Literary Vibe: Emphasize poetic, reflective, or introspective thoughts (e.g., emotional connection, existential thoughts, quiet solitude).
   - Youth & Nostalgia: Associate the mood with nostalgic memories of youth, dreams, seasons, or romantic longing.
   - Spatial & Situational Synesthesia: Translate the music's vibe into a vivid situation, atmosphere, weather, or imagery (e.g., summer breeze, starry sky, quiet room).
   Examples for reference: "戴上耳机的那一刻，喧嚣的世界瞬间消失了。", "然后，这份爱编织了太阳和所有星星", "你的世界，也包括我在内吗？", "微醺的夏夜吹拂过一阵海风。", "青春是一种眺望的姿态！", "仿佛回到了那个满是汽水味和单车后座的夏天。"。

SOURCE MODE:
1. If 'Pure instrumental' is yes, the source text below is the song title of a pure instrumental track, not lyrics.
2. If 'Pure instrumental' is no, the source text below is a lyrics snippet.
3. Base your mood inference only on the provided source text.

COLOR & THEME GENERATION WORKFLOW:
1. First, identify 10-20 key emotional standalone words from the source text that represent the core mood and atmosphere of the song.
2. Assign a specific, representative color to each of these key emotional standalone words under 'wordColors'.
3. Based on the emotional direction and colors of these identified words, construct the overall color palettes (backgroundColor, primaryColor, secondaryColor, accentColor) for the light and dark themes.
4. Coordinated Colors: The colors assigned in 'wordColors' must be designed in coordination and harmony with the overall color schemes of the themes.

LIGHT THEME RULES:
- Use LIGHT backgrounds. Avoid defaulting to pure white background for every light theme. Generate diverse and rich light-colored backgrounds (e.g., warm creams, soft pastel blues, pale sage greens, gentle peach, warm sands, pale lavenders) that directly match the song's mood.
- Ensure text/icons are dark enough for contrast, but avoid defaulting to pure black (#000000). Generate a very dark tone that coordinates with the background color's hue (e.g., deep navy, dark charcoal, dark plum).
- 'accentColor' must be visible against the light background.

DARK THEME RULES:
- Use DARK backgrounds. Avoid generic pure black backgrounds; use rich, diverse dark colors (e.g., deep midnight blue, dark forest green, charcoal gray, dark plum, deep chocolate, burgundy) matching the song's mood.
- Ensure text/icons are light enough for contrast, but avoid defaulting to pure white (#ffffff). Generate a very bright, soft tone that coordinates with the background color's hue (e.g., soft sky blue, pale mint green, light warm cream).
- 'accentColor' must contrast with the dark background and should be creatively derived from the song's specific mood (e.g., soft blues, mint greens, warm corals, lavender, pale gold) rather than defaulting to generic bright yellow.

SHARED RULES FOR BOTH THEMES:
1. CRITICAL for 'secondaryColor': This color is used for secondary TEXT (e.g., album name, artist name).
   - It MUST have sufficient contrast against 'backgroundColor' to be easily readable.
   - Aim for a contrast ratio of at least 4.5:1 for accessibility.
2. 'wordColors' and 'lyricsIcons' should be the SAME for both themes (they represent the source text's meaning).

IMPORTANT for 'wordColors':
1. Extract 10-20 emotional standalone words. For Latin-script text, each 'word' MUST be one complete word only, not a phrase.
2. CRITICAL: Do NOT include punctuation, apostrophes, curly quotes, hyphens, or spaces in Latin-script 'word' values. Use clean whole words like "train", "gone", "hidden", "cities"; do NOT return "train’s gone", "well-hidden", "set me free", or "shun the light".
3. Avoid function words such as articles, prepositions, pronouns, particles, and auxiliaries (for example: the, a, an, to, me, and, of, in, on).
4. For CJK lyrics, short meaningful semantic terms may contain multiple CJK characters, but do not select single particles unless they are emotionally meaningful.
5. The 'word' field MUST match text from the source snippet after removing surrounding punctuation. If the pure-instrumental title is very short, using the exact full title as a phrase is allowed.

IMPORTANT for 'lyricsIcons':
1. Identify 3-5 visual concepts/objects mentioned in or strongly implied by the source text.
2. Return them as valid Lucide React icon names (PascalCase, e.g., 'CloudLightning', 'HeartHandshake').

OUTPUT CONTRACT:
Return one JSON object with required "light" and "dark" objects. Each theme object requires "name", "backgroundColor", "primaryColor", "accentColor", "secondaryColor", "wordColors", and "lyricsIcons".

Expected JSON structure:
{
  "light": {
    "name": "string (max 10 chars, in Chinese)",
    "description": "string (15-30 chars, in Chinese)",
    "backgroundColor": "hex string",
    "primaryColor": "hex string",
    "accentColor": "hex string",
    "secondaryColor": "hex string",
    "wordColors": [
      {
        "word": "string",
        "color": "hex string"
      }
    ],
    "lyricsIcons": ["string", "string"]
  },
  "dark": {
    "name": "string (max 10 chars, in Chinese)",
    "description": "string (15-30 chars, in Chinese)",
    "backgroundColor": "hex string",
    "primaryColor": "hex string",
    "accentColor": "hex string",
    "secondaryColor": "hex string",
    "wordColors": [
      {
        "word": "string",
        "color": "hex string"
      }
    ],
    "lyricsIcons": ["string", "string"]
  }
}`;

export const buildThemeSourcePrompt = (snippet: string, isPureMusic: boolean, songTitle?: string) => `Pure instrumental: ${isPureMusic ? 'yes' : 'no'}
${isPureMusic && songTitle ? `Song title: ${songTitle}\n` : ''}Source snippet:
${snippet}`;
