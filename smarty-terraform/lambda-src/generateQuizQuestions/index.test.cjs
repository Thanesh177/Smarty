const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');
const shared = {};
for (const name of ['examBlueprints', 'quizQuestionQuality', 'quizAccess']) {
  const scope = {};
  const source = fs.readFileSync(__dirname + '/../../../infrastructure/shared/' + name + '.mjs', 'utf8').replace(/export /g, '');
  vm.runInNewContext(source + (name === 'examBlueprints'
    ? '\nglobalThis.exports = { resolveExamTrack };'
    : name === 'quizAccess' ? '\nglobalThis.exports = { hasPremiumQuizMembership };'
    : '\nglobalThis.exports = { normalizeTeachingQuality, REASONING_BY_LEVEL };'), scope);
  Object.assign(shared, scope.exports);
}
function quality(options, answer, q, difficulty = 'Easy') {
  return { reasoningKind: { Easy:'foundation', Medium:'application', Hard:'multi-step' }[difficulty],
    explanationSteps: ['The measurement establishes the effect under the given assumptions.', 'Compare that evidence with the causal relationship before reaching a conclusion.'],
    misconception: 'An observation is not automatically proof of the proposed cause.',
    distractorExplanations: Object.fromEntries(options.filter(option => option !== answer).map(option => [option, 'This alternative does not follow from the stated evidence and assumptions.'])),
    repairQuestion: { q: 'A different application: ' + q, options, answer, explanation: 'Apply the same distinction in this new context. The first mechanism follows from the evidence; the alternatives require an unsupported assumption.' } };
}

// Execute the actual handler with SDK boundaries replaced; no cloud credentials
// or model calls are used. This is a unit harness, not an AWS integration test.
function harness({ stopReason = 'tool_use', toolName = 'submit_quiz', splitSubmission = false, alter = questions => questions } = {}) {
  const items = new Map();
  let modelCalls = 0, failWrites = false, lastModelInput;
  class Command { constructor(input) { this.input = input; } }
  class GetCommand extends Command {}
  class PutCommand extends Command {}
  const db = { async send(command) {
    const { TableName, Key, Item, ConditionExpression, ExpressionAttributeValues: values } = command.input;
    const key = TableName + '|' + Object.values(Key || { key: Item.cacheKey || Item.historyKey })[0];
    const current = items.get(key);
    if (command instanceof GetCommand) return { Item: current };
    if (failWrites && !Item.cacheKey?.startsWith('lock#')) throw Error('write unavailable');
    if (ConditionExpression && ((ConditionExpression.includes('attribute_not_exists') && current?.expiresAt > values[':now']) || (ConditionExpression.includes('#owner') && current?.owner !== values[':owner']))) {
      const error = Error('busy'); error.name = 'ConditionalCheckFailedException'; throw error;
    }
    items.set(key, Item); return {};
  }};
  const questions = [
    'Which mechanism stores prior attention keys?', 'Why does a capacitor resist voltage changes?',
    'What causes basalt cooling fractures?', 'How can packet loss affect retransmission?',
    'Which evidence supports tectonic plate movement?', 'When does an enzyme bind its substrate?',
  ].map(q => ({ q, options: ['First', 'Second', 'Third', 'Fourth'], answer: 'First', explanation: 'The first mechanism explains this result by linking the stated cause to its effect. Check the assumptions first; the other choices do not describe the mechanism under these assumptions.', difficulty: 'Easy', ...quality(['First','Second','Third','Fourth'],'First',q) }));
  const context = { process: { env: {} }, console: { warn() {}, error() {}, info() {} }, TextDecoder, createHash, randomUUID, Buffer,
    GetCommand, PutCommand, ConverseCommand: Command, ...shared,
    DynamoDBClient: class {}, DynamoDBDocumentClient: { from: () => db },
    BedrockRuntimeClient: class { async send(command) {
      modelCalls++; lastModelInput = command.input;
      const count = Number(command.input.messages[0].content[0].text.match(/Create exactly (\d+) new/)[1]);
      const rows = alter(questions,modelCalls).slice(0,count);
      return { stopReason, output: { message: { content: (splitSubmission ? rows.map(row => [row]) : [rows]).map((batch,index) =>
        ({ toolUse: { toolUseId: 'fixture-'+index, name: toolName, input: { questions: batch, passage: batch[0]?.passage } } })) } } };
    } },
  };
  const source = fs.readFileSync(__dirname + '/index.mjs', 'utf8').replace(/import[\s\S]*?from\s+"[^"]+";/g, '').replace(/export /g, '');
  vm.runInNewContext(source + '\nglobalThis.api = { handler, buildCacheKey, getCachedQuestionPool, saveQuestionPool, memoryCache, getDepthProfile, normalizeQuestions };', context);
  const event = (user, body = {}, groups = []) => ({ requestContext: { http: { method: 'POST' }, authorizer: { jwt: { claims: { sub: user, 'cognito:groups':groups } } } }, body: JSON.stringify({ topicId: 'ai', topicTitle: 'AI', requestedCount: 3, ...body }) });
  return { ...context.api, items, event, calls: () => modelCalls, modelInput: () => lastModelInput, failWrites: () => { failWrites = true; } };
}

