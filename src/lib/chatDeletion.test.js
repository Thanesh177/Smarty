import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatDeletion } from './chatDeletion.js';

test('chat deletion accepts confirmed responses, including wrapped bodies', () => {
  for (const body of [{ deleted: true, chatId: 'one' }, { success: true }, { body: JSON.stringify({ deleted: true }) }, JSON.stringify({ deleted: true })]) {
    assert.equal(normalizeChatDeletion(body, 'one').deleted, true);
  }
});
test('rejected and ambiguous responses never remove a conversation locally', () => {
  for (const body of [{ deleted: false }, { success: false }, { error: 'Denied' }, '', null, { deleted: true, chatId: 'other' }]) assert.throws(() => normalizeChatDeletion(body, 'one'));
});
test('only a specific already-deleted membership is idempotent, not a missing route', () => {
  assert.equal(normalizeChatDeletion({ error: 'Chat not found', deleted: false, chatId: 'one' }, 'one', 404).alreadyDeleted, true);
  for (const body of [{ message: 'Not Found' }, { error: 'Unauthorized' }, { error: 'Chat not found', deleted: false, chatId: 'other' }]) assert.throws(() => normalizeChatDeletion(body, 'one', 404));
});
