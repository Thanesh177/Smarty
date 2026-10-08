import test from 'node:test';
import assert from 'node:assert/strict';
import { explanationSections, readingLessonSections, explanationBlocks, DETAILED_EXPLANATION_VERSION } from './explanationFormat.js';

test('supports saved and generated heading formats without false matches', () => {
  const sections = explanationSections('Intro text\n\n### Core idea\nA precise idea.\n\n**Worked example**: Start at 2.\n\nWhy it matters in daily life is not a heading.');
  assert.equal(sections.length, 3);
  assert.equal(sections[1].heading, 'Core idea');
  assert.equal(sections[2].kind, 'example');
  assert.match(sections[2].text, /Why it matters in daily life/);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
  assert.equal(DETAILED_EXPLANATION_VERSION, 5);
});

test('narrative lessons keep the opening and subject-specific chapter titles', () => {
  const sections = readingLessonSections('Picture a prediction that is wrong.\n\n## Turning an error into a direction\nA parameter changes after measuring the loss.\n\n## One delivery: two possible updates\nStart with a hypothetical estimate.\n\n### When a smaller step helps\nChanging the learning rate changes the update.');
  assert.equal(sections.length, 4);
  assert.equal(sections[0].heading, '');
  assert.match(sections[0].text, /Picture a prediction/);
  assert.equal(sections[1].heading, 'Turning an error into a direction');
  assert.equal(sections[2].heading, 'One delivery: two possible updates');
  assert.equal(sections[3].heading, 'When a smaller step helps');
  assert.equal(new Set(sections.map(section => section.id)).size, 4);
});

test('old saved guides become continuous prose without losing examples or terms', () => {
  const original = 'Core idea\nAn error provides a signal.\n\nEssential terms\n- Loss: the size of the error.\n\nHow it works\n1. Measure the error.\n2. Adjust the parameter.\n\nWorked example\nA value moves from 2 to 1.7.\n\nWhy it matters\nThe changed value changes the prediction.';
  const sections = readingLessonSections(original);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].heading, '');
  assert.match(sections[0].text, /Loss: the size/);
  assert.match(sections[0].text, /2\. Adjust the parameter/);
  assert.match(sections[0].text, /2 to 1\.7/);
  assert.doesNotMatch(sections[0].text, /Core idea|Why it matters|Worked example/);
  assert.equal(explanationSections(original).length, 5, 'Chat responses keep their original formatting');
  assert.deepEqual(readingLessonSections('## Simple explanation: Keep this opening.\n\n## Why it matters:\nKeep the consequence.').map(({heading, text}) => ({heading, text})), [
    {heading:'', text:'Keep this opening.\n\nKeep the consequence.'},
  ]);
});

test('arbitrary chapter text and HTML remain inert strings; prose is not a heading', () => {
  const sections = readingLessonSections('Why a cache helps: this sentence is ordinary prose.\n\n## <img src=x onerror=alert(1)>\nA label is rendered as text, never HTML.');
  assert.equal(sections.length, 2);
  assert.equal(sections[0].heading, '');
  assert.equal(sections[1].heading, '<img src=x onerror=alert(1)>');
  assert.equal(readingLessonSections(`## ${'x'.repeat(120)}\nToo long.`)[0].heading, '');
});
test('keeps introductory text, numbered steps, continuations, and outcome separate', () => {
  assert.deepEqual(explanationBlocks('Start with a weight of 2.\n\n1. Compute the update.\n   Multiply 0.1 by 3.\n\n2. Subtract 0.3 from 2.\n\nThe result is 1.7.'), [
    { type: 'p', text: 'Start with a weight of 2.' },
    { type: 'ol', start: 1, items: ['Compute the update. Multiply 0.1 by 3.', 'Subtract 0.3 from 2.'] },
    { type: 'p', text: 'The result is 1.7.' },
  ]);
});
test('normalizes terms, line endings and empty sections without executing HTML', () => {
  assert.deepEqual(explanationBlocks('- Loss: the error.\r\n- Gradient: direction of change.'), [{type:'ul', start:undefined, items:['Loss: the error.', 'Gradient: direction of change.']}]);
  assert.equal(explanationSections('Core idea\n\nHow it works\n<script>alert(1)</script>')[0].text, '<script>alert(1)</script>');
  assert.deepEqual(explanationSections(null), []);
});