test('shared question pool serves different users with one model call', async () => {
  const h = harness();
  assert.equal((await h.handler(h.event('alice'))).statusCode, 200);
  assert.equal((await h.handler(h.event('bob'))).statusCode, 200);
  assert.equal(h.calls(), 1);
  assert(h.items.has('UserQuizQuestionHistory|alice#ai'));
  assert(h.items.has('UserQuizQuestionHistory|bob#ai'));
});
test('cache identity tracks source, depth and model, but not weak-area order', () => {
  const h = harness(), base = { topicId: 'ai', weakAreas: ['a', 'b'], depth: 'Foundation', sourceBody: 'original' };
  assert.equal(h.buildCacheKey(base), h.buildCacheKey({ ...base, weakAreas: ['b', 'a'] }));
  assert.notEqual(h.buildCacheKey(base), h.buildCacheKey({ ...base, sourceBody: 'edited' }));
  assert.notEqual(h.buildCacheKey(base), h.buildCacheKey({ ...base, depth: 'Expert' }));
  assert.notEqual(h.buildCacheKey(base), h.buildCacheKey({ ...base, modelId: 'another-model' }));
});
test('only Hard shared generation uses the deeper model', async () => {
  const h = harness({alter:rows=>rows.map(row=>({...row,difficulty:'Hard',...quality(row.options,row.answer,row.q,'Hard')}))});
  assert.equal((await h.handler(h.event('alice',{difficulty:'Hard',difficultySelection:'manual'},['SmartyPremium']))).statusCode,200);
  assert.equal(h.modelInput().modelId,'us.anthropic.claude-sonnet-4-6');
  assert.equal(h.modelInput().inferenceConfig.maxTokens,3600);
});
test('non-premium Hard requests and adaptive promotion fail before database or paid model work', async () => {
  const h=harness();
  for (const body of [{difficulty:'Hard',difficultySelection:'manual'}, {learnerLevel:20},
    {difficulty:'Hard',isPremium:true,plan:'premium',groups:['SmartyPremium']}, {learnerDepth:'Expert'}]) {
    const result=await h.handler(h.event('free',body));
    assert.equal(result.statusCode,403);
    assert.equal(JSON.parse(result.body).code,'premium_required');
  }
  assert.equal(h.calls(),0); assert.equal(h.items.size,0);
});
test('premium-only caches cannot be read using client flags or an unverified token', async () => {
  const h=harness({alter:rows=>rows.map(row=>({...row,difficulty:'Hard',...quality(row.options,row.answer,row.q,'Hard')}))});
  const body={difficulty:'Hard',difficultySelection:'manual'};
  assert.equal((await h.handler(h.event('member',body,['SmartyPremium']))).statusCode,200);
  const free=h.event('free',{...body,premium:true});
  free.headers={Authorization:'Bearer forged.payload.signature'};
  assert.equal((await h.handler(free)).statusCode,403);
  assert.equal(h.calls(),1);
  assert(!h.items.has('UserQuizQuestionHistory|free#ai'));
});
test('simultaneous cold requests do not generate duplicate pools', async () => {
  const h = harness();
  const results = await Promise.all([h.handler(h.event('alice')), h.handler(h.event('bob'))]);
  assert(results.some(result => result.statusCode === 200));
  assert(results.every(result => [200, 503].includes(result.statusCode)));
  assert.equal(h.calls(), 1);
});
test('failed database write is not published to warm memory cache', async () => {
  const h = harness(); h.failWrites();
  await assert.rejects(h.saveQuestionPool('failure', {}, [{ q: 'q', answer: 'a' }]));
  assert.equal(h.memoryCache.size, 0);
});
test('expired database pools are not reused before TTL cleanup', async () => {
  const h = harness();
  h.items.set('QuizQuestionCache|expired', { questions: [{ q: 'expired' }], expiresAt: 1 });
  assert.equal((await h.getCachedQuestionPool('expired')).questions.length, 0);
});
test('body userId cannot impersonate another learner', async () => {
  const h = harness();
  await h.handler(h.event('alice', { userId: 'bob' }));
  assert(h.items.has('UserQuizQuestionHistory|alice#ai'));
  assert(!h.items.has('UserQuizQuestionHistory|bob#ai'));
});

