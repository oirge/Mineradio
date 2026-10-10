// src/mods/folium/contract.ts
// The public Folium 1 contract: every type a mod can observe lives here and
// nowhere else. Host-internal types (Line, Theme, SongResult, store shapes)
// never appear in this file; the host projects them into these DTOs.
//
// Stability rule (mods/README.md): inside folium 1.x this file only grows.
// Removing a field or changing its meaning requires folium 2.

/** The Folium version this host implements; mods read it at runtime as `folium.host.folium`. */
export const FOLIUM_VERSION = Object.freeze({ major: 1, minor: 4 });

/** `modid:name`, like a Forge ResourceLocation. The mod id part is added by the host. */
export type FoliumId = string;

/** Localized text keyed by locale (`zh-CN`, `en`, `in`); the host falls back to `en`, then to any entry. */
export type FoliumLabel = Record<string, string | undefined>;

/** Undoes a registration, subscription or mount. Safe to call more than once. */
export type FoliumDisposer = () => void;

// ---------------------------------------------------------------- DTOs
//
// FoliumLine / FoliumTheme mirror the host's Line / Theme field for field:
// same names, same meanings, so code moves between a builtin visualizer and a
// mod without translation. They are still frozen projections (dto.ts), never
// the host objects themselves. The only Folium addition is FoliumTheme.isDaylight,
// which builtin modes receive as a separate prop.

/** Ruby (furigana) over part of a syllable. Times in seconds on the lyric clock. */
export interface FoliumLyricRuby {
    /** The ruby text. */
    text: string;
    /** Start, seconds. */
    startTime: number;
    /** End, seconds. */
    endTime: number;
}

/** One timed syllable of a word. Times in seconds on the lyric clock. */
export interface FoliumLyricSyllable {
    /** The syllable text. */
    text: string;
    /** Start, seconds. */
    startTime: number;
    /** End, seconds. */
    endTime: number;
    /** A space follows this syllable. */
    endsWithSpace?: boolean;
    /** Ruby over this syllable. */
    ruby?: FoliumLyricRuby[];
    /** Marked explicit by the lyric source. */
    obscene?: boolean;
    /** Beats of silence after the syllable, from the lyric source. */
    emptyBeat?: number;
}

/** Another rendering of a line or vocal: a translation, a romanization, or another role from the lyric source. */
export interface FoliumLyricAlternateText {
    /** 'translation', 'romanization' or another role from the lyric source. */
    role: string;
    /** BCP 47 language tag, when the source gives one. */
    language?: string;
    /** The full text. */
    text: string;
    /** Timed syllables, when the source has them. */
    syllables?: FoliumLyricSyllable[];
}

/** One timed word of a line. Times in seconds on the lyric clock. */
export interface FoliumWord {
    /** The word text, including a trailing space when there is one. */
    text: string;
    /** Start, seconds. */
    startTime: number;
    /** End, seconds. */
    endTime: number;
    /** Timed syllables, when the source has them. */
    syllables?: FoliumLyricSyllable[];
}

/** A background vocal (harmony) attached to a line, timed and structured like a line. */
export interface FoliumBackgroundVocal {
    /** The full text. */
    text: string;
    /** Start, seconds. */
    startTime: number;
    /** End, seconds. */
    endTime: number;
    /** Timed words. */
    words: FoliumWord[];
    /** The singer, when the source names one. */
    agentId?: string;
    /** Translation text. */
    translation?: string;
    /** Romanization text. */
    romanization?: string;
    /** All alternate texts from the source. */
    alternateTexts?: FoliumLyricAlternateText[];
}

/** How short a line is: `micro` and `short` lines get faster transitions. */
export type FoliumLineTimingClass = 'normal' | 'short' | 'micro';
/** How the host moves a line in and out: full, fast, or no transition. */
export type FoliumLineTransitionMode = 'normal' | 'fast' | 'none';
/** How the host reveals the words of a line: full, fast, or all at once. */
export type FoliumWordRevealMode = 'normal' | 'fast' | 'instant';

/** How the host times a line on screen; builtin modes read the same values. */
export interface FoliumLineRenderHints {
    /** `endTime - startTime`, seconds. */
    rawDuration: number;
    /** How short the line is. */
    timingClass: FoliumLineTimingClass;
    /** When the host stops showing the line (endTime plus hold/tail). */
    renderEndTime: number;
    /** How the line moves in and out. */
    lineTransitionMode: FoliumLineTransitionMode;
    /** How its words are revealed. */
    wordRevealMode: FoliumWordRevealMode;
}

/**
 * One lyric line, the same fields and meanings as the host `Line` builtin visualizers receive. Times in
 * seconds on the lyric clock.
 */
export interface FoliumLine {
    /** Timed words; a line without word timing has one word spanning the line. */
    words: FoliumWord[];
    /** Start, seconds. */
    startTime: number;
    /** The lyric's own end time. When the line leaves the screen is `renderHints.renderEndTime`. */
    endTime: number;
    /** The whole line. */
    fullText: string;
    /** Always present: the host fills in hints the lyric source did not carry. */
    renderHints: FoliumLineRenderHints;
    /** Translation text. */
    translation?: string;
    /** Romanization text. */
    romanization?: string;
    /** All alternate texts from the source, with language and role. */
    alternateTexts?: FoliumLyricAlternateText[];
    /** Line id from the source, when it has one. */
    id?: string;
    /** The singer, when the source names one. */
    agentId?: string;
    /** Song part name from the source, e.g. `Chorus`. */
    songPart?: string;
    /** Index of the song part this line belongs to. */
    blockIndex?: number;
    /** The line is part of a chorus. */
    isChorus?: boolean;
    /** The chorus effect builtin modes draw for it. */
    chorusEffect?: 'bars' | 'circles' | 'beams';
    /**
     * Background vocals. The host's legacy single `backgroundVocal` is folded
     * in here, so this is the only place to look.
     */
    backgroundVocals?: FoliumBackgroundVocal[];
    /** The user's saved word split; `join('')` equals `fullText`. See `folium.lyrics.segmentWords`. */
    wordSegments?: string[];
}

/**
 * The current theme, the same fields and meanings as the host `Theme` builtin visualizers receive, plus
 * `isDaylight`.
 */
