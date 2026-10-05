// Metadata only; book text stays at its original provider. These historical
// editions are public domain in the US, not necessarily in every country.
const picks = [
  [11, "Alice's Adventures in Wonderland", 'Lewis Carroll', ['fiction','adventure'], 'A curious journey through language, logic, and a world that refuses ordinary rules.'],
  [84, 'Frankenstein', 'Mary Shelley', ['fiction','science fiction'], 'A story about creation, responsibility, isolation, and the consequences of ambition.'],
  [1342, 'Pride and Prejudice', 'Jane Austen', ['fiction','psychology'], 'Look closely at first impressions, social expectations, and the difficulty of understanding another person.'],
  [1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', ['mystery','short stories','fiction'], 'Short mysteries that reward observation, careful reasoning, and attention to small details.'],
  [244, 'A Study in Scarlet', 'Arthur Conan Doyle', ['mystery','fiction'], 'Meet Holmes and Watson through an investigation that connects an unexpected set of clues.'],
  [35, 'The Time Machine', 'H. G. Wells', ['science fiction','fiction','adventure'], 'An imaginative journey into the future that asks what progress really means.'],
  [36, 'The War of the Worlds', 'H. G. Wells', ['science fiction','fiction'], 'An invasion story that challenges human confidence and our place in a much larger universe.'],
  [1228, 'On the Origin of Species', 'Charles Darwin', ['science','nature'], 'Follow the observations and arguments behind natural selection, read in their historical context.'],
  [944, 'The Voyage of the Beagle', 'Charles Darwin', ['science','nature','adventure'], 'Travel observations that connect landscapes, living things, and scientific curiosity.'],
  [205, 'Walden', 'Henry David Thoreau', ['nature','philosophy','biography'], 'Reflections on deliberate living, attention, and the relationship between people and nature.'],
  [1497, 'The Republic', 'Plato', ['philosophy','politics'], 'Conversations about justice, knowledge, education, and the structure of a good society.'],
  [2680, 'Meditations', 'Marcus Aurelius', ['philosophy','psychology'], 'Personal reflections on attention, judgement, responsibility, and the things we cannot control.'],
  [5827, 'The Problems of Philosophy', 'Bertrand Russell', ['philosophy'], 'An introduction to questions about knowledge, appearance, reality, and what we can reasonably believe.'],
  [1232, 'The Prince', 'Niccolò Machiavelli', ['politics','history'], 'A historical exploration of political power, leadership, and the tension between ideals and practice.'],
  [3300, 'An Inquiry into the Nature and Causes of the Wealth of Nations', 'Adam Smith', ['economics','politics'], 'Explore influential historical arguments about labour, markets, trade, and economic institutions.'],
  [20203, 'Autobiography of Benjamin Franklin', 'Benjamin Franklin', ['biography','history'], 'A personal account of work, learning, civic life, and an attempt to improve everyday habits.'],
  [1065, 'The Raven', 'Edgar Allan Poe', ['poetry'], 'A concentrated study of rhythm, repetition, memory, and grief.'],
  [2148, 'The Works of Edgar Allan Poe, Volume 2', 'Edgar Allan Poe', ['short stories','mystery','fiction'], 'Short fiction that explores atmosphere, unease, mystery, and the workings of the mind.'],
  [1260, 'Jane Eyre', 'Charlotte Brontë', ['fiction','psychology'], 'A story about independence, conscience, belonging, and the search for a life of one’s own.'],
  [768, 'Wuthering Heights', 'Emily Brontë', ['fiction','psychology'], 'Explore memory, attachment, and the lasting consequences of intense relationships.'],
  [74, 'The Adventures of Tom Sawyer', 'Mark Twain', ['fiction','adventure'], 'A mischievous journey through childhood, friendship, and life along the Mississippi.'],
  [76, 'Adventures of Huckleberry Finn', 'Mark Twain', ['fiction','adventure'], 'A river journey that tests friendship, conscience, and the assumptions of its historical society.'],
  [120, 'Treasure Island', 'Robert Louis Stevenson', ['fiction','adventure'], 'A sea adventure about trust, courage, conflicting loyalties, and the lure of treasure.'],
  [2701, 'Moby Dick; or, The Whale', 'Herman Melville', ['fiction','adventure','nature'], 'A voyage that turns obsession, nature, and the search for meaning into a vast literary world.'],
];
export const STARTER_BOOKS = picks.map(([id,title,author,subjects,description]) => ({
  id:String(id),gutenberg_id:String(id),book_id:String(id),title,author,authors:[author],subjects,description,
  language:['en'],readable:true,source:'Project Gutenberg',previewUrl:`https://www.gutenberg.org/ebooks/${id}`,
  cover:`https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
}));
export function getStarterCatalog({search='',category='',language='en',access='read'}={}) {
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean), topic=category.toLowerCase();
  const books = access==='read' && (!language || language==='en') ? STARTER_BOOKS.filter(book =>
    (!topic || book.subjects.some(subject => subject.includes(topic) || topic.includes(subject))) &&
    words.every(word => `${book.title} ${book.author}`.toLowerCase().includes(word))) : [];
  return {books,total:books.length,nextPage:null,source:'starter'};
}
