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
  const window={__SMARTY_SHOW_BOOT_ERROR__:reason=>events.push(reason || 'error')};
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
  assert.deepEqual(app.events,['saved-session']);
});

function bootRecovery(online) {
  let reloads = 0, timer;
  const window = { location: { search: '?code=private-sign-in-code', reload: () => { reloads++; } } };
  const navigator = { userAgent: '', onLine: online };
  const description = { textContent: 'Please reload Smarty to try again.' };
  const button = {};
  const root = { appendChild(content) { this.content = content; } };
  const fragment = { querySelector: selector => selector === 'p' ? description : button };
  const template = { content: { cloneNode: () => fragment } };
  const document = { getElementById: id => id === 'root' ? root : template };
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const script = html.match(/<script id="smarty-startup-recovery">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, { window, navigator, document, URLSearchParams, setTimeout: callback => { timer = callback; } });
  return { window, navigator, description, button, root, timer, reloads: () => reloads };
}

test('startup recovery shows helpful fixed copy, not callback parameters or raw errors', () => {
  const recovery = bootRecovery(true);
  recovery.window.__SMARTY_SHOW_BOOT_ERROR__('saved-session');
  assert.match(recovery.description.textContent, /Your saved sign-in has not been removed/);
  const unknown = bootRecovery(true);
  unknown.window.__SMARTY_SHOW_BOOT_ERROR__('private-sign-in-code');
  assert.equal(unknown.description.textContent, 'Please reload Smarty to try again.');
});

test('a mounted app is not replaced by the timeout, and offline reload waits for connectivity', () => {
  const mounted = bootRecovery(true);
  mounted.window.__SMARTY_APP_MOUNTED__ = true;
  mounted.timer();
  assert.equal(mounted.root.content, undefined);
  const offline = bootRecovery(false);
  offline.timer();
  assert.match(offline.description.textContent, /Reconnect/);
  offline.button.onclick();
  assert.equal(offline.reloads(), 0);
  offline.navigator.onLine = true;
  offline.button.onclick();
  assert.equal(offline.reloads(), 1);
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
