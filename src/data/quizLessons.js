import { EXPANDED_QUIZ_LESSONS } from './quizLessonExpansion.js';

// A lesson connects ideas within one meaningful scope, not an exam syllabus.
// Keep IDs stable: they scope cached questions, attempts and mistake review.
const lesson = (id, title, branch, outcome, concepts) => ({ id, title, branch, outcome, concepts });

const EXISTING_QUIZ_LESSONS = {
  'science-mathematics': [
    lesson('measurement', 'Measure without fooling yourself', 'Scientific thinking', 'Separate accuracy, precision and uncertainty when interpreting a measurement.', ['SI units', 'Significant figures', 'Measurement error']),
    lesson('experiments', 'Design a fair experiment', 'Scientific thinking', 'Identify variables, controls and the conclusions an experiment can actually support.', ['Controls', 'Confounding', 'Replication']),
    lesson('forces', 'Why things move—or stay still', 'Physics', 'Use net force, inertia and acceleration to explain everyday motion.', ['Newton’s laws', 'Force diagrams', 'Friction']),
    lesson('energy', 'Follow the energy', 'Physics', 'Track work, kinetic energy and energy transfers instead of treating energy as something that disappears.', ['Work', 'Kinetic energy', 'Conservation']),
    lesson('circuits', 'Inside an electric circuit', 'Physics', 'Predict how voltage, resistance and circuit layout affect current.', ['Ohm’s law', 'Series circuits', 'Parallel circuits']),
    lesson('waves', 'Light, sound and waves', 'Physics', 'Connect wavelength, frequency and speed to sound, light and interference.', ['Frequency', 'Wave speed', 'Interference']),
    lesson('atoms', 'Build an atom', 'Chemistry', 'Distinguish elements, ions and isotopes by tracking protons, neutrons and electrons.', ['Atomic number', 'Isotopes', 'Ions']),
    lesson('bonds', 'Why atoms bond', 'Chemistry', 'Compare electron sharing, electron transfer and the forces between molecules.', ['Covalent bonds', 'Ionic bonding', 'Polarity']),
    lesson('reactions', 'Read a chemical reaction', 'Chemistry', 'Balance atoms and reason about quantities and limiting reactants.', ['Balancing equations', 'Moles', 'Limiting reactants']),
    lesson('acids', 'Acids, bases and pH', 'Chemistry', 'Interpret the logarithmic pH scale and what neutralization does and does not imply.', ['Hydrogen ions', 'pH', 'Neutralization']),
    lesson('algebra', 'Turn a problem into an equation', 'Mathematics', 'Translate relationships into equations and check whether a solution makes sense.', ['Equations', 'Proportions', 'Functions']),
    lesson('probability', 'Reason about chance', 'Mathematics', 'Work through independent events, conditional probability and misleading intuition.', ['Sample spaces', 'Independence', 'Conditional probability']),
    lesson('statistics', 'What data can really tell you', 'Mathematics', 'Interpret averages, spread and sampling without confusing association with causation.', ['Mean and median', 'Sampling bias', 'Correlation']),
    lesson('calculus', 'Change and accumulation', 'Mathematics', 'Connect derivatives to rates and integrals to accumulated quantities.', ['Rate of change', 'Derivatives', 'Integrals']),
  ],
  'life-sciences': [
    lesson('cells', 'A cell as a working system', 'Cells & molecules', 'Connect cell structures to the jobs that keep a cell alive.', ['Membranes', 'Ribosomes', 'Organelles']),
    lesson('membranes', 'How cells move substances', 'Cells & molecules', 'Explain diffusion, osmosis and active transport using concentration gradients.', ['Diffusion', 'Osmosis', 'Active transport']),
    lesson('enzymes', 'The chemistry of enzymes', 'Cells & molecules', 'Explain catalysis, specificity and how conditions change enzyme activity.', ['Activation energy', 'Active sites', 'Inhibition']),
    lesson('genetics', 'From DNA to inherited traits', 'Genetics & evolution', 'Distinguish genes, alleles and inheritance probabilities from genetic certainty.', ['DNA', 'Alleles', 'Inheritance']),
    lesson('evolution', 'How populations evolve', 'Genetics & evolution', 'Reason about variation, selection and resistance without assuming evolution has a goal.', ['Natural selection', 'Variation', 'Genetic drift']),
    lesson('immunity', 'How the body recognizes threats', 'Human biology', 'Compare innate and adaptive defenses and explain immune memory.', ['Antibodies', 'Immune memory', 'Innate defenses']),
    lesson('respiration', 'Where cellular energy comes from', 'Human biology', 'Follow energy transfers through respiration rather than confusing breathing with ATP production.', ['ATP', 'Cellular respiration', 'Gas exchange']),
    lesson('circulation', 'Blood, oxygen and circulation', 'Human biology', 'Trace circulation and link vessel structure to transport and exchange.', ['Heart chambers', 'Arteries and veins', 'Capillaries']),
    lesson('plants', 'How a plant feeds and grows', 'Living diversity', 'Connect photosynthesis, water transport and gas exchange.', ['Photosynthesis', 'Xylem and phloem', 'Stomata']),
    lesson('microbes', 'The invisible living world', 'Living diversity', 'Distinguish bacteria, viruses and fungi and the roles microbes play.', ['Bacteria', 'Viruses', 'Microbial ecosystems']),
    lesson('marine-life', 'Life beneath the surface', 'Living diversity', 'Explore adaptations to pressure, light and the movement of nutrients in the sea.', ['Marine adaptations', 'Plankton', 'Deep-sea ecosystems']),
  ],
  'earth-space': [
    lesson('orbits', 'Gravity, orbits and seasons', 'Space', 'Explain an orbit as falling motion and separate seasons from distance to the Sun.', ['Gravity', 'Orbital motion', 'Axial tilt']),
    lesson('stars', 'How stars make light', 'Space', 'Connect stellar fusion, mass and a star’s changing life cycle.', ['Fusion', 'Stellar evolution', 'Light spectra']),
    lesson('cosmology', 'Reading the expanding universe', 'Space', 'Understand redshift and the evidence and limits of cosmological models.', ['Expansion', 'Redshift', 'Cosmic background']),
    lesson('geology', 'A planet in motion', 'Earth', 'Connect plate movement to earthquakes, volcanoes and the rock cycle.', ['Plate tectonics', 'Rock cycle', 'Earthquakes']),
    lesson('climate', 'Weather is not climate', 'Earth', 'Distinguish short-term variation from climate trends and explain the greenhouse effect.', ['Greenhouse effect', 'Climate trends', 'Feedbacks']),
    lesson('oceans', 'Oceans, currents and the water cycle', 'Earth', 'Follow heat, salt and water through connected ocean and atmospheric systems.', ['Ocean currents', 'Water cycle', 'Salinity']),
    lesson('food-webs', 'Who depends on whom?', 'Ecology', 'Follow energy and matter through food webs and predict indirect ecosystem effects.', ['Food webs', 'Energy transfer', 'Decomposition']),
    lesson('biodiversity', 'Resilience in a living world', 'Ecology', 'Reason about biodiversity, habitat loss and evidence for conservation decisions.', ['Biodiversity', 'Habitat fragmentation', 'Resilience']),
  ],
  technology: [
    lesson('ai-learning', 'How a model learns', 'AI & data', 'Distinguish training from inference and recognize overfitting and data leakage.', ['Training and inference', 'Overfitting', 'Test data']),
    lesson('neural-networks', 'Inside a neural network', 'AI & data', 'Trace inputs, weights, activations and error-driven updates.', ['Weights', 'Activation functions', 'Gradient descent']),
    lesson('data', 'From raw data to useful evidence', 'AI & data', 'Spot data-quality problems and choose sensible ways to compare results.', ['Data cleaning', 'Evaluation metrics', 'Data leakage']),
    lesson('algorithms', 'Think in algorithms', 'Software', 'Compare search, sorting and algorithmic cost on realistic inputs.', ['Search', 'Sorting', 'Complexity']),
    lesson('databases', 'Ask a database the right question', 'Software', 'Reason about joins, keys, indexes and transactions.', ['SQL joins', 'Indexes', 'Transactions']),
    lesson('networks', 'How the internet delivers a page', 'Systems', 'Trace DNS, transport and HTTP and distinguish encryption from trust.', ['DNS', 'TCP and HTTP', 'TLS']),
    lesson('security', 'Recognize a digital threat', 'Systems', 'Identify phishing, authentication risks and the limits of common defenses.', ['Phishing', 'Authentication', 'Least privilege']),
    lesson('operating-systems', 'What an operating system manages', 'Systems', 'Connect processes, scheduling and virtual memory to application behavior.', ['Processes', 'Scheduling', 'Virtual memory']),
  ],
  engineering: [
    lesson('electronics', 'Signals, switches and circuits', 'Electronics', 'Explain the roles of transistors, capacitors and sensors.', ['Transistors', 'Capacitors', 'Sensors']),
    lesson('materials', 'Choose a material for the job', 'Design & materials', 'Balance strength, toughness, mass and corrosion resistance.', ['Stress and strain', 'Toughness', 'Material selection']),
    lesson('manufacturing', 'From drawing to manufactured part', 'Design & materials', 'Reason about tolerances, process choice and quality checks.', ['Tolerances', 'Manufacturing processes', 'Quality control']),
    lesson('feedback', 'Control a changing system', 'Systems', 'Trace sensors, controllers and actuators through a feedback loop.', ['Feedback', 'Setpoints', 'Stability']),
    lesson('energy-systems', 'Make energy useful', 'Systems', 'Track useful output, waste and efficiency across energy conversions.', ['Efficiency', 'Heat transfer', 'Energy conversion']),
  ],
  'mind-health': [
    lesson('memory', 'Make learning stick', 'Learning', 'Compare retrieval, spacing and recognition when studying.', ['Retrieval practice', 'Spacing', 'Recognition versus recall']),
    lesson('attention', 'Where attention goes', 'Learning', 'Reason about divided attention, task switching and cognitive load.', ['Attention', 'Task switching', 'Cognitive load']),
    lesson('sleep', 'Sleep and a working brain', 'Wellbeing', 'Distinguish sleep mechanisms and evidence from universal health promises.', ['Sleep stages', 'Circadian rhythm', 'Memory consolidation']),
    lesson('nutrition', 'Understand nutrients and energy', 'Wellbeing', 'Compare nutrient functions and interpret food labels critically.', ['Macronutrients', 'Energy balance', 'Food labels']),
    lesson('habits', 'How habits take shape', 'Behavior', 'Distinguish cues, reinforcement and environmental influences.', ['Cues', 'Reinforcement', 'Behavior change']),
  ],
  'money-business': [
    lesson('interest', 'When growth compounds', 'Money', 'Calculate compound growth and distinguish nominal from real returns.', ['Compound interest', 'Inflation', 'Percentage changes']),
    lesson('budgeting', 'Make a budget that adds up', 'Money', 'Compare cash flow, borrowing costs and emergency reserves.', ['Cash flow', 'Debt costs', 'Emergency reserves']),
    lesson('supply-demand', 'Prices, choices and trade-offs', 'Economics', 'Reason about incentives, scarcity and shifts in supply and demand.', ['Supply and demand', 'Opportunity cost', 'Elasticity']),
    lesson('business-models', 'How a business creates value', 'Business', 'Distinguish revenue, profit, unit economics and customer value.', ['Revenue and profit', 'Unit economics', 'Customer value']),
    lesson('risk', 'Risk is not just volatility', 'Money', 'Compare diversification, concentration and uncertainty. Educational practice, not financial advice.', ['Diversification', 'Expected return', 'Concentration risk']),
  ],
  'food-agriculture': [
    lesson('soil', 'A living soil', 'Growing food', 'Connect soil structure, nutrients and organisms to plant growth.', ['Soil structure', 'Nutrient cycles', 'Soil organisms']),
    lesson('water-crops', 'Water, crops and yield', 'Growing food', 'Reason about irrigation, water stress and agricultural trade-offs.', ['Irrigation', 'Water stress', 'Crop yield']),
    lesson('preservation', 'Why food spoils', 'Food science', 'Explain how temperature, water availability and acidity affect preservation.', ['Microbial growth', 'Water activity', 'Preservation']),
    lesson('fermentation', 'Microbes that transform food', 'Food science', 'Distinguish fermentation from spoilage and follow microbial transformations.', ['Fermentation', 'Yeasts', 'Lactic acid bacteria']),
  ],
  history: [
    lesson('sources', 'Read a historical source', 'Historical thinking', 'Distinguish evidence, interpretation and the limits of a surviving record.', ['Primary sources', 'Corroboration', 'Historical context']),
    lesson('ancient-world', 'Cities, states and early civilizations', 'World history', 'Connect agriculture, specialization and institutions without assuming one path of development.', ['Early cities', 'Agriculture', 'State formation']),
    lesson('trade', 'Routes that connected societies', 'World history', 'Explore how trade carried goods, technologies and ideas.', ['Trade routes', 'Cultural exchange', 'Maritime trade']),
    lesson('revolutions', 'Why political orders change', 'World history', 'Separate causes, triggers and consequences of revolutions.', ['Revolution', 'Institutions', 'Historical causation']),
    lesson('colonialism', 'Empire, resistance and independence', 'World history', 'Compare colonial institutions, resistance and the limits of broad comparisons.', ['Colonialism', 'Resistance', 'Decolonization']),
  ],
  'society-ideas': [
    lesson('logic', 'Does the argument follow?', 'Reasoning', 'Distinguish valid reasoning, true premises and common fallacies.', ['Validity', 'Soundness', 'Fallacies']),
    lesson('ethics', 'Think through a difficult choice', 'Philosophy', 'Compare consequences, duties and fairness without reducing ethics to a slogan.', ['Consequentialism', 'Duties', 'Fairness']),
    lesson('institutions', 'How institutions shape behavior', 'Society', 'Connect incentives, norms and institutional constraints.', ['Institutions', 'Social norms', 'Incentives']),
    lesson('language', 'How language carries meaning', 'Society', 'Distinguish sounds, grammar, meaning and the role of context.', ['Phonemes', 'Syntax', 'Pragmatics']),
  ],
  'arts-design': [
    lesson('visual-design', 'Guide an eye through a page', 'Design', 'Use hierarchy, grouping and contrast to explain a design choice.', ['Hierarchy', 'Proximity', 'Contrast']),
    lesson('photography', 'Make sense of an exposure', 'Image & film', 'Predict how shutter speed, aperture and sensitivity affect an image.', ['Shutter speed', 'Aperture', 'Exposure']),
    lesson('film', 'How an edit changes meaning', 'Image & film', 'Reason about shot order, continuity and the interpretation of a scene.', ['Montage', 'Continuity', 'Context']),
    lesson('music', 'Why a melody holds together', 'Words & music', 'Connect pitch, rhythm, intervals and harmonic expectations.', ['Pitch', 'Rhythm', 'Intervals']),
    lesson('literature', 'Read beyond the plot', 'Words & music', 'Distinguish narrator, perspective and textual evidence for an interpretation.', ['Narration', 'Perspective', 'Textual evidence']),
  ],
  news: [
    lesson('verification', 'Check a claim before sharing', 'News literacy', 'Distinguish original reporting, independent confirmation and a repeated claim.', ['Verification', 'Independent sources', 'Corrections']),
    lesson('numbers', 'Read the numbers in a headline', 'News literacy', 'Spot base-rate mistakes, misleading charts and missing comparisons.', ['Base rates', 'Absolute versus relative change', 'Charts']),
    lesson('context', 'Separate a fact from its framing', 'News literacy', 'Distinguish reporting, opinion and the context needed to interpret a development.', ['Framing', 'Attribution', 'Uncertainty']),
  ],
  community: [
    lesson('discussion', 'Have a useful disagreement', 'Learning together', 'Compare a claim, its evidence and a respectful response.', ['Evidence', 'Counterarguments', 'Constructive feedback']),
    lesson('privacy', 'Protect people while sharing', 'Learning together', 'Recognize consent, private information and responsible reporting.', ['Consent', 'Privacy', 'Reporting']),
    lesson('group-learning', 'Learn without an echo chamber', 'Learning together', 'Use independent attempts and explanation to uncover mistakes.', ['Independent reasoning', 'Peer explanation', 'Group bias']),
  ],
  'trading-markets': [
    lesson('orders', 'From an order to an execution', 'Market mechanics', 'Distinguish order types, liquidity and execution risk.', ['Market orders', 'Limit orders', 'Slippage']),
    lesson('position-size', 'Size a risk before a trade', 'Risk', 'Calculate position size and understand why stops do not guarantee a loss limit.', ['Position sizing', 'Stop orders', 'Gap risk']),
    lesson('expectancy', 'A win rate is not a strategy', 'Risk', 'Calculate expectancy and distinguish a backtest from reliable evidence.', ['Expectancy', 'Trading costs', 'Overfitting']),
  ],
  psychology: [
    lesson('bias', 'When intuition misleads', 'Thinking', 'Identify confirmation bias, anchoring and base-rate neglect in a scenario.', ['Confirmation bias', 'Anchoring', 'Base rates']),
    lesson('conditioning', 'Learning from consequences', 'Behavior', 'Distinguish reinforcement, punishment and classical conditioning.', ['Reinforcement', 'Punishment', 'Conditioning']),
    lesson('research', 'What a psychology study shows', 'Research', 'Interpret controls, blinding and the limits of an observational association.', ['Blinding', 'Control groups', 'Causal inference']),
  ],
  neuroscience: [
    lesson('neurons', 'How a neuron sends a signal', 'Neural systems', 'Trace membrane potentials, action potentials and synaptic signaling.', ['Action potentials', 'Synapses', 'Neurotransmitters']),
    lesson('plasticity', 'How experience changes a brain', 'Neural systems', 'Interpret plasticity without assuming that any change is unlimited.', ['Plasticity', 'Learning', 'Neural circuits']),
    lesson('brain-imaging', 'What a brain scan can tell us', 'Research', 'Distinguish indirect imaging signals from direct claims about thoughts.', ['fMRI', 'BOLD signal', 'Reverse inference']),
  ],
  'game-theory': [
    lesson('payoffs', 'Read a strategic situation', 'Strategy', 'Use payoff tables to identify incentives and best responses.', ['Payoffs', 'Best responses', 'Dominant strategies']),
    lesson('equilibrium', 'When nobody wants to move first', 'Strategy', 'Distinguish equilibrium from a collectively best outcome.', ['Nash equilibrium', 'Coordination', 'Social dilemmas']),
    lesson('cooperation', 'Why cooperation can last', 'Strategy', 'Reason about repeated interaction, trust and changing incentives.', ['Repeated games', 'Cooperation', 'Credible commitments']),
  ],
};