export interface FoliumTheme {
    /** Theme name. */
    name: string;
    /** CSS color. */
    backgroundColor: string;
    /** CSS color of lyric text. */
    primaryColor: string;
    /** CSS color for highlights. */
    accentColor: string;
    /** CSS color for secondary text. */
    secondaryColor: string;
    /** The builtin font family class. */
    fontStyle: 'sans' | 'serif' | 'mono';
    /** The user's chosen family, if any. For a CSS font-family value use `folium.theme.resolveFontStack(theme)`. */
    fontFamily?: string;
    /** The user's font fallback list. */
    fontFamilyStack?: string[];
    /** For a concrete weight use `folium.theme.resolveFontWeight(theme, fallback)`. */
    fontWeight?: number;
    /** How lively animations should be; builtin modes scale motion by it. */
    animationIntensity: 'calm' | 'normal' | 'chaotic';
    /** Keyword colors; match them with `folium.lyrics.buildWordColorRanges` / `resolveWordColor`. */
    wordColors?: { word: string; color: string }[];
    /** Decorative icon names the theme suggests. */
    lyricsIcons?: string[];
    /** Where the theme came from (e.g. an AI provider). */
    provider?: string;
    /** Theme description. */
    description?: string;
    /** Folium addition: builtin modes get this as a separate `isDaylight` prop. */
    isDaylight: boolean;
}

/**
 * A song as mods see it. Pass it back to the host (playSong, enqueue, beforePlay.replaceWith) only when it
 * carries a `ref`.
 */
export interface FoliumSong {
    /** The song id at its source, as a string; null when unknown. */
    id: string | null;
    /** Song title. */
    title: string;
    /** Artists joined with ` / `. */
    artist: string;
    /** Album name. */
    album: string | null;
    /** Where the song comes from: an Omni provider id, 'local', 'navidrome', … */
    source: string | null;
    /**
     * Opaque handle the host can turn back into the real song (playSong,
     * enqueue, beforePlay.replaceWith). Valid for the session; null when the
     * DTO was not built from a host song.
     */
    ref: string | null;
}

/** The host player state. */
export type FoliumPlaybackState = 'playing' | 'paused' | 'stopped';

/** The whole playback picture, as main entries read it with `api.runtime.getPlaybackSnapshot()`. */
export interface FoliumPlaybackSnapshot {
    /** The displayed song. */
    song: FoliumSong | null;
    /** The player state. */
    state: FoliumPlaybackState;
    /** Seconds. */
    position: number;
    /** Seconds; 0 when unknown. */
    duration: number;
    /** Lyrics of the displayed song. */
    lines: FoliumLine[];
    /** The current theme. */
    theme: FoliumTheme | null;
    /** The current lyric animation mode id. */
    visualizerMode: string | null;
}

/**
 * Folium 1.4: lyric formats the host parses, the same parsers as local lyric files. These and nothing
 * else: lyrics in any other form (a platform's JSON, SRT, ASS, a custom word-timing scheme) are the mod's
 * to convert into one of them first. QRC and KRC are the decrypted plain text; the host does not decrypt.
 *
 * The format is never sniffed, and the content is not checked against it: an `lrc` track that carries
 * `<mm:ss.xx>` word tags is read as plain LRC (name it `enhanced-lrc`), and mislabelled or malformed text
 * parses to no lines or to garbled ones. `folium.lyrics.parse` runs the same pipeline, to check a conversion.
 */
export type FoliumLyricFormat = 'lrc' | 'enhanced-lrc' | 'yrc' | 'qrc' | 'krc' | 'ttml' | 'vtt' | 'awlrc';

/**
 * Folium 1.4: one lyric document in its raw text, parsed by the host's local lyric file pipeline.
 * Each text is at most 1,048,576 characters.
 */
export interface FoliumLyricsTrack {
    /** How to read `text`. */
    format: FoliumLyricFormat;
    /** The raw lyric document. */
    text: string;
    /**
     * Translation lines, matched to `text` by start time like a local `.t.lrc` file (VTT cues for a
     * `vtt` track). Ignored for `ttml`, which carries its translations inline.
     */
    translationText?: string;
    /** Romanization lines, matched like `translationText`. Ignored for `ttml`. */
    romanizationText?: string;
}

/**
 * Folium 1.4: lyrics a provider hands the host. With both tracks the host shows `wordByWord`, and falls
 * back to `main` when it is missing or parses to no lines; a `wordByWord` track without its own
 * translation or romanization borrows the ones on `main`.
 */
export interface FoliumLyricsResult {
    /** Line-timed lyrics, also the fallback for `wordByWord`. */
    main?: FoliumLyricsTrack;
    /** Word-timed lyrics, shown in preference to `main`. */
    wordByWord?: FoliumLyricsTrack;
    /** An instrumental: the host shows its pure-music view and ignores both tracks. */
    isPureMusic?: boolean;
    /**
     * Chorus spans in seconds on the lyric clock; lines inside one get the chorus effect. Without them
     * the host detects choruses from repeated lines, and TTML `songPart` markers take precedence over both.
     * At most 64 are kept; a span needs finite times with `0 <= startTime < endTime`.
     */
    chorusRanges?: Array<{ startTime: number; endTime: number }>;
}

/**
 * The Folium 1.3 `getLyrics` answer: plain LRC, parsed as plain LRC. Deprecated in Folium 1.4 in favor of
 * FoliumLyricsResult; Folium 2 drops it.
 */
export interface FoliumLegacyLyricsResult {
    /** LRC text. */
    lrc: string;
    /** Translation LRC. */
    translationLrc?: string;
}

/** Folium 1.4: what `folium.lyrics.parse` returns. */
export interface FoliumParsedLyrics {
    /** The parsed lines; empty when the text holds none. The host's lyric display filter is not applied. */
    lines: readonly FoliumLine[];
    /** Whether the lines carry real word timings rather than timings the host estimated. */
    isWordByWord: boolean;
}

// ---------------------------------------------------------------- Parameters

/** Field kinds: a slider, a text box, a switch, or a choice among `options`. */
export type FoliumParamType = 'number' | 'text' | 'boolean' | 'select';

/** One choice of a `select` field. */
export interface FoliumParamOption {
    /** The stored value. */
    value: string;
    /** What the user sees. */
    label: FoliumLabel;
}

