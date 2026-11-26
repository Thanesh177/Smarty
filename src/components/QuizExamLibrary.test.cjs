const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const path = require('node:path');

function app(file, supplied = {}) {
  const code = buildSync({ entryPoints:[path.join(__dirname,file)],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime','lucide-react'] }).outputFiles[0].text;
  let cursor = 0;
  const states = [], events = [], scope = {exports:{}};
  const jsx = (type,props) => ({type,props:props || {}});
  vm.runInNewContext(code,{module:scope,exports:scope.exports,require(name) {
    if (name === 'react') return {useMemo:fn => fn(),useState(initial) {
      const key = cursor++; if (!(key in states)) states[key] = initial;
      return [states[key],next => { states[key] = typeof next === 'function' ? next(states[key]) : next; }];
    }};
    if (name === 'react/jsx-runtime') return {jsx,jsxs:jsx};
    if (name === 'lucide-react') return new Proxy({},{get:(_,key) => key});
    throw Error(name);
  }});
  const props = {onChoose:value => events.push(value),onStart:value => events.push(value),onAnswered:value => events.push(value),...supplied};
  const render = () => {cursor = 0; return scope.exports.default(props);};
  const find = (node,predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(item => find(item,predicate))
    : [...(predicate(node) ? [node] : []),...find(node.props?.children,predicate)];
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  return {render,find,text,events};
}
test('exam search finds named tracks by subject and opens a scoped area', () => {
  const h = app('QuizExamLibrary.jsx');
  h.find(h.render(),node => node.type === 'input')[0].props.onChange({target:{value:'cybersecurity'}});
  const matches = h.find(h.render(),node => node.type === 'button');
  assert.equal(matches.length,1); assert.match(h.text(matches[0]),/CompTIA Security/);
  matches[0].props.onClick(); assert.equal(h.events[0],'security-plus-701');
  const detail = app('QuizExamLibrary.jsx',{examId:'terraform-associate-004'});
  const tree = detail.render();
  assert.match(detail.text(tree),/Not affiliated|Not a complete/);
  detail.find(tree,node => node.type === 'button' && detail.text(node).startsWith('State and collaboration'))[0].props.onClick();
  assert.equal(detail.events[0].examDomain,'state'); assert.equal(detail.events[0].format,'practice');
});
test('optional repair requires a choice, can be answered once and stays separate from round scoring', () => {
  const question = {q:'Which control prevents simultaneous changes?',options:['Locking','Naming','Duplicating','Printing'],answer:'Locking',explanation:'Locking coordinates writers; it does not replace access controls or backups.'};
  const h = app('QuizRepairCheck.jsx',{question});
  let tree = h.render();
  h.find(tree,node => node.type === 'button')[0].props.onClick(); tree = h.render();
  let check = h.find(tree,node => node.type === 'button' && h.text(node) === 'Check this answer')[0];
  assert.equal(check.props.disabled,true);
  h.find(tree,node => node.type === 'button' && h.text(node) === 'Locking')[0].props.onClick();
  tree = h.render(); check = h.find(tree,node => node.type === 'button' && h.text(node) === 'Check this answer')[0];
  assert.equal(check.props.disabled,false); check.props.onClick(); tree = h.render();
  assert.equal(h.events.length,1); assert.equal(h.events[0].isCorrect,true);
  assert.equal(h.find(tree,node => node.type === 'button' && !node.props.disabled).length,0);
  assert.match(h.text(tree),/does not change your first answer or round score/);
  assert.match(h.text(tree),/Locking coordinates writers/);
});
