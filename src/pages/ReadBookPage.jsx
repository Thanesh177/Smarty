import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readBooksApi } from '../api/client';
import './ReadBookPage.css';

const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 24;

const CATEGORIES = [
  { title: 'Popular Classics', search: '' },
  { title: 'Psychology', search: 'psychology' },
  { title: 'Fiction', search: 'fiction' },
  { title: 'Adventure', search: 'adventure' },
  { title: 'Science', search: 'science' },
  { title: 'Philosophy', search: 'philosophy' },
];

const QUICK_SEARCHES = [
  'Sherlock Holmes',
  'Jane Austen',
  'psychology',
  'philosophy',
  'science fiction',
  'adventure',
  'history',
  'poetry',
];

const CATEGORY_FILTERS = [
  { label: 'All categories', value: '' },
  { label: 'Fiction', value: 'fiction' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Psychology', value: 'psychology' },
  { label: 'Philosophy', value: 'philosophy' },
  { label: 'Science', value: 'science' },
  { label: 'History', value: 'history' },
  { label: 'Poetry', value: 'poetry' },
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

  if (Array.isArray(book.author_name)) {
    return book.author_name.join(', ');
  }

  return book.author || book.author_name || 'Unknown author';
}

function getSearchText(book) {
  return [
    getTitle(book),
    getAuthor(book),
    book.subject,
    book.subjects,
    book.description,
    book.language,
  ]
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function mergeUniqueBooks(existingBooks, newBooks) {
  const seen = new Set(existingBooks.map((book) => String(getBookId(book) || getTitle(book))));
  const merged = [...existingBooks];

  newBooks.forEach((book) => {
    const key = String(getBookId(book) || getTitle(book));

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(book);
    }
  });

  return merged;
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

function getBookCover(book) {
  return book.cover || book.coverUrl || (book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '');
}

function isBookReadable(book) {
  return Boolean(book.readable || book.gutenberg_id || book.book_id);
}

function matchesAccessFilter(book, filter) {
  if (filter === 'read') return isBookReadable(book);
  if (filter === 'preview') return !isBookReadable(book);
  return true;
}

function getBookPreviewUrl(book) {
  const id = getBookId(book);
  return book.previewUrl || book.openLibraryUrl || (id ? `https://openlibrary.org/works/${id}` : 'https://openlibrary.org');
}

function getReadBookId(book) {
  return book.gutenberg_id || book.book_id || book.ia || getBookId(book);
}

export default function ReadBookPage() {
  const location = useLocation();
  const isPreviewPage = location.pathname === '/preview-books';
  const [rows, setRows] = useState({});
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState(isPreviewPage ? 'preview' : 'read');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(false);
  const [browseBooks, setBrowseBooks] = useState([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [hasMoreBrowse, setHasMoreBrowse] = useState(true);
  const [savedBooks, setSavedBooks] = useState(getSavedBooks);
  const [loadingRows, setLoadingRows] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadMoreRef = useRef(null);
  const searchAbort = useRef(null);

  const cleanQuery = query.trim();
  const cleanAuthorFilter = authorFilter.trim();
  const cleanYearFilter = yearFilter.trim();
  const activeSearchText = cleanQuery;
const hasActiveFilters = Boolean(activeSearchText || cleanAuthorFilter || cleanYearFilter || categoryFilter);

  useEffect(() => {
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
  }, [isPreviewPage]);

  const readingHistory = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('reading_history') || '[]');

      return raw.filter((book) => {
        if (!book?.id) return false;
        if (!book.title || book.title.startsWith('Book #')) return false;
        return true;
      });
    } catch {
      return [];
    }
  }, []);

  const allLoadedBooks = useMemo(() => {
    const rowBooks = Object.values(rows).flat();
    return mergeUniqueBooks([...savedBooks, ...readingHistory], [...rowBooks, ...browseBooks]);
  }, [browseBooks, readingHistory, rows, savedBooks]);

  const instantMatches = useMemo(() => {
    if (!cleanQuery) return [];

    const words = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

    return allLoadedBooks
      .filter((book) => {
        const searchText = getSearchText(book);
        return words.every((word) => searchText.includes(word));
      })
      .slice(0, 8);
  }, [allLoadedBooks, cleanQuery]);

  const visibleInstantMatches = useMemo(
    () => instantMatches.filter((book) => matchesAccessFilter(book, accessFilter)),
    [accessFilter, instantMatches]
  );

  const visibleSearchResults = useMemo(
    () => searchResults.filter((book) => matchesAccessFilter(book, accessFilter)),
    [accessFilter, searchResults]
  );

  const visibleBrowseBooks = useMemo(
    () => browseBooks.filter((book) => matchesAccessFilter(book, accessFilter)),
    [accessFilter, browseBooks]
  );

  const visibleSavedBooks = useMemo(
    () => savedBooks.filter((book) => matchesAccessFilter(book, accessFilter)),
    [accessFilter, savedBooks]
  );

  const visibleReadingHistory = useMemo(
    () => readingHistory.filter((book) => matchesAccessFilter(book, accessFilter)),
    [accessFilter, readingHistory]
  );

  const visibleRows = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rows).map(([title, books]) => [
          title,
          books.filter((book) => matchesAccessFilter(book, accessFilter)),
        ])
      ),
    [accessFilter, rows]
  );

  const loadBrowsePage = useCallback(async (pageToLoad = 1) => {
    setLoadingMore(true);
    setError('');

    try {
      const books = await readBooksApi.getBooks({
        search: categoryFilter,
        author: cleanAuthorFilter,
        year: cleanYearFilter,
        category: categoryFilter,
        page: pageToLoad,
        page_size: SEARCH_PAGE_SIZE,
      });

      setBrowseBooks((currentBooks) => (
        pageToLoad === 1 ? books : mergeUniqueBooks(currentBooks, books)
      ));
      setBrowsePage(pageToLoad);
      setHasMoreBrowse(books.length >= SEARCH_PAGE_SIZE);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'canceled' || err.code === 'ERR_CANCELED') {
        return;
      }

      setError(err.message || 'Failed to load more books.');
    } finally {
      setLoadingMore(false);
    }
  }, [categoryFilter, cleanAuthorFilter, cleanYearFilter]);

  const loadSearchPage = useCallback(async (searchText, pageToLoad = 1) => {
    if (!searchText) return;

    searchAbort.current?.abort();
    searchAbort.current = new AbortController();

    setSearching(pageToLoad === 1);
    setLoadingMore(pageToLoad > 1);
    setError('');

    try {
      const books = await readBooksApi.getBooks(
        {
          search: searchText,
          author: cleanAuthorFilter,
          year: cleanYearFilter,
          category: categoryFilter,
          page: pageToLoad,
          page_size: SEARCH_PAGE_SIZE,
        },
        { signal: searchAbort.current.signal }
      );

      setSearchResults((currentBooks) => (
        pageToLoad === 1 ? books : mergeUniqueBooks(currentBooks, books)
      ));
      setSearchPage(pageToLoad);
      setHasMoreSearch(books.length >= SEARCH_PAGE_SIZE);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'canceled' || err.code === 'ERR_CANCELED') {
        return;
      }

      setError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }, [categoryFilter, cleanAuthorFilter, cleanYearFilter]);

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
    loadBrowsePage(1);
  }, [loadBrowsePage]);

  useEffect(() => {
    if (!hasActiveFilters) {
      setSearchResults([]);
      setSearchPage(1);
      setHasMoreSearch(false);
      loadBrowsePage(1);
      return;
    }

    const timer = setTimeout(() => {
      loadSearchPage(activeSearchText || 'books', 1);
    }, 180);

    return () => clearTimeout(timer);
  }, [activeSearchText, cleanAuthorFilter, cleanYearFilter, hasActiveFilters, loadBrowsePage, loadSearchPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting;

        if (!isVisible || loadingMore || searching) return;

        if (hasActiveFilters && hasMoreSearch) {
          loadSearchPage(activeSearchText || 'books', searchPage + 1);
        }

        if (!hasActiveFilters && hasMoreBrowse) {
          loadBrowsePage(browsePage + 1);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    browsePage,
    activeSearchText,
    hasActiveFilters,
    hasMoreBrowse,
    hasMoreSearch,
    loadBrowsePage,
    loadSearchPage,
    loadingMore,
    searchPage,
    searching,
    cleanAuthorFilter,
    cleanYearFilter,
  ]);

  function handleSubmitSearch(event) {
    event.preventDefault();

    if (hasActiveFilters) {
      loadSearchPage(activeSearchText || 'books', 1);
    }
  }

  function clearSearch() {
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setQuery('');
    setAuthorFilter('');
    setYearFilter('');
    setCategoryFilter('');
    setSearchResults([]);
    setSearchPage(1);
    setHasMoreSearch(false);
    setError('');
  }

  function runQuickSearch(searchText) {
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setQuery(searchText);
    setCategoryFilter('');
    setAuthorFilter('');
    setYearFilter('');
    loadSearchPage(searchText, 1);
  }

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

  function applyCategoryFilter(value) {
    setCategoryFilter(value);
    setQuery('');
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setAuthorFilter('');
    setYearFilter('');
  }

  function BookCard({ book }) {
    const id = getBookId(book);
    const title = getTitle(book);
    const readId = getReadBookId(book);
    const author = getAuthor(book);
    const cover = getBookCover(book);
    const readable = isBookReadable(book);
    const previewUrl = getBookPreviewUrl(book);

    return (
      <article className="read-book-card">
        <div className="book-cover-placeholder">
          {cover && (
            <img
              src={cover}
              alt={`${title} cover`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span>{title.slice(0, 1)}</span>
        </div>

        <div className="read-book-body">
          <h3>{title}</h3>
          <p>{author}</p>
          <small>
            {readable
              ? 'Readable text available'
              : 'Preview only · opens externally'}
          </small>
          <div className="read-book-actions">
            {id && readable ? (
              <Link to={`/read-book/${readId}`}>Read</Link>
            ) : id ? (
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Preview
              </a>
            ) : (
              <button type="button" disabled>Unavailable</button>
            )}
            <button type="button" onClick={() => toggleSave(book)}>
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

  function BookGrid({ title, books }) {
    if (!books?.length) return null;

    return (
      <section className="book-row">
        <h2>{title}</h2>

        <div className="book-results-grid">
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
          <span className="read-books-kicker">
            {isPreviewPage ? 'External previews' : 'Books for everyone'}
          </span>
          <h1>{isPreviewPage ? 'Preview Books' : 'Read Free Books'}</h1>
          <p>
            {isPreviewPage
              ? 'These books cannot be fully read inside Smarty. Preview opens on OpenLibrary in a new tab.'
              : 'Search readable public-domain books and keep scrolling for more.'}
          </p>
        </div>
      </div>

      <form className="read-books-search" onSubmit={handleSubmitSearch}>
        <div className="read-books-search-box">
          <span aria-hidden="true">🔎</span>
          <input
            type="search"
            placeholder="Search by title, author, or subject..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {query && (
            <button className="search-clear-btn" type="button" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>

        <div className="book-filters">
          <input
            type="text"
            placeholder="Author"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
          />

          <input
            type="number"
            placeholder="Year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          />

          <select
            value={categoryFilter}
            onChange={(e) => applyCategoryFilter(e.target.value)}
          >
            {CATEGORY_FILTERS.map((category) => (
              <option key={category.value || 'all'} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="category-bar" aria-label="Book categories">
          {CATEGORY_FILTERS.map((category) => (
            <button
              type="button"
              key={category.value || 'all-categories'}
              className={`category-btn ${categoryFilter === category.value ? 'active' : ''}`}
              onClick={() => applyCategoryFilter(category.value)}
            >
              {category.label.replace('All categories', 'All')}
            </button>
          ))}
        </div>

        <div className="access-filter-bar" aria-label="Reading access filter">
          {[
            ['read', 'Read Now'],
            ['preview', 'Preview Only'],
            ['all', 'All Books'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`access-filter-btn ${accessFilter === value ? 'active' : ''}`}
              onClick={() => setAccessFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="quick-searches" aria-label="Quick book searches">
          {QUICK_SEARCHES.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => runQuickSearch(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </form>
      {error && error !== 'canceled' && error !== 'Canceled' && (
        <p className="read-books-status error">{error}</p>
      )}

      {hasActiveFilters && visibleInstantMatches.length > 0 && visibleSearchResults.length === 0 && (
        <BookRow title="Instant matches from your library" books={visibleInstantMatches} />
      )}

      {hasActiveFilters && (
        <BookGrid
          title={
            searching
              ? 'Searching the full library...'
              : `${visibleSearchResults.length} result${visibleSearchResults.length === 1 ? '' : 's'} found`
          }
          books={visibleSearchResults}
        />
      )}

      {hasActiveFilters && !searching && visibleSearchResults.length === 0 && !error && (
        <p className="read-books-status">No books found. Try another title, author, or subject.</p>
      )}

      {!hasActiveFilters && visibleReadingHistory.length > 0 && (
        <BookRow title="Continue Reading" books={visibleReadingHistory} />
      )}

      {!hasActiveFilters && visibleSavedBooks.length > 0 && (
        <BookRow title="Saved Books" books={visibleSavedBooks} />
      )}

      {loadingRows && <p className="read-books-status">Loading books...</p>}

      {!loadingRows &&
        !hasActiveFilters &&
        Object.entries(visibleRows).map(([title, books]) => (
          <BookRow key={title} title={title} books={books} />
        ))}

      {!hasActiveFilters && <BookGrid title="More Books" books={visibleBrowseBooks} />}

      <div ref={loadMoreRef} className="book-load-sentinel" />

      {loadingMore && <p className="read-books-status">Loading more books...</p>}

      {!hasActiveFilters && !hasMoreBrowse && visibleBrowseBooks.length > 0 && (
        <p className="read-books-status">You have reached the end.</p>
      )}

      {hasActiveFilters && !hasMoreSearch && visibleSearchResults.length > 0 && (
        <p className="read-books-status">No more search results.</p>
      )}
    </section>
  );
}