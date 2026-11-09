const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('esbuild');

const source = fs.readFileSync(__dirname + '/games/QuizArcade.jsx', 'utf8');
const scope = { exports: {} };
const compiled = transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
new Function('module', 'exports', 'require', compiled)(scope, scope.exports, require);
const { ArcadeLobby, ArcadeProgress, ArcadeRecap } = scope.exports;

test('featured challenges dispatch their subject directly from the lobby', () => {
  const launched = [];
  const lobby = ArcadeLobby({ onChoose: id => launched.push(id) });
  const buttons = lobby.props.children[1].props.children;
  assert.ok(buttons.every(button => button.type === 'button'));
  buttons[1].props.onClick();
  assert.deepEqual(launched, ['science-mathematics']);
});

test('the progress strip distinguishes the current step and exposes its position', () => {
  const strip = ArcadeProgress({ step: 2, total: 3, label: 'Challenge progress' });
  assert.equal(strip.props.role, 'progressbar');
  assert.equal(strip.props['aria-valuetext'], 'Step 2 of 3');
  assert.deepEqual(strip.props.children.map(item => item.props.className), ['is-complete', 'is-current', undefined]);
});

test('the recap includes an accessible unsure outcome and a review shortcut', () => {
  let opened = false;
  const recap = ArcadeRecap({ answers: [
    { isCorrect: true, confidence: 'unsure' },
    { isCorrect: false },
    { isCorrect: true },
  ], onReview: () => { opened = true; } });
  const [rounds, review] = recap.props.children;
  const [unsure, incorrect, correct] = rounds.props.children;
  assert.equal(unsure.props.className, 'is-unsure');
  assert.equal(unsure.props.children[0].props.children.join(''), 'Round 1: Correct, marked unsure');
  assert.equal(incorrect.props.className, 'is-incorrect');
  assert.equal(correct.props.className, 'is-correct');
  review.props.onClick();
  assert.equal(opened, true);
});
