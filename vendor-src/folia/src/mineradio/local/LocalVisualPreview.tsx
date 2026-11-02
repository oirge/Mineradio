import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import VisualizerRenderer from '../../components/visualizer/VisualizerRenderer';
import { getVisualizerBackgroundRegistryEntry } from '../../components/visualizer/backgrounds/registry';
import type { AudioBands, Line, Theme } from '../../types';
import { useVisualSceneSettings } from './useVisualSettings';
import type { LocalVisualAssets } from './useLocalVisualAssets';
import LocalErrorBoundary from './LocalErrorBoundary';
import './localVisualOptions.css';

const lines: Line[] = ['让音乐照亮此刻', '烟花在夜空中盛开', '雨滴轻轻落在窗上', '街角传来熟悉的旋律'].map((text, index) => ({
    id: `preview-${index}`, startTime: index * 6, endTime: index * 6 + 5.8, fullText: text,
    translation: ['Let music light up this moment', 'Fireworks bloom in the night', 'Raindrops softly touch the window', 'A familiar melody fills the street'][index],
    words: [...text].map((char, word) => ({ text: char, startTime: index * 6 + word * 0.5, endTime: index * 6 + word * 0.5 + 0.5 })),
}));

export default memo(function LocalVisualPreview({ theme, assets }: { theme: Theme; assets: LocalVisualAssets }) {
    const settings = useVisualSceneSettings();
    const { i18n } = useTranslation();
    const en = i18n.resolvedLanguage === 'en';
    const [surface, setSurface] = useState<'lyrics' | 'background'>('lyrics');
    const [active, setActive] = useState(false);
    const [scale, setScale] = useState(0.4);
    const [lineIndex, setLineIndex] = useState(0);
    const host = useRef<HTMLDivElement>(null);
    const time = useMemo(() => motionValue(0), []);
    const power = useMemo(() => motionValue(30), []);
    const bands = useMemo<AudioBands>(() => ({ bass: motionValue(30), lowMid: motionValue(30), mid: motionValue(30), vocal: motionValue(30), treble: motionValue(30), spectrum: motionValue(new Uint8Array(512)) }), []);
    useEffect(() => {
        const element = host.current;
        if (!element) return;
        let visible = false;
        const sync = () => setActive(visible && !document.hidden);
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
        const resize = new ResizeObserver(entries => setScale(entries[0].contentRect.width / 960));
        observer.observe(element); resize.observe(element);
        document.addEventListener('visibilitychange', sync);
        return () => { observer.disconnect(); resize.disconnect(); document.removeEventListener('visibilitychange', sync); };
    }, []);
    useEffect(() => {
        if (!active) return;
        let raf = 0, previous = -1, start = performance.now() - time.get() * 1000;
        const frame = (now: number) => {
            const seconds = ((now - start) / 1000) % 24;
            time.set(seconds);
            const next = Math.floor(seconds / 6);
            if (next !== previous) { previous = next; setLineIndex(next); }
            power.set(30 + Math.sin(seconds * 3) * 15);
            for (const band of [bands.bass, bands.lowMid, bands.mid, bands.vocal, bands.treble]) band.set(power.get());
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, [active, time, power, bands]);
    const background = { ...settings.background, customImage: assets.background.images[0] ?? null };
    return <section className="local-live-preview" aria-label={en ? 'Live preview' : '实时预览'}>
        <div className="local-preview-tabs"><button type="button" aria-pressed={surface === 'lyrics'} onClick={() => setSurface('lyrics')}>{en ? 'Lyric preview' : '歌词预览'}</button><button type="button" aria-pressed={surface === 'background'} onClick={() => setSurface('background')}>{en ? 'Background preview' : '背景预览'}</button></div>
        <div className="local-preview-viewport" ref={host} data-testid="local-live-preview" data-surface={surface}>
            <div className="local-preview-stage" style={{ transform: `scale(${scale})` }}>
                <LocalErrorBoundary surface={`preview:${surface}:${settings.mode}`}><Suspense fallback={null}>
                    {active && (surface === 'lyrics' ? <VisualizerRenderer key={settings.mode} mode={settings.mode} theme={theme} isDaylight={settings.daylight}
                        currentTime={time} currentLineIndex={lineIndex} lines={lines} audioBands={bands} audioPower={power} isPreviewMode
                        seed="local-preview" songTitle="实时预览" songArtist="Mineradio" background={background} lyricsFontScale={settings.lyricsFontScale}
                        visualizerTunings={settings.tunings} subtitleOverlayLayout={settings.subtitleLayout} hideTranslationSubtitle={!settings.translation}
                        cappellaCustomEmojiImages={assets.emoji.images} cappellaCustomAvatarImages={assets.avatar.images} monetPortraitImage={assets.portrait.images[0] ?? null} />
                        : getVisualizerBackgroundRegistryEntry(background.mode || 'latent').render({ config: background, theme, isDaylight: settings.daylight, audioBands: bands, audioPower: power, staticMode: false, paused: false, seed: 'background-preview' }))}
                </Suspense></LocalErrorBoundary>
            </div>
        </div>
    </section>;
});
