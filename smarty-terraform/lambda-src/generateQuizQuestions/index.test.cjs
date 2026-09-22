const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');

// Execute the actual handler with SDK boundaries replaced; no cloud credentials
// or model calls are used. This is a unit harness, not an AWS integration test.
function harness() {
  const items = new Map();
  let modelCalls = 0, failWrites = false;
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
  ].map(q => ({ q, options: ['First', 'Second', 'Third', 'Fourth'], answer: 'First', explanation: 'The first mechanism explains this result.', difficulty: 'Easy' }));
  const context = { process: { env: {} }, console: { warn() {}, error() {} }, TextDecoder, createHash, randomUUID,
    GetCommand, PutCommand, InvokeModelCommand: Command,
    DynamoDBClient: class {}, DynamoDBDocumentClient: { from: () => db },
    BedrockRuntimeClient: class { async send() { modelCalls++; return { body: Buffer.from(JSON.stringify({ output: { message: { content: [{ text: JSON.stringify({ questions }) }] } } })) }; } },
  };
  const source = fs.readFileSync(__dirname + '/index.mjs', 'utf8').replace(/import[\s\S]*?from\s+"[^"]+";/g, '').replace(/export /g, '');
  vm.runInNewContext(source + '\nglobalThis.api = { handler, buildCacheKey, getCachedQuestionPool, saveQuestionPool, memoryCache };', context);
  const event = (user, body = {}) => ({ requestContext: { http: { method: 'POST' }, authorizer: { jwt: { claims: { sub: user } } } }, body: JSON.stringify({ topicId: 'ai', topicTitle: 'AI', requestedCount: 3, ...body }) });
  return { ...context.api, items, event, calls: () => modelCalls, failWrites: () => { failWrites = true; } };
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
