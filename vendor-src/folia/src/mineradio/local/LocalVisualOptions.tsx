import { useTranslation } from 'react-i18next';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from '../../components/visualizer/registry';
import { useVisualSettings } from './useVisualSettings';
import SubtitleRowsSettings from './SubtitleRowsSettings';

export default function LocalVisualOptions({ label }: { label: (key: string) => string }) {
    const settings = useVisualSettings();
    const { i18n } = useTranslation();
    const en = i18n.resolvedLanguage === 'en';
    const text = (zh: string, english: string) => en ? english : zh;
    return <>
        <label className="local-setting local-toggle-setting"><span>{text('每首歌随机歌词样式', 'Random style per song')}</span><input data-testid="local-random-mode" type="checkbox" checked={settings.randomMode} onChange={e => settings.update({ randomMode: e.target.checked })} /></label>
        <details className="local-tuning"><summary>{text('自选随机池', 'Random style pool')} · {settings.randomPool.length}</summary>
            <div className="local-random-pool">{VISUALIZER_REGISTRY.map(entry => <label key={entry.mode}>
                <input type="checkbox" data-mode={entry.mode} checked={settings.randomPool.includes(entry.mode)}
                    disabled={settings.randomPool.length === 1 && settings.randomPool[0] === entry.mode}
                    onChange={event => settings.toggleRandomPool(entry.mode, event.target.checked)} />{getVisualizerModeLabel(entry.mode, label)}
            </label>)}</div>
            <small>{text('至少保留一种；两种以上时不会连续重复。', 'Keep at least one style. Two or more styles never repeat consecutively.')}</small>
        </details>
        <button type="button" className="local-reroll" data-testid="local-reroll" onClick={settings.reroll}>{text('重新抽取歌词样式', 'Reroll lyric style')}</button>
        <SubtitleRowsSettings />
        <label className="local-setting local-toggle-setting"><span>{text('和声字幕（含海报墙）', 'Harmony subtitles (including poster wall)')}</span><input data-testid="local-harmony" type="checkbox" checked={settings.harmony} onChange={e => settings.update({ harmony: e.target.checked })} /></label>
    </>;
}
