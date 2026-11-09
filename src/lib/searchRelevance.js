const WORDS = /[\p{L}\p{M}\p{N}+#]+/gu;
const MAX_QUERY = 120;

// Small, explicit concept bridges keep recommendations explainable. Related
// subjects are not treated as interchangeable names for the same subject.
const CONCEPTS = [
  [['artificial intelligence', 'ai'], ['machine learning', 'deep learning', 'neural networks', 'robotics', 'ai ethics']],
  [['machine learning', 'ml'], ['artificial intelligence', 'data science', 'deep learning', 'statistics']],
  [['programming', 'coding', 'software development'], ['software systems', 'computer science', 'algorithms', 'databases']],
  [['cybersecurity', 'cyber security', 'infosec'], ['cryptography', 'computer networks', 'online privacy']],
  [['cryptography', 'encryption', 'cryptographic'], ['cybersecurity', 'mathematics', 'computer networks']],
  [['astronomy', 'stargazing'], ['cosmology', 'cosmos', 'space', 'planets', 'universe']],
  [['space', 'outer space'], ['astronomy', 'cosmology', 'cosmos', 'spaceflight', 'planets']],
  [['cosmology', 'cosmos', 'universe'], ['astronomy', 'space', 'black holes', 'gravity']],
  [['moon', 'lunar science'], ['astronomy', 'space', 'planets']],
  [['climate change', 'global warming', 'climate'], ['weather', 'environment', 'ecology', 'sustainability', 'energy']],
  [['weather', 'meteorology', 'rain', 'storms'], ['climate change', 'earth science']],
  [['ecology', 'ecosystems', 'ecosystem'], ['environment', 'biodiversity', 'biology', 'zoology', 'botany']],
  [['zoology', 'animals', 'wildlife'], ['biology', 'ecology', 'biodiversity', 'nature']],
  [['botany', 'plants', 'plant science'], ['biology', 'ecology', 'agriculture']],
  [['marine biology', 'sea creatures', 'marine life'], ['oceanography', 'ocean', 'ecosystems', 'zoology']],
  [['microbiology', 'microorganisms', 'microbes'], ['biology', 'immunology', 'genetics']],
  [['genetics', 'genes', 'dna', 'genomics'], ['biology', 'evolution', 'microbiology', 'human body']],
  [['immunology', 'immune system', 'immunity'], ['microbiology', 'biology', 'human body', 'health']],
  [['human body', 'human biology', 'anatomy', 'physiology'], ['biology', 'health', 'neuroscience']],
  [['neuroscience', 'brain', 'brain function', 'human brain'], ['psychology', 'memory', 'learning', 'human biology']],
  [['psychology', 'human behavior', 'mind'], ['decision making', 'mental health', 'neuroscience', 'memory', 'cognitive science']],
  [['cognitive psychology', 'cognitive', 'cognition', 'cognitive science', 'cognitive bias'], ['psychology', 'neuroscience', 'memory', 'learning theory', 'scientific method']],
  [['sleep', 'rest'], ['health', 'mental health', 'memory', 'brain function']],
  [['nutrition', 'diet'], ['health', 'food science', 'fitness']],
  [['food science', 'food chemistry'], ['chemistry', 'nutrition', 'agriculture']],
  [['agriculture', 'farming', 'crops'], ['botany', 'food science', 'ecology', 'soil science']],
  [['personal finance', 'money', 'budgeting'], ['finance', 'economics', 'investing', 'saving']],
  [['stock market', 'stocks', 'equities'], ['investing', 'trading', 'finance', 'economics']],
  [['startups', 'startup', 'entrepreneurship'], ['business', 'marketing', 'finance', 'innovation']],
  [['marketing', 'advertising'], ['consumer behavior', 'psychology', 'business', 'startups']],
  [['economics', 'economy'], ['global economy', 'finance', 'trade', 'economic history']],
  [['ancient civilizations', 'ancient history'], ['archaeology', 'ancient empires', 'world history', 'trade routes']],
  [['archaeology', 'archeology'], ['anthropology', 'ancient civilizations', 'history']],
  [['ethics', 'moral philosophy'], ['philosophy', 'society', 'law', 'decision making']],
  [['literature', 'books', 'fiction'], ['poetry', 'culture', 'history']],
  [['art', 'arts', 'visual arts'], ['art history', 'photography', 'design', 'culture']],
  [['music theory', 'music', 'harmony'], ['mathematics', 'acoustics', 'sound']],
  [['photography', 'photos'], ['filmmaking', 'art', 'optics', 'design']],
  [['architecture', 'building design'], ['engineering', 'infrastructure', 'materials science', 'product design']],
  [['mathematics', 'math', 'maths'], ['statistics', 'probability', 'physics', 'logic']],
  [['statistics', 'stats'], ['probability', 'mathematics', 'data science', 'scientific method']],
  [['chemistry', 'chemical reactions'], ['materials science', 'food science', 'biochemistry', 'scientific method']],
  [['physics'], ['gravity', 'energy', 'materials science', 'astronomy']],
];

export function normalizeSearchText(value) {
  return (String(value ?? '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').match(WORDS) || []).join(' ');
}

const conceptByTerm = new Map(CONCEPTS.flatMap(concept => concept[0].map(term => [term, concept])));
// This spelling is otherwise equally close to physiology and psychology.
const preferredCorrections = new Map([['phycoology', 'psychology']]);

function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) return oneEditApart(b, a);
  let start = 0;
  while (start < a.length && a[start] === b[start]) start++;
  if (a.length < b.length) return a.slice(start) === b.slice(start + 1);
  if (a.slice(start + 1) === b.slice(start + 1)) return true;
  return a[start] === b[start + 1] && a[start + 1] === b[start]
    && a.slice(start + 2) === b.slice(start + 2);
}

