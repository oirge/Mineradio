'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// tests/folia-vocal-band-cache.test.js
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const start = source.indexOf('function localBeatRound('), end = source.indexOf('function readLocalBeatPrefs()', start);
const ctx = vm.createContext({ LOCAL_BEAT_COMBOS: ['', 'downbeat'] });
vm.runInContext(source.slice(start, end), ctx);

test('the retained vocal band has 50 Hz dB frames and onset indexes in the song timeline', () => {
    const energy = new Float32Array(200).fill(0.00001); energy.fill(0.2, 50, 80); energy.fill(0.4, 130, 150);
    const value = ctx.buildLocalVocalBandEnvelope(energy, 100);
    assert.equal(value.fps, 50); assert.equal(value.db.length, 100);
    assert.ok(Math.abs(value.db[26] - 20 * Math.log10(0.2)) < 0.001);
    assert.deepEqual(Array.from(value.onsets), [25, 65]);
    assert.ok(value.top > -10); assert.ok(value.db[0] < -90);
    assert.equal(ctx.buildLocalVocalBandEnvelope([], 100), null);
});

test('vocal data survives actual JSON beat-cache packing and old caches remain readable', () => {
    const envelope = ctx.buildLocalVocalBandEnvelope(new Float32Array([0.001, 0.001, 0.8, 0.8]), 100);
    const map = { cameraBeats: [{ time: 1, combo: 'downbeat', strength: 0.7 }], pulseBeats: [1], duration: 3, vocalBand: envelope };
    const packed = JSON.parse(JSON.stringify(ctx.packLocalBeatMap(map)));
    const restored = ctx.unpackLocalBeatMap(packed);
    assert.equal(restored.vocalBand.fps, 50); assert.deepEqual(Array.from(restored.vocalBand.onsets), [1]);
    assert.ok(Math.abs(restored.vocalBand.db[1] - envelope.db[1]) <= 0.051);
    delete packed.vocalBand;
    const old = ctx.unpackLocalBeatMap(packed);
    assert.equal(old.vocalBand, null); assert.equal(old.cameraBeats[0].time, 1);
    assert.equal(ctx.normalizeLocalVocalBandEnvelope({ fps: 25, db: [1] }), null);
});
