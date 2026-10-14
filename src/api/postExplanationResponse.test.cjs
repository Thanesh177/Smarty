const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function client(payload) {
  const instance = {
    interceptors: { request: { use() {} }, response: { use() {} } },
    post: async () => ({ data: payload }),
  };
  const scope = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(__dirname + '/client.js', 'utf8'), {
    format: 'cjs', define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, VITE_API_BASE_URL: 'https://fixture.example' }) },
  }).code, {
    module: scope, exports: scope.exports, console, URL, URLSearchParams, AbortController, DOMException,
    setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      if (name === 'axios') return { create: () => instance };
      if (name === 'aws-amplify/auth') return { fetchAuthSession: async () => ({}) };
      if (name.includes('/firebase')) return { requestNotificationToken: async () => null };
      if (name.includes('/cognito')) return { hasNativeRefreshSession: () => false, refreshNativeSession: async () => null };
      return require(name);
    },
  });
  return scope.exports.postApi;
}

const lesson = 'An expanded lesson teaches the causes and components in plain language. '.repeat(7);
test('details client retains accepted, versioned explanations including wrapped responses', async () => {
  for (const wrapped of [false, true]) {
    const payload = { explanation: lesson, aiDetailedExplanationVersion: 7, persisted: true };
    const data = await client(wrapped ? { body: JSON.stringify(payload) } : payload).getPostDetails({ postId: 'fixture' });
    assert.equal(data.explanation, lesson.trim());
    assert.equal(data.aiDetailedExplanationVersion, 7);
  }
});
test('details client refuses earlier teaching formats rather than passing raw text through', async () => {
  const data = await client({ explanation: lesson, aiDetailedExplanationVersion: 5 }).getPostDetails({ postId: 'fixture' });
  assert.equal(data.explanation, '');
  assert.equal(data.aiDetailedExplanation, '');
});
test('empty nested metadata cannot label unversioned top-level text as new', async () => {
  const data = await client({ explanation: lesson, post: { aiDetailedExplanationVersion: 7 } }).getPostDetails({ postId: 'fixture' });
  assert.equal(data.explanation, '');
  assert.equal(data.aiDetailedExplanationVersion, 0);
});