/**
 * One declarative field. The same schema drives settings sections, visualizer
 * settings, tunings of builtin modes and command parameters, and it is the only
 * source of keys, defaults and validation for the values it describes.
 */
export interface FoliumParam {
    /** Value key, unique within the schema. */
    key: string;
    /** Field kind. */
    type: FoliumParamType;
    /** Field label. */
    label: FoliumLabel;
    /** Help text. */
    description?: FoliumLabel;
    /** Fields sharing a group label render together under that heading. */
    group?: FoliumLabel;
    /** Used until the user changes the field; also what `reset` restores. */
    defaultValue?: string | number | boolean;
    /** `number`: lower bound (values are clamped). */
    min?: number;
    /** `number`: upper bound (values are clamped). */
    max?: number;
    /** `number`: slider step. Default 1 when both bounds are integers, else 0.01. */
    step?: number;
    /** `text`: placeholder. */
    placeholder?: string;
    /** `select`: the choices; values outside them are rejected. */
    options?: FoliumParamOption[];
}

/** Values keyed by field `key`, defaults merged. Read-only; write through `FoliumParamAccess.set`. */
export type FoliumParamValues = Readonly<Record<string, unknown>>;

/** Read/write access to one schema's persisted values (defaults already merged). */
export interface FoliumParamAccess {
    /** The fields, as registered (invalid declarations dropped). */
    readonly schema: readonly FoliumParam[];
    /** Current values, defaults merged. */
    get(): FoliumParamValues;
    /** Validated against the schema: unknown keys are dropped, numbers clamped, selects checked. */
    set(patch: Record<string, unknown>): void;
    /** Restores every default. */
    reset(): void;
    /** Called after any value changes. */
    subscribe(listener: () => void): FoliumDisposer;
}

// ---------------------------------------------------------------- Host containers

/**
 * Everything UI-shaped is mounted into a container the host owns. The host
 * creates it (inside a ShadowRoot for panels), passes theme colors as
 * `--folium-*` CSS custom properties, and calls the disposer when it removes the
 * container. Mods never query or mutate host DOM outside their container.
 */
export type FoliumMount<Ctx> = (container: HTMLElement, ctx: Ctx) => void | FoliumDisposer;

/** Context for panel-like containers (player panel tabs, settings panels). */
export interface FoliumPanelContext {
    /** The UI locale, e.g. `zh-CN`. */
    readonly locale: string;
    /** The current theme. */
    getTheme(): FoliumTheme;
    /** Called when the theme changes. */
    subscribe(listener: () => void): FoliumDisposer;
}

/**
 * Context for a custom settings panel (`settingsPanel`): the panel draws the form, the schema still owns the
 * values.
 */
export interface FoliumSettingsPanelContext extends FoliumPanelContext {
    /** Read and write the values the schema describes. */
    readonly params: FoliumParamAccess;
}

/** A clock in seconds. `on` fires while it runs; read it with `get` when you need it now. */
export interface FoliumClock {
    /** Current time, seconds. */
    get(): number;
    /** Called with the time on every change. */
    on(event: 'change', listener: (seconds: number) => void): FoliumDisposer;
}

/** What the host draws around the content. */
export interface FoliumSurface {
    /** The host renders onto a transparent surface (OBS source, alpha export). */
    transparent: boolean;
    /** The host is painting its configured background under this content. */
    hostBackground: boolean;
}

/** Analyser band energies, each 0..1. */
export interface FoliumAudioBands {
    /** 20–150 Hz */
    readonly bass: number;
    /** 150–400 Hz */
    readonly lowMid: number;
    /** 400–1200 Hz */
    readonly mid: number;
    /** 1000–3500 Hz */
    readonly vocal: number;
    /** 3500 Hz and up */
    readonly treble: number;
}

/**
 * Folium 1.2: the host's audio analyser, for audio-reactive content. Values
 * change every frame and nothing is announced: read them inside your own frame
 * loop. Previews feed a synthetic signal; silence (or no analyser) reads as 0.
 */
export interface FoliumAudio {
    /** Overall energy (bass + low mid, shaped), 0..1. */
    getPower(): number;
    /** The same object on every call, refreshed in place; copy it to keep a reading. */
    getBands(): FoliumAudioBands;
    /** Raw analyser FFT magnitudes (0–255), or null when there are none. The host reuses the array. */
    getSpectrum(): Uint8Array | null;
}

/**
 * Context for lyric-synced content (visualizers, stage layers).
 * Snapshot fields are fixed for one mount; the host remounts only when the
 * lyric data, the song or `staticMode` changes (or the preview line in static
 * mode). Everything else is read through getters, and `subscribe` fires when
 * any getter's value changes, including while paused, when `currentTime` is idle.
 */
/**
 * Folium 1.3: the host's display settings for lyric content, named and valued
 * as builtin modes receive them. A mod that turns off `hostLayers.subtitles`
 * and draws its own reads the subtitle settings here.
 */
export interface FoliumDisplay {
    /** False while lyrics should not be drawn (e.g. the settings modal covers the player). */
    showText: boolean;
    /** The user's lyric size multiplier; builtin modes scale lyric text by it. */
    lyricsFontScale: number;
    /** Subtitle size multiplier. */
    subtitleFontScale: number;
    /** Subtitle opacity, 0..1. */
    subtitleOverlayOpacity: number;
    /** Subtitles get a backing plate. */
    subtitleOverlayBackground: boolean;
    /** Upcoming-line subtitles are blurred. */
    subtitleUpcomingLyricsBlur: boolean;
    /** Background vocals are shown as subtitles. */
    showHarmonySubtitle: boolean;
    /** Harmony subtitles get a backing plate. */
    harmonySubtitleBackground: boolean;
    /** Subtitles show a translation or romanization. */
    showSubtitleTranslation: boolean;
    /** The host hides translation subtitles here (e.g. the lyrics already carry them). */
    hideTranslationSubtitle: boolean;
    /** What subtitles show. */
    subtitleContentMode: 'translation' | 'romanization' | 'none';
    /** The player controls are hidden. */
    isPlayerChromeHidden: boolean;
    /** The player panel is open. */
    isPanelOpen: boolean;
    /** Lyric layer opacity, 0..1. */
    visualizerOpacity: number;
}

