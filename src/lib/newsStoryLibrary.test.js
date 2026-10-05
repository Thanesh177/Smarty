import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoryLibrary, savedStoryUrl, storyLibraryKey, updateStoryLibrary } from './newsStoryLibrary.js';

const makeStorage = () => {
  const items = new Map();
  return {getItem:key=>items.get(key) ?? null, setItem:(key,value)=>items.set(key,value)};
};

test('saved stories and opened reports are isolated by account', () => {
  const storage = makeStorage();
  assert(updateStoryLibrary('alice','Gaza',{saved:true,year:'2023',month:'10',openedId:'report-one'},storage).ok);
  assert.deepEqual(readStoryLibrary('bob',storage),[]);
  assert.deepEqual(readStoryLibrary('guest',storage),[]);
  assert(updateStoryLibrary('bob','Gaza',{saved:true,openedId:'report-two'},storage).ok);
  assert.deepEqual(readStoryLibrary('alice',storage)[0].opened,['report-one']);
  assert.deepEqual(readStoryLibrary('bob',storage)[0].opened,['report-two']);
});

test('saved coverage resumes its selected period and survives unsaving', () => {
  const storage = makeStorage();
  updateStoryLibrary('a','São Paulo',{saved:true,year:'2023',month:'10',order:'newest',openedId:'report-one'},storage);
  let entry = readStoryLibrary('a',storage)[0];
  assert.equal(savedStoryUrl(entry),'/news/story?q=S%C3%A3o+Paulo&year=2023&month=10&order=newest');
  updateStoryLibrary('a','São Paulo',{month:'11',openedId:'report-one'},storage);
  entry = readStoryLibrary('a',storage)[0];
  assert.equal(entry.month,'11');
  assert.deepEqual(entry.opened,['report-one']);
  updateStoryLibrary('a','São Paulo',{saved:false},storage);
  entry = readStoryLibrary('a',storage)[0];
  assert.equal(entry.saved,false);
  assert.deepEqual(entry.opened,['report-one']);
});

test('case variants do not duplicate the same subject', () => {
  const storage = makeStorage();
  updateStoryLibrary('a','Gaza',{saved:true},storage);
  updateStoryLibrary('a','gaza',{openedId:'one'},storage);
  assert.equal(readStoryLibrary('a',storage).length,1);
  assert.equal(readStoryLibrary('a',storage)[0].saved,true);
});

test('malformed storage is sanitized without breaking the page', () => {
  const storage = makeStorage();
  storage.setItem(storyLibraryKey('a'),'{broken');
  assert.deepEqual(readStoryLibrary('a',storage),[]);
  storage.setItem(storyLibraryKey('a'),JSON.stringify([null,{query:{}},{query:'x'},
    {query:'Gaza',saved:'true',opened:['one','one',{},'x'.repeat(3000)],year:'9999',updatedAt:'bad'}, {query:'gaza'}]));
  const entries = readStoryLibrary('a',storage);
  assert.equal(entries.length,1);
  assert.equal(entries[0].saved,false);
  assert.equal(entries[0].year,'recent');
  assert.deepEqual(entries[0].opened,['one']);
});

test('unavailable storage never claims successful persistence', () => {
  const blocked = {getItem(){throw Error('blocked');}, setItem(){throw Error('quota');}};
  assert.deepEqual(readStoryLibrary('a',blocked),[]);
  assert.equal(updateStoryLibrary('a','Gaza',{saved:true},blocked).ok,false);
  assert.equal(updateStoryLibrary('a','x',{saved:true},makeStorage()).ok,false);
});

test('limits preserve saved stories rather than silently evicting them', () => {
  const storage = makeStorage();
  for (let i=0;i<50;i++) assert(updateStoryLibrary('a',`Story ${i}`,{saved:true},storage).ok);
  assert.equal(updateStoryLibrary('a','New story',{saved:true},storage).ok,false);
  assert.equal(readStoryLibrary('a',storage).length,50);
  updateStoryLibrary('a','Story 0',{saved:false},storage);
  assert(updateStoryLibrary('a','New story',{saved:true},storage).ok);
  assert.equal(readStoryLibrary('a',storage).length,50);
  assert(!readStoryLibrary('a',storage).some(entry=>entry.query==='Story 0'));
});

test('opened-report history remains bounded', () => {
  const storage = makeStorage();
  for (let i=0;i<210;i++) updateStoryLibrary('a','Gaza',{openedId:`report-${i}`},storage);
  const entry = readStoryLibrary('a',storage)[0];
  assert.equal(entry.opened.length,200);
  assert.equal(entry.opened[0],'report-10');
  assert.equal(entry.opened.at(-1),'report-209');
});
