import { LyricData } from '../../../types';
import { LyricAdapter } from '../LyricAdapter';
import { LyricProcessingOptions, RawEmbeddedLyric } from '../types';
import { parseLyricsAsync } from '../workerClient';
import { detectTimedLyricFormat } from '../formatDetection';
import { normalizeEmbeddedLrcText, normalizeEmbeddedUsltTags } from '../embeddedLrcNormalization';
import { extractAwlrcContainer } from '../awlrcContainer';

export class EmbeddedLyricAdapter implements LyricAdapter<RawEmbeddedLyric> {
    async parse(source: RawEmbeddedLyric, options: LyricProcessingOptions = {}): Promise<LyricData | null> {
        let mainLrc = '';
        let transLrc = '';
        let romanizationLrc = '';

        if (source.usltTags && source.usltTags.length > 0) {
            const normalized = normalizeEmbeddedUsltTags(source.usltTags);
            mainLrc = normalized.mainText;
            transLrc = normalized.translationText;
            romanizationLrc = normalized.romanizationText || '';
        } else if (source.textContent) {
            const normalized = normalizeEmbeddedLrcText(source.textContent, source.translationContent);
            mainLrc = normalized.mainText;
            transLrc = normalized.translationText;
            romanizationLrc = normalized.romanizationText || '';
        }

        if (!mainLrc) return null;

        // LX Music embeds the authoritative word-timed track in an `[awlrc:...]` container;
        // the repeated LRC body is only a fallback view and must not be parsed as one timeline.
        const container = extractAwlrcContainer(mainLrc);
        if (container?.awlrc || container?.lrc) {
            const translation = transLrc || container.tlrc || '';
            const romanization = container.rlrc || romanizationLrc;
            return container.awlrc
                ? await parseLyricsAsync('awlrc', container.awlrc, translation, options, romanization)
                : await parseLyricsAsync('lrc', container.lrc!, translation, options, romanization);
        }

        return await parseLyricsAsync(detectTimedLyricFormat(mainLrc), mainLrc, transLrc, options, romanizationLrc);
    }
}
