import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryKey, bookKey, updateLibraryEntry, readBookLibrary, saveBookLibrary, bookProgress, mergeBookPages, readBookCatalogCache, saveBookCatalogCache, safeBookUrl } from './bookLibrary.js';
import { STARTER_BOOKS, getStarterCatalog } from './bookStarterCatalog.js';
import { bookParagraphs, findBookMatches, normalizeReaderSettings, splitBookSections } from './bookReader.js';
import { validBookText, readBookTextCache, saveBookTextCache } from './bookTextCache.js';
import { isVerticalPull } from './pullRefresh.js';
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };
const book = { id: '11', title: 'Alice', author: 'Lewis Carroll', readable: true, gutenberg_id: '11' };
test('shelves are isolated by account and retained across reopening', () => {
  const db = storage(), entries = updateLibraryEntry([], book, { shelf: 'reading', chapter: 4, totalChapters: 12, notes: 'Curiosity', bookmarks: [0, 2] });
  assert(saveBookLibrary('alice', entries, db));
  assert.equal(readBookLibrary('alice', db)[0].chapter, 4);
  assert.deepEqual(readBookLibrary('bob', db), []); assert.notEqual(libraryKey('alice'), libraryKey('bob'));
});
test('updates retain notes and bookmarks without duplicating books', () => {
  let entries = updateLibraryEntry([], book, { notes: 'A note', bookmarks: [1] });
  entries = updateLibraryEntry(entries, book, { shelf: 'finished' });
  assert.equal(entries.length, 1);assert.equal(entries[0].notes, 'A note');assert.deepEqual(entries[0].bookmarks, [1]);
  assert.equal(bookProgress(entries[0]), 100);assert.equal(bookProgress({chapter:0,totalChapters:10}),0);
  assert.equal(bookProgress({chapter:4,totalChapters:10}),40);
});
test('malformed storage and quota errors do not crash the library', () => {
  assert.deepEqual(readBookLibrary('a', {getItem:()=>'{bad'}), []);
  assert.deepEqual(readBookLibrary('a', {getItem:()=>'{"not":"an array"}'}), []);
  assert.equal(saveBookLibrary('a', [], {setItem:()=>{throw Error('quota');}}), false);
});
test('page merging deduplicates stable provider IDs, not identical titles', () => {
  assert.equal(mergeBookPages([book], [book, {...book,id:'12'}]).length, 2);
  assert.notEqual(bookKey(book), bookKey({id:'OL11W'}));
  assert.equal(safeBookUrl('javascript:alert(1)'), '');
});
test('public catalog cache is bounded, expires, and tolerates broken storage', () => {
  const db = storage();
  saveBookCatalogCache('science', {books:[book], nextPage:2}, db, 100);
  assert.equal(readBookCatalogCache('science', db, 101).nextPage, 2);
  assert.equal(readBookCatalogCache('science', db, 100 + 86400001), null);
  for(let n=0;n<20;n++)saveBookCatalogCache('page'+n,{books:[book]},db,200+n);
  assert.equal(readBookCatalogCache('science',db,300),null);
  assert.equal(readBookCatalogCache('x',{getItem:()=>'{bad'}),null);
});
test('starter collection works offline without pretending to be a full catalog', () => {
  assert.equal(STARTER_BOOKS.length,24);
  assert.equal(new Set(STARTER_BOOKS.map(bookKey)).size,24);
  assert.equal(getStarterCatalog().source,'starter');
  assert.equal(getStarterCatalog({search:'Darwin'}).books.length,2);
  assert(getStarterCatalog({category:'philosophy'}).books.length>=3);
  assert.equal(getStarterCatalog({language:'ta'}).books.length,0);
  assert.equal(getStarterCatalog({access:'preview'}).books.length,0);
});
test('reader preserves short chapters and does not split words at section boundaries', () => {
  const chapters='Preface.\nCHAPTER I\nA short chapter.\nCHAPTER II\nAnother chapter.\nCHAPTER III\nThe end.';
  const sections=splitBookSections(chapters);
  assert.equal(sections.length,4);assert.equal(sections.join(''),chapters);
  const text='curiosity and learning '.repeat(900);
  const chunks=splitBookSections(text);assert.equal(chunks.join(''),text);
  assert(chunks.slice(0,-1).every(chunk=>/\s$/.test(chunk)));
  assert.deepEqual(splitBookSections(''),[]);
});
test('reader settings tolerate corruption and keep typography in usable bounds', () => {
  assert.deepEqual(normalizeReaderSettings(null),{fontSize:18,lineHeight:1.8,theme:'dark'});
  assert.deepEqual(normalizeReaderSettings({fontSize:999,lineHeight:0,theme:'unknown'}),{fontSize:28,lineHeight:1.4,theme:'dark'});
});
test('in-book search finds literal phrases with bounded results and retains paragraph breaks', () => {
  assert.deepEqual(bookParagraphs('First line\nsecond line\n\nNew thought'),['First line\nsecond line','New thought']);
  const results=findBookMatches(['Learning [AI].\n\nMore [AI].','Different subject [AI].'],'[ai]');
  assert.deepEqual(results.map(({section,paragraph})=>[section,paragraph]),[[0,0],[0,1],[1,0]]);
  assert.equal(findBookMatches(['Nothing'],'x').length,0);
  assert.equal(findBookMatches(Array(100).fill('a matching passage'),'matching').length,60);
});
test('text cache safely degrades without IndexedDB and rejects HTML errors', async () => {
  assert(validBookText('A readable paragraph. '.repeat(10)));
  assert(!validBookText('<!DOCTYPE html><html>'+ 'error '.repeat(100)));
  assert(!validBookText('too short'));assert.equal(await readBookTextCache('11'),null);
  assert.equal(await saveBookTextCache('11','A readable paragraph. '.repeat(10)),false);
});
test('pull to refresh ignores horizontal and upward gestures', () => {
  const start={x:40,y:80};
  assert(isVerticalPull(start,{x:45,y:200}));
  assert(!isVerticalPull(start,{x:190,y:120}));
  assert(!isVerticalPull(start,{x:45,y:40}));
});
