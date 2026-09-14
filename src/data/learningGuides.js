// Original introductory guides. References are shown alongside each lesson.
const question = (q, answer, other, explanation, difficulty = 'Medium') => ({
  q, answer, options: [answer, ...other], explanation, difficulty, source: 'smarty-guide',
});
const guides = [
  {
    slug: 'gradient-descent', topic: 'Artificial Intelligence', subTopic: 'Gradient descent',
    title: 'How a model turns an error into a better prediction',
    relatedTopics: ['Machine Learning', 'Data Science'], nextGuides: ['overfitting'],
    objective: 'Explain what changes during training and calculate one update.',
    body: 'A model makes a prediction using adjustable numbers called parameters. Gradient descent uses the prediction error to work out which direction to adjust those numbers.',
    sections: [
      ['Simple explanation', 'Training is a feedback loop: predict, measure error, adjust, repeat. A loss function turns prediction mistakes into a number. The goal is to reduce that number.'],
      ['How it works', 'The gradient measures how the loss changes with each parameter. Update a weight by subtracting learning rate × gradient. A weight of 2, gradient of 3, and learning rate of 0.1 gives a new weight of 1.7.'],
      ['Real-life example', 'For a delivery-time predictor, training compares predicted minutes with observed minutes. Repeated updates can improve the relationship between distance and predicted time.'],
      ['Final takeaway', 'A larger learning rate is not always faster: it can overshoot. Also, lower training error alone does not establish accuracy on unfamiliar examples. Next, explore overfitting.'],
    ],
    sources: [{ label: 'Google · Gradient descent', url: 'https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent' }, { label: 'Google · Learning rate', url: 'https://developers.google.com/machine-learning/crash-course/linear-regression/hyperparameters' }],
    questions: [
      question('What changes during a gradient-descent update?', 'Model parameters', ['The recorded observations', 'The number of output labels', 'The source of the dataset'], 'The update adjusts weights and biases.'),
      question('Weight 2, gradient 3, learning rate 0.1: what is the next weight?', '1.7', ['2.3', '0.6', '3.1'], '2 − (0.1 × 3) = 1.7.', 'Hard'),
      question('Loss starts jumping after the learning rate increases. What is a plausible cause?', 'Updates overshoot a useful minimum', ['The model now guarantees accuracy', 'The data automatically became larger', 'Gradients are no longer calculated'], 'Large updates can overshoot.', 'Hard'),
    ],
  },
  {
    slug: 'overfitting', topic: 'Artificial Intelligence', subTopic: 'Generalization and overfitting',
    title: 'Why a model can ace practice and fail the real test',
    relatedTopics: ['Machine Learning', 'Data Science'], nextGuides: ['gradient-descent'],
    objective: 'Distinguish learning a pattern from fitting incidental details.',
    body: 'A model can fit its training examples so closely that it also learns accidental noise. New examples then expose the difference between fitting and generalizing.',
    sections: [
      ['Simple explanation', 'Imagine practicing only one exam paper. Remembering its answers does not prove you can solve new questions. Overfitting is the corresponding problem in a model.'],
      ['How it works', 'Compare training performance with performance on held-out examples. Improving training accuracy while validation performance deteriorates is a warning sign.'],
      ['Real-life example', 'A classifier trained on animal photos might rely on backgrounds. It can appear accurate in its training set but struggle with animals photographed somewhere else.'],
      ['Final takeaway', 'Representative data, simpler models, and regularization can help. Keep a separate test set for the final assessment; repeatedly tuning against it leaks information into your choices.'],
    ],
    sources: [{ label: 'Google · Overfitting', url: 'https://developers.google.com/machine-learning/crash-course/overfitting/overfitting' }],
    questions: [
      question('Training accuracy rises while validation accuracy falls. What should you investigate?', 'Overfitting', ['Guaranteed generalization', 'A larger test set', 'Fewer training examples being stored'], 'The model may fit details that do not transfer.'),
      question('A model recognizes cows only on grass. Which test probes the shortcut?', 'Cow photos with different backgrounds', ['The same training photos again', 'Only higher-resolution grass', 'Removing every cow photo'], 'Change the suspected shortcut while keeping the target.'),
      question('Why avoid tuning repeatedly against the final test set?', 'It influences model choices and weakens the independent test', ['It makes every dataset smaller', 'It disables regularization', 'It prevents parameter updates'], 'Reserve independent evidence for the final evaluation.', 'Hard'),
    ],
  },
  {
    slug: 'dns', topic: 'Computer Networks', subTopic: 'DNS resolution',
    title: 'What happens between typing a website name and connecting',
    relatedTopics: ['Cybersecurity', 'Software Systems'], nextGuides: ['tls'],
    objective: 'Follow a name lookup and explain why old results can persist.',
    body: 'DNS helps translate a website name into information a computer can use to reach it. That lookup is distinct from loading the page itself.',
    sections: [
      ['Simple explanation', 'A domain name is convenient for people. A network connection needs an address. DNS records connect names with addresses and other routing information.'],
      ['How it works', 'A recursive resolver checks its cache. If necessary, it consults the DNS hierarchy to find an authoritative answer, then returns the result to the client.'],
      ['Real-life example', 'After a website changes its address, some visitors can still receive a cached old answer until its time-to-live expires. Different caches may refresh at different times.'],
      ['Final takeaway', 'Resolving the right address does not encrypt the connection or establish that a page is trustworthy. The next step is understanding what TLS adds.'],
    ],
    sources: [{ label: 'Cloudflare · DNS', url: 'https://www.cloudflare.com/learning/dns/what-is-dns/' }],
    questions: [
      question('What is the main task of a DNS address lookup?', 'Find an address associated with a name', ['Encrypt page content', 'Render the layout', 'Verify every claim on the page'], 'Name resolution happens before page loading.'),
      question('Why can two visitors temporarily see different addresses after a DNS change?', 'Their resolvers may hold different cached answers', ['DNS always selects random websites', 'The browser rewrites the domain', 'TLS changes the DNS records'], 'Cache lifetimes affect when updates appear.'),
      question('A lookup succeeds. Which task still needs a separate mechanism?', 'Encrypting the connection', ['Receiving a DNS answer', 'Finding the returned address', 'Reading the resolved record'], 'DNS resolution alone does not provide transport encryption.'),
    ],
  },
  {
    slug: 'tls', topic: 'Cybersecurity', subTopic: 'TLS handshakes',
    title: 'How your browser establishes a private conversation',
    relatedTopics: ['Computer Networks', 'Cryptography'], nextGuides: ['dns'],
    objective: 'Separate server authentication from data encryption.',
    body: 'Before HTTPS carries application data, the browser and server establish a protected connection. A TLS handshake negotiates security settings and key material.',
    sections: [
      ['Simple explanation', 'Two jobs matter: establishing who the server is and protecting the messages exchanged with it. A certificate helps the client authenticate the server.'],
      ['How it works', 'In a typical TLS 1.3 connection, the peers negotiate parameters and derive shared secrets through key exchange. They use symmetric keys to protect the connection’s data.'],
      ['Real-life example', 'When you submit a form over a valid HTTPS connection, someone merely observing network traffic should not be able to read its protected contents. The receiving website still can.'],
      ['Final takeaway', 'HTTPS protects transport; it does not certify that a website is honest. A deceptive site can also have a valid certificate. Always consider the destination itself.'],
    ],
    sources: [{ label: 'Cloudflare · TLS handshake', url: 'https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/' }],
    questions: [
      question('What does the certificate help a browser establish?', 'The authenticated identity of the server', ['The truth of every article', 'The trustworthiness of every seller', 'The absence of tracking'], 'Authentication is different from judging content.'),
      question('What normally protects application data after the handshake?', 'Symmetric encryption keys', ['The domain name in plain text', 'The DNS cache', 'The public certificate alone'], 'Session keys protect the data.'),
      question('A deceptive site has HTTPS. Is that a contradiction?', 'No; transport protection does not establish honesty', ['Yes; certificates review all content', 'Yes; HTTPS blocks every scam', 'No; HTTPS never encrypts anything'], 'A secure connection can lead to an untrustworthy destination.', 'Hard'),
    ],
  },
  {
    slug: 'dna-copying', topic: 'Biology', subTopic: 'DNA replication',
    title: 'How a cell copies a molecular instruction set',
    relatedTopics: ['Genetics', 'Human Body'], nextGuides: [],
    objective: 'Explain how an existing strand guides a new copy.',
    body: 'Before a cell divides, its DNA must be copied. The two strands provide templates that guide the construction of new complementary strands.',
    sections: [
      ['Simple explanation', 'DNA contains paired bases: A pairs with T, and C with G. Each original strand contains information that can guide its partner’s reconstruction.'],
      ['How it works', 'The strands separate, and cellular machinery assembles complementary nucleotides along each template. Each resulting DNA molecule has one original strand and one new strand.'],
      ['Real-life example', 'For a template segment A-C-T, the complementary bases are T-G-A. This illustrates the pairing rule, not every chemical step of replication.'],
      ['Final takeaway', 'Replication copies DNA; transcription makes an RNA copy from a DNA sequence. These are related but different processes. Copying is highly accurate, but errors can occur.'],
    ],
    sources: [{ label: 'NHGRI · DNA replication', url: 'https://www.genome.gov/genetics-glossary/DNA-Replication' }, { label: 'NHGRI · DNA', url: 'https://www.genome.gov/genetics-glossary/Deoxyribonucleic-Acid-DNA' }, { label: 'NHGRI · Transcription', url: 'https://www.genome.gov/genetics-glossary/Transcription' }],
    questions: [
      question('Which bases complement A-C-T?', 'T-G-A', ['A-C-T', 'G-A-C', 'C-T-G'], 'Apply A–T and C–G pairing.'),
      question('After replication, what does each daughter DNA molecule contain?', 'One original strand and one new strand', ['Only two original strands', 'Only RNA', 'No original material'], 'This is the semiconservative pattern.'),
      question('Which task is transcription rather than replication?', 'Making an RNA copy from DNA', ['Copying a DNA molecule', 'Building both daughter DNA molecules', 'Producing a complementary DNA strand'], 'The product is RNA rather than a duplicate DNA molecule.'),
    ],
  },
  {
    slug: 'blue-sky', topic: 'Physics', subTopic: 'Rayleigh scattering',
    title: 'Why the same sunlight makes blue skies and red sunsets',
    relatedTopics: ['Astronomy', 'Earth Science', 'Nature'], nextGuides: [],
    objective: 'Use scattering and path length to explain two everyday observations.',
    body: 'Sunlight contains many wavelengths. Air molecules scatter shorter visible wavelengths more strongly than longer ones, sending some light toward you from across the sky.',
    sections: [
      ['Simple explanation', 'The blue overhead is scattered sunlight arriving from directions other than the Sun. It is not simply an image of the ocean.'],
      ['How it works', 'For molecules much smaller than the wavelength, Rayleigh scattering strongly favors shorter wavelengths. Blue light is redirected more effectively than red light.'],
      ['Real-life example', 'At sunset, sunlight travels through more atmosphere before reaching you. More of the shorter-wavelength light has scattered out of the direct beam, leaving it relatively redder.'],
      ['Final takeaway', 'This explains the basic pattern, not every sky color. Dust, clouds, and larger particles affect scattering differently. Never look directly at the Sun to test the idea.'],
    ],
    sources: [{ label: 'NASA · Why is the sky blue?', url: 'https://spaceplace.nasa.gov/blue-sky/en/' }],
    questions: [
      question('Why can the sky look blue away from the Sun?', 'Air redirects some sunlight toward us', ['The atmosphere emits only blue light', 'The ocean paints every sky', 'Red light cannot enter air'], 'Scattered sunlight reaches the observer.'),
      question('What changes for the direct sunlight path near sunset?', 'It passes through more atmosphere', ['It passes through no gas', 'All wavelengths become blue', 'The Sun produces only red light'], 'The longer path changes the direct beam’s balance.'),
      question('Why can a hazy sky differ from the simplest Rayleigh explanation?', 'Larger particles scatter light differently', ['Rayleigh scattering removes the atmosphere', 'Every particle scatters identically', 'Visible light stops having wavelengths'], 'Particle size changes scattering behavior.', 'Hard'),
    ],
  },
];

export const LEARNING_GUIDES = guides.map((guide) => ({
  ...guide, id: 'smarty-guide-' + guide.slug, author: 'Smarty learning guide',
  creatorName: 'Smarty learning guide', isLearningGuide: true,
  aiDetailedExplanation: guide.sections.map(([heading, text]) => heading + ': ' + text).join('\n\n'),
}));
export const getLearningGuide = (id) => LEARNING_GUIDES.find((guide) => guide.id === id) || null;
export function getGuideQuestions(id) {
  return (getLearningGuide(id)?.questions || []).map((item, index) => ({ ...item, id: id + '-q' + index }));
}
