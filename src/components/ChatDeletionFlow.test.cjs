const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { assertActionAccepted } = require('../lib/actionConfirmation.js');
const source = fs.readFileSync(__dirname+'/../pages/ChatPage.jsx','utf8');
const marker = '  const handleDeleteChat = async () => {';
const body = source.slice(source.indexOf(marker)+marker.length, source.indexOf('\n  };\n\nconst runReportUser',source.indexOf(marker)));
const deferred = () => { let resolve; const promise = new Promise(done=>{resolve=done;}); return {promise,resolve}; };
function harness({approved=true, response={deleted:true}, storageFails=false}={}) {
  const chats=[{chatId:'one'},{chatId:'two'}], status=[], calls=[], cached=[];
  const state={chats,cleared:false,approvals:0};
  const accountRef={current:'viewer'}, active={current:'one'}, mounted={current:true}, lock={current:false}, deleted={current:new Set()};
  const noop=()=>{};
  const handle=vm.runInNewContext(`(async function(){${body}})`,{
    activeChat:{chatId:'one',receiverName:'Sam'}, userId:'viewer', deleteLockRef:lock, mountedRef:mounted,
    accountRef,activeChatIdRef:active,deletedChatIdsRef:deleted, chatRequestSeqRef:{current:1},
    confirmAction:async()=>{state.approvals++;return approved;},getUserDisplayName:()=> 'Sam',
    setDeleteSubmitting:noop,setActionsOpen:noop,setStatus:value=>status.push(value),
    assertActionAccepted,withTimeout:promise=>promise,
    chatApi:{deleteChat:async id=>{calls.push(id);return typeof response==='function'?response():response;}},
    messageCacheRef:{current:new Map([['one',[]],['two',[]]])},openedChatIdsRef:{current:new Set(['one'])},
    setChats:fn=>{state.chats=fn(state.chats);},writeChatListCache:(id,list)=>cached.push([id,list]),
    setMessages:()=>{state.cleared=true;},setActiveChat:noop,setMobileChatOpen:noop,setOpenReactionMenuId:noop,setEditingMessageId:noop,setEditingText:noop,
    activeChatStorageKey:'active:viewer',localStorage:{removeItem(){if(storageFails)throw new Error('No storage');}},
    URLSearchParams,searchParams:new URLSearchParams('chatId=one'),setSearchParams:params=>{state.search=params.toString();},
    setActiveChatOnSocket:noop,messagePollTimerRef:{current:null}, window:{dispatchEvent:noop},Event,
    refreshChatsSoon:noop,
  });
  return {handle,state,status,calls,cached,active,accountRef,deleted,lock};
}
test('canceling chat deletion never calls the delete service',async()=>{
  const app=harness({approved:false});await app.handle();assert.equal(app.calls.length,0);assert.equal(app.state.chats.length,2);
});
test('confirmed deletion clears only the target, its cached list entry, and deep link',async()=>{
  const app=harness({storageFails:true});await app.handle();assert.deepEqual(app.calls,['one']);
  assert.equal(app.state.chats.map(x=>x.chatId).join(','),'two');assert.equal(app.state.cleared,true);
  assert.equal(app.cached[0][0],'viewer');assert.equal(app.state.search,'');assert.equal(app.deleted.current.has('one'),true);
});
test('repeated clicks authorize only one deletion',async()=>{
  const gate=deferred(), app=harness({response:()=>gate.promise});const first=app.handle();await app.handle();
  gate.resolve({deleted:true});await first;assert.equal(app.state.approvals,1);assert.equal(app.calls.length,1);
});
test('a late delete response does not clear a newly opened conversation',async()=>{
  const gate=deferred(),app=harness({response:()=>gate.promise});const pending=app.handle();await Promise.resolve();
  app.active.current='two';gate.resolve({deleted:true});await pending;assert.equal(app.state.cleared,false);
  assert.equal(app.state.chats[0].chatId,'two');
});
test('a server rejection retains the chat and offers retry feedback',async()=>{
  const app=harness({response:{success:false}});await app.handle();assert.equal(app.state.chats.length,2);
  assert.equal(app.state.cleared,false);assert(app.status.at(-1).includes('try again'));
});
test('a response from an old account cannot modify the current account',async()=>{
  const gate=deferred(),app=harness({response:()=>gate.promise});const pending=app.handle();await Promise.resolve();
  app.accountRef.current='different';gate.resolve({deleted:true});await pending;
  assert.equal(app.state.chats.length,2);assert.equal(app.state.cleared,false);
});
test('chat deletion uses the shared portaled, focus-managed confirmation',()=>{
  assert.match(body,/await confirmAction/);assert.doesNotMatch(source,/chat-delete-dialog-title|deleteConfirmOpen/);
  assert.match(source,/chat-conversation-status" role="status"/);
  assert.match(source,/filter\(chat => !deletedChatIdsRef\.current\.has\(chat\.chatId\)\)/);
});

test('portaled chat actions are not dismissed before a mobile click and use both app palettes', () => {
  const menu = fs.readFileSync(__dirname + '/ConversationActionMenu.jsx', 'utf8');
  const styles = fs.readFileSync(__dirname + '/ConversationActionMenu.css', 'utf8');
  const rooms = fs.readFileSync(__dirname + '/../pages/TopicRoomsPage.jsx', 'utf8');
  assert.match(source, /<ConversationActionMenu anchorRef=\{chatActionsTriggerRef\}/);
  assert.match(rooms, /<ConversationActionMenu anchorRef=\{activeRoomMenuTrigger\}/);
  assert.doesNotMatch(source, /closest\?\.\('\.dropdown-actions'\)|dropdown-actions[^>]*onBlur/);
  assert.match(menu, /!anchor\.contains\(event\.target\) && !panel\.contains\(event\.target\)/);
  assert.match(menu, /<dialog[\s\S]+Reason/);
  assert.doesNotMatch(source, /window\.prompt\('Reason for reporting/);
  assert.match(styles, /background: var\(--ui-surface\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /\.is-destructive \{ color: var\(--ui-danger\)/);
});
