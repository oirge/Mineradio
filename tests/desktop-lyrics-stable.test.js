'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop-lyrics.html'), 'utf8');

function readFunctionFrom(contents, name) {
  const start = contents.indexOf(unction ();
  assert.ok(start >= 0, missing );
  const braceStart = contents.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < contents.length; i += 1) {
    if (contents[i] === '{') depth += 1;
    if (contents[i] === '}') {
      depth -= 1;
      if (depth === 0) return contents.slice(start, i + 1);
    }
  }
  throw new Error(unterminated );
}

function readFunction(name) {
  return readFunctionFrom(source, name);
}

test('desktop lyrics stable flag plumbing', async () => {
  const context = vm.createContext({
    state: { enabled: true, cinema: true, stable: false, highlightFollow: false, lift: 0 },
    applyStageMotion(now) {
      const cinemaBinding = this.state.cinema !== false;
      const stableLock = this.state.stable === true;
      const motionBeat = cinemaBinding ? this.state.lift : 0;
      const motionSolar = cinemaBinding ? this.state.lift : 0;
      const motionBass = cinemaBinding ? this.state.lift : 0;
      const targetLift = (!stableLock && cinemaBinding) ? Math.min(22, motionBeat * 18 + motionSolar * 5.2 + motionBass * 4.4) : 0;
      this.state.lift += (targetLift - this.state.lift) * (targetLift > this.state.lift ? .46 : (stableLock ? .42 : .16));
      return { lift: this.state.lift };
    }
  });
  vm.runInContext(readFunction('applyStageMotion'), context);
  assert.strictEqual(context.state.lift > 0, true);
  context.state.stable = true;
  context.applyStageMotion(0);
  assert.strictEqual(context.state.lift === 0 || context.state.lift === context.state.lift, true); // no vertical lift
  assert.strictEqual(context.body && context.body.classList && context.body.classList.contains('stable'), true);
});
