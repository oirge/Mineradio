import { useTranslation } from 'react-i18next';
import { VISUALIZER_REGISTRY, getVisualizerModeLabel } from '../../components/visualizer/registry';
import { getSubtitleOverlayRows, withSubtitleOverlayRow, withSubtitleOverlayRowCount, type SubtitleOverlayRowCount } from '../../utils/lyrics/subtitleOverlayLayout';
import type { SubtitleOverlayRowSource } from '../../types';
import { useVisualSettings } from './useVisualSettings';

export default function LocalVisualOptions({ label }: { label: (key: string) => string }) {
    const settings = useVisualSettings();
    const { i18n } = useTranslation();
    const en = i18n.resolvedLanguage === 'en';
    const text = (zh: string, english: string) => en ? english : zh;
    const rows = getSubtitleOverlayRows(settings.subtitleLayout);
    const names = { current: text('当前歌词', 'Current line'), next: text('下一句', 'Next line'), translation: text('翻译', 'Translation'), romanization: text('音译', 'Romanization') };
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
        <label className="local-setting"><span>{text('底部字幕布局', 'Bottom subtitle rows')}</span><select data-testid="local-subtitle-rows" value={rows.length} onChange={e => settings.update({ subtitleLayout: withSubtitleOverlayRowCount(settings.subtitleLayout, Number(e.target.value) as SubtitleOverlayRowCount) })}>
            <option value="1">{text('单行', 'One row')}</option><option value="2">{text('双行', 'Two rows')}</option><option value="3">{text('三行', 'Three rows')}</option>
        </select></label>
        {rows.map((source, index) => <label className="local-setting" key={index}><span>{text(`第 ${index + 1} 行`, `Row ${index + 1}`)}</span><select aria-label={text(`字幕第 ${index + 1} 行`, `Subtitle row ${index + 1}`)} value={source} disabled={rows.length > 1 && index === 0} onChange={e => settings.update({ subtitleLayout: withSubtitleOverlayRow(settings.subtitleLayout, index, e.target.value as SubtitleOverlayRowSource) })}>
            {(rows.length === 1 ? ['current', 'translation', 'romanization'] : index === 0 ? ['current'] : ['next', 'translation', 'romanization']).map(value => <option key={value} value={value}>{names[value as SubtitleOverlayRowSource]}</option>)}
        </select></label>)}
        <label className="local-setting local-toggle-setting"><span>{text('和声字幕（含海报墙）', 'Harmony subtitles (including poster wall)')}</span><input data-testid="local-harmony" type="checkbox" checked={settings.harmony} onChange={e => settings.update({ harmony: e.target.checked })} /></label>
    </>;
}
