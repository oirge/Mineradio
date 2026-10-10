import { Suspense } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LATENT_BACKGROUND_TUNING, DEFAULT_SORA_BACKGROUND_TUNING, DEFAULT_MONET_BACKGROUND_TUNING, DEFAULT_NOMAND_BACKGROUND_TUNING, type Theme, type VisualizerBackgroundMode, type VisualizerMode } from '../../types';
import { VISUALIZER_REGISTRY, getVisualizerRegistryEntry, getVisualizerModeLabel } from '../../components/visualizer/registry';
import { VISUALIZER_BACKGROUND_REGISTRY, getVisualizerBackgroundModeLabel, getVisualizerBackgroundRegistryEntry } from '../../components/visualizer/backgrounds/registry';
import type { VisualizerSettingsPanelProps } from '../../components/visualizer/definition';
import type { VisualizerTuningMode } from '../../components/visualizer/tuningRegistry';
import { colorWithAlpha } from '../../components/visualizer/colorMix';
import { useVisualSettings } from './useVisualSettings';
import type { LocalVisualAssets } from './useLocalVisualAssets';

// src/mineradio/local/VisualSettings.tsx
// Visual-only controls reuse Folia's registry and tuning panels without its global Settings application.
export default function VisualSettings({ theme, onClose, assets }: { theme: Theme; onClose: () => void; assets: LocalVisualAssets }) {
    const { t } = useTranslation('localPlayer');
    const { t: translate } = useTranslation();
    const settings = useVisualSettings();
    const label = (key: string) => String(translate(key));
    const modeEntry = getVisualizerRegistryEntry(settings.mode);
    const mode = settings.mode as VisualizerTuningMode;
    const modeTitle = mode.charAt(0).toUpperCase() + mode.slice(1);
    const panelProps = {
        t: label, isDaylight: settings.daylight, theme,
        controlCardBg: colorWithAlpha(theme.primaryColor, 0.035), rangeInputClass: 'local-setting-range',
        [`${mode}Tuning`]: settings.tunings[mode],
        [`on${modeTitle}TuningChange`]: (patch: Record<string, unknown>) => settings.tune(mode, patch),
        cappellaCustomEmojiImages: assets.emoji.images,
        cappellaCustomEmojiCount: assets.emoji.images.length,
        hasCappellaCustomEmojiPack: assets.emoji.images.length > 0,
        isCappellaCustomEmojiPackLoading: assets.emoji.loading,
        onImportCappellaCustomEmojiPack: assets.emoji.upload, onClearCappellaCustomEmojiPack: assets.emoji.clear,
        cappellaCustomAvatarImages: assets.avatar.images,
        hasCappellaCustomAvatar: assets.avatar.images.length > 0, isCappellaCustomAvatarLoading: assets.avatar.loading,
        onImportCappellaCustomAvatar: assets.avatar.upload, onClearCappellaCustomAvatar: assets.avatar.clear,
        monetPortraitImage: assets.portrait.images[0] ?? null,
        isLoadingMonetPortraitImage: assets.portrait.loading,
        onUploadMonetPortraitImage: assets.portrait.upload, onClearMonetPortraitImage: assets.portrait.clear,
    } as VisualizerSettingsPanelProps;
    const backgroundEntry = getVisualizerBackgroundRegistryEntry(settings.background.mode || 'latent');
    const patchBackground = (key: string, patch: Record<string, unknown>) => {
        const current = settings.background as Record<string, any>;
        settings.update({ background: { ...current, [key]: { ...current[key], ...patch } } });
    };
    return <aside className="local-settings local-glass" data-testid="local-visual-settings">
        <div className="local-panel-title"><strong>{t('visuals')}</strong><div><button aria-label={t('reset')} title={t('reset')} onClick={settings.reset}><RotateCcw size={16} /></button><button aria-label={t('close')} onClick={onClose}><X size={18} /></button></div></div>
        <div className="local-settings-body">
            <label className="local-setting"><span>{t('lyricMode')}</span><select aria-label={t('lyricMode')} data-testid="local-visualizer-mode" value={settings.mode} onChange={(event) => settings.update({ mode: event.target.value as VisualizerMode })}>
                {VISUALIZER_REGISTRY.filter((entry) => !entry.mode.startsWith('mod:')).map((entry) => <option key={entry.mode} value={entry.mode}>{getVisualizerModeLabel(entry.mode, label)}</option>)}
            </select></label>
            <label className="local-setting"><span>{t('background')}</span><select aria-label={t('background')} data-testid="local-background-mode" value={settings.background.mode || 'latent'} onChange={(event) => settings.update({ background: { ...settings.background, mode: event.target.value as VisualizerBackgroundMode } })}>
                {VISUALIZER_BACKGROUND_REGISTRY.filter((entry) => entry.mode !== 'url' && !entry.mode.startsWith('mod:')).map((entry) => <option key={entry.mode} value={entry.mode}>{getVisualizerBackgroundModeLabel(entry.mode, label)}</option>)}
            </select></label>
            <label className="local-setting"><span>{t('theme')}</span><select aria-label={t('theme')} data-testid="local-theme" value={settings.daylight ? 'light' : 'dark'} onChange={(event) => settings.update({ daylight: event.target.value === 'light' })}><option value="dark">{t('dark')}</option><option value="light">{t('light')}</option></select></label>
            <label className="local-setting local-range-setting"><span>{t('lyricSize')}<output>{Math.round(settings.lyricsFontScale * 100)}%</output></span><input aria-label={t('lyricSize')} type="range" min="0.6" max="1.6" step="0.05" value={settings.lyricsFontScale} onChange={(event) => settings.update({ lyricsFontScale: Number(event.target.value) })} /></label>
            <label className="local-setting local-toggle-setting"><span>{t('translation')}</span><input type="checkbox" checked={settings.translation} onChange={(event) => settings.update({ translation: event.target.checked })} /></label>
            {modeEntry.renderSettingsPanel && <details className="local-tuning" data-testid="local-effect-tuning" key={settings.mode}><summary>{t('tuning')} · {getVisualizerModeLabel(settings.mode, label)}</summary><Suspense fallback={null}>{modeEntry.renderSettingsPanel(panelProps)}</Suspense></details>}
            {backgroundEntry.renderSettingsPanel && <details className="local-tuning" data-testid="local-background-tuning" key={backgroundEntry.mode}><summary>{t('background')} · {getVisualizerBackgroundModeLabel(backgroundEntry.mode, label)}</summary>
                <Suspense fallback={null}>{backgroundEntry.renderSettingsPanel?.({
                    t: label, theme, isDaylight: settings.daylight, config: { ...settings.background, customImage: assets.background.images[0] ?? null },
                    controlCardBg: colorWithAlpha(theme.primaryColor, 0.035), rangeInputClass: 'local-setting-range',
                    actions: {
                        customImage: { onUpload: assets.background.upload, onClear: assets.background.clear, isLoading: assets.background.loading },
                        common: {
                            onCoverColorChange: (useCoverColorBg) => patchBackground('common', { useCoverColorBg }),
                            onOpacityChange: (opacity) => patchBackground('common', { opacity }),
                            onDisableGeometricChange: (disableGeometricBackground) => patchBackground('common', { disableGeometricBackground }),
                            onDisableVignetteChange: (disableVignette) => patchBackground('common', { disableVignette }),
                        },
                        latent: { onTuningChange: (patch) => patchBackground('latent', { tuning: { ...DEFAULT_LATENT_BACKGROUND_TUNING, ...settings.background.latent?.tuning, ...patch } }) },
                        sora: { onTuningChange: (patch) => patchBackground('sora', { tuning: { ...DEFAULT_SORA_BACKGROUND_TUNING, ...settings.background.sora?.tuning, ...patch } }) },
                        monet: { onTuningChange: (patch) => patchBackground('monet', { tuning: { ...DEFAULT_MONET_BACKGROUND_TUNING, ...settings.background.monet?.tuning, ...patch } }) },
                        nomand: { onTuningChange: (patch) => patchBackground('nomand', { tuning: { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...settings.background.nomand?.tuning, ...patch } }) },
                    },
                })}</Suspense>
            </details>}
        </div>
    </aside>;
}