/**
 * Context for lyric-synced content (visualizers, stage layers). Snapshot fields are fixed for one mount; the
 * host remounts only when the lyric data, the song or `staticMode` changes (or the preview line in static
 * mode). Everything else is read through getters, and `subscribe` fires when any getter's value changes,
 * including while paused, when `currentTime` is idle.
 */
export interface FoliumStageContext {
    /** Lyrics of this song (fixed for the mount). */
    readonly lines: readonly FoliumLine[];
    /** This song (fixed for the mount). */
    readonly song: FoliumSong | null;
    /** A still preview: draw one frame of `staticLineIndex`, do not animate. */
    readonly staticMode: boolean;
    /** Only meaningful in static mode: the line the preview shows. */
    readonly staticLineIndex: number | null;
    /**
     * Folium 1.3: the geometry seed builtin modes get (the displayed song's id,
     * or a per-mode fallback). Stable per song, identical in previews, playback
     * and export, so seeded randomness matches everywhere.
     */
    readonly seed: string | null;
    /** Folium 1.3: rendering inside a settings preview rather than the player page. */
    readonly isPreview: boolean;
    /** The lyric clock. */
    readonly currentTime: FoliumClock;
    /** Index into `lines` of the active line; -1 between lines. */
    getLineIndex(): number;
    /** Playback is paused. */
    isPaused(): boolean;
    /** The current theme. */
    getTheme(): FoliumTheme;
    /** Folium 1.3: the theme the host's subtitles use; equals getTheme() where there is none. */
    getSubtitleTheme(): FoliumTheme;
    /** Folium 1.3. */
    getCoverUrl(): string | null;
    /** Folium 1.3. The same object until a value changes; `subscribe` announces changes. */
    getDisplay(): FoliumDisplay;
    /** This entry's settings values (defaults merged); empty without a schema. */
    getSettings(): FoliumParamValues;
    /** What the host draws around this content. */
    getSurface(): FoliumSurface;
    /** Called when the line index, pause, theme, subtitle theme, cover, display, settings or surface change. */
    subscribe(listener: () => void): FoliumDisposer;
    /** Folium 1.2. */
    readonly audio: FoliumAudio;
}

// ---------------------------------------------------------------- Registry definitions

/** A lyric animation mode. Its mode id is `mod:<modid>:<id>`. */
export interface FoliumVisualizerDef {
    /** Local id; the mode id becomes `mod:<modid>:<id>`. */
    id: string;
    /** Name in the mode picker. */
    label: FoliumLabel;
    /** Position in the mode picker; default 500 (after builtin modes). */
    order?: number;
    /** Draws the visualizer into its container. */
    mount: FoliumMount<FoliumStageContext>;
    /**
     * Settings schema; the host renders the form under the mode picker, persists the values and includes them
     * in visual config import/export.
     */
    settings?: FoliumParam[];
    /** Replaces the host-rendered form; values still follow `settings`. */
    settingsPanel?: FoliumMount<FoliumSettingsPanelContext>;
    /** Host-rendered layers around the visualizer. Both default to true. */
    hostLayers?: { background?: boolean; subtitles?: boolean };
}

/** Extra tuning knobs for a builtin visualizer mode that declares Folium tunables. */
export interface FoliumTuningDef {
    /** Local id. */
    id: string;
    /** A builtin visualizer mode that declares `foliumTunables`, e.g. "sonnet". */
    target: string;
    /** Card title. */
    label: FoliumLabel;
    /** Number params only; keys and ranges are checked against the target's whitelist. */
    params: FoliumParam[];
}

/** What a command receives when it runs. */
export interface FoliumCommandContext {
    /** Validated parameter values (defaults merged). */
    readonly values: FoliumParamValues;
}

/**
 * A command in the mods panel and the command palette. `run` executes in the renderer; hand Node work to the
 * main entry through `folium.rpc`.
 */
export interface FoliumCommandDef {
    /** Local id. */
    id: string;
    /** Command name. */
    label: FoliumLabel;
    /** Shown under the name. */
    description?: FoliumLabel;
    /** Extra search terms for the command palette (label texts are always included). */
    keywords?: string[];
    /** Shown in the mods panel and the command palette; a palette entry with params opens a form. */
    params?: FoliumParam[];
    /** Runs the command; the result is shown as a summary (a string, `{ outputPath }` or `{ message }`). */
    run(ctx: FoliumCommandContext): unknown | Promise<unknown>;
}

/** Lyric-free context for background types: they paint behind every mode, previews included. */
export interface FoliumBackgroundContext {
    /** A still preview: draw one frame, do not animate. */
    readonly staticMode: boolean;
    /** Playback is paused. */
    isPaused(): boolean;
    /** The current theme. */
    getTheme(): FoliumTheme;
    /** This background's settings values (defaults merged). */
    getSettings(): FoliumParamValues;
    /** Cover image URL of the displayed song. */
    getCoverUrl(): string | null;
    /** Called when pause, theme, settings or cover change. */
    subscribe(listener: () => void): FoliumDisposer;
    /** Folium 1.2. */
    readonly audio: FoliumAudio;
}

/** A background type in the background picker; it paints behind every mode, previews and export included. */
export interface FoliumBackgroundDef {
    /** Local id. */
    id: string;
    /** Name in the background picker. */
    label: FoliumLabel;
    /** Position in the picker; default 500. */
    order?: number;
    /** Draws the background into its container. */
    mount: FoliumMount<FoliumBackgroundContext>;
    /** Settings schema, as for visualizers. */
    settings?: FoliumParam[];
    /** Replaces the host-rendered form; values still follow `settings`. */
    settingsPanel?: FoliumMount<FoliumSettingsPanelContext>;
}

/**
 * Where a stage layer sits on the player page:
 *   - `player.stage.back`: above the background, under the lyrics;
 *   - `player.stage.front`: above the lyrics, under the player chrome;
 *   - `app.overlay`: above the whole app.
 */
export type FoliumStageSlot = 'player.stage.back' | 'player.stage.front' | 'app.overlay';

/**
 * A layer on the live player page (never in previews, OBS sources or the export window). Needs the `ui.stage`
 * permission.
 */
