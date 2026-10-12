'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');

test('alignment HTTP API enforces the playback grant and rejects link escapes', async t => {
  const directory = await fs.promises.realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-alignment-api-')));
  const music = path.join(directory, 'music');
  const outside = path.join(directory, 'outside');
  fs.mkdirSync(music); fs.mkdirSync(outside);
  const audio = path.join(music, 'song.wav'); fs.writeFileSync(audio, 'test bytes');
  fs.writeFileSync(path.join(music, 'song.lrc'), '[00:01]歌词');
  fs.writeFileSync(path.join(outside, 'secret.wav'), 'outside grant');
  fs.symlinkSync(outside, path.join(music, 'linked'), 'junction');
  const overrides = {
    HOST: '127.0.0.1', PORT: '0', MINERADIO_LOCAL_FILE_TOKEN: 'test-token-only',
    MINERADIO_ALIGN_RUNTIME: directory, MINERADIO_ALIGN_CACHE: path.join(directory, 'cache'),
    MINERADIO_ALIGN_PYTHON: process.execPath,
    MINERADIO_ALIGN_WORKER: path.join(__dirname, 'fixtures', 'alignment-worker.cjs'),
  };
  const original = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  const server = require('../server.js');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  if (!server.listening) await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/api/lyrics-alignment`;
  async function post(body) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const base = { action: 'lookup', path: audio, token: 'test-token-only' };
  assert.equal((await fetch(endpoint)).status, 405);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post(base)).status, 403, 'missing main-process authorizer must fail closed');
  assert.equal((await post({ ...base, action: 'ensure', lyrics: [{ text: '慢唱' }] })).status, 403);
  server.setLocalFileAuthorizer(target => {
    if (!target.startsWith(music + path.sep)) throw new Error('OUTSIDE_LIBRARY');
    return target;
  });
  assert.equal((await post({ ...base, token: 'wrong' })).status, 403);
  assert.equal((await post({ ...base, action: 'ensure', token: 'wrong', lyrics: [{ text: '慢唱' }] })).status, 403);
  assert.equal((await post({ ...base, path: path.join(outside, 'secret.wav') })).status, 403);
  assert.equal((await post({ ...base, path: path.join(music, 'linked', 'secret.wav') })).status, 403);
  assert.equal((await post({ ...base, action: 'ensure', path: path.join(music, 'linked', 'secret.wav'),
    lyrics: [{ text: '慢唱' }] })).status, 403);
  assert.equal((await post({ ...base, path: 'relative.wav' })).status, 403);
  assert.equal((await post({ ...base, path: path.join(music, 'missing.wav') })).status, 404);
  assert.equal((await post({ ...base, path: path.join(music, 'song.lrc') })).data.error, 'ALIGNMENT_AUDIO_REQUIRED');
  assert.equal((await post({ ...base, lyrics: 'bad shape' })).status, 400);
  assert.equal((await post({ ...base, action: 'runtime' })).data.available, true);
  assert.equal((await post(base)).data.hit, false);
  const created = await post({ ...base, action: 'start', lyrics: [{ text: '快唱', hintStart: 9, hintEnd: 15 }] });
  assert.equal(created.status, 200);
  let result = created.data;
  for (let i = 0; i < 300 && ['running', 'queued'].includes(result.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    result = (await post({ ...base, action: 'status', id: result.id })).data;
  }
  assert.equal(result.status, 'complete', result.message);
  const cache = (await post({ ...base, lyrics: [{ text: '快唱' }] })).data;
  assert.equal(cache.matches, true);
  assert.equal(cache.alignment.lines[0].hintStart, 9);
  assert.equal(cache.alignment.lines[0].hintEnd, 15);
  cache.alignment.lines[0].hintStart = 1;
  cache.alignment.lines[0].hintEnd = 2;
  const correction = { ...base, action: 'correct', alignment: cache.alignment,
    audioSha256: cache.audio.sha256, lyricsHash: cache.lyricsHash, revision: cache.revision };
  assert.equal((await post({ ...correction, revision: 'stale' })).status, 409);
  const corrected = await post(correction);
  assert.equal(corrected.status, 200);
  assert.equal(corrected.data.record.alignment.corrected, true);
  assert.equal(corrected.data.record.alignment.lines[0].hintStart, 9);
  assert.equal(corrected.data.record.alignment.lines[0].hintEnd, 15);
  assert.notEqual(corrected.data.record.revision, cache.revision);
  const protectedCache = path.join(directory, 'cache', cache.audio.sha256 + '.json');
  const correctedBytes = fs.readFileSync(protectedCache);
  const reused = await post({ ...base, action: 'ensure', lyrics: [{ text: '快唱' }] });
  assert.equal(reused.status, 200);
  assert.equal(reused.data.status, 'complete');
  assert.equal(reused.data.cached, true);
  assert.equal(reused.data.result.revision, corrected.data.record.revision);
  const sourceAnchorsChanged = { ...base, lyrics: [{ text: '快唱', hintStart: 11, hintEnd: 17 }] };
  const anchorLookup = await post(sourceAnchorsChanged);
  assert.equal(anchorLookup.data.matches, false);
  assert.equal(anchorLookup.data.textMatches, true);
  const correctedWithNewSource = await post({ ...sourceAnchorsChanged, action: 'ensure' });
  assert.equal(correctedWithNewSource.data.status, 'complete');
  assert.equal(correctedWithNewSource.data.result.revision, corrected.data.record.revision);
  const protectedOtherText = await post({ ...base, action: 'ensure', lyrics: [{ text: '慢唱' }] });
  assert.equal(protectedOtherText.status, 200);
  assert.equal(protectedOtherText.data.status, 'skipped');
  assert.equal(protectedOtherText.data.reason, 'ALIGNMENT_CORRECTED_CACHE_PROTECTED');
  assert.deepEqual(fs.readFileSync(protectedCache), correctedBytes);
  assert.equal((await post({ ...base, action: 'ensure', lyrics: [{ text: '快唱' }], language: 'invalid' })).status, 400);
  assert.equal((await post({ ...base, action: 'ensure', lyrics: 'not-an-array' })).status, 400);
  assert.equal((await post({ ...base, action: 'clear' })).status, 200);
  assert.equal((await post(base)).data.hit, false);
  const automatic = await post({ ...base, action: 'ensure', lyrics: [{ text: '慢唱', hintStart: 9 }] });
  assert.equal(automatic.status, 200);
  assert.ok(['queued', 'running'].includes(automatic.data.status));
  assert.equal((await post({ ...base, action: 'ensure', lyrics: [{ text: '慢唱', hintStart: 9 }] })).data.id,
    automatic.data.id);
  result = automatic.data;
  for (let i = 0; i < 300 && ['running', 'queued'].includes(result.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    result = (await post({ ...base, action: 'status', id: result.id })).data;
  }
  assert.equal(result.status, 'complete', result.message);
  const automaticBytes = fs.readFileSync(protectedCache);
  const automaticHit = await post({ ...base, action: 'ensure', lyrics: [{ text: '慢唱' }] });
  assert.equal(automaticHit.data.status, 'complete');
  assert.equal(automaticHit.data.result.revision, result.result.revision);
  assert.deepEqual(fs.readFileSync(protectedCache), automaticBytes);
  const changedLyrics = await post({ ...base, action: 'ensure', lyrics: [{ text: '快唱' }] });
  assert.equal(changedLyrics.status, 200);
  result = changedLyrics.data;
  for (let i = 0; i < 300 && ['running', 'queued'].includes(result.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    result = (await post({ ...base, action: 'status', id: result.id })).data;
  }
  assert.equal(result.status, 'complete', result.message);
  assert.equal(result.result.alignment.lines[0].text, '快唱');
  assert.equal((await post({ ...base, action: 'clear' })).status, 200);
});
