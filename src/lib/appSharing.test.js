import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_LINK, PLAY_REVIEW_LINK, SHARE_INVITATIONS, sharePayload, shareText, shareEmail, shareApp } from './appSharing.js';
test('all invitations share the canonical public site, never a user or auth URL', () => {
  for (const item of SHARE_INVITATIONS) {
    const payload = sharePayload(item.id);
    assert.equal(payload.url, APP_LINK); assert.equal(payload.title, 'Smarty');
    assert.ok(shareText(item.id).endsWith(APP_LINK));
    const email = new URL(shareEmail(item.id));
    assert.equal(email.protocol, 'mailto:');
    assert.ok(email.searchParams.get('body').includes(item.text));
  }
  assert.deepEqual(sharePayload('invalid'), sharePayload('curiosity'));
  assert.equal(new URL(PLAY_REVIEW_LINK).searchParams.get('id'), 'com.thanesh.smarty');
});
test('native sharing is invoked once with the selected message and cancellation stays quiet', async () => {
  let calls = 0;
  assert.equal(await shareApp('study', { share: async payload => { calls++; assert.equal(payload.text, SHARE_INVITATIONS[1].text); } }), 'shared');
  assert.equal(calls, 1);
  assert.equal(await shareApp('study', { share: async () => { throw { name: 'AbortError' }; } }), 'cancelled');
  assert.equal(await shareApp('study', {}), 'unsupported');
  await assert.rejects(shareApp('study', { share: async () => { throw Error('unavailable'); } }));
});
