import { getMainTopicDefinition, getMainTopicSearchTerms } from '../data/topicTaxonomy.js';
import { rankSearchMatches } from './searchRelevance.js';

const labelOf = topic => typeof topic === 'string' ? topic : topic.label;

export function rankTopicChoices(topics, query, limit = Infinity) {
  return rankSearchMatches(topics, query, {
    title: topic => labelOf(topic) === 'All' ? 'All posts' : labelOf(topic),
    keywords: topic => getMainTopicSearchTerms(labelOf(topic)),
    context: topic => {
      const label = labelOf(topic);
      return getMainTopicSearchTerms(label) ? getMainTopicDefinition(label)?.description : '';
    },
    limit,
  });
}
