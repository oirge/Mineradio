const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const PRELOAD = fs.readFileSync(path.join(ROOT, 'desktop', 'preload.js'), 'utf8');
const MAIN = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');

function sliceBetween(source, start, end) {
  const startAt = source.indexOf(start);
  assert.notEqual(startAt, -1, `missing slice start: ${start}`);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(endAt, -1, `missing slice end: ${end}`);
  return source.slice(startAt, endAt);
}

function languageContext() {
  const storage = new Map();
  const context = {
    UI_LANGUAGE_STORE_KEY: 'mineradio-ui-language-v1',
    document: {
      documentElement: {},
      getElementById() { return null; },
    },
    localStorage: { getItem(key) { return storage.get(key) || null; } },
    setPersistentLocalStorageItem(key, value) { storage.set(key, value); },
  };
  vm.createContext(context);
  vm.runInContext(sliceBetween(APP, 'var UI_LANGUAGE_PAIRS = [', 'var persistentUiStateBackupPendingPatch'), context);
  return context;
}

function textElement(text, attributes = {}) {
  const node = { nodeType: 3, nodeValue: text, parentElement: null };
  const element = {
    nodeType: 1,
    tagName: 'SPAN',
    childNodes: [node],
    firstChild: node,
    parentElement: null,
    hasAttribute(key) { return Object.hasOwn(attributes, key); },
    getAttribute(key) { return attributes[key] ?? null; },
    setAttribute(key, value) { attributes[key] = value; },
    closest(selector) {
      return selector === '[data-i18n-skip]' && this.hasAttribute('data-i18n-skip') ? this : null;
    },
  };
  node.parentElement = element;
  return element;
}

test('设置标签中英往返后保持各自原文，不受同译文影响', () => {
  const context = languageContext();
  const labels = ['高级', '高级参数', '自定', '自定义', '水平位置', '左右位置', '背景压暗'];
  const elements = labels.map(text => textElement(text, { title: text }));
  context.setUiLanguage('en');
  elements.forEach(element => context.translateUiElement(element));
  assert.equal(elements[0].firstChild.nodeValue, 'Advanced');
  assert.equal(elements[2].firstChild.nodeValue, 'Custom');
  context.setUiLanguage('zh-CN');
  elements.forEach((element, index) => {
    context.translateUiElement(element);
    assert.equal(element.firstChild.nodeValue, labels[index]);
    assert.equal(element.getAttribute('title'), labels[index]);
  });
});

test('设置中的用户数据与输入值不受语言切换影响', () => {
  const context = languageContext();
  const userLabel = textElement('歌词', { 'data-i18n-skip': '', title: '默认' });
  const input = textElement('自定', { placeholder: '目标语言' });
  input.tagName = 'TEXTAREA';
  input.value = 'English';
  context.setUiLanguage('en');
  context.translateUiElement(userLabel);
  context.translateUiElement(input);
  assert.equal(userLabel.firstChild.nodeValue, '歌词');
  assert.equal(userLabel.getAttribute('title'), '默认');
  assert.equal(input.value, 'English');
  assert.equal(input.firstChild.nodeValue, '自定');
  assert.equal(input.getAttribute('placeholder'), 'Target Language');
});

test('语言偏好在重新初始化后恢复且不写入视觉设置', () => {
  const context = languageContext();
  context.setUiLanguage('en');
  context.uiLanguage = 'zh-CN';
  context.initUiLanguageControls();
  assert.equal(context.uiLanguage, 'en');
  assert.equal(context.document.documentElement.lang, 'en-US');
  assert.doesNotMatch(APP, /fx\.uiLanguage\s*=/);
});

test('运行时重新写入的设置状态沿用当前语言并能切回中文', () => {
  const context = languageContext();
  const element = textElement('暂无断点');
  context.setUiLanguage('en');
  context.translateUiElement(element);
  assert.equal(element.firstChild.nodeValue, 'No Saved Positions');
  element.firstChild.nodeValue = '7 个断点';
  context.translateUiElement(element);
  assert.equal(element.firstChild.nodeValue, '7 breakpoints');
  context.setUiLanguage('zh-CN');
  context.translateUiElement(element);
  assert.equal(element.firstChild.nodeValue, '7 个断点');
});

