import test from 'node:test';
import assert from 'node:assert/strict';
import { getPostAuthorId, getPostAuthorUsername, getPostAuthorProfilePath } from './postAuthor.js';

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

test('older and nested author records resolve to the same public profile route', () => {
  for (const post of [{ creator: { sub: 'author' } }, { author: { user_id: 'author' } }, { user: { userID: 'author' } },
    { ownerId: 'author' }, { owner: { id: 'author' } }, { createdBy: { sub: 'author' } }, { authorSub: 'author' }, { createdByUserId: 'author' }]) {
    assert.equal(getPostAuthorId(post), 'author');
    assert.equal(getPostAuthorProfilePath(post), '/creator/author');
  }
  const uuid = '6bc8582d-488b-4da0-b541-c225971ef493';
  assert.equal(getPostAuthorProfilePath({ author: uuid }), '/creator/' + uuid);
  assert.equal(getPostAuthorUsername({ author: uuid }), 'Smarty member');
  assert.equal(getPostAuthorUsername({ owner: { username: 'owner_handle', sub: uuid } }), 'owner_handle');
});

test('placeholder, email and display-name-only authors never point to a guessed profile', () => {
  for (const post of [{ authorId: 'undefined', username: 'reader' }, { authorId: 'null' }, { authorId: 'private@example.com' },
    { author: 'Alex', viewerId: 'me' }, { username: '@reader', user: { email: 'private@example.com' } }, { authorId: 'smarty-ai' }]) {
    assert.equal(getPostAuthorProfilePath(post), '');
  }
  assert.equal(getPostAuthorId({ creatorId: 'undefined', authorId: 'actual-author' }), 'actual-author');
  assert.equal(getPostAuthorProfilePath({ authorId: 'author/user 123' }), '/creator/author%2Fuser%20123');
});
