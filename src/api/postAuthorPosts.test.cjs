const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { getPostAuthorId } = require('../lib/postAuthor.js');

const source = fs.readFileSync(__dirname + '/client.js', 'utf8');
const body = source.match(/async getPostsByCreator\(userId\) \{([\s\S]+?)\n  \},/)[1];
function reader(posts, mock = false) {
  let requests = 0;
  const get = vm.runInNewContext(`(async function(userId) { ${body} })`, {
    USE_MOCK: mock, delay: async () => {}, mockFeed: posts, getPostAuthorId,
    endpoints: { posts: { feed: '/reels' } }, normalizeList: data => data,
    api: { get: async () => { requests++; return { data: posts }; } },
  });
  return { get, count: () => requests };
}

test('public profile contributions use the same author identity as post links', async () => {
  const posts = [
    { id: 'one', authorId: 'author' }, { id: 'two', creator: { sub: 'author' } },
    { id: 'three', ownerId: 'author' }, { id: 'other', authorId: 'viewer' }, { id: 'unknown', username: 'author' },
  ];
  for (const mock of [false, true]) {
    const read = reader(posts, mock);
    assert.equal((await read.get(' author ')).map(post => post.id).join(','), 'one,two,three');
    assert.equal(read.count(), mock ? 0 : 1);
  }
});

test('missing author identities never request or expose an unowned collection', async () => {
  const read = reader([{ id: 'unknown' }]);
  for (const id of [undefined, null, '', ' ']) assert.equal((await read.get(id)).length, 0);
  assert.equal(read.count(), 0);
});
