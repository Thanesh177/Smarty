import test from 'node:test';
import assert from 'node:assert/strict';
import {contentId,contentList,contentTopics,filterContent,personId} from './communityContent.js';
test('collections normalize wrappers, drop invalid records and deduplicate IDs',()=>{
  const list=contentList({posts:[{item:{reelId:'a',title:'One'}},{id:'a'},{postId:'b'},{}]});
  assert.equal(list.length,2);assert.equal(contentId(list[0]),'a');assert.equal(list[0].title,'One');assert.equal(personId({userId:'f'}),'f');
  assert.deepEqual(contentList({posts:{bad:true}}),[]);
});
test('topic, visibility, search and ordering work together without changing source data',()=>{
  const posts=[{id:'1',title:'Beta',topic:['AI','AI'],body:'Attention layers',createdAt:'2026-09-01',visibility:'private'},{id:'2',title:'Alpha',topic:'Science',createdAt:'2026-09-02'}];
  assert.deepEqual(contentTopics(posts[0]),['AI']);assert.equal(filterContent(posts,{query:'attention',visibility:'private',topic:'AI'})[0].id,'1');
  assert.equal(filterContent(posts,{visibility:'public'})[0].id,'2');assert.equal(filterContent(posts,{sort:'title'})[0].id,'2');
  assert.equal(filterContent(posts)[0].id,'2');assert.equal(posts[0].id,'1');
});