test('动态歌词保存状态保留行数并支持中英往返', () => {
  const context = languageContext();
  const element = textElement('已保存 2 行，并切换为自定义歌词');
  context.setUiLanguage('en');
  context.translateUiElement(element);
  assert.equal(element.firstChild.nodeValue, 'Saved 2 lines and switched to custom lyrics');
  context.setUiLanguage('zh-CN');
  context.translateUiElement(element);
  assert.equal(element.firstChild.nodeValue, '已保存 2 行，并切换为自定义歌词');
});

test('自定义歌词弹窗纳入语言范围，歌曲信息与歌词文件名保持原文', () => {
  const context = languageContext();
  const songTitle = textElement('高级', { 'data-i18n-skip': '' });
  const lyricFile = textElement('主题', { 'data-i18n-skip': '', title: 'Lyrics' });
  const placeholder = textElement('', { placeholder: '[00:12.00] 第一行歌词\n[00:16.50] 第二行歌词\n\n没有时间轴也可以，每一行会按歌曲时长自动铺开' });
  placeholder.childNodes = [];
  placeholder.firstChild = null;
  assert.match(APP, /'custom-lyric-modal'/);
  assert.match(HTML, /id="custom-lyric-modal"[\s\S]*?data-i18n="自定义歌词"/);
  assert.match(HTML, /id="custom-lyric-track-meta"[^>]+data-i18n-skip/);
  context.setUiLanguage('en');
  [songTitle, lyricFile, placeholder].forEach(element => context.translateUiElement(element));
  assert.equal(songTitle.firstChild.nodeValue, '高级');
  assert.equal(lyricFile.firstChild.nodeValue, '主题');
  assert.equal(lyricFile.getAttribute('title'), 'Lyrics');
  assert.equal(
    placeholder.getAttribute('placeholder'),
    '[00:12.00] First lyric line\n[00:16.50] Second lyric line\n\nWithout timestamps, lines are spaced across the track.',
  );
  assert.match(APP, /function setCustomLyricStatusParts\(prefix, userValue, suffix, tone\)/);
  assert.match(APP, /data-i18n-skip/);
});

test('存档列表语言切换重绘保留未提交改名、焦点与光标选区', () => {
  const start = APP.indexOf('function renderUserFxArchives(opts)');
  const end = APP.indexOf('\nfunction createUserFxArchive()', start);
  assert.ok(start >= 0 && end > start);
  const source = APP.slice(start, end);
  const document = { activeElement: null };
  let input;
  const grid = {
    set innerHTML(html) {
      const match = html.match(/<input class="user-archive-input"[^>]*value="([^"]*)"/);
      input = match ? {
        value: match[1],
        selectionStart: 0,
        selectionEnd: 0,
        selectionDirection: 'none',
        focus() { document.activeElement = this; },
        setSelectionRange(startAt, endAt, direction) {
          this.selectionStart = startAt;
          this.selectionEnd = endAt;
          this.selectionDirection = direction;
        },
      } : null;
    },
  };
  const previousInput = {
    value: 'My Draft',
    selectionStart: 3,
    selectionEnd: 7,
    selectionDirection: 'backward',
  };
  document.activeElement = previousInput;
  const context = {
    document: {
      get activeElement() { return document.activeElement; },
      getElementById(id) {
        if (id === 'user-archive-grid') return grid;
        if (id === 'user-archive-input-0') return input || previousInput;
        return null;
      },
    },
    userFxArchiveEditing: 0,
    userFxArchiveRenderGeneration: 0,
    userFxArchivesHydrated: true,
    userFxArchives: [{ name: 'Original name', snapshot: null, savedAt: 0 }],
    ensureUserFxArchives() { return this.userFxArchives; },
    isUserFxArchivePanelVisible() { return true; },
    escHtml(value) { return String(value); },
    bindUserFxArchiveDrop() {},
    setTimeout() { throw new Error('existing rename draft should not schedule a new-edit focus'); },
  };
  vm.runInNewContext(source + '\nthis.render = renderUserFxArchives;', context);
  context.render();
  assert.equal(input.value, 'My Draft');
  assert.equal(document.activeElement, input);
  assert.equal(input.selectionStart, 3);
  assert.equal(input.selectionEnd, 7);
  assert.equal(input.selectionDirection, 'backward');
});

