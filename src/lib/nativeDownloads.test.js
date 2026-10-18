import test from 'node:test';
import assert from 'node:assert/strict';
import { chatBackupPayload, mediaDownloadPayload } from './nativeDownloads.js';

test('chat snapshots contain selected text fields, not URLs or response metadata',()=>{
  const result=chatBackupPayload({id:'direct:c1',title:'A friend',userId:'me',messages:[
    {messageId:'1',senderId:'me',text:'Hello',createdAt:'2026-10-01T10:00:00Z',mediaName:'photo.jpg',mediaUrl:'https://example.test/signed-private-url',token:'secret',reactions:{}},
    {messageId:'2',senderName:'private@example.test',text:'Deleted text',isDeleted:true,mediaUrl:'https://example.test/private'},
    {messageId:'3',viewOnce:true,text:'Do not archive'},
  ]});
  assert.equal(result.messages.length,2);
  assert.equal(result.messages[0].sender,'You');
  assert.equal(result.messages[1].sender,'Member');
  assert.equal(result.messages[1].text,'Message removed');
  assert.equal(result.messages[1].attachment,'');
  assert.doesNotMatch(JSON.stringify(result),/signed-private|token|secret|reactions|Do not archive/);
});
test('empty, oversized and ephemeral-only backups fail clearly',()=>{
  assert.throws(()=>chatBackupPayload({id:'x',messages:[]}),/Load some/);
  assert.throws(()=>chatBackupPayload({id:'x',messages:[{text:'x'.repeat(16001)}]}),/too large/);
  assert.throws(()=>chatBackupPayload({id:'x',messages:[{ephemeral:true,text:'x'}]}),/eligible/);
});
test('media downloads use the refreshed URL and reject unfinished local uploads',()=>{
  globalThis.window={location:{origin:'https://smarty.wiki'}};
  const result=mediaDownloadPayload({messageId:'1',mediaType:'video/mp4',mediaName:'Lesson.mp4',mediaUrl:'https://old.test/file'},'https://media.s3.amazonaws.com/fresh');
  assert.equal(result.kind,'video');assert.equal(result.url,'https://media.s3.amazonaws.com/fresh');
  assert.throws(()=>mediaDownloadPayload({mediaUrl:'blob:local-upload'}),/finish uploading/);
  delete globalThis.window;
});
