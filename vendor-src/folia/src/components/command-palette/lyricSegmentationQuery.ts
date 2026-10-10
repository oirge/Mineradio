import { parseCommandQuery } from './syntax/parse';
import type { CommandSyntaxSpec } from './syntax/types';

// src/components/command-palette/lyricSegmentationQuery.ts
// The `--flag` dialect the lyric segmentation command accepts in the palette input, so its actions
// are reachable from the keyboard instead of only from the buttons in the surface.
//
// Parsing goes through syntax/parse like the queue and sleep-timer commands; nothing here writes
// its own regex.

export const LYRIC_SEGMENTATION_SYNTAX_SPEC: CommandSyntaxSpec = {
    flags: [
        { name: 'ai', aliases: ['segment'], descriptionKey: 'commandPalette.syntax.lyricSegmentation.ai', descriptionFallback: 'Segment this song with the configured model' },
        { name: 'copy-seg', aliases: ['copy-segmentation', 'copy-current'], descriptionKey: 'commandPalette.syntax.lyricSegmentation.copySeg', descriptionFallback: 'Copy the current segmentation' },
        { name: 'copy-prompt', aliases: ['prompt'], descriptionKey: 'commandPalette.syntax.lyricSegmentation.copyPrompt', descriptionFallback: 'Copy the prompt and lyrics to run elsewhere' },
    ],
    facets: [],
};

export type LyricSegmentationAction = 'ai' | 'copy-seg' | 'copy-prompt';

export type ParsedLyricSegmentationQuery = {
    action: LyricSegmentationAction | null;
    /** Flag text typed so far that does not resolve yet, used to offer completions. */
    actionDraft: string | null;
    /** Whatever is left once the flag is stripped — a pasted segmentation, usually. */
    text: string;
};

export const parseLyricSegmentationQuery = (input: string): ParsedLyricSegmentationQuery => {
    const parsed = parseCommandQuery(LYRIC_SEGMENTATION_SYNTAX_SPEC, input);
    return {
        action: (parsed.flag as LyricSegmentationAction | null) ?? null,
        actionDraft: parsed.flagDraft,
        text: parsed.text,
    };
};

/**
 * Whether pasted text should be imported rather than entered as a command flag.
 *
 * The palette input is shared with the flags above, so a paste has to be told apart from ordinary
 * typing before it is treated as an import. Any nonempty paste other than a single-line flag is
 * sent to the parser, so malformed JSON and unrecognised model responses get visible feedback
 * instead of silently sitting in a single-line input with their line breaks flattened.
 */
export const looksLikeSegmentationPaste = (text: string, delimiter: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return !trimmed.startsWith('--') || /[\r\n]/.test(trimmed) || trimmed.includes(delimiter);
};
