import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversationPartnerId, getMemberId, getMessageAuthorId, getPublicMemberName, memberProfilePath, requireMatchingProfile } from './memberProfile.js';

test('member links use stable, encoded account IDs, never emails or missing values', () => {
  assert.equal(memberProfilePath(getMemberId({ userId: 'account/a b', sub: 'login-alias' })), '/creator/account%2Fa%20b');
  for (const value of ['', '..', 'null', 'reader@example.invalid', 'smarty-ai', { id: 'someone' }]) {
    assert.equal(memberProfilePath(value), '');
  }
});

test('chat links target the other participant and never the chat or membership key', () => {
  assert.equal(getConversationPartnerId({ chatId: 'chat-1', userId: 'viewer', receiverId: 'reader' }, 'viewer'), 'reader');
  assert.equal(getConversationPartnerId({ chatId: 'chat-1', receiverId: 'viewer', participants: [{ sub: 'viewer' }, { userId: 'reader' }] }, 'viewer'), 'reader');
  assert.equal(getConversationPartnerId({ id: 'conversation-1', userId: 'viewer', receiverId: 'viewer' }, 'viewer'), '');
  assert.equal(getConversationPartnerId({ receiverId: 'login-alias', senderId: 'reader' }, { userId: 'viewer', sub: 'login-alias' }), 'reader');
  assert.equal(getConversationPartnerId({ receiverId: 'reader' }, ''), '');
});

test('room and comment links derive the author, not the content ID', () => {
  assert.equal(getMessageAuthorId({ id: 'message-1', sender: { userId: 'reader' } }), 'reader');
  assert.equal(getMessageAuthorId({ id: 'comment-1', authorId: 'reader' }), 'reader');
  assert.equal(getMessageAuthorId({ id: 'content-1', name: 'reader' }), '');
});

test('a public name never displays a private email or an account UUID', () => {
  assert.equal(getPublicMemberName('reader@example.invalid', '9a584216-18c5-49c3-97b1-770f55e6a2be', 'skyreader'), 'skyreader');
  assert.equal(getPublicMemberName('reader@example.invalid', ''), '');
});

test('a profile response for a different account is never accepted', () => {
  assert.throws(() => requireMatchingProfile({ userId: 'viewer', isMe: true }, 'reader'), { code: 'PROFILE_IDENTITY_MISMATCH' });
  assert.throws(() => requireMatchingProfile({ username: 'reader' }, 'reader'), { code: 'PROFILE_IDENTITY_MISMATCH' });
  const profile = { userId: 'reader', postsCount: 0 };
  assert.equal(requireMatchingProfile(profile, 'reader'), profile);
});
