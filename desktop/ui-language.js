'use strict';

// Native menus and dialogs share the renderer's persisted language without rereading disk per label.
const UI_LANGUAGE_KEY = 'mineradio-ui-language-v1';
const ENGLISH = Object.freeze({
  '显示 Mineradio': 'Show Mineradio',
  '关闭按钮最小化到托盘': 'Close button minimizes to tray',
  '最小化时显示迷你播放器': 'Show mini player when minimized',
  '迷你播放器样式': 'Mini player style',
  '标准（带封面）': 'Standard (with artwork)',
  '极简（无封面）': 'Compact (without artwork)',
  '开机自动启动': 'Start with Windows',
  '退出 Mineradio': 'Quit Mineradio',
  '导出 Mineradio 备份': 'Export Mineradio backup',
  '导入 Mineradio 备份': 'Import Mineradio backup',
  'Mineradio 备份': 'Mineradio backup',
  '所有文件': 'All files',
  '导出 Mineradio 存档': 'Export Mineradio settings',
  '导入 Mineradio 存档': 'Import Mineradio settings',
  '导入 Mineradio 插件': 'Import Mineradio plugin',
  'Mineradio 插件': 'Mineradio plugin',
  '选择本地音乐文件夹': 'Choose a local music folder',
  '导入 Wallpaper Engine 项目': 'Import Wallpaper Engine project',
  '导入此目录': 'Import this folder',
  '选择 project.json、场景包 (.pkg/.pak) 或视频/图片': 'Choose project.json, a scene package (.pkg/.pak), video or image',
  '导入到壁纸索引': 'Import into wallpaper library',
  'Wallpaper Engine 项目 / 视频 / 图片': 'Wallpaper Engine projects / videos / images',
  '视频': 'Videos',
  '图片': 'Images',
});

function normalizeDesktopUiLanguage(value) {
  return value === 'en' || value === 'en-US' ? 'en' : 'zh-CN';
}

function createDesktopUiLanguage({ readValues, onChange = () => {} }) {
  let language;
  return {
    text(source) {
      if (language === undefined) {
        try { language = normalizeDesktopUiLanguage(readValues()?.[UI_LANGUAGE_KEY]); }
        catch { language = 'zh-CN'; }
      }
      return language === 'en' ? ENGLISH[source] ?? source : source;
    },
    apply(values) {
      const next = normalizeDesktopUiLanguage(values?.[UI_LANGUAGE_KEY]);
      if (language === next) return false;
      language = next;
      onChange();
      return true;
    },
  };
}

module.exports = { UI_LANGUAGE_KEY, createDesktopUiLanguage, normalizeDesktopUiLanguage };
