'use strict';
const fs = require('node:fs');
const args = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(args[args.indexOf('--request') + 1], 'utf8'));
const output = args[args.indexOf('--output') + 1];
const result = {
  schemaVersion: 1, timeUnit: 'seconds', engine: 'test-fixture-only', language: 'Chinese',
  audioSha256: input.lyrics[0].text === '错唱' ? '0'.repeat(64) : input.audioSha256,
  audioDuration: 30,
  lines: input.lyrics.map((line, index) => ({
    text: line.text,
    start: 10 + index * 5, end: 12 + index * 5,
    words: [
      { text: line.text.slice(0, 1), c0: 0, c1: 1, start: 10 + index * 5, end: 10.12 + index * 5 },
      { text: line.text.slice(1), c0: 1, c1: line.text.length, start: 10.42 + index * 5, end: 12 + index * 5 },
    ],
    reviewReasons: [],
  })),
};
setTimeout(() => {
  fs.writeFileSync(output, JSON.stringify(result));
  console.log(JSON.stringify({ stage: 'complete' }));
}, input.lyrics[0].text === '慢唱' ? 400 : 0);
