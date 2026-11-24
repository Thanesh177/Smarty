const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function harness() {
  const values = [], effects = [];
  let cursor = 0;
  const module = { exports: {} };
  const compiled = transformSync(fs.readFileSync(__dirname + '/PostVocabulary.jsx', 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    window: { innerWidth: 390, innerHeight: 844 }, document: { body: {} },
    require(name) {
      if (name === 'react') return {
        memo: component => component, useId: () => 'meaning-heading', useRef: () => ({ current: null }),
        useMemo: compute => compute(), useEffect: effect => effects.push(effect),
        useState(initial) {
          const slot = cursor++;
          if (!(slot in values)) values[slot] = initial;
          return [values[slot], value => { values[slot] = typeof value === 'function' ? value(values[slot]) : value; }];
        },
      };
      if (name === 'react-dom') return { createPortal: children => children };
      if (name === '../lib/postGlossary') return require('../lib/postGlossary.js');
      if (name === '../lib/postVocabularyDialog') {
        const dialog = require('../lib/postVocabularyDialog.js');
        return { ...dialog, vocabularyPanelPosition: rect => dialog.vocabularyPanelPosition(rect, { innerWidth: 390, innerHeight: 844 }) };
      }
      if (name.endsWith('.css')) return {};
      return require(name);
    },
  });
  return {
    render: props => { cursor = 0; effects.length = 0; return module.exports.default(props); },
  };
}
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
};
const terms = [{ term: 'chlorophyll', meaning: 'The green substance in a leaf that absorbs light used to make sugars.' }];
const props = { text: 'A leaf contains chlorophyll.', terms };

test('legacy posts and a loading single-post view remain safe without a glossary', () => {
  const tree = harness().render({ text: props.text });
  assert.equal(find(tree, node => node.type === 'button').length, 0);
  assert.equal(find(tree, node => node.props?.role === 'dialog').length, 0);
});

test('a word opens its saved explanation without navigating or making an API request', () => {
  const view = harness();
  const word = find(view.render(props), node => node.type === 'button')[0];
  assert.equal(word.props['aria-label'], 'Explain chlorophyll');
  assert.equal(word.props.type, 'button');
  assert.equal(word.props['aria-expanded'], false);
  let stopped = false;
  word.props.onClick({ stopPropagation: () => { stopped = true; }, currentTarget: { getBoundingClientRect: () => ({ left: 310, bottom: 760 }) } });
  assert.ok(stopped);
  const tree = view.render(props);
  const dialog = find(tree, node => node.props?.role === 'dialog')[0];
  assert.equal(dialog.props['aria-modal'], 'true');
  assert.equal(dialog.props['aria-describedby'], 'meaning-heading-meaning');
  assert.equal(find(tree, node => node.props?.className === 'post-vocabulary-word')[0].props['aria-expanded'], true);
  assert.equal(dialog.props.style.left, 34);
  assert.equal(dialog.props.style.width, 340);
  assert.ok(dialog.props.style.top < 760, 'Panel stays inside a phone viewport');
  assert.equal(find(dialog, node => node.type === 'p')[0].props.children, terms[0].meaning);
  find(dialog, node => node.props?.['aria-label'] === 'Close word explanation')[0].props.onClick();
  assert.equal(find(view.render(props), node => node.props?.role === 'dialog').length, 0);
});

test('source or definition changes immediately remove an open stale explanation', () => {
  for (const change of [{ text: 'The post was edited.' }, { terms: [] }]) {
    const view = harness();
    find(view.render(props), node => node.type === 'button')[0].props.onClick({ stopPropagation() {}, currentTarget: { getBoundingClientRect: () => ({ left: 20, bottom: 100 }) } });
    assert.equal(find(view.render({ ...props, ...change }), node => node.props?.role === 'dialog').length, 0);
  }
});

test('word explanations are wired into feed and reading views, but not translated text', () => {
  for (const path of ['pages/FeedPage.jsx', 'pages/ReelDetailPage.jsx', 'components/PostCard.jsx']) {
    const source = fs.readFileSync(__dirname + '/../' + path, 'utf8');
    assert.match(source, /usePostVocabulary\(post\)/);
    assert.match(source, /<PostVocabulary text=/);
  }
  const source = fs.readFileSync(__dirname + '/PostVocabulary.jsx', 'utf8');
  assert.doesNotMatch(source, /\bfetch\(|\bpostApi\.|\baxios\./);
  assert.match(source, /manageVocabularyDialog/);
  assert.doesNotMatch(source, /export function usePostVocabulary/);
  assert.match(source, /event\.target === event\.currentTarget/);
  const feed = fs.readFileSync(__dirname + '/../pages/FeedPage.jsx', 'utf8');
  assert.match(feed, /isTranslated && translatedText \? translatedText : <PostVocabulary/);
  const card = feed.slice(feed.indexOf('const FeedPostCard'), feed.indexOf('export default function FeedPage'));
  assert.doesNotMatch(card, /role="button"/);
  assert.match(card, /className="post-learning-link"/);
  assert.match(card, /to=\{`\/post-ai\/\$\{encodeURIComponent\(postId\)\}`\}/);
});
