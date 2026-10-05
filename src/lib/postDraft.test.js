import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_POST, cleanPostTopic, hasPostDraft, normalizePostDraft, postDraftKey, postReadingStats, readPostDraft, savePostDraft, validatePostMedia } from './postDraft.js';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
test('draft text and visibility round-trip without storing attachments', () => {
  const store = storage();
  const form = { topic: 'Science', title: 'Why water rises', body: 'An example.', visibility: 'private', media: 'private-file' };
  assert.equal(savePostDraft('one', form, store), true);
  assert.deepEqual(readPostDraft('one', store), { topic: 'Science', title: 'Why water rises', body: 'An example.', visibility: 'private' });
  assert(!store.getItem(postDraftKey('one')).includes('private-file'));
});
test('drafts are isolated by account and clearing leaves other accounts intact', () => {
  const store = storage();
  savePostDraft('a', { ...EMPTY_POST, title: 'A' }, store);
  savePostDraft('b', { ...EMPTY_POST, title: 'B' }, store);
  savePostDraft('a', EMPTY_POST, store);
  assert.deepEqual(readPostDraft('a', store), EMPTY_POST);
  assert.equal(readPostDraft('b', store).title, 'B');
});
test('corrupt drafts and untrusted field types are handled safely', () => {
  const store = storage();
  store.setItem(postDraftKey('a'), '{bad');
  assert.deepEqual(readPostDraft('a', store), EMPTY_POST);
  assert.deepEqual(normalizePostDraft({ title: {}, body: [], topic: 9, visibility: 'other' }), EMPTY_POST);
  assert.equal(normalizePostDraft({ body: 'a'.repeat(9000) }).body.length, 5000);
});
test('storage failures are reported instead of claiming a saved draft', () => {
  const blocked = { getItem() { throw Error('denied'); }, setItem() { throw Error('full'); }, removeItem() { throw Error('denied'); } };
  assert.deepEqual(readPostDraft('a', blocked), EMPTY_POST);
  assert.equal(savePostDraft('a', { ...EMPTY_POST, title: 'Keep me' }, blocked), false);
  assert.equal(savePostDraft('a', EMPTY_POST, blocked), false);
});
test('draft and reading stats do not treat whitespace as content', () => {
  assert.equal(hasPostDraft({ ...EMPTY_POST, body: '  \n ' }), false);
  assert.deepEqual(postReadingStats(' one\n two  three '), { words: 3, minutes: 1 });
  assert.equal(postReadingStats('word '.repeat(201)).minutes, 2);
  assert.equal(cleanPostTopic(' AI \n  systems\u0000 '), 'AI systems');
});
test('media limits, unsupported files, and empty files are checked', () => {
  assert.equal(validatePostMedia({ type: 'image/png', size: 12 * 1024 * 1024 }), '');
  assert.match(validatePostMedia({ type: 'image/png', size: 12 * 1024 * 1024 + 1 }), /12 MB/);
  assert.match(validatePostMedia({ type: 'video/mp4', size: 251 * 1024 * 1024 }), /250 MB/);
  assert.match(validatePostMedia({ type: 'application/pdf', size: 20 }), /image or video/);
  assert.match(validatePostMedia({ type: 'image/svg+xml', size: 20 }), /instead of an SVG/);
  assert.match(validatePostMedia({ type: 'image/png', size: 0 }), /empty/);
});
