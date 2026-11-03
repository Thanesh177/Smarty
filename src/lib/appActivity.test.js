import test from 'node:test';
import assert from 'node:assert/strict';
import { addAppActivity, readAppActivity, markAppActivityRead } from './appActivity.js';
const store = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const notice = { id: 'first', category: 'news', title: 'New reporting', body: 'A story has an update.', url: '/news' };
test('activity is account scoped and repeated deliveries do not reset read state', () => {
  const storage = store(); assert.equal(addAppActivity('alice', notice, storage), true);
  assert.deepEqual(readAppActivity('bob', storage), []);
  markAppActivityRead('alice', 'first', storage);
  assert.equal(addAppActivity('alice', notice, storage), false);
  assert.equal(readAppActivity('alice', storage)[0].read, true);
});
test('only safe internal destinations and selected fields enter the bounded inbox', () => {
  const storage = store();
  for (let i = 0; i < 45; i++) addAppActivity('bounded', { ...notice, id: String(i), url: 'https://evil.test', token: 'not retained' }, storage, i);
  const rows = readAppActivity('bounded', storage);
  assert.equal(rows.length, 40); assert.equal(rows[0].id, '44');
  assert.equal(rows[0].url, '/learn'); assert.equal(rows[0].token, undefined);
  for (const url of ['//evil.test', '/\\evil.test', 'javascript:alert(1)']) {
    addAppActivity('bounded', { ...notice, id: url, url }, storage);
    assert.equal(readAppActivity('bounded', storage)[0].url, '/learn');
  }
  assert.equal(addAppActivity('bounded', { ...notice, category: 'messages' }, storage), false);
  markAppActivityRead('bounded', 'all', storage);
  assert.ok(readAppActivity('bounded', storage).every(item => item.read));
});
test('anonymous accounts and broken persistence do not crash the app', () => {
  assert.equal(addAppActivity('', notice, store()), false);
  assert.deepEqual(readAppActivity('bad-json', { getItem: () => 'not-json' }), []);
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.equal(addAppActivity('memory-only', notice, blocked), true);
  assert.equal(readAppActivity('memory-only', blocked).length, 1);
});