export interface FoliumStageLayerDef {
    /** Local id. */
    id: string;
    /** Where the layer sits. */
    slot: FoliumStageSlot;
    /** Stacking order within the slot; default 500. */
    order?: number;
    /**
     * When false (default) the layer is click-through, so it cannot block the
     * player; elements that should still take clicks set `pointer-events: auto`.
     * When true the whole layer captures the pointer.
     */
    interactive?: boolean;
    /** Draws the layer into its container. */
    mount: FoliumMount<FoliumStageContext>;
}

/**
 * The mod's own settings, shown in the mods panel when the mod's row is expanded. Values are readable in
 * every context.
 */
export interface FoliumSettingsSectionDef {
    /** Local id. */
    id: string;
    /** Section title. */
    label: FoliumLabel;
    /** Shown under the title. */
    description?: FoliumLabel;
    /** The fields. */
    settings: FoliumParam[];
    /** Replaces the host-rendered form; values still follow `settings`. */
    settingsPanel?: FoliumMount<FoliumSettingsPanelContext>;
}

/** A tab in the player panel. `folium.ui.openPlayerPanel(id)` opens it. */
export interface FoliumPlayerPanelTabDef {
    /** Local id; pass it to `folium.ui.openPlayerPanel`. */
    id: string;
    /** Tab title. */
    label: FoliumLabel;
    /** Tab order; default 500. */
    order?: number;
    /** Draws the tab into its container. */
    mount: FoliumMount<FoliumPanelContext>;
}

/** Progress-bar context shared by control buttons and progress layers. */
export interface FoliumProgressContext {
    /** The playback clock (audio time). */
    readonly currentTime: FoliumClock;
    /** Track duration, seconds; 0 when unknown. */
    getDuration(): number;
    /** 0..1 position of a time on the track (0 when the duration is unknown). */
    timeToRatio(seconds: number): number;
    /** Seeks the host player; ignored while the host bar is disabled. */
    seek(seconds: number): void;
    /** The host bar's colors, so mod UI can match it. */
    getColors(): { fill: string; track: string; text: string };
    /** Called when the duration or the colors change. */
    subscribe(listener: () => void): FoliumDisposer;
}

/** The side of the progress bar a control button sits on. */
export type FoliumControlSlot = 'progress.leading' | 'progress.trailing';

/** A button next to the progress bar. All three host progress bars (floating controls x2, Lattice) show it. */
export interface FoliumControlButtonDef {
    /** Local id. */
    id: string;
    /** Left or right of the bar. */
    slot: FoliumControlSlot;
    /** Order within the slot; default 500. */
    order?: number;
    /**
     * Folium 1.3: leave the collapsed floating capsule alone. The button is not
     * mounted there, only on the expanded capsule and Lattice. Default false.
     */
    hideWhenCollapsed?: boolean;
    /** Draws the button into its container. */
    mount: FoliumMount<FoliumProgressContext>;
}

/**
 * A layer over the progress track. Its container is click-through so seeking
 * keeps working; elements that should take clicks set `pointer-events: auto`.
 */
export interface FoliumProgressLayerDef {
    /** Local id. */
    id: string;
    /** Stacking order; default 500. */
    order?: number;
    /** Draws the layer into its container, which spans the track. */
    mount: FoliumMount<FoliumProgressContext>;
}

/**
 * Mod CSS, injected inside `@layer folium-mods` and removed with the mod. The
 * stable targets are the host's public parts: `[data-folium-part="progress.track"]` etc.
 * (see mods/README.md for the list). Anything else in the host DOM is not API.
 */
export interface FoliumStyleDef {
    /** Local id. */
    id: string;
    /** The stylesheet. */
    css: string;
}

/** What `register` returns. */
export interface FoliumRegistryHandle {
    /** Full namespaced id (`modid:name`). */
    readonly id: FoliumId;
    /** Removes the entry now (the host also removes it when the mod stops). */
    unregister(): void;
}

/** What `settingsSections.register` returns: the handle plus the section's values. */
export interface FoliumSettingsSectionHandle extends FoliumRegistryHandle {
    /** The section's values (defaults merged) and write access. */
    readonly params: FoliumParamAccess;
}

/** Every registry has this one method. */
export interface FoliumRegistry<Def, Handle extends FoliumRegistryHandle = FoliumRegistryHandle> {
    /** Adds an entry; throws on an invalid definition or a duplicate id. */
    register(def: Def): Handle;
}

/**
 * All registries, as `folium.registries`. UI-only ones (commands, stageLayers, playerPanelTabs,
 * controlButtons, progressLayers, styles) accept registrations and do nothing in the export window.
 */
export interface FoliumRegistries {
    /** Lyric animation modes. */
    visualizers: FoliumRegistry<FoliumVisualizerDef>;
    /** Tuning knobs for builtin modes. */
    tunings: FoliumRegistry<FoliumTuningDef>;
    /** Commands. */
    commands: FoliumRegistry<FoliumCommandDef>;
    /** Background types. */
    backgrounds: FoliumRegistry<FoliumBackgroundDef>;
    /** Player page layers (`ui.stage`). */
    stageLayers: FoliumRegistry<FoliumStageLayerDef>;
    /** The mod's own settings. */
    settingsSections: FoliumRegistry<FoliumSettingsSectionDef, FoliumSettingsSectionHandle>;
    /** Player panel tabs. */
    playerPanelTabs: FoliumRegistry<FoliumPlayerPanelTabDef>;
    /** Progress bar buttons. */
    controlButtons: FoliumRegistry<FoliumControlButtonDef>;
    /** Layers over the progress track. */
    progressLayers: FoliumRegistry<FoliumProgressLayerDef>;
    /** Mod CSS for public parts. */
    styles: FoliumRegistry<FoliumStyleDef>;
}

// ---------------------------------------------------------------- Events

/** Handler order for one event type; handlers of the same priority run in registration order. */
export type FoliumEventPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

