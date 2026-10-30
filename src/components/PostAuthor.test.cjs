const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function renderAuthor({ post, profile, user = { userId: 'viewer' }, resolve = true, profileData, state }) {
  let query;
  const compiled = transformSync(fs.readFileSync(__dirname + '/PostAuthor.jsx', 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: name => {
      if (name === 'react-router-dom') return { Link: 'link' };
      if (name === '@tanstack/react-query') return { useQuery: options => { query = options; return { data: profile }; } };
      if (name === '../contexts/AuthContext') return { useAuth: () => ({ user }) };
      if (name === '../api/client') return { creatorApi: { getProfile: async id => ({ userId: id }) } };
      if (name === '../lib/postAuthor') return require('../lib/postAuthor.js');
      if (name.endsWith('.css')) return {};
      return require(name);
    },
  });
  return { tree: module.exports.default({ post, resolve, profileData, state }), get query() { return query; } };
}

test('clicking the public username targets the author, never the signed-in viewer', () => {
  const result = renderAuthor({ post: { authorId: 'another user', author: 'private@example.com' }, profile: { username: 'reader' } });
  assert.equal(result.tree.props.to, '/creator/another%20user');
  assert.equal(result.tree.props.children, 'reader');
  assert.equal(result.query.queryKey.join(':'), 'post-author-label:viewer:another user');
  let stopped = false;
  result.tree.props.onClick({ stopPropagation: () => { stopped = true; } });
  assert(stopped, 'Opening the author does not also open the post');
});

test('missing profiles retain a safe username fallback without exposing email', () => {
  const result = renderAuthor({ post: { authorId: 'other', author: 'private@example.com' } });
  assert.equal(result.tree.props.children, 'Smarty member');
  assert.equal(result.tree.props.to, '/creator/other');
});

test('signed-out and distant video labels do not request protected profiles', () => {
  assert.equal(renderAuthor({ post: { authorId: 'other' }, user: null }).query.enabled, false);
  assert.equal(renderAuthor({ post: { authorId: 'other' }, resolve: false }).query.enabled, false);
  assert.equal(renderAuthor({ post: { authorId: 'other' }, user: { userId: 'second' } }).query.queryKey[1], 'second');
});

test('system or unidentified authors never render a broken profile URL', () => {
  for (const post of [{ authorId: 'smarty-ai' }, { author: 'private@example.com' }]) {
    const result = renderAuthor({ post });
    assert.equal(result.tree.type, 'span');
    assert.equal(result.tree.props.to, undefined);
    assert.equal(result.query.enabled, false);
  }
});

test('feed authors reuse the enriched profile and preserve normal link navigation', () => {
  const result = renderAuthor({ post: { creator: { sub: 'author-123' }, viewerId: 'viewer' },
    profileData: { username: 'curious_reader' }, resolve: false,
    state: { fromPostId: 'post-1', creatorId: 'viewer', databaseAuthorId: 'viewer' } });
  assert.equal(result.tree.props.to, '/creator/author-123');
  assert.equal(result.tree.props.children, 'curious_reader');
  assert.equal(result.tree.props.state.fromPostId, 'post-1');
  assert.equal(result.tree.props.state.creatorId, 'author-123');
  assert.equal(result.tree.props.state.databaseAuthorId, 'author-123');
  assert.equal(result.query.enabled, false, 'The feed already batches profile lookups');
  let stopped = false, prevented = false;
  result.tree.props.onClick({ stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } });
  assert.equal(stopped, true);
  assert.equal(prevented, false, 'React Router retains normal and modified link clicks');
});

test('signed-out readers still get a link to the post author instead of their own profile', () => {
  const result = renderAuthor({ post: { ownerId: 'owner-123', username: 'reader' }, user: null });
  assert.equal(result.tree.props.to, '/creator/owner-123');
  assert.equal(result.tree.props.children, 'reader');
  assert.equal(result.query.enabled, false);
});

test('feed, detailed lesson, single post and video views share the author link', () => {
  for (const file of ['pages/FeedPage.jsx', 'pages/PostAiPage.jsx', 'pages/ReelDetailPage.jsx', 'components/PostCard.jsx', 'components/ReelVideo.jsx']) {
    const source = fs.readFileSync(__dirname + '/../' + file, 'utf8');
    assert.match(source, /<PostAuthor\s+post=/, file);
  }
  const feed = fs.readFileSync(__dirname + '/../pages/FeedPage.jsx', 'utf8');
  assert.doesNotMatch(feed, /onOpenCreator|handleOpenCreator/);
});