test('study paths and exam focus partition the shared pool without partitioning by learner', () => {
  const h = harness(), base = { topicId: 'technology', depth: 'Foundation', studyTrack: 'college', examTarget: 'Networks' };
  assert.notEqual(h.buildCacheKey(base), h.buildCacheKey({ ...base, studyTrack: 'government exams' }));
  assert.notEqual(h.buildCacheKey(base), h.buildCacheKey({ ...base, examTarget: 'Databases' }));
  assert.equal(h.buildCacheKey(base), h.buildCacheKey({ ...base, examTarget: 'networks' }));
});
test('manual foundation selection is respected even for a high-level learner', () => {
  const h = harness();
  assert.equal(h.getDepthProfile({ learnerLevel: 20, difficulty: 'Easy', difficultySelection: 'manual' }).difficulty, 'Easy');
  assert.equal(h.getDepthProfile({ learnerLevel: 20, difficulty: 'Easy' }).difficulty, 'Hard');
});
test('AI receives study context, explicit output bounds and untrusted-input safety rules', async () => {
  const h = harness();
  assert.equal((await h.handler(h.event('alice', { studyTrack: 'professional skills', examTarget: 'Networking' }))).statusCode, 200);
  const input = h.modelInput(), prompt = input.messages[0].content[0].text;
  assert.ok(prompt.includes('professional skills')); assert.ok(prompt.includes('Networking'));
  assert.ok(prompt.includes('35-55 words')); assert.ok(prompt.includes('intermediate step'));
  assert.ok(input.system[0].text.includes('untrusted reference data')); assert.equal(input.inferenceConfig.maxTokens,3600);
  assert.match(input.modelId,/claude-haiku-4-5/); assert.equal(input.inferenceConfig.topP,undefined);
  assert.equal(input.toolConfig.tools.length,1);
  assert.equal(input.toolConfig.toolChoice.tool.name,'submit_quiz');
  assert.equal(input.toolConfig.tools[0].toolSpec.inputSchema.json.properties.questions.maxItems,3);
});
test('only a completed allowlisted structured submission can enter the pool', async () => {
  for (const settings of [{stopReason:'end_turn'},{toolName:'untrusted_action'}]) {
    const h = harness(settings);
    assert.equal((await h.handler(h.event('alice'))).statusCode,500);
    assert.equal([...h.items.keys()].filter(key => key.startsWith('QuizQuestionCache|quiz-')).length,0);
  }
});
test('a bounded batch split across data-only tool blocks does not need a paid retry', async () => {
  const h = harness({splitSubmission:true});
  const result = await h.handler(h.event('alice'));
  assert.equal(result.statusCode,200); assert.equal(JSON.parse(result.body).questions.length,3);
  assert.equal(h.calls(),1);
});
test('compact indexed reasons preserve choice-specific teaching without repeated answer keys', async () => {
  const h = harness({alter:rows=>rows.map(({distractorExplanations,...row})=>({...row,
    distractorReasons:row.options.map(option=>option===row.answer?'':distractorExplanations[option])}))});
  const result = await h.handler(h.event('alice'));
  assert.equal(result.statusCode,200);
  const [question] = JSON.parse(result.body).questions;
  assert.equal(Object.keys(question.distractorExplanations).length,3);
  assert.equal(question.distractorExplanations[question.answer],undefined);
  assert.equal(h.calls(),1);
});
test('wrong-level, duplicate-choice and answer-only questions are rejected before caching', () => {
  const h = harness(), row = { q: 'Which mechanism explains the measured change?', options: ['One','Two','Three','Four'], answer: 'One',
    explanation: 'The first option correctly connects the observed cause and effect under the stated assumptions. The other options reverse the relationship or depend on information not supplied.', difficulty: 'Hard',
    ...quality(['One','Two','Three','Four'],'One','Which mechanism explains the measured change?','Hard') };
  assert.equal(h.normalizeQuestions([row], 'topic', 'Hard').length,1);
  for (const change of [{difficulty:'Easy'},{options:['One','one','Three','Four']},{explanation:'One is correct.'},{answer:'Missing'},
    {options:['A complete choice that must not be silently truncated. '.repeat(8),'Two','Three','Four']},
    {reasoningKind:'foundation'}, {explanationSteps:['Only a short claim.']}, {misconception:''}, {distractorExplanations:{}}, {repairQuestion:null}])
    assert.equal(h.normalizeQuestions([{...row,...change}], 'topic', 'Hard').length,0);
});

