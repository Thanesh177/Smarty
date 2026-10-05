import test from 'node:test';
import assert from 'node:assert/strict';
import { explanationSections, explanationBlocks, DETAILED_EXPLANATION_VERSION } from './explanationFormat.js';

test('supports saved and generated heading formats without false matches', () => {
  const sections = explanationSections('Intro text\n\n### Core idea\nA precise idea.\n\n**Worked example**: Start at 2.\n\nWhy it matters in daily life is not a heading.');
  assert.equal(sections.length, 3);
  assert.equal(sections[1].heading, 'Core idea');
  assert.equal(sections[2].kind, 'example');
  assert.match(sections[2].text, /Why it matters in daily life/);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
  assert.equal(DETAILED_EXPLANATION_VERSION, 4);
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
