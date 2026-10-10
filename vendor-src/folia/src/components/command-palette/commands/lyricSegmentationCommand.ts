import { WholeWord } from 'lucide-react';
import { defineCommand } from '../commandFactories';
import { lyricSegmentationSurface } from '../surfaces/lyricSegmentationSurface';
import { LYRIC_SEGMENTATION_SYNTAX_SPEC } from '../lyricSegmentationQuery';
import { countAppliedSegmentationLines } from '../../../utils/lyrics/lyricSegmentationRecord';
import type { CommandPaletteCommand } from '../types';

// src/components/command-palette/commands/lyricSegmentationCommand.ts
// A state command: the list row says whether this song is on the default word split or a saved
// one, and opening it reveals the editor. Hidden for modes whose typography is not built from
// words, because changing the segmentation would have no visible effect there.

/** Shared with the player panel's appearance row, which opens this command's surface directly. */
export const LYRIC_SEGMENTATION_COMMAND_ID = 'lyric-segmentation';

export const lyricSegmentationCommand: CommandPaletteCommand = defineCommand({
    id: LYRIC_SEGMENTATION_COMMAND_ID,
    group: 'visualizer',
    title: 'Adjust lyric word segmentation',
    description: 'Fix how this song’s lyrics are split into words, with AI or by hand',
    // No pinyin here: the build-time index derives it from the Chinese title in zh-CN.ts. No
    // keyword may be a space-separated prefix of another the user might type in full, since this
    // command takes no input of its own.
    keywords: ['word segmentation', 'lyric segmentation', 'segment lyrics', 'word split', '歌词分词', '分词调整', '分词', '词边界', '重新分词'],
    icon: WholeWord,
    surface: lyricSegmentationSurface,
    // The input doubles as the import box and as a command line for the surface's actions, so the
    // palette parses `--ai` / `--copy-prompt` / `--copy-seg` and offers them as completions.
    syntax: LYRIC_SEGMENTATION_SYNTAX_SPEC,
    requiresInput: true,
    // No executeShortcut: the AI action costs money, so this must not be one keystroke away.
    // Deliberately not gated on lyrics being loaded: they arrive a beat after the song, and a
    // command that appears and disappears while a track settles is worse than one that opens onto
    // "no lyrics to segment". The mode gate is the one that matters, since the saved split would
    // have no visible effect elsewhere.
    isAvailable: context => (
        context ? Boolean(context.shared.currentSong) && context.visualizer.usesWordSegmentation : true
    ),
    getPreview: (_input, context) => {
        const { record } = context.visualizer.lyricSegmentation;
        if (!record) {
            return context.shared.t('lyricSegmentation.statusDefault', 'Default segmentation');
        }
        const applied = countAppliedSegmentationLines(context.shared.lyrics, record);
        const sourceLabel = context.shared.t(
            record.source === 'ai' ? 'lyricSegmentation.sourceAi' : 'lyricSegmentation.sourceManual',
            record.source === 'ai' ? 'AI' : 'Manual',
        );
        return `${sourceLabel} · ${applied}`;
    },
    placeholder: context => context.shared.t(
        'lyricSegmentation.inputPlaceholder',
        'Paste a segmentation to import, or type --ai / --copy-prompt / --copy-seg',
    ),
    execute: () => false,
});