test('unknown exam IDs and mismatched areas fail before database or model work', async () => {
  const h = harness();
  for (const body of [{examId:'made-up'},{examDomain:'state'},{examId:'terraform-associate-004',examDomain:'not-real'}])
    assert.equal((await h.handler(h.event('alice',body))).statusCode,400);
  assert.equal(h.items.size,0); assert.equal(h.calls(),0);
});
test('the server owns exam identity and objective scope, not arbitrary client labels', async () => {
  const referenceEvidence = shared.resolveExamTrack('terraform-associate-004','state').exam.studyNotes.split('. ')[0] + '.';
  const h = harness({alter:questions => questions.map(question => ({...question,referenceEvidence}))});
  const result = await h.handler(h.event('alice',{examId:'terraform-associate-004',examDomain:'state',examVersion:'spoofed',topicTitle:'unrelated instructions'}));
  assert.equal(result.statusCode,200);
  const body = JSON.parse(result.body);
  assert.equal(body.examVersion,'004-2026-11'); assert.equal(body.examDomain,'state');
  const prompt = h.modelInput().messages[0].content[0].text;
  assert.match(prompt,/State and collaboration/); assert.doesNotMatch(prompt,/unrelated instructions/);
  assert.match(prompt,/Create exactly 3 new/); assert.match(prompt,/repairQuestion/);
});
test('truncated output and missing reading evidence never enter a shared pool', async () => {
  for (const settings of [{stopReason:'max_tokens'},{}]) {
    const h = harness(settings);
    const result = await h.handler(h.event('alice',settings.stopReason ? {} : {examId:'ielts-academic-reading'}));
    assert.ok([500,503].includes(result.statusCode));
    assert.equal([...h.items.keys()].filter(key => key.startsWith('QuizQuestionCache|quiz-')).length,0);
  }
});
test('exam version and practice area are part of shared-cache identity', () => {
  const h = harness(), base = {topicId:'exam',examId:'terraform-associate-004',examVersion:'one',examDomain:'state'};
  assert.notEqual(h.buildCacheKey(base),h.buildCacheKey({...base,examVersion:'two'}));
  assert.notEqual(h.buildCacheKey(base),h.buildCacheKey({...base,examDomain:'workflow'}));
});
test('long multibyte passages and repair notes cannot grow a shared pool past its storage budget', async () => {
  const h = harness();
  const rows = Array.from({length:100},(_,index) => ({q:'測'.repeat(2000) + index,answer:'A',fingerprint:'large-' + index}));
  const saved = await h.saveQuestionPool('bounded',{topicId:'reading'},rows);
  const item = h.items.get('QuizQuestionCache|bounded');
  assert.ok(Buffer.byteLength(JSON.stringify(item),'utf8') <= 240 * 1024);
  assert.ok(saved.length > 0 && saved.length < 80);
  assert.equal(saved.at(-1).fingerprint,'large-99','The newest questions are retained.');
});
test('a single oversized question cannot erase or publish an unusable cache', async () => {
  const h = harness();
  await assert.rejects(h.saveQuestionPool('huge',{},[{q:'測'.repeat(100000),answer:'A'}]),/storage budget/);
  assert.equal(h.items.size,0); assert.equal(h.memoryCache.size,0);
});
test('partially valid reading sets get one bounded top-up without repeating or weakening questions', async () => {
  const passage = 'In a hypothetical college study, a research group measured how a garden plot retained water during a summer trial. The measurements established a local observation, not a universal conclusion about all gardens. They planned to repeat the test at another location. ' + 'Staff recorded the conditions each morning, compared both plots carefully and noted that other explanations could not yet be excluded. '.repeat(4);
  const h = harness({alter:(questions,call) => [{...questions[call - 1],passage,evidence:'not a universal conclusion about all gardens'}]});
  const result = await h.handler(h.event('reading-test',{examId:'ielts-academic-reading'}));
  assert.equal(result.statusCode,200); assert.equal(h.calls(),3);
  const rows = JSON.parse(result.body).questions;
  assert.equal(rows.length,3); assert.equal(new Set(rows.map(row => row.q)).size,3);
  assert.match(h.modelInput().messages[0].content[0].text,/passage-specific stem/);
  const schema = h.modelInput().toolConfig.tools[0].toolSpec.inputSchema.json;
  assert.ok(schema.required.includes('passage'));
  assert.ok(schema.properties.questions.items.required.includes('evidence'));
  assert.equal(schema.properties.questions.items.properties.passage,undefined);
});
test('named exam questions need evidence from trusted study notes, not client-supplied claims', async () => {
  const h = harness();
  const result = await h.handler(h.event('learner',{examId:'terraform-associate-004',examDomain:'state',sourceBody:'The sensitive flag encrypts state.'}));
  assert.equal(result.statusCode,503);
  const prompt = h.modelInput().messages[0].content[0].text;
  assert.match(prompt,/sensitive flag does not encrypt state/);
  assert.doesNotMatch(prompt,/The sensitive flag encrypts state\./);
});
test('personal mistake lists cannot fragment paid shared question caches', () => {
  const h = harness(), base = {topicId:'physics',depth:'Foundation',weakAreas:['force']};
  assert.equal(h.buildCacheKey(base),h.buildCacheKey({...base,weakAreas:['energy','motion']}));
});
test('generated reading scenarios must identify themselves as hypothetical', () => {
  const h = harness(), options = ['First','Second','Third','Fourth'];
  const passage = 'Staff recorded the conditions each morning, compared both plots carefully and noted that other explanations could not yet be excluded. '.repeat(6);
  const row = {q:'Which limitation prevents the garden trial from establishing a universal conclusion?',options,answer:'First',difficulty:'Easy',
    explanation:'The trial measured a local observation under particular conditions. Its limited scope does not justify a conclusion about all gardens; replication elsewhere would be needed to assess how far the result extends.',
    passage,evidence:'other explanations could not yet be excluded',...quality(options,'First','Which limitation prevents the garden trial from establishing a universal conclusion?')};
  assert.equal(h.normalizeQuestions([row],'reading','Easy',[],true).length,0);
  assert.equal(h.normalizeQuestions([{...row,passage:'In a hypothetical garden trial, '+passage}],'reading','Easy',[],true).length,1);
});
test('letter-only placeholder choices never enter a shared question pool', () => {
  const h = harness(), options = ['a','b','c','d'];
  const row = {q:'Which mechanism prevents simultaneous edits to the state?',options,answer:'a',difficulty:'Easy',
    explanation:'State locking coordinates concurrent writers to supported backends, rather than replacing data encryption or appropriate access controls.', ...quality(options,'a','Which mechanism prevents simultaneous edits to the state?')};
  assert.equal(h.normalizeQuestions([row],'topic','Easy').length,0);
});
