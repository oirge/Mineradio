// test/manual/issue125-inject-invalid-embedded-cover.js
// 粘贴到 Folia 的 devtools 窗口的 console 里面，然后点击 本地 -> All songs，在 v0.5.22版本之前应该可以触发黑屏崩溃
// https://github.com/Akarin520/folia-major/issues/125
// 此脚本修改本地 indexedDB 中一首歌的 embeddedCover 为 plain object，从而复现此问题

(async () => {
  const DB_NAME = 'KineticPlayerDB';
  const DB_VERSION = 6;
  const STORE = 'local_music';

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });

  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  const songs = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result || []);
  });

  const target =
    songs.find(song => song?.embeddedCover instanceof Blob) ||
    songs.find(Boolean);

  if (!target) {
    db.close();
    throw new Error('[issue125] No local songs found in IndexedDB.');
  }

  target.embeddedCover = {
    __issue125InvalidEmbeddedCover: true,
    size: target.embeddedCover?.size ?? 12345,
    type: target.embeddedCover?.type ?? 'image/png',
    note: 'Plain object injected to reproduce URL.createObjectURL overload failure.',
  };

  store.put(target);

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
  window.dispatchEvent(new CustomEvent('folia-local-music-updated'));

  console.warn('[issue125] injected invalid embeddedCover', {
    id: target.id,
    fileName: target.fileName,
    embeddedCoverIsBlob: target.embeddedCover instanceof Blob,
    nextStep: 'Open Local Music > All Songs. Before the fix this should reproduce createObjectURL Overload resolution failed.',
  });
})();
