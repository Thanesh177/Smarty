const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { transformSync } = require('esbuild');
const source = fs.readFileSync(__dirname + '/QuizPracticeControls.jsx', 'utf8');
const compiled = transformSync(source, { loader:'jsx', jsx:'automatic', format:'cjs' }).code;
const moduleScope = { exports:{} };
vm.runInNewContext(compiled, { module:moduleScope, exports:moduleScope.exports, require });
const Controls = moduleScope.exports.default;
const find = (node,predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(item => find(item,predicate))
  : [...(predicate(node) ? [node] : []),...find(node.props?.children,predicate)];
test('all four difficulty choices are direct and challenge uses hard questions', () => {
  assert.deepEqual(Array.from(moduleScope.exports.QUIZ_LEVELS), ['Easy','Medium','Hard','Challenge']);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Challenge').difficultyPreference, 'Hard');
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Challenge').challengeMode, true);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Easy').challengeMode, false);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('unknown').difficultyPreference, 'Easy');
});
test('difficulty and question/game formats keep independent selected states', () => {
  const levels=[],modes=[];
  const tree = Controls({ level:'Medium', mode:'mixed', sound:false, premiumAccess:true, onLevel:v=>levels.push(v), onMode:v=>modes.push(v), onSound(){} });
  const children=tree.props.children;
  const buttons=children[1].props.children;
  assert.equal(buttons[1].props['aria-pressed'],true);
  buttons[3].props.onClick(); assert.equal(levels[0],'Challenge');
  const formats=find(tree,node => node.props?.['aria-label'] === 'Practice format')[0].props.children;
  assert.equal(formats[1].props['aria-pressed'],true);
  formats[0].props.onClick(); assert.equal(modes[0],'practice');
});
test('exam tracks retain difficulty controls but do not offer a game format they cannot start', () => {
  const tree = Controls({level:'Easy',mode:'mixed',sound:false,questionsOnly:true});
  assert.equal(find(tree,node => node.props?.['aria-label'] === 'Practice format').length,0);
  assert.equal(find(tree,node => node.props?.['aria-label'] === 'Question difficulty').length,1);
  assert.match(tree.props.className,/is-questions-only/);
});
test('free players can select Medium but Hard and Challenge open premium information without changing difficulty', () => {
  const levels=[]; let locked=0;
  const tree=Controls({level:'Easy',mode:'practice',sound:false,onLevel:value=>levels.push(value),onPremiumRequired:()=>locked++});
  const buttons=find(tree,node=>node.props?.['aria-label']==='Question difficulty')[0].props.children;
  buttons[1].props.onClick();
  for (const button of buttons.slice(2)) {
    assert.equal(button.props['data-premium-locked'],true);
    assert.match(button.props['aria-label'],/Premium/);
    button.props.onClick();
  }
  assert.deepEqual(levels,['Medium']); assert.equal(locked,2);
});
test('quiz no longer renders the removed setup or saved-review sections', () => {
  const page = fs.readFileSync(__dirname+'/../pages/QuizPage.jsx','utf8');
  assert.doesNotMatch(page,/Worth another look|Study setup|quiz-saved-review/);
  assert.match(page,/!topic\.conceptId && !topic\.challengeMode && <>/);
  assert.match(page,/Review lesson notes/);
});