/** Read-only notifications, emitted after the fact. */
export interface FoliumNotificationEvents {
    /** The displayed song changed. */
    'playback.songChanged': { readonly song: FoliumSong | null };
    /** Playing, paused or stopped. */
    'playback.stateChanged': { readonly state: FoliumPlaybackState };
    /** The user or a mod seeked; `position` in seconds. */
    'playback.seeked': { readonly position: number };
    /** Lyrics for the displayed song are ready (after `lyrics.transform`). */
    'lyrics.loaded': { readonly song: FoliumSong | null; readonly lines: readonly FoliumLine[] };
    /** The app switched views (e.g. `home`, `player`). */
    'app.viewChanged': { readonly view: string };
    /** The lyric animation mode changed. */
    'visualizer.modeChanged': { readonly mode: string };
    /** The theme or daylight mode changed. */
    'theme.changed': { readonly theme: FoliumTheme };
    /** Folium 1.3: `playback.getState().liked` changed (a like or unlike, or a new song). */
    'playback.likeChanged': { readonly liked: boolean };
}

/**
 * Synchronous hook: runs when new lyrics reach the player, before they are
 * shown. Assign `lines` to rewrite them; lines left untouched (same object)
 * keep all their host-side data, new or changed ones are built from the DTO.
 *
 * Always runs on untransformed lyrics, never on its own output: when the host
 * rebuilds lyrics already on screen (e.g. a word-segmentation update) it
 * starts again from the untransformed version, so handlers need not be
 * idempotent.
 */
export interface FoliumLyricsTransformEvent {
    /** The song the lyrics belong to. */
    readonly song: FoliumSong | null;
    /** Assign a new array to rewrite the lyrics. */
    lines: readonly FoliumLine[];
}

/**
 * Async hook: runs before a song starts. Handlers may cancel it or play
 * another song instead. Not run for the track an automix blend advances to:
 * the blend starts that track seconds early on a fixed schedule and cannot
 * wait for handlers.
 */
export interface FoliumBeforePlayEvent {
    /** The song about to play. */
    readonly song: FoliumSong;
    /** A handler already cancelled. */
    readonly cancelled: boolean;
    /** Stops the song from playing; later handlers are skipped. */
    cancel(): void;
    /** Plays this song instead; it must carry a `ref` from the host. */
    replaceWith(song: FoliumSong): void;
}

/**
 * EXPERIMENTAL (manifest `experimental: ["omni.hooks"]`): Omni answered with
 * lyrics for an online song. Same line rules as `lyrics.transform`.
 */
export interface FoliumOmniLyricsEvent {
    /** The online song. */
    readonly song: FoliumSong;
    /** Assign a new array to rewrite the lyrics. */
    lines: readonly FoliumLine[];
    /** Omni reported the song as instrumental. */
    readonly isPureMusic: boolean;
}

/** EXPERIMENTAL (`omni.hooks`): Omni resolved an audio URL; assign `url` to use another one. */
export interface FoliumOmniAudioEvent {
    /** The online song. */
    readonly song: FoliumSong;
    /** Assign another https URL to play that instead. */
    url: string | null;
}

/** Hooks: every handler receives the same event object, in priority order, and may change it. */
export interface FoliumHookEvents {
    /** Rewrite lyrics before they are shown (sync). */
    'lyrics.transform': FoliumLyricsTransformEvent;
    /** Cancel or replace a song before it plays (async, 1.5 s per handler). */
    'playback.beforePlay': FoliumBeforePlayEvent;
    /** Rewrite lyrics Omni fetched (experimental, `omni.hooks`). */
    'omni.lyricsResolved': FoliumOmniLyricsEvent;
    /** Replace the audio URL Omni resolved (experimental, `omni.hooks`). */
    'omni.audioSourceResolved': FoliumOmniAudioEvent;
}

/** Every event type and its payload. */
export type FoliumEventMap = FoliumNotificationEvents & FoliumHookEvents;

/** The event bus, as `folium.events`. */
export interface FoliumEvents {
    /**
     * Adds a handler; returns its disposer. Each handler runs in its own error boundary; a sync handler over
     * 16 ms logs a warning.
     */
    on<K extends keyof FoliumEventMap>(
        type: K,
        handler: (event: FoliumEventMap[K]) => void | Promise<void>,
        options?: { priority?: FoliumEventPriority },
    ): FoliumDisposer;
}

// ---------------------------------------------------------------- Services

/**
 * `folium.playback`. `getState` is always available; every other method needs the `playback.control`
 * permission. All of it is unavailable in the export window.
 */
export interface FoliumPlaybackService {
    /**
     * The displayed song, player state, position and duration (seconds).
     * Folium 1.3: `liked` (the displayed song is liked; false with no song) and
     * `canLike` (toggleLike would act now; the host's own like button greys out otherwise).
     */
    getState(): {
        song: FoliumSong | null;
        state: FoliumPlaybackState;
        position: number;
        duration: number;
        liked: boolean;
        canLike: boolean;
    };
    /** Resumes playback. Needs `playback.control`. */
    play(): void;
    /** Pauses. Needs `playback.control`. */
    pause(): void;
    /** Play/pause. Needs `playback.control`. */
    toggle(): void;
    /** Seeks to a playback position (audio time), seconds. Needs `playback.control`. */
    seek(seconds: number): void;
    /**
     * Folium 1.3: seeks to a point on the lyric clock, e.g. `line.startTime`,
     * the way clicking a lyric line does in builtin modes. The host converts
     * lyric time to playback time (lyric offsets, lyrics-only stage sources);
     * `seek(line.startTime)` would land off by the offset. Ignored while the
     * host has now-playing controls disabled. Needs `playback.control`.
     */
    seekToLyricTime(lyricSeconds: number): void;
    /** Next track. Needs `playback.control`. */
    next(): void;
    /** Previous track. Needs `playback.control`. */
    previous(): void;
    /** Plays a song by its host `ref`. Resolves false when the ref is unknown. Needs `playback.control`. */
    playSong(song: FoliumSong): Promise<boolean>;
    /** Appends a song (by `ref`) to the queue. Needs `playback.control`. */
    enqueue(song: FoliumSong): boolean;
    /**
     * Folium 1.3: shuffles the play queue, keeping the current song first.
     * False when there is nothing to shuffle (Personal FM, a queue of one,
     * external Stage playback). Needs `playback.control`.
     */
    shuffleQueue(): boolean;
    /**
     * Folium 1.3: likes or unlikes the displayed song, like the host's like
     * button, which also reports the result. False when `canLike` is false.
     * Needs `playback.control`.
     */
    toggleLike(): boolean;
}

