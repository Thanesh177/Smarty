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
test('all four difficulty choices are direct and challenge uses hard questions', () => {
  assert.deepEqual(Array.from(moduleScope.exports.QUIZ_LEVELS), ['Easy','Medium','Hard','Challenge']);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Challenge').difficultyPreference, 'Hard');
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Challenge').challengeMode, true);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('Easy').challengeMode, false);
  assert.equal(moduleScope.exports.getQuizPracticeLevel('unknown').difficultyPreference, 'Easy');
});
test('difficulty and question/game formats keep independent selected states', () => {
  const levels=[],modes=[];
  const tree = Controls({ level:'Medium', mode:'mixed', sound:false, onLevel:v=>levels.push(v), onMode:v=>modes.push(v), onSound(){} });
  const children=tree.props.children;
  const buttons=children[1].props.children;
  assert.equal(buttons[1].props['aria-pressed'],true);
  buttons[3].props.onClick(); assert.equal(levels[0],'Challenge');
  const formats=children[4].props.children;
  assert.equal(formats[1].props['aria-pressed'],true);
  formats[0].props.onClick(); assert.equal(modes[0],'practice');
});
test('quiz no longer renders the removed setup or saved-review sections', () => {
  const page = fs.readFileSync(__dirname+'/../pages/QuizPage.jsx','utf8');
  assert.doesNotMatch(page,/Worth another look|Study setup|quiz-saved-review/);
  assert.match(page,/!topic\.challengeMode && <details/);
  assert.match(page,/Review lesson notes/);
});
