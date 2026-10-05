const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(AudioContext) {
  const cleanups = [];
  const scope = { window: { AudioContext }, useRef: value => ({ current: value }),
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => cleanups.push(fn()) };
  const source = fs.readFileSync(__dirname + '/useSoundFeedback.js', 'utf8')
    .replace(/import[^;]+;/, '').replace('export default function', 'function');
  vm.runInNewContext(source + '\nglobalThis.feedback = useSoundFeedback;', scope);
  return { create: scope.feedback, cleanup: () => cleanups.forEach(fn => fn?.()) };
}

test('many tones share one audio context and release connected nodes', () => {
  let contexts = 0, disconnects = 0, closes = 0;
  class Audio {
    constructor() { contexts++; this.state='running'; this.currentTime=0; }
    createOscillator() { return { frequency: {}, connect(){}, start(){}, stop(){this.onended();}, disconnect(){disconnects++;} }; }
    createGain() { return { gain: {setValueAtTime(){},exponentialRampToValueAtTime(){}}, connect(){}, disconnect(){disconnects++;} }; }
    close() { closes++; return Promise.resolve(); }
  }
  const h = harness(Audio), feedback = h.create();
  for(let i=0;i<100;i++) feedback.correct();
  assert.equal(contexts,1); assert.equal(disconnects,200);
  h.cleanup(); assert.equal(closes,1); feedback.correct(); assert.equal(contexts,1);
});
test('disabled sound never creates an audio context', () => {
  let contexts=0; const h=harness(class { constructor(){contexts++;} });
  h.create({enabled:false}).wrong(); assert.equal(contexts,0); h.cleanup();
});
test('unavailable or failing audio is optional and cannot throw into scoring', () => {
  for(const Audio of [undefined, class { constructor(){throw Error('not allowed');} }, class { constructor(){this.state='running';} createOscillator(){throw Error('audio limit');} }]) {
    const h=harness(Audio), feedback=h.create(); assert.doesNotThrow(()=>feedback.correct()); assert.doesNotThrow(()=>h.cleanup());
  }
});
test('pending audio resume cannot play after unmount', async () => {
  let resumed, oscillators=0;
  class Audio {
    constructor(){this.state='suspended';}
    resume(){return new Promise(resolve=>{resumed=resolve;});}
    createOscillator(){oscillators++;}
    close(){return Promise.resolve();}
  }
  const h=harness(Audio); h.create().correct(); h.cleanup(); resumed(); await Promise.resolve(); assert.equal(oscillators,0);
});
