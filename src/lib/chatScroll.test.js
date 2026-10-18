import test from 'node:test';
import assert from 'node:assert/strict';
import {scrollConversationToEnd,shouldPrefetchChatHistory} from './chatScroll.js';

test('initial positioning and reduced motion never animate',()=>{
  const calls=[],element={scrollHeight:1200,clientHeight:400,scrollTop:100,scrollTo:value=>calls.push(value)};
  scrollConversationToEnd(element);scrollConversationToEnd(element,{smooth:true,reducedMotion:true});
  assert.deepEqual(calls,[{top:800,behavior:'instant'},{top:800,behavior:'instant'}]);
  scrollConversationToEnd(element,{smooth:true});assert.equal(calls.at(-1).behavior,'smooth');
});
test('no redundant scroll at the end, and history prefetch starts before the edge',()=>{
  const element={scrollHeight:1000,clientHeight:500,scrollTop:500,scrollTo(){throw Error('already at end');}};
  scrollConversationToEnd(element);
  assert.equal(shouldPrefetchChatHistory({...element,scrollTop:200},false,true),true);
  assert.equal(shouldPrefetchChatHistory({...element,scrollTop:200},true,true),false);
  assert.equal(shouldPrefetchChatHistory({...element,scrollTop:200},false,false),false);
});
