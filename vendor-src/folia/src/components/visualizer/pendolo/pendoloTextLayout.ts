import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';
import { splitLyricGraphemes } from '../../../utils/lyrics/graphemeTiming';

// src/components/visualizer/pendolo/pendoloTextLayout.ts

export interface PendoloWrappedTextLine {
    text: string;
    width: number;
    graphemeStart: number;
    graphemeEnd: number;
}

export interface PendoloTextLayout {
    lines: PendoloWrappedTextLine[];
    lineHeight: number;
    height: number;
}

/** Builds stable visual lines so timed fills and vertical spacing share one wrap result. */
export const buildPendoloTextLayout = (
    text: string,
    fontSpec: string,
    maxWidth: number,
    lineHeight: number,
): PendoloTextLayout => {
    const prepared = prepareWithSegments(text || ' ', fontSpec, {
        whiteSpace: 'pre-wrap',
    });
    const layout = layoutWithLines(prepared, Math.max(1, maxWidth), lineHeight);
    let graphemeCursor = 0;
    const lines = layout.lines.map(line => {
        const graphemeCount = splitLyricGraphemes(line.text).length;
        const result = {
            text: line.text,
            width: line.width,
            graphemeStart: graphemeCursor,
            graphemeEnd: graphemeCursor + graphemeCount,
        };
        graphemeCursor += graphemeCount;
        return result;
    });

    return {
        lines,
        lineHeight,
        height: Math.max(lines.length, 1) * lineHeight,
    };
};
