'use strict';
// 安装包自带的两份声明式主题包（1.7.2 起）。内容与 examples/plugins/ 下同名文件逐字段一致，
// tests/plugin-system.test.js 钉住这一点，改了示例文件却忘了改这里会红。
// 首次启动由 plugin-runtime.js 的 seedBuiltinThemes() 走与用户导入完全相同的 parsePluginPackage()
// 通道装进插件列表：清洗规则、变量白名单、体积上限全都一视同仁，自带主题不享受任何特权。
// 自带主题默认不启用 —— 装上就换掉全体用户的外观不合适，界面默认仍是原本的金色玻璃。
(function(global){
  // 每一项就是一个完整的 .json 插件包，fileName 决定按声明式主题解析。
  var BUILTIN_THEMES = [
    {
      fileName: "theme-midnight-indigo.json",
      json:
      {
        "schema": "mineradio-plugin-v1",
        "id": "mineradio.theme.midnight-indigo",
        "name": "午夜靛蓝",
        "kind": "theme",
        "version": "1.4.0",
        "author": "Mineradio",
        "theme": {
          "vars": {
            "--panel-glass-shadow": "0 24px 78px rgba(2,4,14,.46),0 0 0 1px rgba(190,205,255,.055),inset 0 1px 0 rgba(255,255,255,.17),inset 0 -18px 42px rgba(2,4,14,.20)",
            "--saved-panel-glass-bg": "rgba(13,19,46,.58)",
            "--saved-panel-glass-shadow": "inset 0 0 2px 1px rgba(188,204,255,.30),inset 0 0 12px 4px rgba(112,144,255,.10),0 12px 34px rgba(2,4,14,.42)",
            "--saved-button-glass-bg": "rgba(17,25,56,.58)",
            "--saved-button-glass-hover-bg": "rgba(108,140,255,.13)",
            "--saved-button-glass-shadow": "inset 0 0 2px 1px rgba(188,204,255,.28),inset 0 0 10px 4px rgba(112,144,255,.10),0 10px 30px rgba(2,4,14,.34)",
            "--saved-button-glass-hover-shadow": "inset 0 0 2px 1px rgba(200,214,255,.40),inset 0 0 12px 5px rgba(112,144,255,.15),0 12px 34px rgba(2,4,14,.40),0 0 18px rgba(108,140,255,.10)",
            "--champagne": "#C3D2FF",
            "--source-local": "#8FA8CF",
            "--th-panel-bg": "linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(16,22,52,.88) 44%,rgba(5,7,18,.86))",
            "--th-panel-border": "rgba(188,204,255,.10)",
            "--th-panel-shadow": "0 24px 78px rgba(5,7,18,.52),0 0 0 1px rgba(188,204,255,.06),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -18px 42px rgba(5,7,18,.22)",
            "--th-side-panel-bg": "linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(16,22,52,.88) 44%,rgba(5,7,18,.86))",
            "--th-side-panel-border": "rgba(188,204,255,.11)",
            "--th-side-panel-shadow": "0 24px 80px rgba(5,7,18,.50),inset 0 1px 0 rgba(188,204,255,.10)",
            "--th-popover-bg": "rgba(8,11,26,.965)",
            "--th-popover-border": "rgba(188,204,255,.16)",
            "--th-popover-shadow": "0 28px 84px rgba(5,7,18,.80),0 0 0 1px rgba(5,7,18,.52),inset 0 1px 0 rgba(188,204,255,.12)",
            "--th-subpanel-bg": "rgba(8,11,26,.56)",
            "--th-subpanel-border": "rgba(188,204,255,.10)",
            "--th-row-bg": "rgba(20,27,62,.72)",
            "--th-row-border": "rgba(188,204,255,.11)",
            "--th-row-shadow": "inset 0 1px 0 rgba(188,204,255,.08)",
            "--th-row-hover-bg": "rgba(32,44,96,.86)",
            "--th-row-hover-border": "rgba(188,204,255,.20)",
            "--th-row-active-bg": "rgba(24,36,92,.90)",
            "--th-chip-bg": "rgba(30,40,88,.62)",
            "--th-chip-border": "rgba(188,204,255,.14)",
            "--th-chip-hover-bg": "rgba(108,140,255,.20)",
            "--th-chip-hover-border": "rgba(108,140,255,.30)",
            "--th-bar-bg": "rgba(16,22,52,.30)",
            "--th-bar-shadow": "inset 0 0 2px 1px rgba(188,204,255,.34),inset 0 0 11px 4px rgba(108,140,255,.14),0 12px 34px rgba(5,7,18,.30),inset 0 -14px 40px rgba(5,7,18,.16)",
            "--th-search-bg": "rgba(16,22,52,.56)",
            "--th-hairline": "rgba(188,204,255,.12)",
            "--th-text-strong": "rgba(214,224,255,.94)",
            "--th-text-dim": "rgba(190,202,240,.72)",
            "--th-hairline-soft": "rgba(188,204,255,.05)",
            "--th-mini-bg": "linear-gradient(120deg,rgba(16,22,52,.97),rgba(5,7,18,.98))",
            "--th-mini-border": "rgba(188,204,255,.14)",
            "--th-mini-shadow": "0 14px 38px rgba(5,7,18,.52),inset 0 1px 0 rgba(188,204,255,.12)",
            "--th-mini-cover-bg": "rgba(20,27,62,.92)",
            "--th-mini-cover-border": "rgba(188,204,255,.14)",
            "--th-mini-cover-text": "rgba(108,140,255,.92)",
            "--th-mini-title": "rgba(214,224,255,.96)",
            "--th-mini-artist": "rgba(190,202,240,.58)",
            "--th-mini-btn-bg": "rgba(30,40,88,.82)",
            "--th-mini-btn-border": "rgba(188,204,255,.13)",
            "--th-mini-btn-text": "rgba(214,224,255,.80)",
            "--th-mini-btn-hover-bg": "rgba(108,140,255,.22)",
            "--th-mini-btn-hover-border": "rgba(108,140,255,.42)",
            "--th-mini-btn-hover-text": "rgba(188,204,255,.98)",
            "--th-mini-play-bg": "rgba(108,140,255,.20)",
            "--th-mini-play-border": "rgba(108,140,255,.38)",
            "--th-mini-play-text": "rgba(188,204,255,.96)",
            "--th-mini-ghost-text": "rgba(190,202,240,.56)"
          },
          "css": "#search-box,#search-results,.search-mode-tabs,#fx-panel,#playlist-panel,#toast,.modal,.track-detail-modal,.cover-color-pop,.color-lab-pop,.visual-guide-card,.volume-popover,.quality-popover,.mini-queue-popover,.home-hero,.home-card,.home-tile,.home-mosaic-cell,.pl-inline-detail{background:linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(16,22,52,.88) 44%,rgba(5,7,18,.86))!important}\n#search-box,#search-results,.search-mode-tabs{background:rgba(16,22,52,.56)!important}\n.search-empty{color:rgba(206,214,240,.52)}"
        }
      }
    },
    {
      fileName: "theme-warm-amber.json",
      json:
      {
        "schema": "mineradio-plugin-v1",
        "id": "mineradio.theme.warm-amber",
        "name": "暖琥珀",
        "kind": "theme",
        "version": "1.4.0",
        "author": "Mineradio",
        "theme": {
          "vars": {
            "--panel-glass-shadow": "0 24px 78px rgba(14,8,2,.46),0 0 0 1px rgba(255,226,180,.060),inset 0 1px 0 rgba(255,255,255,.17),inset 0 -18px 42px rgba(14,8,2,.20)",
            "--saved-panel-glass-bg": "rgba(44,26,10,.58)",
            "--saved-panel-glass-shadow": "inset 0 0 2px 1px rgba(255,226,180,.30),inset 0 0 12px 4px rgba(244,185,97,.11),0 12px 34px rgba(14,8,2,.42)",
            "--saved-button-glass-bg": "rgba(52,32,13,.58)",
            "--saved-button-glass-hover-bg": "rgba(244,185,97,.13)",
            "--saved-button-glass-shadow": "inset 0 0 2px 1px rgba(255,226,180,.28),inset 0 0 10px 4px rgba(244,185,97,.10),0 10px 30px rgba(14,8,2,.34)",
            "--saved-button-glass-hover-shadow": "inset 0 0 2px 1px rgba(255,232,196,.40),inset 0 0 12px 5px rgba(244,185,97,.16),0 12px 34px rgba(14,8,2,.40),0 0 18px rgba(244,185,97,.11)",
            "--champagne": "#F4B961",
            "--source-local": "#CFAE8F",
            "--th-panel-bg": "linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(46,30,14,.88) 44%,rgba(16,10,4,.86))",
            "--th-panel-border": "rgba(255,226,180,.10)",
            "--th-panel-shadow": "0 24px 78px rgba(16,10,4,.52),0 0 0 1px rgba(255,226,180,.06),inset 0 1px 0 rgba(255,255,255,.15),inset 0 -18px 42px rgba(16,10,4,.22)",
            "--th-side-panel-bg": "linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(46,30,14,.88) 44%,rgba(16,10,4,.86))",
            "--th-side-panel-border": "rgba(255,226,180,.11)",
            "--th-side-panel-shadow": "0 24px 80px rgba(16,10,4,.50),inset 0 1px 0 rgba(255,226,180,.10)",
            "--th-popover-bg": "rgba(20,12,5,.965)",
            "--th-popover-border": "rgba(255,226,180,.16)",
            "--th-popover-shadow": "0 28px 84px rgba(16,10,4,.80),0 0 0 1px rgba(16,10,4,.52),inset 0 1px 0 rgba(255,226,180,.12)",
            "--th-subpanel-bg": "rgba(20,12,5,.56)",
            "--th-subpanel-border": "rgba(255,226,180,.10)",
            "--th-row-bg": "rgba(52,34,15,.72)",
            "--th-row-border": "rgba(255,226,180,.11)",
            "--th-row-shadow": "inset 0 1px 0 rgba(255,226,180,.08)",
            "--th-row-hover-bg": "rgba(74,49,20,.86)",
            "--th-row-hover-border": "rgba(255,226,180,.20)",
            "--th-row-active-bg": "rgba(64,42,16,.90)",
            "--th-chip-bg": "rgba(60,39,17,.62)",
            "--th-chip-border": "rgba(255,226,180,.14)",
            "--th-chip-hover-bg": "rgba(244,185,97,.20)",
            "--th-chip-hover-border": "rgba(244,185,97,.30)",
            "--th-bar-bg": "rgba(46,30,14,.30)",
            "--th-bar-shadow": "inset 0 0 2px 1px rgba(255,226,180,.34),inset 0 0 11px 4px rgba(244,185,97,.14),0 12px 34px rgba(16,10,4,.30),inset 0 -14px 40px rgba(16,10,4,.16)",
            "--th-search-bg": "rgba(46,30,14,.56)",
            "--th-hairline": "rgba(255,226,180,.12)",
            "--th-text-strong": "rgba(255,236,210,.94)",
            "--th-text-dim": "rgba(240,218,186,.72)",
            "--th-hairline-soft": "rgba(255,226,180,.05)",
            "--th-mini-bg": "linear-gradient(120deg,rgba(46,30,14,.97),rgba(16,10,4,.98))",
            "--th-mini-border": "rgba(255,226,180,.14)",
            "--th-mini-shadow": "0 14px 38px rgba(16,10,4,.52),inset 0 1px 0 rgba(255,226,180,.12)",
            "--th-mini-cover-bg": "rgba(52,34,15,.92)",
            "--th-mini-cover-border": "rgba(255,226,180,.14)",
            "--th-mini-cover-text": "rgba(244,185,97,.92)",
            "--th-mini-title": "rgba(255,236,210,.96)",
            "--th-mini-artist": "rgba(240,218,186,.58)",
            "--th-mini-btn-bg": "rgba(60,39,17,.82)",
            "--th-mini-btn-border": "rgba(255,226,180,.13)",
            "--th-mini-btn-text": "rgba(255,236,210,.80)",
            "--th-mini-btn-hover-bg": "rgba(244,185,97,.22)",
            "--th-mini-btn-hover-border": "rgba(244,185,97,.42)",
            "--th-mini-btn-hover-text": "rgba(255,226,180,.98)",
            "--th-mini-play-bg": "rgba(244,185,97,.20)",
            "--th-mini-play-border": "rgba(244,185,97,.38)",
            "--th-mini-play-text": "rgba(255,226,180,.96)",
            "--th-mini-ghost-text": "rgba(240,218,186,.56)"
          },
          "css": "#search-box,#search-results,.search-mode-tabs,#fx-panel,#playlist-panel,#toast,.modal,.track-detail-modal,.cover-color-pop,.color-lab-pop,.visual-guide-card,.volume-popover,.quality-popover,.mini-queue-popover,.home-hero,.home-card,.home-tile,.home-mosaic-cell,.pl-inline-detail{background:linear-gradient(145deg,rgba(var(--home-accent-rgb),.12),rgba(46,30,14,.88) 44%,rgba(16,10,4,.86))!important}\n#search-box,#search-results,.search-mode-tabs{background:rgba(46,30,14,.56)!important}\n.search-empty{color:rgba(240,222,198,.52)}"
        }
      }
    }
  ];

  /**
   * 取全部自带主题包。每次都重新序列化，调用方拿到的是文本副本，改不到这里的常量。
   * @returns {Array<{fileName: string, content: string}>} 插件包数组。
   */
  function listBuiltinThemes() {
    var out = [];
    for (var i = 0; i < BUILTIN_THEMES.length; i++) {
      out.push({
        fileName: BUILTIN_THEMES[i].fileName,
        content: JSON.stringify(BUILTIN_THEMES[i].json)
      });
    }
    return out;
  }

  /**
   * 自带主题的 id 列表。运行时用它判断一条记录该不该记进「用户卸载过」名单。
   * @returns {string[]} id 数组。
   */
  function builtinThemeIds() {
    var out = [];
    for (var i = 0; i < BUILTIN_THEMES.length; i++) out.push(String(BUILTIN_THEMES[i].json.id || ''));
    return out;
  }

  var api = { list: listBuiltinThemes, ids: builtinThemeIds };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  global.MineradioBuiltinThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
