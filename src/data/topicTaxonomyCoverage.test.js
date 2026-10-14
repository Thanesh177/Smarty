import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_TOPICS, getMainTopicDefinition, postMatchesMainTopic } from './topicTaxonomy.js';

test('expanded learning subjects resolve within the existing main categories', () => {
  const mapping = {
    Zoology: 'life-sciences', Botany: 'life-sciences', 'Marine Biology': 'life-sciences',
    Cosmology: 'earth-space', 'Scientific Method': 'science-mathematics',
    'Scientific Discoveries': 'science-mathematics', 'Scientific Mysteries': 'science-mathematics',
    Education: 'mind-health', Literature: 'arts-design',
    Animals: 'life-sciences', Plants: 'life-sciences', 'Sea Creatures': 'life-sciences',
    Cosmos: 'earth-space', Universe: 'earth-space', Books: 'arts-design',
    Experiments: 'science-mathematics',
  };
  for (const [topic, main] of Object.entries(mapping)) {
    assert.equal(getMainTopicDefinition(topic)?.id, main, topic);
    assert.equal(postMatchesMainTopic({ topic }, main, [topic]), true);
    assert.equal(postMatchesMainTopic({ topic }, 'money-business', [topic]), false);
  }
  assert.ok(MAIN_TOPICS.length >= 10 && MAIN_TOPICS.length <= 15);
});