/** A local file the user picked for this mod. */
export interface FoliumFileHandle {
    /** folia-mod:// URL usable as a media/img src for this session. */
    url: string;
    /** File name. */
    name: string;
    /** Size in bytes. */
    size: number;
    /**
     * Folium 1.1: opaque id of a persisted grant (pickFile with `persist`, or
     * restoreFile). Store it to get the file back after a restart.
     */
    grantId?: string;
}

/** Folium 1.2: options for `folium.ui.icon`. */
export interface FoliumIconOptions {
    /** Width and height in px. Default 24. */
    size?: number;
    /** Stroke width in the icon's 24-unit grid. Default 2. */
    strokeWidth?: number;
    /** Any CSS color. Default `currentColor`, so the icon follows the surrounding text. */
    color?: string;
}

/** `folium.ui`. Unavailable in the export window, except `icon`. */
export interface FoliumUiService {
    /** Shows a status message. */
    toast(message: string, options?: { type?: 'info' | 'success' | 'error'; durationMs?: number }): void;
    /** Opens the player panel, optionally on one of this mod's panel tabs (local id). */
    openPlayerPanel(tabId?: string): void;
    /** Switches to the home or player view. */
    navigate(view: 'home' | 'player'): void;
    /** Folium 1.3: opens the host volume panel (the command palette's volume command). */
    openVolume(): void;
    /**
     * Lets the user pick a local file; null when cancelled. With `persist`
     * (Folium 1.1) the pick is remembered for this mod and the handle carries
     * a `grantId` for restoreFile.
     */
    pickFile(options?: { accept?: 'video' | 'audio' | 'image' | 'any'; persist?: boolean }): Promise<FoliumFileHandle | null>;
    /**
     * Folium 1.1: a file this mod picked with `persist`, as a fresh session
     * handle. Null when the grant is unknown to this mod or the file is gone.
     */
    restoreFile(grantId: string): Promise<FoliumFileHandle | null>;
    /** Folium 1.1: forgets a persisted grant. URLs already handed out keep working this session. */
    releaseFile(grantId: string): Promise<void>;
    /**
     * Embeds an external page in `container` as a sandboxed iframe. The URL's
     * origin must be listed in the manifest `embedOrigins` (needs `net.embed`).
     */
    embed(container: HTMLElement, url: string, options?: { title?: string; allow?: string[] }): FoliumDisposer;
    /**
     * Folium 1.2: one of the host's icons (lucide, named as on lucide.dev, e.g.
     * "play", "skip-forward") as a new <svg> element the mod owns; null for an
     * unknown name. Works in every context, the export window included.
     */
    icon(name: string, options?: FoliumIconOptions): Promise<SVGSVGElement | null>;
}

/** Request options for `folium.net.fetch`. */
export interface FoliumFetchInit {
    /** Default `GET`. */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
    /** Request headers. */
    headers?: Record<string, string>;
    /** Request body (text). */
    body?: string;
    /** Default 15000, at most 60000. */
    timeoutMs?: number;
}

/** A fully read response (body at most 5 MB); `text` and `json` return synchronously. */
export interface FoliumFetchResponse {
    /** Status is 2xx. */
    readonly ok: boolean;
    /** HTTP status. */
    readonly status: number;
    /** HTTP status text. */
    readonly statusText: string;
    /** Response headers, lowercase names. */
    readonly headers: Readonly<Record<string, string>>;
    /** The body as text. */
    text(): string;
    /** The body parsed as JSON; throws on invalid JSON. */
    json<T = unknown>(): T;
}

/** `folium.net`. */
export interface FoliumNetService {
    /** Fetch through the host (no CORS limits); needs the `net.fetch` permission. */
    fetch(url: string, init?: FoliumFetchInit): Promise<FoliumFetchResponse>;
}

// ---------------------------------------------------------------- Experimental

/** EXPERIMENTAL (`omni.providers`): a song as a mod provider describes it. */
export interface FoliumProviderSong {
    /** Song id within this provider. */
    id: string;
    /** Song title. */
    title: string;
    /** Artist names. */
    artists: string[];
    /** Album name. */
    album?: string;
    /** Cover image URL. */
    coverUrl?: string;
    /** Duration in milliseconds. */
    durationMs?: number;
}

/** Audio quality levels an Omni provider may be asked for. */
export type FoliumAudioQuality = 'standard' | 'high' | 'lossless' | 'hires';

/**
 * EXPERIMENTAL (`omni.providers`): an online music source. The host adapts it
 * to its provider contract; songs from it play, queue and show lyrics like any
 * online song. Use folium.net.fetch for network access.
 */
export interface FoliumOmniProviderDef {
    /** Local provider id. */
    id: string;
    /** Full name: the second line of the source's row in the home provider switcher. */
    displayName: string;
    /**
     * Short name: the switcher row, the search overlay's source chip and the home placeholder title; its
     * first character is the avatar badge. Defaults to `displayName`.
     */
    shortName?: string;
    /** Search songs; `page` is offset-based. */
    search?(query: string, page: { limit: number; offset: number }): Promise<{ items: FoliumProviderSong[]; hasMore: boolean; total?: number }>;
    /** One song by id. */
    getSong?(id: string): Promise<FoliumProviderSong | null>;
    /** A playable URL for the song at a quality. */
    getAudioUrl?(song: FoliumProviderSong, quality: FoliumAudioQuality): Promise<{ url: string; expiresAt?: number } | null>;
    /**
     * Lyrics for a song, as raw text the host parses (FoliumLyricsResult, Folium 1.4), or the deprecated
     * Folium 1.3 plain-LRC shape. Null when there are none.
     */
    getLyrics?(song: FoliumProviderSong): Promise<FoliumLyricsResult | FoliumLegacyLyricsResult | null>;
}

// ---------------------------------------------------------------- Shared helpers

/** One word from `folium.lyrics.segmentWords`. */
export interface FoliumWordSegment {
    /** The segment text. */
    segment: string;
    /** UTF-16 offset of the segment in the line's `fullText`. */
    index: number;
    /** False for whitespace and punctuation-only segments. */
    isWordLike: boolean;
}

