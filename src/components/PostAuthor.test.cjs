const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function renderAuthor({ post, profile, user = { userId: 'viewer' }, resolve = true }) {
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
  return { tree: module.exports.default({ post, resolve }), get query() { return query; } };
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
