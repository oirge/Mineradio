'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDesktopUiLanguage, UI_LANGUAGE_KEY } = require('../desktop/ui-language');

test('原生文案从同一持久化键恢复，更新与删除后即时刷新菜单', () => {
  let reads = 0, changes = 0;
  const language = createDesktopUiLanguage({ readValues: () => { reads++; return { [UI_LANGUAGE_KEY]: 'en' }; }, onChange: () => changes++ });
  assert.equal(language.text('显示 Mineradio'), 'Show Mineradio');
  assert.equal(language.text('导入 Mineradio 备份'), 'Import Mineradio backup');
  assert.equal(reads, 1);
  assert.equal(language.apply({ [UI_LANGUAGE_KEY]: 'en' }), false);
  assert.equal(language.apply({ [UI_LANGUAGE_KEY]: 'zh-CN' }), true);
  assert.equal(language.text('所有文件'), '所有文件');
  language.apply({ [UI_LANGUAGE_KEY]: 'en' });
  language.apply({});
  assert.equal(language.text('退出 Mineradio'), '退出 Mineradio');
  assert.equal(changes, 3);
  assert.equal(language.text('用户的音乐目录'), '用户的音乐目录');
});

test('真实文件选择处理器在英文模式翻译标题和筛选器并保留取消语义', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../desktop/main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('mineradio-export-backup-file'");
  const end = source.indexOf("ipcMain.on('mineradio-ui-state-read-sync'", start);
  const handlers = new Map(), options = [];
  const language = createDesktopUiLanguage({ readValues: () => ({ [UI_LANGUAGE_KEY]: 'en' }) });
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    trustedMainFrameHandler: callback => callback,
    getSenderWindow: () => ({}), desktopUiText: language.text,
    dialog: { showOpenDialog: async (_owner, value) => { options.push(value); return { canceled: true }; },
      showSaveDialog: async (_owner, value) => { options.push(value); return { canceled: true }; } },
  });
  for (const [name, callback] of handlers) {
    const result = await callback({});
    assert.equal(result.canceled, true, name);
  }
  assert.equal(options.length, 5);
  for (const option of options) {
    assert.doesNotMatch(option.title, /\p{Script=Han}/u);
    for (const filter of option.filters) assert.doesNotMatch(filter.name, /\p{Script=Han}/u);
  }
});
