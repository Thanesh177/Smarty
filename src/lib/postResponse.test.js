import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostResponse } from './postResponse.js';

test('saved video captions beginning with How are content, not JSON', () => {
  const post = { id: 'one', topic: 'Video', title: 'How a wheel stores energy', body: 'How a wheel stores energy', videoUrl: '/video.mp4' };
  assert.equal(normalizePostResponse(post), post);
});
test('direct post content stays untouched even when it looks like JSON', () => {
  for (const body of ['{"error":"an example"}', '{not JSON}', 'null', '']) {
    const post = { title: 'An explanation', body };
    assert.equal(normalizePostResponse(post), post);
    assert.equal(post.body, body);
  }
});
test('success and saved-item acknowledgements remain supported', () => {
  const response = { success: true, item: { id: 'one', body: 'How it works' } };
  assert.equal(normalizePostResponse(response), response);
  assert.deepEqual(normalizePostResponse(JSON.stringify(response)), response);
});
test('explicit proxy and legacy body-only confirmations are decoded', () => {
  const post = { id: 'one', body: 'How it works' };
  assert.deepEqual(normalizePostResponse({ statusCode: 201, body: JSON.stringify(post) }), post);
  assert.equal(normalizePostResponse({ statusCode: 200, body: post }), post);
  assert.deepEqual(normalizePostResponse({ body: JSON.stringify({ success: true }) }), { success: true });
});
test('failed confirmations never turn into a successful publish', () => {
  for (const response of [{ success: false }, { error: 'failed' }, { statusCode: 500, body: '{"success":true}' }, { statusCode: 201, body: '{"success":false}' }]) {
    assert.throws(() => normalizePostResponse(response), /could not be published/);
  }
});
test('malformed or empty confirmations have an actionable message, not a JSON syntax error', () => {
  for (const response of ['How it works', null, [], {}, { body: 'How it works' }, { statusCode: 201, body: 'not JSON' }, { statusCode: 200, body: 'null' }]) {
    assert.throws(() => normalizePostResponse(response), error => !(error instanceof SyntaxError) && /may already be saved/.test(error.message));
  }
});
