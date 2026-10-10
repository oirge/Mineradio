import { layoutWithLines, type PreparedTextWithSegments } from '@chenglou/pretext';
import { Line, Word as WordType } from '../../../types';
import { type GraphemeTiming } from '../../../utils/lyrics/graphemeTiming';

// src/components/visualizer/fume/fumeTypes.ts
// Shared shapes of the fume article: blocks, render lines and segments, layout metrics, camera state.

export interface ViewportSize {
    width: number;
    height: number;
}

export interface SegmentMeta {
    graphemeStart: number;
    graphemeEnd: number;
    graphemeCount: number;
}

export interface WordRange {
    wordIndex: number;
    word: WordType;
    start: number;
    end: number;
    colorStart: number;
    colorEnd: number;
    graphemeTimings: GraphemeTiming[];
}

export interface RenderLineSlice {
    id: string;
    text: string;
    start: number;
    end: number;
    graphemes: string[];
    glyphOffsets: number[];
    segments: RenderSegmentSlice[];
    left: number;
    top: number;
    width: number;
}

export interface RenderSegmentSlice {
    text: string;
    start: number;
    end: number;
    localStart: number;
    localEnd: number;
    x: number;
    width: number;
    isFullSegment: boolean;
    measuredGlyphOffsets: number[];
}

export interface FumeBlock {
    id: string;
    sourceLineIndex: number;
    line: Line;
    variant: 'body' | 'hero';
    x: number;
    y: number;
    width: number;
    height: number;
    innerWidth: number;
    fontPx: number;
    lineHeight: number;
    prepared: PreparedTextWithSegments;
    layout: ReturnType<typeof layoutWithLines>;
    graphemes: string[];
    segmentMetas: SegmentMeta[];
    wordRanges: WordRange[];
    wordRangeIndexByOffset: number[];
    colorRangeIndexByOffset: number[];
    renderLines: RenderLineSlice[];
}

interface FumePaperBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface FumeArticleLayout {
    width: number;
    height: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    paperBounds: FumePaperBounds;
    blocks: FumeBlock[];
    blockBySourceLineIndex: Map<number, FumeBlock>;
    chronologicalBlocks: FumeBlock[];
    firstRenderableStartTime: number;
    lastChronologicalRenderEndTime: number;
}

export interface FumeArticleLayoutMetrics {
    width: number;
    height: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    paperBounds: FumePaperBounds;
}

export interface StaticBlockSnapshot {
    canvas: HTMLCanvasElement;
    padding: number;
}

export interface FumeLayoutAttemptOptions {
    paperWidth: number;
    viewportHeight: number;
    columns: number;
    gap: number;
    densityScale: number;
    seedKey: string;
    mode?: 'measure' | 'render';
    timing?: FumeLayoutAttemptTiming;
}

export interface FumeLayoutAttemptTiming {
    lines: number;
    prepareLayoutMs: number;
    placementMs: number;
    renderDetailsMs: number;
}

export interface CameraTarget {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    focusX: number;
    focusY: number;
    scale: number;
    velocityScale: number;
    focusScale: number;
}

export interface CameraRetargetState {
    sourceLineIndex: number;
    startedAt: number;
    duration: number;
    fromX: number;
    fromY: number;
    fromScale: number;
    bridgeMode: 'none' | 'direct' | 'overview';
    bridgeWaypointX: number;
    bridgeWaypointY: number;
    bridgeWaypointScale: number;
    bridgeWaypointPhase: number;
}

export interface CameraViewTarget {
    x: number;
    y: number;
    scale: number;
}
