import { useTranslation } from 'react-i18next';
import { getSubtitleOverlayRows, SUBTITLE_OVERLAY_FOLLOW_ROWS, SUBTITLE_OVERLAY_SINGLE_ROWS, subtitleOverlayPreviewsUpcoming, withSubtitleOverlayRow, withSubtitleOverlayRowCount, withSubtitleOverlayUpcomingPreview, type SubtitleOverlayRowCount } from '../../utils/lyrics/subtitleOverlayLayout';
import type { SubtitleOverlayRowSource } from '../../types';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/SubtitleRowsSettings.tsx
// The visual settings window and shortcut edit the same row layout through the upstream helpers.
export default function SubtitleRowsSettings() {
    const { t } = useTranslation('localPlayer');
    const layout = useVisualSettings(state => state.subtitleLayout);
    const update = useVisualSettings(state => state.update);
    const rows = getSubtitleOverlayRows(layout);
    return <>
        <label className="local-setting"><span>{t('subtitleRows')}</span><select data-testid="local-subtitle-rows" value={rows.length}
            onChange={event => update({ subtitleLayout: withSubtitleOverlayRowCount(layout, Number(event.target.value) as SubtitleOverlayRowCount) })}>
            {[1, 2, 3].map(count => <option key={count} value={count}>{t('subtitleRowCount', { count })}</option>)}
        </select></label>
        {rows.map((source, index) => <label className="local-setting" key={index}><span>{t('subtitleRow', { count: index + 1 })}</span>
            <select aria-label={t('subtitleRow', { count: index + 1 })} value={source}
                onChange={event => update({ subtitleLayout: withSubtitleOverlayRow(layout, index, event.target.value as SubtitleOverlayRowSource) })}>
                {(index === 0 ? SUBTITLE_OVERLAY_SINGLE_ROWS : SUBTITLE_OVERLAY_FOLLOW_ROWS)
                    .map(value => <option key={value} value={value}>{t(`subtitleSource_${value}`)}</option>)}
            </select></label>)}
        <label className="local-setting local-toggle-setting"><span>{t('subtitleUpcomingPreview')}</span>
            <input type="checkbox" data-testid="local-subtitle-upcoming-preview" checked={subtitleOverlayPreviewsUpcoming(layout)}
                onChange={event => update({ subtitleLayout: withSubtitleOverlayUpcomingPreview(layout, event.target.checked) })} />
        </label>
    </>;
}
