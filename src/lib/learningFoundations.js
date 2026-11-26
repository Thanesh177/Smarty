import { getMainTopicDefinition } from '../data/topicTaxonomy.js';

// Original, stable background notes. They explain prerequisites, not new claims
// about a source article. No model call or guessed prerequisite link is needed.
const FOUNDATIONS = {
  technology: ['Inputs, models and state', 'An input is information a system receives. A model is a simplified representation used to explain or predict something. State is information a system keeps between steps; changing it can change the next result.'],
  engineering: ['Forces, energy and constraints', 'A force can change motion or deform a material. Energy tracks the capacity to produce change. A design must also satisfy constraints such as size, safety and available materials; improving one property can involve a trade-off elsewhere.'],
  'science-mathematics': ['Quantities, relationships and evidence', 'A quantity combines a number with a unit. A mathematical relationship describes how quantities depend on one another. To test a scientific explanation, compare its predictions with measurements and account for uncertainty.'],
  'life-sciences': ['Cells and biological instructions', 'Cells are the basic units of organisms. DNA stores information that cells use to make functional molecules, including proteins. Biological effects depend on how these parts interact, so a change to one part can affect several processes.'],
  'earth-space': ['Systems and scales', 'A system is a set of interacting parts. The same process can look different over seconds, years or geological time. Keep track of the size and timescale being discussed before comparing observations or drawing a conclusion.'],
  'mind-health': ['Association is not a cause', 'An association means two observations vary together. It does not, by itself, show that one causes the other. Comparison groups, study design and alternative explanations matter when interpreting claims about the mind or health.'],
  'money-business': ['Incentives, costs and uncertainty', 'An incentive changes what a person or organisation has reason to do. Opportunity cost is the value of the best alternative given up. Decisions involve uncertainty: a possible outcome is not a guaranteed outcome.'],
  'food-agriculture': ['Organisms and their environment', 'Living things need resources and suitable conditions to grow. Soil, water, nutrients and other organisms interact. A result observed under one set of conditions may change when the environment changes.'],
  history: ['Evidence and interpretation', 'A historical source is surviving evidence, not a complete recording of the past. Ask who produced it, when and for what purpose. An interpretation connects evidence into an account; its strength depends on corroboration and acknowledged gaps.'],
  'society-ideas': ['Claims, reasons and assumptions', 'A claim states what someone thinks is true. Reasons are offered to support it, and assumptions are things the argument takes for granted. Separate those parts before deciding whether the conclusion follows.'],
  'arts-design': ['Form, context and interpretation', 'Form describes how a work is organised: its shapes, sounds, words or sequence. Context includes the circumstances in which it was made or encountered. An interpretation should connect specific details to the meaning being proposed.'],
};
const SPECIFIC_BASICS = {
  'net force': ['Net force', 'Several forces can act on an object at once. Net force is their combined effect, including direction: forces in opposite directions subtract. For an object with constant mass, a non-zero net force changes its velocity; balanced forces do not require it to be stationary.'],
  probability: ['Probability', 'Probability describes how likely an outcome is under a stated model or set of assumptions. A value of 0 rules it out within that model; 1 makes it certain. A probability is not a promise about what happens in one individual trial.'],
  atoms: ['Atoms', 'Atoms are units of chemical elements. A small nucleus contains protons and usually neutrons, while electrons occupy the surrounding region. The number of protons identifies the element; arrangements of electrons help determine how atoms bond.'],
  'electric current': ['Electric current', 'Electric current measures how much electric charge passes a point per unit of time. Voltage is an energy difference per unit charge, not another name for current. How much current flows depends on the circuit and its components.'],
  correlation: ['Correlation and cause', 'Correlation describes a statistical relationship between variables. It can result from a causal link, a shared influence or other features of the data. It does not by itself identify which explanation is correct or which direction a cause would run.'],
  'terraform state': ['Terraform state', 'Terraform configuration describes the intended infrastructure. State records the link between that configuration and managed remote objects, together with relevant attributes. State is not a replacement for configuration, and it can contain sensitive information.'],
  'model tokens': ['Model tokens', 'A language model processes text as tokens: units that can be words, parts of words or punctuation. Token boundaries depend on the tokenizer. The model uses numerical representations of those units to compute patterns and possible continuations; a token is not necessarily a whole word.'],
};

export function getPrerequisiteHelp(post = {}) {
  const explicit = typeof post.prerequisiteSubject === 'string' ? post.prerequisiteSubject.trim().slice(0, 300) : '';
  const subject = getMainTopicDefinition(post.topic || post.category || '')?.id;
  const note = SPECIFIC_BASICS[explicit.toLowerCase()] || FOUNDATIONS[subject];
  return {
    subject: explicit,
    title: note?.[0] || 'Start with the background',
    explanation: note?.[1] || 'Identify the main idea, what the parts mean, and the conditions being discussed. The detailed explanation defines specialist terms as they appear. You can open those terms without leaving the post.',
  };
}