export const QUIZ_LESSONS = Object.fromEntries(Object.entries(EXISTING_QUIZ_LESSONS).map(([id, existing]) => [id,
  [...(EXPANDED_QUIZ_LESSONS[id] || []), ...existing],
]));

export const getQuizLessons = subjectId => Object.hasOwn(QUIZ_LESSONS, subjectId) ? QUIZ_LESSONS[subjectId] : [];
export const getQuizLesson = (subjectId, lessonId) => getQuizLessons(subjectId).find(item => item.id === lessonId) || null;
export const getQuizConceptId = value => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const getLessonQuizId = (subjectId, lessonId, concept = '') => `${subjectId}--${lessonId}${concept ? '--' + getQuizConceptId(concept) : ''}`;

export function makeLessonQuizTopic(subject, selected, concept = '') {
  if (concept && !selected.concepts.includes(concept)) throw new RangeError('Unknown topic in this lesson');
  return { ...subject, id: getLessonQuizId(subject.id, selected.id, concept), baseTopicId: subject.id,
    lessonId: selected.id, lessonVersion: concept ? 1 : 2, lessonTitle: selected.title,
    conceptId: concept ? getQuizConceptId(concept) : '', focusTitle: concept,
    title: concept || selected.title, focus: concept ? `${selected.title}: ${concept}` : selected.title,
    topic: subject.title, desc: selected.outcome, subjects: concept ? [concept] : selected.concepts,
    objectives: [selected.outcome], branch: selected.branch, studyNote: selected.studyNote || '' };
}

export function getLessonStudyReference(topic) {
  if (!topic?.lessonId || topic.conceptId) return {};
  return {
    sourceTitle: topic.lessonTitle,
    sourceBody: [topic.studyNote, `Learning goal: ${topic.desc}`, `Ideas covered by this lesson: ${topic.subjects.join('; ')}.`].filter(Boolean).join('\n'),
  };
}

export function getRelatedQuizLessons(subjectId, lessonId) {
  const current = getQuizLesson(subjectId, lessonId);
  if (!current) return [];
  const others = getQuizLessons(subjectId).filter(item => item.id !== lessonId);
  return [...others.filter(item => item.branch === current.branch), ...others.filter(item => item.branch !== current.branch)].slice(0, 3);
}

export function getQuizLessonLabel(quizId) {
  const [subjectId, lessonId, conceptId] = String(quizId).split('--');
  const selected = getQuizLesson(subjectId, lessonId);
  if (!selected) return '';
  const concept = selected.concepts.find(item => getQuizConceptId(item) === conceptId);
  return concept ? `${selected.title} / ${concept}` : selected.title;
}