function twoEditsApart(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  let start = 0;
  while (start < a.length && a[start] === b[start]) start++;
  const left = a.slice(start);
  const right = b.slice(start);
  return oneEditApart(left.slice(1), right.slice(1))
    || oneEditApart(left.slice(1), right)
    || oneEditApart(left, right.slice(1))
    || (left[0] === right[1] && left[1] === right[0] && oneEditApart(left.slice(2), right.slice(2)));
}

function uniqueConceptMatch(term, test) {
  let found = null;
  for (const [name, concept] of conceptByTerm) {
    if (!test(term, name)) continue;
    if (found && found !== concept) return false;
    found = concept;
  }
  return found;
}

function findConcept(term) {
  const exact = conceptByTerm.get(preferredCorrections.get(term) || term);
  if (exact) return exact;
  // For longer queries, allow two mistakes only in the small concept index,
  // not against every result. An ambiguous correction expands nothing.
  if (term.length < 5) return null;
  const close = uniqueConceptMatch(term, oneEditApart);
  if (close !== null || term.length < 8) return close || null;
  return uniqueConceptMatch(term, twoEditsApart) || null;
}

function querySubject(term) {
  return term
    .replace(/^(?:what (?:is|are)|(?:tell me|learn|read) about) /, '')
    .replace(/^how (?:does|do) (.+) work$/, '$1');
}

function conceptInPhrase(phrase) {
  if (!phrase.includes(' ')) return null;
  const text = ` ${phrase} `;
  let found = null;
  for (const [term, concept] of conceptByTerm) {
    if (term.length < 4 || !text.includes(` ${term} `)) continue;
    if (found && found !== concept) return null;
    found = concept;
  }
  return found;
}

export function getPreferredSearchQuery(query) {
  const term = normalizeSearchText(query).slice(0, MAX_QUERY);
  return findConcept(querySubject(term))?.[0][0] || String(query ?? '').trim();
}

function buildVariants(query, related) {
  const term = normalizeSearchText(String(query ?? '').slice(0, MAX_QUERY));
  if (!term) return [];
  const subject = related ? querySubject(term) : term;
  const concept = related ? findConcept(subject) || conceptInPhrase(subject) : null;
  const variants = [[term, 1]];
  if (subject !== term) variants.push([subject, .96]);
  if (concept) {
    for (const synonym of concept[0]) if (synonym !== subject) variants.push([synonym, .86]);
    for (const neighbor of concept[1]) variants.push([neighbor, .70]);
  }
  return variants.map(([phrase, weight]) => ({
    phrase, words: phrase.split(' '), weight,
    wholeWordOnly: related && phrase.length <= 3 && conceptByTerm.has(phrase),
  }));
}

function scorePhrase(candidate, { phrase, words, wholeWordOnly }, allowFuzzy) {
  if (candidate === phrase) return 160;
  if (` ${candidate} `.includes(` ${phrase} `)) return 144;
  if (wholeWordOnly) return 0;
  if (candidate.startsWith(phrase)) return 132;

  const candidateWords = candidate.split(' ');
  let weakest = 116;
  for (const word of words) {
    let best = 0;
    for (const other of candidateWords) {
      if (word === other) { best = 116; break; }
      if (word.length >= 2 && other.startsWith(word)) best = Math.max(best, 104);
      else if (allowFuzzy && word.length >= 5 && other.length >= 4 && oneEditApart(word, other)) best = Math.max(best, 92);
    }
    if (!best) return 0;
    weakest = Math.min(weakest, best);
  }
  return weakest;
}

function scoreField(values, variants, fuzzy = true) {
  let best = 0;
  for (const value of Array.isArray(values) ? values : [values]) {
    const normalized = normalizeSearchText(value);
    if (!normalized) continue;
    for (const variant of variants) {
      best = Math.max(best, scorePhrase(normalized, variant, fuzzy && variant.weight >= .96) * variant.weight);
    }
  }
  return best;
}

const empty = () => '';
const identity = value => value;

export function rankSearchMatches(items, query, { title = identity, keywords = empty, context = empty, limit = Infinity, related = true } = {}) {
  const variants = buildVariants(query, related);
  if (!variants.length) return String(query ?? '').trim() ? [] : items.slice(0, limit);
  return items.map((item, index) => ({ item, index, score: Math.max(
    scoreField(title(item), variants),
    scoreField(keywords(item), variants) * .8,
    scoreField(context(item), variants, false) * .55,
  ) })).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.item);
}
