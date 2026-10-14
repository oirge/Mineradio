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
});
