'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createLyricAlignmentService, normalizeLyrics, lyricHash, validateAlignment,
  resolveAlignmentPaths, defaultAlignmentRuntimeRoot } =
  require('../desktop/lyric-alignment-service.js');

function fixture(words) {
  return { schemaVersion: 1, timeUnit: 'seconds', audioDuration: 30,
    engine: 'test-fixture-only', language: 'Chinese',
    lines: [{ text: '快唱', start: 10, end: 12, words: words || [
      { text: '快', c0: 0, c1: 1, start: 10, end: 10.12 },
      { text: '唱', c0: 1, c1: 2, start: 10.42, end: 12 },
    ] }] };
}

test('normalization excludes intro production metadata, not sung lines or instrumental gaps', () => {
  const rows = normalizeLyrics([
    { text: '曲名 - 作者', hintStart: 0 }, { text: '作词：某人', hintStart: 2 },
    { text: '快唱\n译文', hintStart: 28, hintEnd: 35 },
    { text: '长音', hintStart: 77, hintEnd: 82 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].text, '快唱');
  assert.equal(rows[0].translation, '译文');
  assert.equal(rows[1].hintStart, 77);
  assert.equal(lyricHash(rows), lyricHash(rows.map(row => ({ text: row.text }))));
});

test('schema keeps unequal spans and pauses, with no min-duration expansion', () => {
  const alignment = validateAlignment(fixture(), [{ text: '快唱' }]);
  assert.equal(alignment.lines[0].words[0].end, 10.12);
  assert.equal(alignment.lines[0].words[1].start, 10.42);
  assert.equal(alignment.lines[0].end, 12);
  assert.equal(alignment.reviewCount, 0);
});

test('original lyric anchors survive validation without replacing active word timing', () => {
  const output = fixture();
  output.lines[0].hintStart = 1;
  output.lines[0].hintEnd = 2;
  const alignment = validateAlignment(output, [{ text: '快唱', hintStart: 8.5, hintEnd: 15 }]);
  assert.equal(alignment.lines[0].hintStart, 8.5);
  assert.equal(alignment.lines[0].hintEnd, 15);
  assert.equal(alignment.lines[0].start, 10);
  assert.equal(alignment.lines[0].end, 12);
  assert.deepEqual(validateAlignment(alignment), alignment);
  const withoutAnchors = validateAlignment(output, [{ text: '快唱' }]).lines[0];
  assert.equal(Object.hasOwn(withoutAnchors, 'hintStart'), false);
  assert.equal(Object.hasOwn(withoutAnchors, 'hintEnd'), false);
});

test('invalid or orphaned lyric anchors cannot become fallback timing', () => {
  for (const hints of [
    { hintStart: -1, hintEnd: 12 },
    { hintStart: 30, hintEnd: 31 },
    { hintStart: Infinity, hintEnd: 12 },
    { hintStart: '10', hintEnd: 12 },
    { hintEnd: 12 },
  ]) {
    const output = fixture();
    Object.assign(output.lines[0], hints);
    const line = validateAlignment(output).lines[0];
    assert.equal(Object.hasOwn(line, 'hintStart'), false);
    assert.equal(Object.hasOwn(line, 'hintEnd'), false);
  }
  for (const hintEnd of [9, 10, 31, Infinity, '12']) {
    const output = fixture();
    Object.assign(output.lines[0], { hintStart: 10, hintEnd });
    const line = validateAlignment(output).lines[0];
    assert.equal(line.hintStart, 10);
    assert.equal(Object.hasOwn(line, 'hintEnd'), false);
  }
});

test('word groups never get silently split into fabricated character intervals', () => {
  const result = validateAlignment(fixture([
    { text: '快唱', c0: 0, c1: 2, start: 10, end: 12 },
  ]));
  assert.equal(result.lines[0].words[0].start, null);
  assert.equal(result.lines[0].words[0].end, null);
  assert.ok(result.lines[0].words[0].reviewReasons.includes('MULTI_CHARACTER_TIMESTAMP'));
});

test('unknown spans preserve raw evidence but cannot become active timing', () => {
  const result = validateAlignment(fixture([
    { text: '快', c0: 0, c1: 1, start: null, end: null, rawStart: 10, rawEnd: 10 },
    { text: '唱', c0: 1, c1: 2, start: 10.42, end: 12 },
  ]));
  assert.equal(result.lines[0].words[0].start, null);
  assert.equal(result.lines[0].words[0].rawStart, 10);
  assert.ok(result.reviewCount > 0);
});

test('validator rejects milliseconds, wrong text, wrong ranges and reversed time', () => {
  assert.throws(() => validateAlignment({ ...fixture(), timeUnit: 'milliseconds' }), /时间单位/);
  assert.throws(() => validateAlignment(fixture(), [{ text: '另一版本' }]), /不一致/);
  assert.throws(() => validateAlignment(fixture([
    { text: '快', c0: 1, c1: 2, start: 10, end: 11 },
  ])), /字符范围/);
  assert.throws(() => validateAlignment(fixture([
    { text: '快', c0: 0, c1: 1, start: 10000, end: 10120 },
  ])), /时间无效/);
  assert.throws(() => validateAlignment(fixture([
    { text: '快', c0: 0, c1: 1, start: 10, end: 9 },
  ])), /时间无效/);
});

test('grapheme offsets are UTF-16 and cannot slice inside a surrogate pair', () => {
  const result = validateAlignment({
    schemaVersion: 1, timeUnit: 'seconds', audioDuration: 20,
    lines: [{ text: '\uD840\uDC00唱', words: [
      { text: '\uD840\uDC00', c0: 0, c1: 2, start: 1, end: 2 },
      { text: '唱', c0: 2, c1: 3, start: 2.1, end: 3 },
    ] }],
  });
  assert.equal(result.lines[0].words[1].c0, 2);
});

test('cache binds exact audio bytes and lyric text; manual corrections persist across service restarts', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-lyric-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const audio = path.join(directory, 'audio.wav');
  fs.writeFileSync(audio, Buffer.from('test-only-audio-fingerprint'));
  const options = {
    runtimeRoot: directory, cacheRoot: path.join(directory, 'cache'),
    pythonPath: process.execPath, workerPath: path.join(__dirname, 'fixtures', 'alignment-worker.cjs'),
  };
  const service = createLyricAlignmentService(options);
  const job = await service.start(audio, [{ text: '快唱', hintStart: 9, hintEnd: 15 }]);
  let state = job;
  for (let i = 0; i < 100 && state.status !== 'complete' && state.status !== 'failed'; i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    state = service.status(job.id, audio);
  }
  assert.equal(state.status, 'complete', state.message);
  const cache = await service.readCache(audio, normalizeLyrics([{ text: '快唱' }]));
  assert.equal(cache.hit, true);
  assert.equal(cache.matches, true);
  assert.equal(cache.alignment.lines[0].hintStart, 9);
  assert.equal(cache.alignment.lines[0].hintEnd, 15);
  assert.equal((await service.readCache(audio, normalizeLyrics([{ text: '新词' }]))).matches, false);
  const altered = structuredClone(cache.alignment);
  altered.lines[0].words[1].end = 13.4;
  altered.lines[0].hintStart = 1;
  altered.lines[0].hintEnd = 2;
  await assert.rejects(service.correct(audio, altered, 'wrong-hash', cache.lyricsHash, cache.revision), /不属于/);
  await assert.rejects(service.correct(audio, { ...altered, audioDuration: 300 }, cache.audio.sha256, cache.lyricsHash, cache.revision), /音频时长/);
  await service.correct(audio, altered, cache.audio.sha256, cache.lyricsHash, cache.revision);
  await assert.rejects(service.correct(audio, altered, cache.audio.sha256, cache.lyricsHash, cache.revision), /已改变/);
  const restored = await createLyricAlignmentService(options).readCache(audio);
  assert.equal(restored.alignment.corrected, true);
  assert.equal(restored.alignment.lines[0].words[1].end, 13.4);
  assert.equal(restored.alignment.lines[0].hintStart, 9);
  assert.equal(restored.alignment.lines[0].hintEnd, 15);
  fs.writeFileSync(audio, Buffer.from('different-remix-version'));
  assert.equal((await service.readCache(audio)).hit, false);
});

function serviceFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-align-regression-'));
  const audio = path.join(directory, 'audio.wav');
  fs.writeFileSync(audio, 'test audio bytes');
  const options = { runtimeRoot: directory, cacheRoot: path.join(directory, 'cache'),
    pythonPath: process.execPath, workerPath: path.join(__dirname, 'fixtures', 'alignment-worker.cjs') };
  const service = createLyricAlignmentService(options);
  t.after(async () => {
    await service.clear(audio);
    for (let i = 0; i < 200 && service.runtimeStatus().running; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(service.runtimeStatus().running, false);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { service, audio, directory, options };
}

async function settledJob(service, job, audio) {
  let state = job;
  for (let i = 0; i < 300 && ['queued', 'running'].includes(state.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    state = service.status(job.id, audio);
  }
  assert.ok(['complete', 'failed'].includes(state.status), 'job must settle');
  return state;
}

test('background ensure deduplicates normalized pending requests and reuses exact cache without a runtime', async t => {
  const { service, audio, directory, options } = serviceFixture(t);
  const lyrics = [{ text: '作词：作者', hintStart: 0 }, { text: '慢唱\n译文', hintStart: 9, hintEnd: 15 }];
  const first = await service.ensure(audio, lyrics);
  assert.ok(['queued', 'running'].includes(first.status));
  assert.equal((await service.ensure(audio, lyrics)).id, first.id);
  const completed = await settledJob(service, first, audio);
  assert.equal(completed.status, 'complete', completed.message);
  const target = path.join(directory, 'cache', completed.result.audio.sha256 + '.json');
  const before = fs.readFileSync(target);
  const cached = await service.ensure(audio, [{ text: '慢唱', hintStart: 9 }]);
  assert.equal(cached.status, 'complete');
  assert.equal(cached.cached, true);
  assert.equal(cached.result.revision, completed.result.revision);
  assert.equal(cached.result.alignment.lines[0].hintStart, 9);
  assert.deepEqual(fs.readFileSync(target), before);
  const withoutRuntime = createLyricAlignmentService({ ...options, workerPath: path.join(directory, 'missing-worker.py') });
  assert.equal(withoutRuntime.runtimeStatus().available, false);
  assert.equal((await withoutRuntime.ensure(audio, [{ text: '慢唱' }])).status, 'complete');
  await assert.rejects(service.ensure(audio, [{ text: '慢唱' }], 'invalid'),
    error => error.code === 'ALIGNMENT_LANGUAGE_INVALID');
  await assert.rejects(service.ensure(audio, 'not-an-array'), error => error.code === 'LYRICS_REQUIRED');
  fs.writeFileSync(audio, 'different source audio edition');
  const newEdition = await settledJob(service, await service.ensure(audio, [{ text: '快唱' }]), audio);
  assert.equal(newEdition.status, 'complete', newEdition.message);
  assert.notEqual(newEdition.result.audio.sha256, completed.result.audio.sha256);
});

test('background ensure reuses queued work and generates changed uncorrected plaintext', async t => {
  const { service, audio, directory } = serviceFixture(t);
  const blocker = await service.start(audio, [{ text: '慢唱' }]);
  const otherAudio = path.join(directory, 'other.wav');
  fs.writeFileSync(otherAudio, 'different fixture audio bytes');
  const queued = await service.ensure(otherAudio, [{ text: '快唱' }]);
  assert.equal(queued.status, 'queued');
  assert.equal((await service.ensure(otherAudio, [{ text: '快唱' }])).id, queued.id);
  assert.equal((await settledJob(service, blocker, audio)).status, 'complete');
  assert.equal((await settledJob(service, queued, otherAudio)).status, 'complete');
  const changed = await settledJob(service, await service.ensure(audio, [{ text: '快唱' }]), audio);
  assert.equal(changed.status, 'complete', changed.message);
  assert.equal((await service.readCache(audio)).alignment.lines[0].text, '快唱');
});

test('cache matching detects changed source anchors but tolerates roundoff and missing legacy hints', async t => {
  const { service, audio, directory } = serviceFixture(t);
  const initial = await settledJob(service, await service.ensure(audio, [{ text: '快唱', hintStart: 9, hintEnd: 15 }]), audio);
  assert.equal(initial.status, 'complete', initial.message);
  for (const hints of [{ hintStart: 10, hintEnd: 15 }, { hintStart: 9, hintEnd: 16 }]) {
    const cache = await service.readCache(audio, normalizeLyrics([{ text: '快唱', ...hints }]));
    assert.equal(cache.hit, true);
    assert.equal(cache.textMatches, true);
    assert.equal(cache.matches, false);
  }
  assert.equal((await service.readCache(audio, normalizeLyrics([
    { text: '快唱', hintStart: 9 + 1e-10, hintEnd: 15 - 1e-10 },
  ]))).matches, true);
  assert.equal((await service.readCache(audio, normalizeLyrics([{ text: '快唱' }]))).matches, true);
  const target = path.join(directory, 'cache', initial.result.audio.sha256 + '.json');
  const legacy = JSON.parse(fs.readFileSync(target));
  delete legacy.alignment.lines[0].hintEnd;
  fs.writeFileSync(target, JSON.stringify(legacy));
  assert.equal((await service.readCache(audio, normalizeLyrics([
    { text: '快唱', hintStart: 9, hintEnd: 17 },
  ]))).matches, true);
  delete legacy.alignment.lines[0].hintStart;
  fs.writeFileSync(target, JSON.stringify(legacy));
  assert.equal((await service.readCache(audio, normalizeLyrics([
    { text: '快唱', hintStart: 8, hintEnd: 14 },
  ]))).matches, true);
});

test('background ensure regenerates an uncorrected cache when known source anchors change', async t => {
  const { service, audio } = serviceFixture(t);
  const initial = await settledJob(service, await service.ensure(audio, [{ text: '快唱', hintStart: 9, hintEnd: 15 }]), audio);
  assert.equal(initial.status, 'complete', initial.message);
  const refresh = await service.ensure(audio, [{ text: '快唱', hintStart: 8, hintEnd: 14 }]);
  assert.ok(['queued', 'running'].includes(refresh.status));
  const replaced = await settledJob(service, refresh, audio);
  assert.equal(replaced.status, 'complete', replaced.message);
  assert.notEqual(replaced.result.revision, initial.result.revision);
  assert.equal(replaced.result.alignment.lines[0].hintStart, 8);
  assert.equal(replaced.result.alignment.lines[0].hintEnd, 14);
});

test('background requests protect corrected plaintext while explicit manual start remains available', async t => {
  const { service, audio, directory } = serviceFixture(t);
  await settledJob(service, await service.ensure(audio, [{ text: '快唱', hintStart: 9, hintEnd: 15 }]), audio);
  const cache = await service.readCache(audio);
  const corrected = structuredClone(cache.alignment);
  corrected.lines[0].words[1].end = 13;
  const saved = await service.correct(audio, corrected, cache.audio.sha256, cache.lyricsHash, cache.revision);
  const target = path.join(directory, 'cache', cache.audio.sha256 + '.json');
  const before = fs.readFileSync(target);
  const same = await service.ensure(audio, [{ text: '快唱' }]);
  assert.equal(same.status, 'complete');
  assert.equal(same.result.alignment.corrected, true);
  assert.equal(same.result.revision, saved.record.revision);
  const changedAnchors = [{ text: '快唱', hintStart: 11, hintEnd: 17 }];
  assert.equal((await service.readCache(audio, normalizeLyrics(changedAnchors))).matches, false);
  const correctedWithNewSource = await service.ensure(audio, changedAnchors);
  assert.equal(correctedWithNewSource.status, 'complete');
  assert.equal(correctedWithNewSource.result.revision, saved.record.revision);
  assert.equal(correctedWithNewSource.result.alignment.lines[0].words[1].end, 13);
  const different = await service.ensure(audio, [{ text: '慢唱' }]);
  assert.equal(different.status, 'skipped');
  assert.equal(different.reason, 'ALIGNMENT_CORRECTED_CACHE_PROTECTED');
  assert.equal(service.runtimeStatus().queued, 0);
  assert.deepEqual(fs.readFileSync(target), before);
  const explicit = await settledJob(service, await service.start(audio, [{ text: '慢唱' }]), audio);
  assert.equal(explicit.status, 'complete', explicit.message);
  assert.equal(explicit.result.alignment.lines[0].text, '慢唱');
});

test('a correction arriving during background inference cancels its older result', async t => {
  const { service, audio } = serviceFixture(t);
  await settledJob(service, await service.start(audio, [{ text: '快唱' }]), audio);
  const cache = await service.readCache(audio);
  const automatic = await service.ensure(audio, [{ text: '慢唱' }]);
  const corrected = structuredClone(cache.alignment);
  corrected.lines[0].words[1].end = 13.5;
  const saved = await service.correct(audio, corrected, cache.audio.sha256, cache.lyricsHash, cache.revision);
  assert.equal((await settledJob(service, automatic, audio)).error, 'ALIGNMENT_CANCELLED');
  const preserved = await service.readCache(audio);
  assert.equal(preserved.revision, saved.record.revision);
  assert.equal(preserved.alignment.lines[0].words[1].end, 13.5);
});

test('background persistence also protects a correction saved by another service instance', async t => {
  const { service, audio, directory, options } = serviceFixture(t);
  await settledJob(service, await service.start(audio, [{ text: '快唱' }]), audio);
  const cache = await service.readCache(audio);
  const automatic = await service.ensure(audio, [{ text: '慢唱' }]);
  const corrected = structuredClone(cache.alignment);
  corrected.lines[0].words[1].end = 13.8;
  const peer = createLyricAlignmentService(options);
  const saved = await peer.correct(audio, corrected, cache.audio.sha256, cache.lyricsHash, cache.revision);
  const target = path.join(directory, 'cache', cache.audio.sha256 + '.json');
  const before = fs.readFileSync(target);
  assert.equal((await settledJob(service, automatic, audio)).error, 'ALIGNMENT_CORRECTED_CACHE_PROTECTED');
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal((await service.readCache(audio)).revision, saved.record.revision);
});

test('malformed word objects and partially filled times are rejected without a TypeError', () => {
  for (const words of [[null], [{ text: '快', c0: 0, c1: 1, start: null, end: 1 }]]) {
    assert.throws(() => validateAlignment(fixture(words)), error => error.code.startsWith('ALIGNMENT_'));
  }
  assert.throws(() => validateAlignment({ ...fixture(), lines: [null] }, [{ text: '快唱' }]),
    error => error.code === 'ALIGNMENT_TEXT_MISMATCH');
  assert.throws(() => validateAlignment({ ...fixture(), audioDuration: '30' }),
    error => error.code === 'ALIGNMENT_DURATION_INVALID');
  assert.notEqual(lyricHash([{ text: 'é' }]), lyricHash([{ text: 'e\u0301' }]));
});

test('asynchronous jobs deduplicate only the same file, language and anchors', async t => {
  const { service, audio, directory } = serviceFixture(t);
  const lyrics = [{ text: '慢唱', hintStart: 10 }];
  const first = await service.start(audio, lyrics);
  assert.equal((await service.start(audio, lyrics)).id, first.id);
  const otherFile = path.join(directory, 'copy.wav');
  fs.copyFileSync(audio, otherFile);
  const other = await service.start(otherFile, lyrics);
  assert.notEqual(other.id, first.id);
  assert.throws(() => service.status(first.id, otherFile), error => error.code === 'ALIGNMENT_JOB_NOT_FOUND');
  assert.equal(service.status(other.id, otherFile).status, 'queued');
  const changedAnchor = await service.start(audio, [{ text: '慢唱', hintStart: 11 }]);
  assert.notEqual(changedAnchor.id, first.id);
  await service.clear(audio);
  assert.equal((await settledJob(service, first, audio)).error, 'ALIGNMENT_CANCELLED');
  assert.equal(service.status(other.id, otherFile).error, 'ALIGNMENT_CANCELLED');
  assert.equal((await service.readCache(audio)).hit, false);
});

test('worker output is bound to audio bytes and successful job files are removed', async t => {
  const { service, audio, directory } = serviceFixture(t);
  const invalid = await settledJob(service, await service.start(audio, [{ text: '错唱' }]), audio);
  assert.equal(invalid.error, 'AUDIO_VERSION_MISMATCH');
  assert.equal((await service.readCache(audio)).hit, false);
  const good = await settledJob(service, await service.start(audio, [{ text: '快唱' }]), audio);
  assert.equal(good.status, 'complete', good.message);
  for (let i = 0; i < 100 && service.runtimeStatus().running; i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(fs.readdirSync(path.join(directory, 'cache', 'jobs')), []);
});

test('manual correction wins over an older in-flight realignment', async t => {
  const { service, audio } = serviceFixture(t);
  const initial = await settledJob(service, await service.start(audio, [{ text: '慢唱' }]), audio);
  assert.equal(initial.status, 'complete', initial.message);
  const cache = await service.readCache(audio);
  const rerun = await service.start(audio, [{ text: '慢唱' }]);
  const changed = structuredClone(cache.alignment);
  changed.lines[0].words[1].end = 13;
  const saved = await service.correct(audio, changed, cache.audio.sha256, cache.lyricsHash, cache.revision);
  assert.notEqual(saved.record.revision, cache.revision);
  assert.equal((await settledJob(service, rerun, audio)).error, 'ALIGNMENT_CANCELLED');
  assert.equal((await service.readCache(audio)).alignment.lines[0].words[1].end, 13);
});

test('cache rejects a lyric hash that does not describe the stored text', async t => {
  const { service, audio, directory } = serviceFixture(t);
  const initial = await settledJob(service, await service.start(audio, [{ text: '快唱' }]), audio);
  const target = path.join(directory, 'cache', initial.result.audio.sha256 + '.json');
  const record = JSON.parse(fs.readFileSync(target));
  record.lyricsHash = '0'.repeat(64);
  fs.writeFileSync(target, JSON.stringify(record));
  await assert.rejects(service.readCache(audio), error => error.code === 'ALIGNMENT_CACHE_INVALID');
});

test('changed audio cannot receive the result of an in-flight alignment', async t => {
  const { service, audio } = serviceFixture(t);
  const job = await service.start(audio, [{ text: '慢唱' }]);
  fs.writeFileSync(audio, 'a replaced audio edition');
  const result = await settledJob(service, job, audio);
  assert.equal(result.error, 'AUDIO_CHANGED');
  assert.equal((await service.readCache(audio)).hit, false);
});

test('concurrent manual saves cannot both replace the same revision', async t => {
  const { service, audio } = serviceFixture(t);
  await settledJob(service, await service.start(audio, [{ text: '快唱' }]), audio);
  const cache = await service.readCache(audio);
  const outcomes = await Promise.allSettled([12.5, 13].map(end => {
    const alignment = structuredClone(cache.alignment);
    alignment.lines[0].words[1].end = end;
    return service.correct(audio, alignment, cache.audio.sha256, cache.lyricsHash, cache.revision);
  }));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'ALIGNMENT_REVISION_MISMATCH');
});

test('language validation and bounded job queues reject unusable requests', async t => {
  const { service, audio } = serviceFixture(t);
  await assert.rejects(service.start(audio, [{ text: '快唱' }], 'invalid'), error => error.code === 'ALIGNMENT_LANGUAGE_INVALID');
  for (let i = 0; i < 8; i++) await service.start(audio, [{ text: '慢唱', hintStart: i }]);
  await assert.rejects(service.start(audio, [{ text: '慢唱', hintStart: 9 }]), error => error.code === 'ALIGNMENT_QUEUE_FULL');
});

test('runtime discovery resolves packaged scripts outside app.asar and preserves overrides', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-align-paths-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const runtimeRoot = path.join(directory, 'lyric-runtime');
  const resourcesPath = path.join(directory, 'resources');
  const resourceRoot = path.join(resourcesPath, 'app.asar');
  const worker = path.join(resourcesPath, 'app.asar.unpacked', 'lyric-aligner', 'align.py');
  const python = path.join(runtimeRoot, 'venv', 'Scripts', 'python.exe');
  fs.mkdirSync(path.dirname(worker), { recursive: true });
  fs.mkdirSync(path.dirname(python), { recursive: true });
  fs.writeFileSync(worker, 'test'); fs.writeFileSync(python, 'test');
  const found = resolveAlignmentPaths({ runtimeRoot, resourcesPath, resourceRoot });
  assert.equal(found.workerPath, worker); assert.equal(found.pythonPath, python);
  assert.equal(resolveAlignmentPaths({ runtimeRoot, resourceRoot }).workerPath, worker);
  const override = path.join(directory, 'custom.py'); fs.writeFileSync(override, 'test');
  assert.equal(resolveAlignmentPaths({ runtimeRoot, resourceRoot, workerPath: override }).workerPath, override);
});

test('default runtime stays outside the Windows installation and matches the install script', () => {
  const localAppData = path.join('C:', 'Users', 'Listener', 'AppData', 'Local');
  const expected = path.resolve(localAppData, 'Mineradio-oirge', 'lyric-runtime');
  assert.equal(defaultAlignmentRuntimeRoot({ platform: 'win32', localAppData }), expected);
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const installer = fs.readFileSync(path.join(__dirname, '..', 'lyric-aligner', 'install.ps1'), 'utf8');
  assert.match(server, /process\.env\.MINERADIO_ALIGN_RUNTIME \|\| defaultAlignmentRuntimeRoot\(\)/);
  assert.match(installer, /Join-Path \(Join-Path \$localAppData 'Mineradio-oirge'\) 'lyric-runtime'/);
  assert.doesNotMatch(server, /path\.dirname\(process\.resourcesPath\), 'lyric-runtime'/);
});

test('packaged worker stays unavailable until its local model is installed', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-align-model-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const runtimeRoot = path.join(directory, 'lyric-runtime');
  const workerPath = path.join(directory, 'lyric-aligner', 'align.py');
  const pythonPath = path.join(runtimeRoot, 'venv', 'Scripts', 'python.exe');
  const modelPath = path.join(runtimeRoot, 'models', 'Qwen3-ForcedAligner-0.6B', 'model.safetensors');
  const audio = path.join(directory, 'song.wav');
  for (const file of [workerPath, pythonPath]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'fixture');
  }
  fs.writeFileSync(audio, 'fixture audio');
  const service = createLyricAlignmentService({
    runtimeRoot, cacheRoot: path.join(runtimeRoot, 'alignments'), workerPath, pythonPath,
  });
  assert.equal(service.runtimeStatus().available, false);
  await assert.rejects(service.ensure(audio, [{ text: '快唱' }]),
    error => error.code === 'ALIGNMENT_RUNTIME_MISSING');
  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  fs.writeFileSync(modelPath, '');
  assert.equal(service.runtimeStatus().available, false, 'an empty download is not an installed model');
  fs.writeFileSync(modelPath, 'model fixture');
  assert.equal(service.runtimeStatus().available, true);
});
