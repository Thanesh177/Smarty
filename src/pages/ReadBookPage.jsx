import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readBooksApi } from '../api/client';
import './ReadBookPage.css';

const PAGE_SIZE = 12;

const CATEGORIES = [
  { title: 'Popular Classics', search: '' },
  { title: 'Psychology', search: 'psychology' },
  { title: 'Fiction', search: 'fiction' },
  { title: 'Adventure', search: 'adventure' },
  { title: 'Science', search: 'science' },
  { title: 'Philosophy', search: 'philosophy' },
];

function getBookId(book) {
  return book.id || book.gutenberg_id || book.book_id || book.formats?.id;
}

function getTitle(book) {
  return book.title || book.name || 'Untitled Book';
}

function getAuthor(book) {
  if (Array.isArray(book.authors)) {
    return book.authors.map((a) => a.name || a).join(', ');
  }

  return book.author || book.author_name || 'Unknown author';
}

function getSavedBooks() {
  try {
    return JSON.parse(localStorage.getItem('saved_read_books') || '[]');
  } catch {
    return [];
  }
}

function saveSavedBooks(books) {
  localStorage.setItem('saved_read_books', JSON.stringify(books));
}

export default function ReadBookPage() {
  const [rows, setRows] = useState({});
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [savedBooks, setSavedBooks] = useState(getSavedBooks);
  const [loadingRows, setLoadingRows] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const searchAbort = useRef(null);

  useEffect(() => {
    async function loadRows() {
      setLoadingRows(true);
      setError('');

      try {
        const results = await Promise.all(
          CATEGORIES.map(async (category) => {
            const books = await readBooksApi.getBooks({
              search: category.search,
              page: 1,
              page_size: PAGE_SIZE,
            });

            return [category.title, books];
          })
        );

        setRows(Object.fromEntries(results));
      } catch (err) {
        setError(err.message || 'Failed to load books.');
      } finally {
        setLoadingRows(false);
      }
    }

    loadRows();
  }, []);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      searchAbort.current?.abort();
      searchAbort.current = new AbortController();

      setSearching(true);
      setError('');

      try {
        const books = await readBooksApi.getBooks({
          search: cleanQuery,
          page: 1,
          page_size: 30,
        });

        setSearchResults(books);
      } catch (err) {
        setError(err.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const readingHistory = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('reading_history') || '[]');
    } catch {
      return [];
    }
  }, []);

  function toggleSave(book) {
    const id = getBookId(book);
    if (!id) return;

    const exists = savedBooks.some((item) => getBookId(item) === id);

    const updated = exists
      ? savedBooks.filter((item) => getBookId(item) !== id)
      : [book, ...savedBooks];

    setSavedBooks(updated);
    saveSavedBooks(updated);
  }

  function isSaved(book) {
    const id = getBookId(book);
    return savedBooks.some((item) => getBookId(item) === id);
  }

  function BookCard({ book }) {
    const id = getBookId(book);
    const title = getTitle(book);
    const author = getAuthor(book);

    return (
      <article className="read-book-card">
        <div className="book-cover-placeholder">
          <span>{title.slice(0, 1)}</span>
        </div>

        <div className="read-book-body">
          <h3>{title}</h3>
          <p>{author}</p>

          <div className="read-book-actions">
            {id && <Link to={`/read-book/${id}`}>Read</Link>}

            <button onClick={() => toggleSave(book)}>
              {isSaved(book) ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  function BookRow({ title, books }) {
    if (!books?.length) return null;

    return (
      <section className="book-row">
        <h2>{title}</h2>

        <div className="book-row-scroll">
          {books.map((book, index) => (
            <BookCard key={`${title}-${getBookId(book)}-${index}`} book={book} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="read-books-page">
      <div className="read-books-hero">
        <div>
          <span className="read-books-kicker">Project Gutenberg</span>
          <h1>Read Free Books</h1>
          <p>Netflix-style public-domain reading library.</p>
        </div>
      </div>

      <div className="read-books-search">
        <input
          type="search"
          placeholder="Search books..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <p className="read-books-status error">{error}</p>}

      {query.trim() && (
        <BookRow
          title={searching ? 'Searching...' : `Search results for "${query}"`}
          books={searchResults}
        />
      )}

      {!query.trim() && readingHistory.length > 0 && (
        <BookRow title="Continue Reading" books={readingHistory} />
      )}

      {!query.trim() && savedBooks.length > 0 && (
        <BookRow title="Saved Books" books={savedBooks} />
      )}

      {loadingRows && <p className="read-books-status">Loading books...</p>}

      {!loadingRows &&
        !query.trim() &&
        Object.entries(rows).map(([title, books]) => (
          <BookRow key={title} title={title} books={books} />
        ))}
    </section>
  );
}