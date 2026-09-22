// Exercise the real refresh implementation using dummy tokens and no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const path = require('node:path');
const compiled = transformSync(fs.readFileSync(path.join(__dirname, 'cognito.js'), 'utf8'), {
  format: 'cjs', define: { 'import.meta.env': JSON.stringify({
    VITE_COGNITO_DOMAIN: 'auth.example.invalid', VITE_COGNITO_CLIENT_ID: 'fixture-client', VITE_COGNITO_USER_POOL_ID: 'fixture-pool',
  }) },
}).code;
const jwt = sub => `fixture.${Buffer.from(JSON.stringify({sub, exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const tokens = sub => ({id_token:jwt(sub),access_token:jwt(sub),refresh_token:`fixture-refresh-${sub}`});
const response = (status, body) => ({ok:status===200,status,text:async()=>JSON.stringify(body)});
function load(fetch) {
  const values = new Map();
  const store = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const module = {exports:{}};
  vm.runInNewContext(compiled, {module,exports:module.exports,atob,btoa,URL,URLSearchParams,AbortController,TextEncoder,
    localStorage:store,sessionStorage:store,fetch,
    window:{location:{origin:'https://smarty.wiki',search:''},navigator:{userAgent:'Smarty-iOS'},setTimeout,clearTimeout},
    console:{warn(){}},require:name=>name==='aws-amplify'?{Amplify:{configure(){}}}:{},
  });
  return {api:module.exports,store};
}
test('delayed refresh failure cannot erase a newer login', async()=>{
  let resolve;
  const {api,store}=load(()=>new Promise(done=>{resolve=done;}));
  api.persistNativeRefreshSession(tokens('old'),'old');
  const pending=api.refreshNativeSession();
  api.persistNativeRefreshSession(tokens('new'),'new');
  resolve(response(400,{error:'invalid_grant'}));
  await assert.rejects(pending,error=>error.code==='session_changed');
  assert.equal(store.getItem('smarty-native-refresh-subject'),'new');
  assert.equal(api.hasNativeRefreshSession('new'),true);
});
test('service configuration failures preserve the remembered session', async()=>{
  const {api}=load(async()=>response(400,{error:'invalid_client'}));
  api.persistNativeRefreshSession(tokens('one'),'one');
  await assert.rejects(api.refreshNativeSession(),error=>error.invalidSession===false);
  assert.equal(api.hasNativeRefreshSession('one'),true);
});
test('revoked refresh sessions are removed', async()=>{
  const {api}=load(async()=>response(400,{error:'invalid_grant'}));
  api.persistNativeRefreshSession(tokens('one'),'one');
  await assert.rejects(api.refreshNativeSession(),error=>error.invalidSession===true);
  assert.equal(api.hasNativeRefreshSession('one'),false);
});
test('a refresh finishing after explicit logout cannot restore credentials', async()=>{
  let resolve;
  const {api}=load(()=>new Promise(done=>{resolve=done;}));
  api.persistNativeRefreshSession(tokens('one'),'one');
  const pending=api.refreshNativeSession();
  api.clearNativeRefreshSession();
  resolve(response(200,tokens('one')));
  await assert.rejects(pending,error=>error.code==='session_changed');
  assert.equal(api.hasNativeRefreshSession('one'),false);
});
test('network failures retain the refresh session for later retry', async()=>{
  const {api}=load(async()=>{throw Error('offline');});
  api.persistNativeRefreshSession(tokens('one'),'one');
  await assert.rejects(api.refreshNativeSession(),error=>error.code==='network_error');
  assert.equal(api.hasNativeRefreshSession('one'),true);
});
