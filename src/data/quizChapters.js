// These are the named lessons shown in the library. Each member points at an
// existing, narrower practice set, so saved questions and attempts keep their IDs.
export const QUIZ_CHAPTER_MAP = {
  'science-mathematics': {
    Physics: ['forces', 'energy', 'motion-and-energy', 'circuits', 'waves'],
    Chemistry: ['atoms', 'bonds', 'reactions', 'acids'],
    Mathematics: ['algebra', 'proportional-reasoning', 'probability', 'statistics', 'calculus'],
    'Experimental Methods': ['measurement', 'experiments', 'kitchen-science'],
  },
  'life-sciences': {
    'Cell Biology': ['cells', 'membranes', 'enzymes', 'living-cell-systems'],
    'Genetics & Evolution': ['genetics', 'evolution', 'inheritance-to-evolution'],
    'Human Physiology': ['circulation', 'respiration', 'organ-systems', 'immunity'],
    Botany: ['plants'],
    Microbiology: ['microbes'],
    'Marine Biology': ['marine-life'],
  },
  'earth-space': {
    Astronomy: ['orbits', 'stars', 'reading-the-sky', 'cosmology'],
    Geology: ['geology'],
    'Climate & Water Systems': ['climate', 'oceans', 'watershed'],
    Ecology: ['food-webs', 'biodiversity', 'ecosystem-change'],
  },
  technology: {
    'Artificial Intelligence': ['ai-learning', 'neural-networks', 'evaluation-workflow'],
    'Data Science': ['data', 'databases'],
    'Software Engineering': ['algorithms', 'reliable-software'],
    'Computer Networking': ['networks', 'web-request-journey'],
    Cybersecurity: ['security'],
    'Operating Systems': ['operating-systems'],
  },
  engineering: {
    'Structural Engineering': ['bridge-design'],
    'Materials Engineering': ['materials', 'product-tradeoffs', 'manufacturing'],
    Electronics: ['electronics'],
    'Control Systems': ['feedback', 'temperature-control'],
    'Energy Systems': ['energy-systems'],
  },
  'mind-health': {
    'Memory & Learning': ['memory', 'study-feedback-loop'],
    'Attention & Cognition': ['attention', 'attention-environment'],
    'Sleep & Nutrition': ['sleep', 'nutrition', 'wellbeing-evidence'],
    'Behavioral Science': ['habits'],
  },
  'money-business': {
    'Personal Finance': ['budgeting', 'interest', 'growth-and-value', 'risk'],
    Microeconomics: ['supply-demand', 'choices-and-incentives'],
    'Business Accounting': ['business-models', 'small-business-numbers'],
  },
  'food-agriculture': {
    'Crop & Soil Science': ['soil', 'water-crops', 'growing-tradeoffs'],
    'Food Chemistry & Preservation': ['preservation', 'fermentation', 'dough-science', 'farm-to-table'],
  },
  history: {
    'Historical Research': ['sources', 'historical-case'],
    'Ancient Civilizations': ['ancient-world'],
    'Trade, Technology & Migration': ['trade', 'technology-and-society', 'migration-and-memory'],
    'Revolutions & Empires': ['revolutions', 'colonialism'],
  },
  'society-ideas': {
    Logic: ['logic', 'argument-toolkit'],
    Ethics: ['ethics'],
    'Sociology & Public Policy': ['institutions', 'public-decisions'],
    Linguistics: ['language', 'meaning-in-context'],
  },
  'arts-design': {
    'Visual & Interaction Design': ['visual-design', 'usable-design'],
    'Photography & Film': ['photography', 'film', 'visual-story'],
    'Music & Sound': ['music', 'story-and-sound'],
    Literature: ['literature'],
  },
  news: {
    'Media Verification': ['verification', 'image-evidence', 'investigate-headline'],
    'Data Journalism': ['numbers'],
    'Reporting & Editorial Context': ['context', 'reporting-uncertainty'],
  },
  community: {
    'Group Communication': ['discussion', 'peer-workshop', 'group-learning'],
    'Project Collaboration': ['shared-project'],
    'Digital Privacy': ['privacy', 'responsible-sharing'],
  },
  'trading-markets': {
    'Market Microstructure': ['orders', 'market-simulation'],
    'Portfolio Risk': ['position-size', 'portfolio-arithmetic'],
    'Strategy Evaluation': ['expectancy', 'strategy-evidence'],
  },
  psychology: {
    'Cognitive Psychology': ['bias', 'decision-lab'],
    'Behavioral Psychology': ['conditioning', 'learned-behavior'],
    'Psychology Research Methods': ['research', 'research-claims'],
  },
  neuroscience: {
    Neurophysiology: ['neurons', 'signal-to-action'],
    Neuroplasticity: ['plasticity', 'learning-circuits'],
    Neuroimaging: ['brain-imaging', 'brain-and-behavior'],
  },
  'game-theory': {
    'Strategic Games': ['payoffs', 'strategic-decisions'],
    'Equilibrium & Coordination': ['equilibrium', 'coordination'],
    'Repeated Games & Information': ['cooperation', 'information-and-games'],
  },
};
