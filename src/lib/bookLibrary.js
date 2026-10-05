export const BOOK_SHELVES = [['want', 'Want to read'], ['reading', 'Reading'], ['finished', 'Finished']];
export const BOOK_COLLECTIONS = [
  ['', 'Discover', 'Find a book worth staying with.'],
  ['science', 'Science', 'Ideas, discoveries, and how the world works.'],
  ['philosophy', 'Philosophy', 'Big questions, considered slowly.'],
  ['psychology', 'Mind & behaviour', 'Explore thought, habits, and human nature.'],
  ['history', 'History', 'Understand the people and events that shaped us.'],
  ['biography', 'Lives & memoirs', 'See the world through another life.'],
  ['nature', 'Nature', 'Look closer at the living world.'],
  ['economics', 'Economics', 'Money, trade, and the choices behind them.'],
  ['politics', 'Society', 'Power, communities, and social change.'],
  ['fiction', 'Fiction', 'Make room for another world.'],
  ['mystery', 'Mystery', 'Follow the clues and question the obvious.'],
  ['science fiction', 'Science fiction', 'Imagine what comes next.'],
  ['adventure', 'Adventure', 'Journeys beyond the everyday.'],
  ['poetry', 'Poetry', 'Small moments, carefully observed.'],
  ['short stories', 'Short stories', 'A complete escape in a shorter read.'],
];
export const BOOK_LANGUAGES = [['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ta', 'Tamil'], ['hi', 'Hindi']];
export const libraryKey = account => `smarty-book-library-v1-${encodeURIComponent(account || 'guest')}`;
export const bookId = book => String(book?.id || book?.gutenberg_id || book?.book_id || book?.key?.replace('/works/', '') || '');
export const bookReadId = book => String(book?.gutenberg_id || book?.book_id || book?.ia || bookId(book));
export const bookKey = book => `${/^\d+$/.test(bookId(book)) ? 'gutenberg' : 'openlibrary'}:${bookId(book)}`;
export const bookAuthor = book => {
  const authors = book?.authors || book?.author_name || book?.author;
  return Array.isArray(authors) ? authors.map(author => typeof author === 'string' ? author : author?.name).filter(Boolean).join(', ') || 'Unknown author' : String(authors || 'Unknown author');
};
export function safeBookUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
}
export function normalizeLibraryBook(book) {
  return {
    id: bookId(book), title: String(book?.title || 'Untitled book').slice(0, 300), author: bookAuthor(book),
    cover: safeBookUrl(book?.cover || book?.coverUrl), description: String(typeof book?.description === 'string' ? book.description : book?.description?.value || '').slice(0, 5000),
    subjects: (Array.isArray(book?.subjects) ? book.subjects : Array.isArray(book?.subject) ? book.subject : []).filter(item => typeof item === 'string').slice(0, 12),
    language: Array.isArray(book?.language) ? book.language.slice(0, 8) : [],
    readable: Boolean(book?.readable), source: String(book?.source || ''),
    gutenberg_id: book?.gutenberg_id ? String(book.gutenberg_id) : '', book_id: book?.book_id ? String(book.book_id) : '', ia: String(book?.ia || ''),
    previewUrl: safeBookUrl(book?.previewUrl || book?.openLibraryUrl),
  };
}
export function readBookLibrary(account, storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(libraryKey(account)) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.book && bookId(item.book)).slice(0, 500).map(item => ({
      ...item, book: normalizeLibraryBook(item.book),
      shelf: BOOK_SHELVES.some(([shelf]) => shelf === item.shelf) ? item.shelf : 'want',
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 2000) : '',
      chapter: Math.max(0, Math.floor(Number(item.chapter) || 0)), totalChapters: Math.max(0, Math.floor(Number(item.totalChapters) || 0)),
      bookmarks: Array.isArray(item.bookmarks) ? [...new Set(item.bookmarks.filter(n => Number.isInteger(n) && n >= 0))].slice(0, 1000) : [],
    })) : [];
  } catch { return []; }
}
export function saveBookLibrary(account, entries, storage = window.localStorage) {
  try { storage.setItem(libraryKey(account), JSON.stringify(entries.slice(0, 500))); return true; } catch { return false; }
}
export function updateLibraryEntry(entries, book, changes = {}, now = Date.now()) {
  const key = bookKey(book), old = entries.find(entry => bookKey(entry.book) === key);
  const entry = { shelf: 'want', notes: '', chapter: 0, totalChapters: 0, bookmarks: [], addedAt: now, ...old,
    ...changes, book: { ...normalizeLibraryBook(book) }, updatedAt: now };
  return [entry, ...entries.filter(item => bookKey(item.book) !== key)].slice(0, 500);
}
export function bookProgress(entry) {
  if (entry?.shelf === 'finished') return 100;
  if (!entry?.totalChapters) return 0;
  return Math.min(99, Math.max(0, Math.round((entry.chapter / entry.totalChapters) * 100)));
}
export function mergeBookPages(previous, books) {
  const map = new Map(previous.map(book => [bookKey(book), book]));
  books.filter(book => bookId(book)).forEach(book => map.set(bookKey(book), book));
  return [...map.values()];
}
export function getLegacyLibrary(storage = window.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem('saved_read_books') || '[]');
    const history = JSON.parse(storage.getItem('reading_history') || '[]');
    let entries = [];
    for (const book of Array.isArray(saved) ? saved : []) if (bookId(book)) entries = updateLibraryEntry(entries, book);
    for (const book of Array.isArray(history) ? history : []) {
      if (!bookId(book)) continue;
      let meta = {};
      try { meta = JSON.parse(storage.getItem(`book_${bookId(book)}`) || '{}'); } catch { /* optional metadata */ }
      entries = updateLibraryEntry(entries, { ...meta, ...book, readable: /^\d+$/.test(bookId(book)), gutenberg_id: /^\d+$/.test(bookId(book)) ? bookId(book) : '' }, {
        shelf: 'reading', lastReadAt: book.lastReadAt || 0, chapter: Math.max(0, Number(storage.getItem(`book_progress_${bookId(book)}`)) || 0),
      });
    }
    return entries;
  } catch { return []; }
}

const CATALOG_TTL = 24 * 60 * 60 * 1000;
const CATALOG_KEY = 'smarty-public-book-catalog-v1';
export function readBookCatalogCache(key, storage = window.localStorage, now = Date.now()) {
  try {
    const records = JSON.parse(storage.getItem(CATALOG_KEY) || '{}');
    const record = records[key];
    return record && now - record.at < CATALOG_TTL && Array.isArray(record.value?.books) ? record.value : null;
  } catch { return null; }
}
export function saveBookCatalogCache(key, value, storage = window.localStorage, now = Date.now()) {
  try {
    const records = JSON.parse(storage.getItem(CATALOG_KEY) || '{}');
    const valid = Object.entries(records).filter(([, record]) => record && now - record.at < CATALOG_TTL);
    const next = Object.fromEntries(valid.sort((a, b) => b[1].at - a[1].at).slice(0, 11));
    next[key] = { at: now, value }; storage.setItem(CATALOG_KEY, JSON.stringify(next)); return true;
  } catch { return false; }
}
