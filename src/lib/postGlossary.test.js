import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { normalizePostGlossary, verifyPostGlossary, splitGlossaryText } from './postGlossary.js';
import { preparePublishedVocabulary } from './postVocabularyPublishing.js';

const terms = [
  { term: 'photosynthesis', meaning: 'How a plant uses light energy to make sugars from water and carbon dioxide.' },
  { term: 'chlorophyll', meaning: 'The green substance in a leaf that absorbs the light used to make sugars.' },
];
const post = { title: 'A leaf at work', body: 'Photosynthesis begins when chlorophyll absorbs light.' };
const glossary = (value = post, entries = terms) => ({ version: 1, sourceHash: createHash('sha256').update(value.title + '\n' + value.body).digest('hex'), terms: entries });
const words = value => value.filter(part => typeof part === 'object');
const plain = value => value.map(part => typeof part === 'string' ? part : part.text).join('');

test('only current source-bound definitions are displayed, including Unicode and whitespace', async () => {
  assert.deepEqual(await verifyPostGlossary({ ...post, postGlossary: glossary() }, webcrypto), glossary());
  for (const edit of [{ title: 'Changed title' }, { body: post.body + ' ' }, { body: 'Changed meaning' }]) {
    assert.equal(await verifyPostGlossary({ ...post, ...edit, postGlossary: glossary() }, webcrypto), null);
  }
  const unicode = { title: 'Café — a leaf', body: 'ஒளிச்சேர்க்கை transforms light.\n\nIt uses chlorophyll.' };
  assert.ok(await verifyPostGlossary({ ...unicode, postGlossary: glossary(unicode) }, webcrypto));
  assert.equal(await verifyPostGlossary(post, webcrypto), null);
  assert.equal(await verifyPostGlossary({ ...post, postGlossary: glossary() }, {}), null);
});

test('bounded plain-text definitions reject malformed data without changing post text', () => {
  assert.equal(normalizePostGlossary({ ...glossary(), version: 2 }), null);
  assert.equal(normalizePostGlossary({ ...glossary(), sourceHash: 'bad' }), null);
  const dirty = [null, { term: '<script>', meaning: terms[0].meaning }, { term: 'one', meaning: 'tiny' }, ...terms, terms[0]];
  assert.deepEqual(normalizePostGlossary(glossary(post, dirty)).terms, terms);
  assert.equal(normalizePostGlossary(glossary(post, Array.from({ length: 30 }, (_, index) => ({ term: 'word' + index, meaning: terms[0].meaning })))).terms.length, 16);
  const fuller = { term: 'chlorophyll', meaning: (terms[1].meaning + ' ').repeat(5).trim() };
  assert.ok(fuller.meaning.length > 360 && fuller.meaning.length < 650);
  assert.deepEqual(normalizePostGlossary(glossary(post, [fuller])).terms, [fuller]);
  assert.equal(normalizePostGlossary(glossary(post, [{ ...fuller, meaning: 'x'.repeat(651) }])), null);
});

test('matching preserves the exact post and prefers complete phrases over overlapping words', () => {
  const text = 'A KV cache stores a token. Tokens differ; a KV cache can reuse a token.';
  const definitions = [{ term: 'cache', meaning: 'Short-term storage.' }, { term: 'KV cache', meaning: 'Stored earlier token records.' }, { term: 'token', meaning: 'A piece of text.' }];
  const parts = splitGlossaryText(text, definitions);
  assert.equal(plain(parts), text);
  assert.deepEqual(words(parts).map(part => part.text), ['KV cache', 'token', 'KV cache', 'token']);
  assert.equal(plain(splitGlossaryText(post.body, [])), post.body);
  assert.deepEqual(splitGlossaryText(undefined, terms), ['']);
});

test('literal and multilingual terms work without matching pieces of words or links', () => {
  const text = 'ATP powers cells; ATPase is an enzyme. https://example.com/ATP and atp@example.com are not terms. ATP.';
  assert.deepEqual(words(splitGlossaryText(text, [{ term: 'ATP', meaning: 'An energy-carrying molecule.' }])).map(part => part.text), ['ATP', 'ATP']);
  for (const term of ['C++', 'H₂O', 'ஒளிச்சேர்க்கை', 'β-oxidation']) {
    const sample = `About ${term}: ${term}.`;
    const parts = splitGlossaryText(sample, [{ term, meaning: 'A contextual meaning.' }]);
    assert.equal(plain(parts), sample);
    assert.equal(words(parts).length, 2);
  }
});

test('repetitive content cannot create thousands of interactive controls', () => {
  const text = 'ATP '.repeat(4000);
  const parts = splitGlossaryText(text, [{ term: 'ATP', meaning: 'A molecule carrying energy between reactions in a cell.' }]);
  assert.equal(words(parts).length, 80);
  assert.equal(plain(parts), text);
});

test('Unicode case folding keeps the right definition and never edits the displayed text', () => {
  for (const [term, text] of [['science', 'ſcience'], ['kelvin', 'Kelvin'], ['σigma', 'ςigma']]) {
    const entry = { term, meaning: 'A contextual meaning, kept with the exact text.' };
    const parts = splitGlossaryText(text, [entry]);
    assert.equal(plain(parts), text);
    assert.equal(words(parts)[0]?.meaning, entry.meaning);
  }
  const text = '𝒂ATP and ATP𝒂 are not standalone words. ATP is.';
  assert.deepEqual(words(splitGlossaryText(text, [{ term: 'ATP', meaning: 'An energy-carrying molecule.' }])).map(part => part.text), ['ATP']);
});

test('links and email display text do not become word controls', () => {
  const text = 'www.ATP.com and mailto:ATP@example.com and [ATP](https://example.com) stay links. ATP stays a term.';
  const parts = splitGlossaryText(text, [{ term: 'ATP', meaning: 'An energy-carrying molecule.' }]);
  assert.equal(plain(parts), text);
  assert.deepEqual(words(parts).map(part => part.text), ['ATP']);
  assert.deepEqual(splitGlossaryText('ATP', [{ term: 'ATP' }]), ['ATP']);
});

test('successful create and edit prepare meanings once using the saved id, never client definitions', async () => {
  const calls = [];
  const prepare = async id => { calls.push(id); };
  await preparePublishedVocabulary({ success: true, item: { id: 'server-id' } }, { id: 'client-id', body: post.body }, prepare);
  await preparePublishedVocabulary({ statusCode: 200, body: '{"success":true}' }, { postId: 'edited-id', title: post.title }, prepare);
  assert.deepEqual(calls, ['server-id', 'edited-id']);
});

test('failed writes, missing ids, and optional model failures cannot cause duplicate posts', async () => {
  let calls = 0;
  for (const confirmation of [{ error: 'failed' }, { success: false }, { statusCode: 500, body: '{}' }, 'bad JSON']) {
    await preparePublishedVocabulary(confirmation, { id: 'p1', body: post.body }, async () => { calls++; });
  }
  await preparePublishedVocabulary({ success: true }, { body: post.body }, async () => { calls++; });
  assert.equal(calls, 0);
  await assert.doesNotReject(() => preparePublishedVocabulary({ id: 'p1' }, { body: post.body }, async () => { throw new Error('AI timeout'); }));
});
