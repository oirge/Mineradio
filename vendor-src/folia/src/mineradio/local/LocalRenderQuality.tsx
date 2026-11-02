import { useTranslation } from 'react-i18next';
import type { LyricAntialias, LyricRenderOverride, LyricRenderScale } from '../../types';
import { DEFAULT_LYRIC_RENDER_OVERRIDE, LYRIC_RENDER_SCALES, formatLyricRenderScale } from '../../utils/lyricRenderQuality';
import LyricRenderQualityRows from '../../components/visualizer/renderQuality/LyricRenderQualityRows';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/LocalRenderQuality.tsx
// Shared quality controls for the embedded player and the original Canvas effect panels.
export default function LocalRenderQuality() {
    const { t } = useTranslation();
    const { lyricRenderQuality, update } = useVisualSettings();
    return <div data-testid="local-render-quality">
        <label className="local-setting"><span>{t('options.lyricRenderScale')}</span>
            <select data-testid="local-global-render-scale" aria-label={t('options.lyricRenderScale')} value={lyricRenderQuality.scale}
                onChange={event => update({ lyricRenderQuality: { ...lyricRenderQuality, scale: Number(event.target.value) as LyricRenderScale } })}>
                {LYRIC_RENDER_SCALES.map(scale => <option key={scale} value={scale}>{formatLyricRenderScale(scale)}</option>)}
            </select>
        </label>
        <label className="local-setting"><span>{t('options.lyricAntialias')}</span>
            <select data-testid="local-global-antialias" aria-label={t('options.lyricAntialias')} value={lyricRenderQuality.antialias}
                onChange={event => update({ lyricRenderQuality: { ...lyricRenderQuality, antialias: event.target.value as LyricAntialias } })}>
                {(['auto', 'on', 'off'] as const).map(mode => <option key={mode} value={mode}>{t(`options.lyricAntialias${mode === 'auto' ? 'Auto' : mode === 'on' ? 'On' : 'Off'}`)}</option>)}
            </select>
        </label>
    </div>;
}

// DOM lyric styles use browser text rendering; these modes own a Canvas backing surface.
const LOCAL_CANVAS_MODES: Record<string, boolean> = {
    diorama: true, fume: false, monet: false, pendolo: false, sonnet: true, tempera: true, lumiere: true,
};
export function LocalStyleRenderQuality() {
    const { mode, tunings, tune } = useVisualSettings();
    if (!(mode in LOCAL_CANVAS_MODES)) return null;
    const tuning = tunings[mode as keyof typeof tunings] as { render?: LyricRenderOverride };
    const render = tuning?.render ?? DEFAULT_LYRIC_RENDER_OVERRIDE;
    return <div data-testid="local-style-render-quality"><LyricRenderQualityRows value={render} antialias={LOCAL_CANVAS_MODES[mode]}
        onChange={patch => tune(mode as keyof typeof tunings, { render: { ...render, ...patch } })} /></div>;
}
