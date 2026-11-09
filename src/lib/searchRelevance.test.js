import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_TOPIC_LABELS, MAIN_TOPICS } from '../data/topicTaxonomy.js';
import { getPreferredSearchQuery, normalizeSearchText, rankSearchMatches } from './searchRelevance.js';
import { rankTopicChoices } from './topicSearch.js';

test('exact titles and phrases outrank related and body-only results', () => {
  const records = [
    { title: 'Early railroads', body: 'Machine learning' },
    { title: 'Artificial Intelligence' },
    { title: 'Machine learning in practice' },
    { title: 'Machine Learning' },
  ];
  assert.deepEqual(rankSearchMatches(records, 'machine learning', {
    title: record => record.title, context: record => record.body,
  }).map(record => record.title), [
    'Machine Learning', 'Machine learning in practice', 'Artificial Intelligence', 'Early railroads',
  ]);
});

test('a swapped or missing letter still finds the specific subject', () => {
  assert.equal(rankSearchMatches(['Physics', 'Chemistry'], 'phyiscs')[0], 'Physics');
  assert.equal(rankSearchMatches(['Neuroscience', 'Psychology'], 'psycology')[0], 'Psychology');
  assert.equal(getPreferredSearchQuery('pyschology'), 'psychology');
  assert.equal(getPreferredSearchQuery('phycoology'), 'psychology');
  assert.equal(rankTopicChoices(MAIN_TOPIC_LABELS, 'astrnomy')[0], 'Earth & Space');
});

test('cognitive search connects psychology and science without requiring those words', () => {
  const matches = rankTopicChoices(['Psychology', 'Neuroscience', ...MAIN_TOPIC_LABELS], 'cognitive');
  assert.ok(matches.includes('Psychology'));
  assert.ok(matches.includes('Science & Mathematics'));
  assert.deepEqual(rankTopicChoices(MAIN_TOPIC_LABELS, 'cognitive'), ['Mind & Health', 'Science & Mathematics', 'Life Sciences']);
  assert.equal(rankTopicChoices(MAIN_TOPIC_LABELS, 'phycoology')[0], 'Mind & Health');
});

test('related ideas work across disciplines, including in longer search phrases', () => {
  const topics = MAIN_TOPICS.flatMap(topic => [topic.label, ...topic.topics]);
  for (const [query, expected] of [
    ['why cognitive bias happens', ['Psychology', 'Scientific Method']],
    ['genes', ['Genetics', 'Biology']],
    ['farming', ['Agriculture', 'Botany', 'Food Science']],
    ['encryption', ['Cryptography', 'Cybersecurity', 'Mathematics']],
    ['advertising', ['Marketing', 'Consumer Behavior', 'Psychology']],
    ['harmony', ['Music Theory', 'Mathematics']],
  ]) {
    const matches = rankTopicChoices(topics, query, 8);
    for (const topic of expected) assert.ok(matches.includes(topic), `${query} should surface ${topic}: ${matches}`);
  }
  assert.deepEqual(rankSearchMatches(['Psychology', 'Climatology'], 'brain and climate'), []);
});

test('short concepts expand without matching unrelated word fragments', () => {
  assert.deepEqual(rankSearchMatches(['Air pressure', 'Machine Learning', 'Artificial Intelligence', 'AI'], 'ai'), [
    'AI', 'Artificial Intelligence', 'Machine Learning',
  ]);
  assert.equal(rankTopicChoices(MAIN_TOPIC_LABELS, 'art')[0], 'Arts & Design');
  assert.ok(!rankTopicChoices(MAIN_TOPIC_LABELS, 'art').includes('Technology'));
  assert.deepEqual(rankTopicChoices(MAIN_TOPIC_LABELS, 'rain'), ['Earth & Space']);
  assert.deepEqual(rankTopicChoices(MAIN_TOPIC_LABELS, 'zzyzx'), []);
});

test('the picker and directory rank nested subjects and related fields consistently', () => {
  const picker = ['All', ...MAIN_TOPIC_LABELS];
  assert.equal(rankTopicChoices(picker, 'all posts')[0], 'All');
  for (const [query, first, related] of [
    ['anatomy', 'Life Sciences', 'Mind & Health'],
    ['ancient history', 'History', 'Society & Ideas'],
    ['global warming', 'Earth & Space', 'Engineering'],
  ]) {
    const labels = rankTopicChoices(picker, query);
    assert.equal(labels[0], first);
    assert.ok(labels.includes(related));
    assert.deepEqual(labels, rankTopicChoices(MAIN_TOPICS, query).map(topic => topic.label));
  }
  assert.deepEqual(rankTopicChoices(picker, ' '), picker);
  assert.deepEqual(rankTopicChoices(picker, 'anatomy', 1), ['Life Sciences']);
});

test('search supports accents, punctuation, non-Latin text and natural subject phrases', () => {
  assert.equal(normalizeSearchText('  Éarth & Space  '), 'earth space');
  assert.equal(rankSearchMatches(['C#', 'C++'], 'c++')[0], 'C++');
  assert.equal(rankSearchMatches(['東京 鉄道', '京都 鉄道'], '東京')[0], '東京 鉄道');
  assert.equal(rankTopicChoices(MAIN_TOPIC_LABELS, 'What is machine learning?')[0], 'Technology');
  assert.equal(getPreferredSearchQuery('constructor'), 'constructor');
  assert.deepEqual(rankSearchMatches(['Health', 'Hiking'], '!?'), []);
});

test('person search tolerates typos without expanding subject synonyms', () => {
  assert.deepEqual(rankSearchMatches(['Neuroscience', 'Brain', 'Brian'], 'Brain', { related: false }), ['Brain', 'Brian']);
});
