import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSavedCollection, normalizeSavedCollection, savedContentKind } from './savedCollection.js';
const posts = [{ id: 'read', title: 'A wheel', topic: 'Physics', body: 'Momentum' }, { id: 'video', title: 'An experiment', topic: 'Physics', videoUrl: '/one.mp4' }];
test('saved content combines type, topic and text filters', () => {
  assert.equal(savedContentKind(posts[0]), 'read'); assert.equal(savedContentKind(posts[1]), 'video');
  assert.deepEqual(filterSavedCollection(posts, { kind: 'video', topic: 'Physics' }).map(post => post.id), ['video']);
  assert.deepEqual(filterSavedCollection(posts, { kind: 'read', query: 'momentum' }).map(post => post.id), ['read']);
  assert.equal(filterSavedCollection(posts, { kind: 'video', query: 'momentum' }).length, 0);
});
test('saved collections unwrap envelopes, deduplicate and reject failed responses', () => {
  assert.deepEqual(normalizeSavedCollection({ statusCode: 200, body: JSON.stringify({ posts: [...posts, posts[0]] }) }), posts);
  assert.deepEqual(normalizeSavedCollection({ savedReels: posts }), posts);
  assert.deepEqual(normalizeSavedCollection({ data: posts }), posts);
  assert.throws(() => normalizeSavedCollection({ success: false }));
  assert.throws(() => normalizeSavedCollection({ statusCode: 500, body: '[]' }));
});
test('saved ordering supports ISO dates, epoch timestamps and oldest first', () => {
  const collection = [{ id: 'old', savedAt: 1700000000000 }, { id: 'new', savedAt: '2026-10-09T12:00:00Z' }];
  assert.deepEqual(filterSavedCollection(collection).map(post => post.id), ['new', 'old']);
  assert.deepEqual(filterSavedCollection(collection, { sort: 'oldest' }).map(post => post.id), ['old', 'new']);
});
