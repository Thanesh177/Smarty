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

test('build hints fetch the modern shell, not a legacy bundle or an optional page', async () => {
  const { default: preload } = await import('../scripts/startup-preload.mjs');
  const asset = (fileName, facadeModuleId, imports = [], css = []) =>
    ({ type: 'chunk', fileName, facadeModuleId, imports, viteMetadata: { importedCss: new Set(css) } });
  const legacy = asset('assets/main-legacy-test.js', '/site/src/main.jsx');
  const vendor = asset('assets/vendor.js', null, [], ['assets/common.css']);
  const app = asset('assets/main.js', '/site/src/main.jsx', [vendor.fileName], ['assets/app.css']);
  const chunk = { fileName: 'assets/index.js', dynamicImports: [app.fileName] };
  const bundle = { [legacy.fileName]: legacy, [vendor.fileName]: vendor, [app.fileName]: app };
  const tags = preload().transformIndexHtml.handler('', { bundle, chunk });
  assert.deepEqual(tags.map(tag => tag.attrs.href), ['/assets/main.js', '/assets/common.css', '/assets/app.css']);
  assert.equal(tags[0].attrs.rel, 'modulepreload');
  assert(tags.slice(1).every(tag => tag.attrs.as === 'style' && tag.attrs.rel === 'preload'));
  assert.deepEqual(preload().transformIndexHtml.handler('', {
    bundle, chunk: { fileName: 'assets/index-legacy-test.js', dynamicImports: [legacy.fileName] },
  }), []);
});
