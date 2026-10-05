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
      ['Simple explanation', 'Suppose a delivery-time model predicts 20 minutes, but the delivery takes 30. Training needs a way to turn that mistake into an adjustment. A parameter is an adjustable number inside the model. A loss is a number measuring prediction error. The gradient tells us how the loss changes when a parameter changes; the learning rate controls the size of the adjustment. Training repeats this feedback loop rather than storing a rule for every possible delivery.'],
      ['How it works', 'Follow one training update:\n\n1. The model uses its current parameters to predict a delivery time.\n2. Compare that prediction with the recorded time. A loss function expresses the mismatch as a number.\n3. Calculate the gradient: how would a small change in each parameter affect the loss? Its sign tells us which direction locally increases the loss.\n4. Move in the opposite direction by subtracting learning rate × gradient from the parameter. Then make another prediction and repeat.\n\nThe update follows the slope at the current position. It does not know the best final parameter in advance.'],
      ['Worked example', 'Use hypothetical values for one weight: weight = 2, gradient = 3, learning rate = 0.1. First multiply 0.1 × 3 = 0.3. Then subtract that adjustment: 2 − 0.3 = 1.7. The positive gradient means increasing this weight locally increases loss, so the update reduces it. This is one parameter update, not a claim that the new delivery prediction is 1.7 minutes.\n\nChange just the learning rate to 0.01. The adjustment becomes 0.03 and the weight becomes 1.97: a smaller move in the same direction. Larger moves can overshoot, so a bigger learning rate is not automatically better.'],
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
      ['How it works', '1. Train a model on one set of examples. It can use useful patterns, but it may also use incidental details.\n2. Check it on held-out examples: data not used for the parameter updates. This tests whether its patterns transfer.\n3. Compare the two results. If training performance improves while validation performance worsens, investigate whether the model is fitting details particular to training.\n4. Change the data or training approach, then evaluate again. Keep a separate final test set so the evaluation itself does not become another thing you tune to.'],
      ['Worked example', 'Imagine that nearly every cow photo in training has grass behind it. The model can exploit that background rather than the animal itself. It does well on familiar photos, yet calls a cow standing on sand something else.\n\nChange one condition: keep the cow, but vary the background in a held-out set. If predictions now fail much more often, that is evidence of a background shortcut, not proof of which internal feature caused it. Representative training images can reduce the shortcut. The key question is whether the model still works when an incidental detail changes.'],
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
      ['How it works', 'A resolver is the service that finds the DNS answer for you. Its cache stores earlier answers; an authoritative server supplies records for the domain.\n\n1. Your device asks a resolver for the address associated with a name.\n2. The resolver checks for an unexpired cached answer. Reusing one avoids another full lookup.\n3. If it needs a fresh answer, it follows the DNS hierarchy to the authoritative records.\n4. It returns the answer, and your device can use the address to begin a connection. Loading the page and protecting that connection are separate jobs.'],
      ['Worked example', 'Suppose a website moves from address A to address B. A resolver still holds the earlier answer A with a hypothetical ten-minute cache lifetime remaining. A visitor using that resolver can therefore receive A even though the authoritative record now says B. Another resolver with no cached answer can obtain B immediately.\n\nChange one condition: let the first cached answer expire. That resolver now needs a fresh lookup and can return B. The difference is the age of the stored answer, not two different spellings of the website. This simplified example does not describe every caching layer in a real browser or network.'],
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
      ['How it works', 'A certificate is part of establishing the server’s identity. Key exchange lets the peers derive secrets for the connection. Symmetric encryption uses shared secret keys to protect the data.\n\n1. The browser and server negotiate compatible security parameters.\n2. The browser checks the server’s authentication information. A certificate supports identity checking, not a review of the website’s claims.\n3. Through key exchange, the peers derive shared secrets. This is distinct from simply sending the certificate.\n4. They use derived symmetric keys to protect application data travelling over the connection. These are the main roles in a typical TLS 1.3 connection, not a complete packet-by-packet handshake.'],
      ['Worked example', 'You send a message through a form on a website with a valid HTTPS connection. The browser protects the message in transit. Someone merely observing the network should not be able to read the protected form contents. The receiving website, however, can read the message because it is the intended recipient.\n\nChange one condition: the destination is a deceptive website that still has a valid certificate. Transport protection can still work, yet the recipient can misuse what you send. The lesson is to check both the connection and the destination. Encryption does not turn an untrustworthy recipient into a trustworthy one.'],
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
      ['How it works', 'A template is an existing strand used to guide a new strand. A nucleotide is a building block carrying one of DNA’s bases.\n\n1. The two original DNA strands separate so their bases can act as templates.\n2. Cellular machinery assembles complementary nucleotides along each template: A pairs with T, and C with G.\n3. Each original strand now has a newly assembled partner. The pairing rule preserves the sequence information in the copy.\n4. The two resulting DNA molecules each contain one original strand and one new strand. This is called semiconservative copying.'],
      ['Worked example', 'Take a short template segment A-C-T. Match the bases one at a time: A calls for T; C calls for G; T calls for A. The complementary segment is T-G-A. The existing sequence therefore constrains what gets added instead of leaving the new strand to be assembled randomly.\n\nChange just the middle template base from C to G. The complementary segment becomes T-C-A: only that matching position changes in this pairing exercise. This is a simplified illustration, not every chemical step of replication; it leaves out strand direction and the machinery’s detailed operation. Replication copies DNA, whereas transcription makes RNA from DNA.'],
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
      ['How it works', 'Scattering means redirecting light. Wavelength distinguishes the colors in sunlight. Rayleigh scattering describes the behavior when particles are much smaller than the wavelength.\n\n1. Sunlight containing many visible wavelengths enters the atmosphere.\n2. Air molecules redirect some of that light. Shorter visible wavelengths are scattered more strongly than longer ones.\n3. When you look away from the Sun, scattered light still arrives at your eyes from that direction. That is why the sky is illuminated rather than black in daytime.\n4. Near sunset, the direct sunlight passes through more atmosphere. More short-wavelength light is scattered out of that beam, leaving it relatively redder.'],
      ['Worked example', 'Compare two paths for sunlight: a shorter daytime path through the atmosphere and a longer path near sunset. On the longer path, light encounters more air before reaching you, so more blue light is redirected out of the direct beam. The light arriving directly from the Sun is then relatively redder. Blue sky and a red sunset are related consequences of scattering, not sunlight suddenly changing its source color.\n\nChange one condition by adding haze. Larger particles scatter differently, so the simple air-molecule explanation is no longer enough to predict the exact color. Observe the sky, but never look directly at the Sun to test this idea.'],
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
