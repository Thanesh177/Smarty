import test from 'node:test';
import assert from 'node:assert/strict';
import { getPostAuthorId, getPostAuthorUsername } from './postAuthor.js';

test('public usernames take precedence over legacy email author fields', () => {
  const post = { author: 'private@example.com', creatorName: 'private@example.com', authorUsername: 'curious_mind' };
  assert.equal(getPostAuthorUsername(post), 'curious_mind');
  assert.equal(getPostAuthorUsername(post, { profile: { username: 'new_handle', name: 'Other name' } }), 'new_handle');
  assert.equal(getPostAuthorUsername({ author: { username: 'nested_handle', email: 'private@example.com' } }), 'nested_handle');
});
test('emails and malformed author objects never become public post labels', () => {
  for (const post of [{ author: 'private@example.com' }, { creatorName: 'Alex <private@example.com>' }, { username: 'private@example.com' }, { author: {} }]) {
    assert.equal(getPostAuthorUsername(post), 'Smarty member');
  }
  assert.equal(getPostAuthorUsername({ username: '@reader' }), '@reader');
  assert.equal(getPostAuthorUsername({ author: 'Alex' }), 'Alex');
});
test('author links resolve the posted account, not the viewer or email', () => {
  assert.equal(getPostAuthorId({ authorId: 'author', viewerId: 'me' }), 'author');
  assert.equal(getPostAuthorId({ author: { userId: 'nested' } }), 'nested');
  assert.equal(getPostAuthorId({ authorId: 'private@example.com', userId: 'author' }), 'author');
  assert.equal(getPostAuthorId({ author: 'private@example.com' }), '');
  assert.equal(getPostAuthorId({ authorId: 'smarty-ai' }), '');
  assert.equal(getPostAuthorUsername({ authorId: 'smarty-ai' }), 'Smarty AI');
});
