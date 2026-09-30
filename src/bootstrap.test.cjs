const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {transformSync} = require('esbuild');
const compiled = transformSync(fs.readFileSync(path.join(__dirname, 'bootstrap.js'), 'utf8'), {
  format:'cjs', supported:{'dynamic-import':false},
}).code;
const tick = () => new Promise(resolve => setImmediate(resolve));

function boot(restore) {
  const events=[];
  const window={__SMARTY_SHOW_BOOT_ERROR__:()=>events.push('error')};
  vm.runInNewContext(compiled,{window,require:name=>{
    if(name.includes('nativeSessionStorage'))return {initializeNativeSessionStorage:restore};
    if(name.includes('main.jsx')) {events.push('sdk-and-app-imported');return {};}
    throw Error('Unexpected eager dependency');
  }});
  return {events,window};
}

test('authentication SDK and app imports wait for complete device-session restoration',async()=>{
  let ready;
  const restoring=new Promise(resolve=>{ready=resolve;});
  const app=boot(()=>restoring);
  await tick();
  assert.deepEqual(app.events,[]);
  ready();await tick();
  assert.deepEqual(app.events,['sdk-and-app-imported']);
});

test('unavailable device storage cannot start an empty authentication SDK or clear the session',async()=>{
  const app=boot(async()=>{throw Error('temporarily unavailable');});
  await tick();
  assert.deepEqual(app.events,['error']);
  assert.match(app.window.__SMARTY_BOOT_ERROR__,/session has not been removed/);
});