test('语言偏好只接受中文和英文，脏值回落中文', () => {
  const source = sliceBetween(APP, 'function normalizeUiLanguage(value)', 'function readUiLanguage()');
  const context = {};
  vm.runInNewContext(`${source}\nthis.normalizeUiLanguage = normalizeUiLanguage;`, context);
  assert.equal(context.normalizeUiLanguage('en'), 'en');
  assert.equal(context.normalizeUiLanguage('zh-CN'), 'zh-CN');
  assert.equal(context.normalizeUiLanguage('en-US'), 'en');
  assert.equal(context.normalizeUiLanguage('fr'), 'zh-CN');
  assert.equal(context.normalizeUiLanguage(''), 'zh-CN');
});

test('设置语言切换入口和持久化链路存在', () => {
  assert.match(APP, /var UI_LANGUAGE_STORE_KEY = 'mineradio-ui-language-v1';/);
  assert.match(APP, /UI_LANGUAGE_STORE_KEY,\s*UPDATE_ROUTE_STORE_KEY/);
  assert.match(APP, /function setUiLanguage\(value\)/);
  assert.match(APP, /setPersistentLocalStorageItem\(UI_LANGUAGE_STORE_KEY/);
  assert.match(PRELOAD, /'mineradio-ui-language-v1'/);
  assert.match(MAIN, /'mineradio-ui-language-v1'/);
});

test('设置面板提供中文和 English 选择器', () => {
  assert.match(HTML, /id="fx-language-switch"/);
  assert.match(HTML, /data-ui-language="zh-CN"/);
  assert.match(HTML, /data-ui-language="en"/);
  assert.match(HTML, /界面语言/);
});

test('设置面板的主要分组都有英文目录文案', () => {
  [
    ['视觉控制台', 'Visual Console'],
    ['歌词外观', 'Lyrics Appearance'],
    ['叠加效果', 'Overlay Effects'],
    ['迷你播放器', 'Mini Player'],
    ['3D / 手势', '3D / Gesture'],
    ['自动播放', 'Autoplay'],
    ['音量均衡', 'Volume Normalization'],
    ['无缝播放', 'Gapless Playback'],
    ['播放速度', 'Playback Speed'],
    ['睡眠定时', 'Sleep Timer'],
    ['输出设备', 'Output Device'],
    ['音效链', 'Audio Chain'],
    ['插件', 'Plugins'],
    ['备份', 'Backup'],
    ['音乐文件夹', 'Music Folders'],
    ['高级参数', 'Advanced'],
  ].forEach(([zh, en]) => {
    assert.match(APP, new RegExp(`['"]${zh}['"]`), `missing Chinese source text: ${zh}`);
    assert.match(APP, new RegExp(`['"]${en}['"]`), `missing English text: ${en}`);
  });
});

test('重标记和动态设置节点会重新应用当前语言', () => {
  assert.match(APP, /function applyUiLanguage\(\)/);
  assert.match(APP, /function observeUiLanguagePanel\(\)/);
  assert.match(APP, /relabelFxPanelControls\(\)[\s\S]{0,6000}applyUiLanguage\(\)/);
  assert.match(APP, /MutationObserver/);
  assert.match(APP, /data-i18n/);
  assert.match(APP, /plugin-item-main" data-i18n-skip/);
  assert.match(APP, /user-archive-name" data-i18n-skip/);
});

test('一批重复属性变更只翻译该属性一次，不遍历已有子树', () => {
  const context = languageContext();
  const panel = textElement('高级', { title: '高级' });
  panel.id = 'fx-panel';
  for (let i = 0; i < 200; i++) {
    const child = textElement('歌词'); child.parentElement = panel; panel.childNodes.push(child);
  }
  context.setUiLanguage('en');
  context.translateUiElement(panel);
  panel.setAttribute('title', '背景压暗');
  let attributes = 0, subtrees = 0;
  const original = context.translateUiAttribute;
  context.translateUiAttribute = (...args) => { attributes++; return original(...args); };
  context.translateUiElement = () => { subtrees++; };
  context.translateUiMutations(Array.from({ length: 100 }, () => ({ type: 'attributes', attributeName: 'title', target: panel })));
  assert.equal(attributes, 1);
  assert.equal(subtrees, 0);
  assert.equal(panel.getAttribute('title'), context.uiText('背景压暗'));
});

test('重叠的新子树与文本记录只处理一次，翻译自产生的文本记录不重做', () => {
  const context = languageContext();
  context.setUiLanguage('en');
  const panel = textElement(''); panel.id = 'fx-panel';
  const parent = textElement('歌词'), child = textElement('高级');
  parent.parentElement = panel; child.parentElement = parent; parent.childNodes.push(child);
  let visits = 0;
  const original = context.translateUiTextNode;
  context.translateUiTextNode = node => { visits++; original(node); };
  context.translateUiMutations([
    { type: 'childList', target: panel, addedNodes: [parent] },
    { type: 'childList', target: parent, addedNodes: [child] },
    { type: 'characterData', target: child.firstChild },
  ]);
  assert.equal(visits, 2);
  assert.equal(child.firstChild.nodeValue, 'Advanced');
  context.translateUiMutations([{ type: 'characterData', target: child.firstChild }]);
  assert.equal(visits, 2);
  child.firstChild.nodeValue = '7 个断点';
  context.translateUiMutations(Array.from({ length: 20 }, () => ({ type: 'characterData', target: child.firstChild })));
  assert.equal(visits, 3);
  assert.equal(child.firstChild.nodeValue, '7 breakpoints');
});

test('播放歌单动态文案跟随语言，用户自建歌单名保持原文', () => {
  const pickerStart = APP.indexOf('function renderLocalPlaybackPlaylistPicker()');
  const pickerEnd = APP.indexOf('\nfunction updateLocalPlaybackPlaylistSourceButton()', pickerStart);
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart);
  const picker = APP.slice(pickerStart, pickerEnd);
  assert.match(picker, /uiText\(['"]全部音乐['"]\)/);
  assert.match(picker, /uiText\(['"]特别喜欢['"]\)/);
  assert.match(picker, /uiText\(['"]智能分类['"]\)/);
  assert.match(picker, /translateUiCountText|uiText\(/);

  const sourceStart = pickerEnd;
  const sourceEnd = APP.indexOf('\nfunction setLocalPlaybackPlaylistSelection', sourceStart);
  assert.ok(sourceEnd > sourceStart);
  const sourceButton = APP.slice(sourceStart, sourceEnd);
  assert.match(sourceButton, /uiLanguage\s*===\s*['"]en['"]|uiText\(/);
  assert.match(sourceButton, /title|aria-label/);
  // 用户歌单名只在标签节点上跳过翻译，按钮的悬停提示仍要跟着语言走。
  assert.match(HTML, /id="playlist-source-label"[^>]*data-i18n-skip/);
});

test('热键状态、冲突原因和录入告警使用当前界面语言', () => {
  const start = APP.indexOf('function hotkeyStatusMarkup(');
  const end = APP.indexOf('\nfunction renderHotkeyScope(', start);
  assert.ok(start >= 0 && end > start);
  const source = APP.slice(start, end);
  assert.match(source, /uiText\(/);
  assert.match(source, /title=/);
  assert.match(APP, /setHotkeyCaptureNotice\.reason[\s\S]{0,240}uiText\(/);
  assert.match(APP, /function globalHotkeyRejectReason\(/);
  assert.match(MAIN, /sourceName:\s*['"]不支持该组合键['"]/);
  assert.match(MAIN, /reason:\s*['"]该组合键已被占用或被系统保留['"]/);
});

test('歌曲与歌手详情翻译字段标签，但不翻译用户歌曲信息', () => {
  const rowStart = APP.indexOf('function detailRow(label, value)');
  const rowEnd = APP.indexOf('\nfunction currentArtistNames(', rowStart);
  assert.ok(rowStart >= 0 && rowEnd > rowStart);
  assert.match(APP.slice(rowStart, rowEnd), /uiText\(/);

  const detailStart = APP.indexOf('function openTrackDetailModal(type, songOverride)');
  const detailEnd = APP.indexOf('\nfunction openArtistDetailForSong(', detailStart);
  assert.ok(detailStart >= 0 && detailEnd > detailStart);
  const detail = APP.slice(detailStart, detailEnd);
  ['歌曲详情', '歌手详情', '歌曲名', '关联歌手', '所属专辑', '本地信息'].forEach((label) => {
    assert.match(detail, new RegExp(`uiText\\(['"]${label}['"]\\)`), `详情缺少语言化字段：${label}`);
  });
  assert.match(detail, /escHtml\(title\)/);
  assert.match(detail, /escHtml\(artistName\)/);
  assert.match(detail, /song\.localPath/);
  assert.match(HTML, /id="track-detail-modal"/);
});