/** A keyword-colored span of a line's `fullText` (UTF-16 offsets, end exclusive). */
export interface FoliumWordColorRange {
    /** Start offset in `fullText` (UTF-16). */
    startOffset: number;
    /** End offset, exclusive. */
    endOffset: number;
    /** CSS color from `wordColors`. */
    color: string;
    /** Longer and more specific matches rank higher. */
    priority: number;
}

/**
 * Folium 1.3: the pure lyric helpers builtin modes share, so a mod lays out,
 * times and colors lines exactly as they do. Available in both contexts.
 */
export interface FoliumLyricsHelpers {
    /** When the host stops showing the line: `renderHints.renderEndTime`. -Infinity for null. */
    getLineRenderEndTime(line: FoliumLine | null | undefined): number;
    /** The user's saved split when valid, otherwise Intl.Segmenter word segmentation. */
    segmentWords(line: Pick<FoliumLine, 'fullText' | 'wordSegments'>): FoliumWordSegment[];
    /** With no active line (index -1): the last line already over, for subtitles in gaps. */
    getRecentCompletedLine(lines: readonly FoliumLine[], lineIndex: number, time: number): FoliumLine | null;
    /** The next line: after the active one, or the first still ahead when none is active. */
    getUpcomingLine(lines: readonly FoliumLine[], lineIndex: number, time: number): FoliumLine | null;
    /** Up to `count` (default 2) lines after the active one; empty when none is active. */
    getUpcomingLines(lines: readonly FoliumLine[], lineIndex: number, count?: number): FoliumLine[];
    /** Non-overlapping keyword color spans of `fullText` for `theme.wordColors`. */
    buildWordColorRanges(fullText: string, wordColors: FoliumTheme['wordColors']): FoliumWordColorRange[];
    /** The keyword color of one word, or `fallbackColor`. */
    resolveWordColor(
        wordText: string,
        wordColors: FoliumTheme['wordColors'],
        fallbackColor: string,
        options?: { cjkMatchMode?: 'target-contains-token' | 'bidirectional-contains' | 'exact' },
    ): string;
    /**
     * Folium 1.4: parses a lyric document with the host's local lyric file pipeline, off the main thread.
     * Rejects with a TypeError (`invalid-lyrics-track`) when the track is malformed.
     */
    parse(track: FoliumLyricsTrack): Promise<FoliumParsedLyrics>;
}

/** Folium 1.3: theme resolution builtin modes use. Available in both contexts. */
export interface FoliumThemeHelpers {
    /** CSS font-family value for lyric text. */
    resolveFontStack(theme: Pick<FoliumTheme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>): string;
    /** CSS font-family value for translations and subtitles. */
    resolveTranslationFontStack(theme: Pick<FoliumTheme, 'fontStyle' | 'fontFamily' | 'fontFamilyStack'>): string;
    /** The theme's weight, normalized, or `fallback`. */
    resolveFontWeight(theme: Pick<FoliumTheme, 'fontWeight'> | null | undefined, fallback: number): number;
}

// ---------------------------------------------------------------- Client API

/** Where a client runs: the main window, or the transparent video export window. */
export type FoliumContextKind = 'main' | 'export';

/** The host, for runtime feature detection (`folium.host`). */
export interface FoliumHostInfo {
    /** The Folium version (`major`, `minor`). */
    folium: { major: number; minor: number };
    /** Folia app version, or null when the host cannot tell. */
    folia: string | null;
}

/**
 * `folium.storage`: this mod's data file (shared with its main entry, 1 MB). Needs the `filesystem.data`
 * permission; values must be JSON-serializable.
 */
export interface FoliumStorage {
    /** The stored value, or undefined. */
    get<T = unknown>(key: string): Promise<T | undefined>;
    /** Stores a JSON-serializable value. */
    set(key: string, value: unknown): Promise<void>;
    /** Whether the key exists. */
    has(key: string): Promise<boolean>;
    /** Removes the key. */
    delete(key: string): Promise<void>;
    /** All keys. */
    keys(): Promise<string[]>;
}

/** `folium.rpc`: calls into this mod's main entry. */
export interface FoliumRpc {
    /**
     * Calls the function the main entry registered with `api.rpc.handle(name, fn)`; arguments and result must
     * be JSON-serializable.
     */
    call<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
}

/** `folium.log`. `error` entries show in the mods panel under the mod. */
export interface FoliumLogger {
    /** Informational log. */
    info(message: string, details?: unknown): void;
    /** Warning. */
    warn(message: string, details?: unknown): void;
    /** Error; shown in the mods panel. */
    error(message: string, details?: unknown): void;
}

/** The object a client entry's `activate(folium)` receives. */
export interface FoliumClientApi {
    /** This mod's id. */
    readonly modId: string;
    /** Host versions, for feature detection. */
    readonly host: FoliumHostInfo;
    /** Where this client runs. */
    readonly env: { readonly context: FoliumContextKind };
    /** Logging. */
    readonly log: FoliumLogger;
    /** Everything a mod can add to the host. */
    readonly registries: FoliumRegistries;
    /** The event bus. */
    readonly events: FoliumEvents;
    /** Playback state and control. */
    readonly playback: FoliumPlaybackService;
    /** Toasts, panels, files, embeds, icons. */
    readonly ui: FoliumUiService;
    /** Network access through the host. */
    readonly net: FoliumNetService;
    /** This mod's data file. */
    readonly storage: FoliumStorage;
    /** Calls into this mod's main entry. */
    readonly rpc: FoliumRpc;
    /** Folium 1.3. */
    readonly lyrics: FoliumLyricsHelpers;
    /** Folium 1.3. */
    readonly theme: FoliumThemeHelpers;
    /** Unfrozen surfaces; each requires the matching manifest `experimental` opt-in. */
    readonly experimental: Readonly<Record<string, unknown>>;
    /**
     * Host internals with no compatibility promise. Only available when the
     * manifest pins host versions with `"folia"`; otherwise accessing it throws.
     */
    readonly internals: Readonly<Record<string, unknown>>;
}

/** The shape of a client entry module. */
export interface FoliumClientModule {
    /** `activate(folium)`; may return a disposer, which runs before the host removes the mod's registrations. */
    default: (folium: FoliumClientApi) => void | FoliumDisposer | Promise<void | FoliumDisposer>;
}
