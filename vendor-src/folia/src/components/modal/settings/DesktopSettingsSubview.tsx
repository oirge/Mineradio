import React from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import {
    AlertCircle,
    AppWindow,
    Check,
    Cpu,
    Download,
    ExternalLink,
    Loader2,
    Monitor,
    RefreshCw,
    ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import { CustomSelect } from '../../shared/CustomSelect';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';
import AiConnectionTest from './AiConnectionTest';
import SettingsRow, { SettingsToggle } from './SettingsRow';
import { settingsDividerClassFor } from './settingsCardClasses';
import { usePlayerChromeSettingsStore } from '../../../stores/usePlayerChromeSettingsStore';

// src/components/modal/settings/DesktopSettingsSubview.tsx
// Desktop-only window, tray, update, and AI settings separated from the global settings modal.

const AUR_PACKAGE_URL = 'https://aur.archlinux.org/packages/folia-major-bin';

type ElectronSettingsState = {
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    OPENAI_API_URL: string;
    OPENAI_API_MODEL: string;
    OPENAI_API_TEMPERATURE: string;
    OPENAI_API_STREAM: boolean;
    AI_PROVIDER: string;
    USE_SYSTEM_PROXY_FOR_AI: boolean;
    ENABLE_UPDATE_CHECK: boolean;
    ENABLE_AUTO_UPDATE: boolean;
    UPDATE_CHANNEL: 'realeco' | 'limo' | 'cielo' | 'internal';
    STAGE_MODE_SOURCE: string;
    DISCORD_RICH_PRESENCE_ENABLED: boolean;
};

export type DesktopSettingsChrome = {
    isDaylight: boolean;
    isElectron: boolean;
    settingsCardClass: string;
    successTextColor: string;
    theme?: Theme;
    toggleOffBackgroundClass: string;
};

export type DesktopSettingsPreferences = {
    hideTaskbarIcon: boolean;
    hideRemoteControlTaskbarIcon: boolean;
    hideRemoteControlTitlebar: boolean;
    remoteControlClickThrough: boolean;
    minimizeToTray: boolean;
    closeToTray: boolean;
    onToggleHideTaskbarIcon: (enabled: boolean) => void;
    onToggleHideRemoteControlTaskbarIcon: (enabled: boolean) => void;
    onToggleHideRemoteControlTitlebar: (enabled: boolean) => void;
    onToggleRemoteControlClickThrough: (enabled: boolean) => void;
    onToggleMinimizeToTray: (enabled: boolean) => void;
    onToggleCloseToTray: (enabled: boolean) => void;
    onToggleOpenPlayerOnLaunch: (enabled: boolean) => void;
    openPlayerOnLaunch: boolean;
    wallpaperMode: boolean;
    onToggleWallpaperMode: (enabled: boolean) => void;
    wallpaperMacAutohideDock: boolean;
    onToggleWallpaperMacAutohideDock: (enabled: boolean) => void;
};

export type DesktopSettingsModel = {
    canDownloadUpdate: boolean;
    canEnableAutoUpdate: boolean;
    electronSaveStatus: 'idle' | 'saving' | 'saved';
    electronSettings: ElectronSettingsState;
    onCheckForUpdates: () => Promise<void> | void;
    onDownloadUpdate: () => Promise<void> | void;
    onInstallUpdate: () => Promise<void> | void;
    onOpenBaiduDownload: () => Promise<void> | void;
    onOpenChinaDownload: () => Promise<void> | void;
    onUpdateChannelChange: (channel: 'realeco' | 'limo' | 'cielo') => Promise<void> | void;
    onSaveElectronSettings: () => Promise<void> | void;
    onToggleAutoUpdate: () => Promise<void> | void;
    onToggleUpdateCheck: () => Promise<void> | void;
    setElectronSettings: React.Dispatch<React.SetStateAction<ElectronSettingsState>>;
    updateBadgeIcon: React.ReactNode;
    updateBadgeLabel: string;
    updateStatus: ElectronUpdateStatus | null;
};

type DesktopSettingsSubviewProps = {
    chrome: DesktopSettingsChrome;
    model: DesktopSettingsModel;
    preferences: DesktopSettingsPreferences;
};

const DesktopSettingsSubview: React.FC<DesktopSettingsSubviewProps> = ({
    chrome,
    model,
    preferences,
}) => {
    const {
        isDaylight,
        isElectron,
        settingsCardClass,
        successTextColor,
        theme,
        toggleOffBackgroundClass,
    } = chrome;
    const {
        hideTaskbarIcon,
        hideRemoteControlTaskbarIcon,
        hideRemoteControlTitlebar,
        remoteControlClickThrough,
        minimizeToTray,
        closeToTray,
        onToggleHideTaskbarIcon,
        onToggleHideRemoteControlTaskbarIcon,
        onToggleHideRemoteControlTitlebar,
        onToggleRemoteControlClickThrough,
        onToggleMinimizeToTray,
        onToggleCloseToTray,
        onToggleOpenPlayerOnLaunch,
        openPlayerOnLaunch,
        wallpaperMode,
        onToggleWallpaperMode,
        wallpaperMacAutohideDock,
        onToggleWallpaperMacAutohideDock,
    } = preferences;
    const isLinux = isElectron && window.electron?.platform === 'linux';
    const isWindows = isElectron && window.electron?.platform === 'win32';
    const isMac = isElectron && window.electron?.platform === 'darwin';
    const {
        canDownloadUpdate,
        canEnableAutoUpdate,
        electronSaveStatus,
        electronSettings,
        onCheckForUpdates,
        onDownloadUpdate,
        onInstallUpdate,
        onOpenBaiduDownload,
        onOpenChinaDownload,
        onUpdateChannelChange,
        onSaveElectronSettings,
        onToggleAutoUpdate,
        onToggleUpdateCheck,
        setElectronSettings,
        updateBadgeIcon,
        updateBadgeLabel,
        updateStatus,
    } = model;
    const { t } = useTranslation();
    const {
        hideFullscreenButton,
        handleToggleHideFullscreenButton,
    } = usePlayerChromeSettingsStore(useShallow(state => ({
        hideFullscreenButton: state.hideFullscreenButton,
        handleToggleHideFullscreenButton: state.handleToggleHideFullscreenButton,
    })));

    if (!isElectron) {
        return null;
    }

    // Tailwind 的 dark: 跟随系统配色而不是 isDaylight，这一页的明暗样式全部按 isDaylight 取。
    const rowDividerClass = settingsDividerClassFor(isDaylight);
    const ghostButtonClass = isDaylight
        ? 'border-black/10 bg-black/[0.025] hover:bg-black/[0.055]'
        : 'border-white/10 bg-white/5 hover:bg-white/10';
    const linkButtonHoverClass = isDaylight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/10';
    const fieldClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
        isDaylight
            ? 'border-black/10 bg-black/[0.04] focus:border-black/25'
            : 'border-white/10 bg-black/10 focus:border-white/25'
    }`;
    const noticeTextClass = isDaylight ? 'text-amber-600' : 'text-amber-400';

    const renderToggle = (checked: boolean, onChange: () => void, disabled?: boolean) => (
        <SettingsToggle
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            offClass={toggleOffBackgroundClass}
            onColor={theme?.secondaryColor}
        />
    );

    const renderRow = (title: React.ReactNode, description: React.ReactNode, control: React.ReactNode, isLast = false) => (
        <SettingsRow title={title} description={description} control={control} dividerClass={rowDividerClass} isLast={isLast} />
    );

    const renderField = (label: React.ReactNode, input: React.ReactNode, hint?: React.ReactNode) => (
        <label className="block space-y-1 text-left">
            <span className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>
                {label}
            </span>
            {input}
            {hint && (
                <span className="block text-[10px] opacity-45 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {hint}
                </span>
            )}
        </label>
    );

    const renderProviderOption = (provider: 'gemini' | 'openai', label: React.ReactNode) => {
        const selected = provider === 'openai'
            ? electronSettings.AI_PROVIDER === 'openai'
            : electronSettings.AI_PROVIDER !== 'openai';
        return (
            <button
                type="button"
                onClick={() => setElectronSettings({ ...electronSettings, AI_PROVIDER: provider })}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    selected
                        ? (isDaylight ? 'bg-white shadow-sm' : 'bg-white/10 shadow-sm')
                        : 'opacity-50 hover:opacity-100'
                }`}
                style={{ color: 'var(--text-primary)' }}
            >
                {label}
            </button>
        );
    };

    return (
        <>
            <SettingsAnchor anchorId="desktopTrayBehavior" label={t('options.desktopTrayBehavior')} className="space-y-4">
                <SettingsSectionHeading icon={Monitor} label={t('options.desktopTrayBehavior')} />
                <div className={`rounded-xl border ${settingsCardClass} overflow-hidden`}>
                    {renderRow(
                        t('options.minimizeToTray'),
                        '点击最小化时，应用将隐藏至系统托盘。',
                        renderToggle(minimizeToTray, () => onToggleMinimizeToTray(!minimizeToTray)),
                    )}
                    {renderRow(
                        t('options.closeToTray'),
                        t('options.closeToTrayDesc'),
                        renderToggle(closeToTray, () => onToggleCloseToTray(!closeToTray)),
                    )}
                    {renderRow(
                        t('options.openPlayerOnLaunch'),
                        t('options.openPlayerOnLaunchDesc'),
                        renderToggle(openPlayerOnLaunch, () => onToggleOpenPlayerOnLaunch(!openPlayerOnLaunch)),
                    )}
                    {renderRow(
                        t('options.hideTaskbarIcon'),
                        '即使主窗口处于打开状态，也不在系统任务栏显示应用，最大程度减少干扰。',
                        renderToggle(hideTaskbarIcon, () => onToggleHideTaskbarIcon(!hideTaskbarIcon)),
                    )}
                    {renderRow(
                        t('options.hideRemoteControlTaskbarIcon'),
                        t('options.hideRemoteControlTaskbarIconDesc'),
                        renderToggle(hideRemoteControlTaskbarIcon, () => onToggleHideRemoteControlTaskbarIcon(!hideRemoteControlTaskbarIcon)),
                    )}
                    {renderRow(
                        t('options.hideRemoteControlTitlebar'),
                        t('options.hideRemoteControlTitlebarDesc'),
                        renderToggle(hideRemoteControlTitlebar, () => onToggleHideRemoteControlTitlebar(!hideRemoteControlTitlebar)),
                    )}
                    {renderRow(
                        t('options.remoteControlClickThrough'),
                        t('options.remoteControlClickThroughDesc'),
                        renderToggle(remoteControlClickThrough, () => onToggleRemoteControlClickThrough(!remoteControlClickThrough)),
                    )}
                    {renderRow(
                        t('options.hideFullscreenButton'),
                        t('options.hideFullscreenButtonDesc'),
                        <SettingsToggle
                            checked={hideFullscreenButton}
                            onChange={() => handleToggleHideFullscreenButton(!hideFullscreenButton)}
                            offClass={toggleOffBackgroundClass}
                            onColor={theme?.secondaryColor}
                            ariaLabel={t('options.hideFullscreenButton')}
                        />,
                        true,
                    )}
                </div>

                <div className="px-1 text-[10px] opacity-45 leading-relaxed text-left" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.desktopTrayBehaviorDesc')}
                </div>

                {hideTaskbarIcon && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
                            isDaylight
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-800'
                                : 'bg-amber-500/8 border-amber-500/15 text-amber-200'
                        }`}
                    >
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <div className="space-y-0.5 text-left">
                            <span className="font-semibold">重要提示：</span>
                            <span>隐藏任务栏图标后，应用只会在系统托盘显示。如需找回主窗口，请双击或右键点击托盘中的 Folia 图标。建议同时配合启用“最小化到托盘”。</span>
                        </div>
                    </motion.div>
                )}
            </SettingsAnchor>

            {(isLinux || isWindows || isMac) && (
                <SettingsAnchor anchorId="wallpaperMode" label={t('options.wallpaperMode') || 'Wallpaper Mode'} className="space-y-4">
                    <SettingsSectionHeading icon={AppWindow} label={t('options.wallpaperMode') || 'Wallpaper Mode'} />
                    <div className={`rounded-xl border ${settingsCardClass} overflow-hidden`}>
                        {renderRow(
                            t('options.wallpaperMode'),
                            t('options.wallpaperModeDesc') || 'Sink the app window to the bottom of the desktop and keep it always visible as a lyrics wallpaper.',
                            renderToggle(wallpaperMode, () => onToggleWallpaperMode(!wallpaperMode)),
                            !isMac,
                        )}
                        {isMac && renderRow(
                            t('options.wallpaperMacAutohideDock'),
                            t('options.wallpaperMacAutohideDockDesc'),
                            renderToggle(wallpaperMacAutohideDock, () => onToggleWallpaperMacAutohideDock(!wallpaperMacAutohideDock)),
                            true,
                        )}
                    </div>
                    {isMac && (
                        <div className="px-1 text-xs leading-relaxed text-left text-amber-500">
                            {t('options.wallpaperModeMacPermissionHint') || 'Mac wallpaper mode needs Input Monitoring: enable Folia in System Settings → Privacy & Security → Input Monitoring, then restart the app.'}
                        </div>
                    )}
                </SettingsAnchor>
            )}

            <SettingsAnchor anchorId="updateCheck" label={t('options.updateCheck') || 'Update Check'} className="space-y-4">
                <SettingsSectionHeading
                    icon={RefreshCw}
                    label={t('options.updateCheck') || 'Update Check'}
                    action={(
                        <button
                            type="button"
                            onClick={onCheckForUpdates}
                            disabled={!electronSettings.ENABLE_UPDATE_CHECK || !updateStatus?.updateCheckSupported || updateStatus?.status === 'checking'}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${ghostButtonClass}`}
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {updateBadgeIcon}
                            <span>{updateBadgeLabel}</span>
                        </button>
                    )}
                />

                <div className={`rounded-xl border ${settingsCardClass} overflow-hidden`}>
                    {renderRow(
                        t('options.enableUpdateCheck') || 'Enable Update Check',
                        t('options.enableUpdateCheckDesc') || 'Check GitHub releases through the system proxy when the desktop app starts.',
                        renderToggle(electronSettings.ENABLE_UPDATE_CHECK, onToggleUpdateCheck, !updateStatus?.updateCheckSupported),
                    )}
                    {renderRow(
                        t('options.updateChannel') || 'Update Channel',
                        t('options.updateChannelDesc') || 'Choose which release lane this desktop app follows.',
                        <div className="w-44 shrink-0">
                            <CustomSelect
                                value={electronSettings.UPDATE_CHANNEL}
                                onChange={(value) => void onUpdateChannelChange(value as 'realeco' | 'limo' | 'cielo')}
                                disabled={electronSettings.UPDATE_CHANNEL === 'internal'}
                                isDaylight={isDaylight}
                                theme={theme}
                                ariaLabel={t('options.updateChannel')}
                                options={electronSettings.UPDATE_CHANNEL === 'internal'
                                    ? [{ value: 'internal', label: t('options.updateChannelInternal') }]
                                    : [
                                        { value: 'realeco', label: t('options.updateChannelRealeco') },
                                        { value: 'limo', label: t('options.updateChannelLimo') },
                                        { value: 'cielo', label: t('options.updateChannelCielo') },
                                    ]}
                            />
                        </div>,
                    )}
                    {renderRow(
                        updateStatus?.autoUpdateSupported
                            ? t('options.enableAutoUpdate') || 'Enable Auto Update'
                            : t('options.autoUpdateUnavailable'),
                        updateStatus?.autoUpdateSupported
                            ? t('options.enableAutoUpdateDesc') || 'Automatically download updates after a new version is found.'
                            : t('options.manualUpdateOnlyDesc'),
                        renderToggle(
                            electronSettings.ENABLE_AUTO_UPDATE && Boolean(updateStatus?.autoUpdateSupported),
                            onToggleAutoUpdate,
                            !canEnableAutoUpdate,
                        ),
                        true,
                    )}
                </div>

                {updateStatus?.autoUpdateSupportReason === 'system' && (
                    <div className="px-1 text-xs leading-relaxed text-left text-amber-500">
                        {t('options.updateUnsupportedSystem') || 'Automatic updates are unavailable on the current system.'}
                    </div>
                )}

                {updateStatus?.updateCheckSupportReason === 'channel' && (
                    <div className="px-1 text-xs leading-relaxed text-left text-amber-500">
                        {t('options.updateUnsupportedChannel') || 'Automatic updates are unavailable for this internal build.'}
                    </div>
                )}

                <div className="text-[10px] opacity-45 px-1 leading-relaxed text-left" style={{ color: 'var(--text-secondary)' }}>
                    {updateStatus?.autoUpdateSupported
                        ? t('options.autoUpdateGithubNotice') || 'Auto update needs access to GitHub; if the network is unstable, keep a system proxy enabled.'
                        : t('options.updateCheckGithubNotice')}
                </div>

                {updateStatus?.availableVersion && (
                    <div className={`p-4 rounded-xl border ${settingsCardClass} space-y-3`}>
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-500 shrink-0" />
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {t('options.newVersionFound', { version: updateStatus.availableVersion })}
                            </span>
                        </div>

                        {/* 多平台 / 手动下载时的提示 */}
                        {updateStatus.platform === 'darwin' ? (
                            <div className={`text-xs text-left font-medium opacity-90 ${noticeTextClass}`}>
                                {t('options.macManualUpdateNotice')}
                            </div>
                        ) : updateStatus.platform === 'linux' ? (
                            <div className={`text-xs text-left font-medium opacity-90 ${noticeTextClass}`}>
                                {t('options.linuxManualUpdateNotice')}
                            </div>
                        ) : !updateStatus.autoUpdateSupported ? (
                            <div className={`text-xs text-left font-medium opacity-90 ${noticeTextClass}`}>
                                {t('options.manualUpdateNotice')}
                            </div>
                        ) : (
                            electronSettings.ENABLE_AUTO_UPDATE && updateStatus.status === 'downloading' && (
                                <div className="text-xs text-left opacity-60" style={{ color: 'var(--text-secondary)' }}>
                                    {t('options.autoUpdateGithubNotice')}
                                </div>
                            )
                        )}

                        {/* 下载进度条 */}
                        {updateStatus.autoUpdateSupported && updateStatus.status === 'downloading' && updateStatus.downloadProgress && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="opacity-60 text-left" style={{ color: 'var(--text-secondary)' }}>
                                        {t('options.downloadUpdate')}
                                    </span>
                                    <span className={`font-semibold ${isDaylight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                        {Math.round(updateStatus.downloadProgress.percent)}%
                                    </span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDaylight ? 'bg-black/10' : 'bg-white/10'}`}>
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300 ease-out"
                                        style={{ width: `${updateStatus.downloadProgress.percent}%` }}
                                    />
                                </div>
                                {updateStatus.downloadProgress.transferred !== undefined && updateStatus.downloadProgress.total !== undefined && (
                                    <div className="text-[10px] opacity-40 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                                        {(updateStatus.downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB / {(updateStatus.downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {updateStatus.autoUpdateSupported && !electronSettings.ENABLE_AUTO_UPDATE && (
                                <button
                                    type="button"
                                    onClick={onDownloadUpdate}
                                    disabled={!canDownloadUpdate}
                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${ghostButtonClass}`}
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <Download size={14} />
                                    {t('options.downloadUpdate') || 'Download Update'}
                                </button>
                            )}
                            {updateStatus.autoUpdateSupported && updateStatus.status === 'downloaded' && (
                                <button
                                    type="button"
                                    onClick={onInstallUpdate}
                                    className={`inline-flex items-center gap-1.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 px-3.5 py-2 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${successTextColor}`}
                                >
                                    <RefreshCw size={14} className="animate-spin-slow" />
                                    {t('options.restartToInstallUpdate') || 'Restart to Install'}
                                </button>
                            )}
                        </div>

                        {/* 备用下载入口收拢成可换行的小组，避免与更新主操作争抢视觉层级。 */}
                        <div
                            className={`flex max-w-full flex-wrap items-center gap-1 rounded-xl border p-1.5 ${isDaylight ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.035]'}`}
                            aria-label={t('options.downloadSources')}
                        >
                            <span className="px-1.5 text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                                {t('options.downloadSources')}
                            </span>
                            {electronSettings.UPDATE_CHANNEL === 'realeco' && updateStatus.platform !== 'linux' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={onOpenChinaDownload}
                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-70 transition-colors hover:opacity-100 ${linkButtonHoverClass}`}
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        <ExternalLink size={12} />
                                        {t('options.quarkDrive')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenBaiduDownload}
                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-70 transition-colors hover:opacity-100 ${linkButtonHoverClass}`}
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        <ExternalLink size={12} />
                                        {t('options.baiduDrive')}
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => window.electron?.openUpdateReleasePage(updateStatus.availableVersion)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-70 transition-colors hover:opacity-100 ${linkButtonHoverClass}`}
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <ExternalLink size={12} />
                                {updateStatus.autoUpdateSupported
                                    ? t('options.githubRelease')
                                    : t('options.fullInstallerGithub')}
                            </button>
                            {updateStatus.platform === 'linux' && electronSettings.UPDATE_CHANNEL === 'realeco' && (
                                <button
                                    type="button"
                                    onClick={() => window.electron?.openExternalUrl(AUR_PACKAGE_URL)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-70 transition-colors hover:opacity-100 ${linkButtonHoverClass}`}
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <ExternalLink size={12} />
                                    {t('options.aurPackage')}
                                </button>
                            )}
                        </div>

                        {updateStatus.platform !== 'linux' && (
                            <div className="text-xs opacity-50 pt-1 text-left" style={{ color: 'var(--text-secondary)' }}>
                                {t('options.chinaDownloadHint')}
                            </div>
                        )}
                    </div>
                )}
            </SettingsAnchor>

            <SettingsAnchor anchorId="electronSettings" label={t('options.electronSettings') || 'Desktop App Settings'} className="space-y-4">
                <SettingsSectionHeading icon={Cpu} label={t('options.electronSettings') || 'Desktop App Settings'} />

                <div className={`rounded-xl border ${settingsCardClass} overflow-hidden`}>
                    <div className={`flex flex-wrap items-center justify-between gap-4 p-4 border-b ${rowDividerClass}`}>
                        <div className="space-y-1 text-left min-w-0">
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {t('options.aiProvider') || 'AI Provider'}
                            </div>
                            <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                                选择生成智能歌词主题效果的 AI 服务商。
                            </div>
                        </div>

                        <div className={`flex rounded-xl border p-1 shrink-0 ${isDaylight ? 'bg-black/[0.05] border-black/10' : 'bg-white/5 border-white/5'}`}>
                            {renderProviderOption('gemini', 'Google Gemini')}
                            {renderProviderOption('openai', t('options.otherCompatibleApi'))}
                        </div>
                    </div>

                    <div className={`p-4 space-y-3 border-b ${rowDividerClass}`}>
                        {electronSettings.AI_PROVIDER !== 'openai' ? (
                            <>
                            {renderField(
                                t('options.geminiApiKey') || 'Gemini API Key',
                                <input
                                    type="password"
                                    value={electronSettings.GEMINI_API_KEY || ''}
                                    onChange={(e) => setElectronSettings({ ...electronSettings, GEMINI_API_KEY: e.target.value })}
                                    placeholder="AI Theme Generation Key"
                                    className={fieldClass}
                                    style={{ color: 'var(--text-primary)' }}
                                />,
                            )}
                            <AiConnectionTest
                                key="gemini"
                                payload={{
                                    provider: 'gemini',
                                    apiKey: electronSettings.GEMINI_API_KEY || '',
                                    useSystemProxy: electronSettings.USE_SYSTEM_PROXY_FOR_AI === true,
                                }}
                                buttonClassName={ghostButtonClass}
                                isDaylight={isDaylight}
                            />
                            </>
                        ) : (
                            <>
                                {renderField(
                                    t('options.openaiApiUrl') || 'OpenAI API URL',
                                    <input
                                        type="text"
                                        value={electronSettings.OPENAI_API_URL || ''}
                                        onChange={(e) => setElectronSettings({ ...electronSettings, OPENAI_API_URL: e.target.value })}
                                        placeholder="https://api.openai.com/v1 or https://api.deepseek.com"
                                        className={fieldClass}
                                        style={{ color: 'var(--text-primary)' }}
                                    />,
                                )}
                                {renderField(
                                    t('options.openaiApiModel') || 'OpenAI Model',
                                    <input
                                        type="text"
                                        value={electronSettings.OPENAI_API_MODEL || ''}
                                        onChange={(e) => setElectronSettings({ ...electronSettings, OPENAI_API_MODEL: e.target.value })}
                                        placeholder="gpt-5.6-luna / gpt-4.1-mini / deepseek-v4-flash"
                                        className={fieldClass}
                                        style={{ color: 'var(--text-primary)' }}
                                    />,
                                    t('options.openaiApiModelDesc') || 'Required for many OpenAI-compatible providers. DeepSeek models like deepseek-v4-flash must be filled explicitly if auto-detection does not apply.',
                                )}
                                {renderField(
                                    t('options.openaiApiTemperature') || 'Temperature',
                                    <input
                                        type="number"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={electronSettings.OPENAI_API_TEMPERATURE}
                                        onChange={(e) => setElectronSettings({ ...electronSettings, OPENAI_API_TEMPERATURE: e.target.value })}
                                        placeholder="0.7"
                                        className={fieldClass}
                                        style={{ color: 'var(--text-primary)' }}
                                    />,
                                    t('options.openaiApiTemperatureDesc') || 'Range: 0–2. Defaults to 0.7 when left blank.',
                                )}
                                <div className="flex items-center justify-between gap-4 text-left">
                                    <div className="space-y-1 min-w-0">
                                        <div className="text-xs opacity-60" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.openaiApiStream') || 'Streaming'}
                                        </div>
                                        <div className="text-[10px] opacity-45 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                            {t('options.openaiApiStreamDesc')}
                                        </div>
                                    </div>
                                    {renderToggle(
                                        electronSettings.OPENAI_API_STREAM === true,
                                        () => setElectronSettings({ ...electronSettings, OPENAI_API_STREAM: !electronSettings.OPENAI_API_STREAM }),
                                    )}
                                </div>
                                {renderField(
                                    t('options.openaiApiKey') || 'OpenAI API Key',
                                    <input
                                        type="password"
                                        value={electronSettings.OPENAI_API_KEY || ''}
                                        onChange={(e) => setElectronSettings({ ...electronSettings, OPENAI_API_KEY: e.target.value })}
                                        placeholder="sk-..."
                                        className={fieldClass}
                                        style={{ color: 'var(--text-primary)' }}
                                    />,
                                )}
                                <AiConnectionTest
                                    key="openai"
                                    payload={{
                                        provider: 'openai',
                                        apiKey: electronSettings.OPENAI_API_KEY || '',
                                        apiUrl: electronSettings.OPENAI_API_URL || '',
                                        model: electronSettings.OPENAI_API_MODEL || '',
                                        stream: electronSettings.OPENAI_API_STREAM === true,
                                        useSystemProxy: electronSettings.USE_SYSTEM_PROXY_FOR_AI === true,
                                    }}
                                    buttonClassName={ghostButtonClass}
                                    isDaylight={isDaylight}
                                />
                            </>
                        )}
                    </div>

                    {renderRow(
                        t('options.useSystemProxyAI') || 'Use System Proxy for AI',
                        t('options.useSystemProxyAIDesc') || 'Route strictly AI requests through system proxy.',
                        renderToggle(electronSettings.USE_SYSTEM_PROXY_FOR_AI, () => setElectronSettings({ ...electronSettings, USE_SYSTEM_PROXY_FOR_AI: !electronSettings.USE_SYSTEM_PROXY_FOR_AI })),
                    )}

                    <div className="flex items-center justify-between gap-4 p-4">
                        <span className="text-[10px] opacity-45 leading-relaxed max-w-[280px] text-left" style={{ color: 'var(--text-secondary)' }}>
                            {electronSettings.AI_PROVIDER !== 'openai'
                                ? (t('options.geminiApiKeyDesc') || 'Netease API backend runs locally.')
                                : t('options.openaiApiUrlDesc')}
                        </span>
                        <button
                            type="button"
                            onClick={onSaveElectronSettings}
                            disabled={electronSaveStatus === 'saving'}
                            className={`shrink-0 px-6 py-2 border active:scale-95 disabled:scale-100 disabled:opacity-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-w-[80px] ${ghostButtonClass}`}
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {electronSaveStatus === 'saved' ? (
                                <>
                                    <Check size={14} className={successTextColor} />
                                    <span className={successTextColor}>已保存</span>
                                </>
                            ) : electronSaveStatus === 'saving' ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>正在保存...</span>
                                </>
                            ) : (
                                <span>{t('options.save') || 'Save'}</span>
                            )}
                        </button>
                    </div>
                </div>
            </SettingsAnchor>
        </>
    );
};

export default DesktopSettingsSubview;
