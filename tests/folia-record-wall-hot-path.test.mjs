import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const viewportSource = fs.readFileSync(
    new URL('../vendor-src/folia/src/mineradio/local/RecordWallViewport.tsx', import.meta.url),
    'utf8',
);
const framesSource = fs.readFileSync(
    new URL('../vendor-src/folia/src/mineradio/local/useRecordWallFrames.ts', import.meta.url),
    'utf8',
);

test('record wall leaves dynamic frame styles on the coalesced RAF path', () => {
    assert.doesNotMatch(viewportSource, /computeHexCardFrame/);
    assert.match(viewportSource, /style=\{CARD_FRAME_BASE_STYLE\}/);
    assert.match(framesSource, /applyHexCardFrameStyles\(element, computeHexCardFrame\(coord, x\.get\(\), y\.get\(\), layout\), cache\)/);
});
