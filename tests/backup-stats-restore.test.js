'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createLocalLibraryStore } = require('../desktop/local-library-store.js');

async function withStore(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-backup-restore-'));
  const store = createLocalLibraryStore({ directory: dir });
  try { await run(store); }
  finally {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('备份统计覆盖原值且重复恢复不累加，旧收藏与多余统计被清除', async () => {
  await withStore(async (store) => {
    store.bumpPlayStat({ key: 'a', plays: 99, listenMs: 9999, completed: 20 });
    store.setFavorite({ key: 'a', favorite: true });
    store.setFavorite({ key: 'obsolete', favorite: true });
    const payload = { stats: [
      { key: 'a', pathKey: 'D:/Music/a.mp3', plays: 7, listenMs: 120000, completed: 3, lastPlayedAt: 0, favorite: false },
      { key: 'b', pathKey: 'D:/Music/b.mp3', plays: 0, lastPlayedAt: 0, favorite: true, favoriteAt: 123 }
    ] };
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(store.restoreStats(payload), { ok: true, restored: 2 });
      const rows = store.readStats({}).stats;
      assert.deepEqual(Object.keys(rows).sort(), ['a', 'b']);
      assert.equal(rows.a.plays, 7);
      assert.equal(rows.a.listenMs, 120000);
      assert.equal(rows.a.completed, 3);
      assert.equal(rows.a.lastPlayedAt, 0);
      assert.equal(rows.a.favorite, false);
      assert.equal(rows.a.favoriteAt, 0);
      assert.equal(rows.b.favorite, true);
      assert.equal(rows.b.favoriteAt, 123);
    }
    assert.deepEqual(store.restoreStats({ stats: [] }), { ok: true, restored: 0 });
    assert.deepEqual(store.readStats({}).stats, {});
  });
});

test('备份统计中途写入失败会回滚 DELETE 与已插入的记录', async () => {
  await withStore(async (store) => {
    store.bumpPlayStat({ key: 'original', plays: 4, lastPlayedAt: 888 });
    store.setFavorite({ key: 'original', favorite: true });
    const before = store.readStats({});
    const probe = new DatabaseSync(store.filePath);
    try {
      probe.exec("CREATE TRIGGER reject_backup_row BEFORE INSERT ON song_stats WHEN NEW.song_key='reject' BEGIN SELECT RAISE(ABORT, 'simulated disk write rejection'); END");
      const result = store.restoreStats({ stats: [{ key: 'first', plays: 7 }, { key: 'reject', plays: 9 }] });
      assert.equal(result.ok, false);
      assert.match(result.error, /simulated disk write rejection/);
      assert.deepEqual(store.readStats({}), before);
    } finally { probe.close(); }
  });
});

test('备份统计无效快照或关闭的数据库必须明确失败', async () => {
  await withStore(async (store) => {
    store.bumpPlayStat({ key: 'original', plays: 4 });
    const before = store.readStats({});
    for (const payload of [{}, { stats: [{ key: '' }] }, { stats: [{ key: 'a' }, { key: 'a' }] }]) {
      assert.equal(store.restoreStats(payload).ok, false);
      assert.deepEqual(store.readStats({}), before);
    }
    store.close();
    assert.equal(store.restoreStats({ stats: [] }).ok, false);
  });
});
