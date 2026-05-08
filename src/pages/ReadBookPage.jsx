import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { readBooksApi } from '../api/client';
import './ReadBookPage.css';

const PAGE_SIZE = 12;
const SEARCH_PAGE_SIZE = 24;
const READ_BOOK_ROWS_CACHE_KEY = 'smarty_read_book_rows_cache_v1';
const READ_BOOK_BROWSE_CACHE_KEY = 'smarty_read_book_browse_cache_v1';
const READ_BOOK_CACHE_MAX_AGE = 1000 * 60 * 5;

const CATEGORIES = [
  { title: 'Popular Classics', search: '' },
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

function BooksLoading({ message = 'Loading books...' }) {
  return (
    <div className="books-loading-card" role="status" aria-live="polite">
      <div className="premium-book-loader" aria-hidden="true">
        <span />
      </div>

      <div className="books-loading-copy">
        <strong>{message}</strong>
        <p>Curating your next read...</p>
      </div>
    </div>
  );
}

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

function readSessionCache(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || Date.now() - Number(parsed.savedAt || 0) > READ_BOOK_CACHE_MAX_AGE) {
      return fallback;
    }

    return parsed.value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSessionCache(key, value) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        value,
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function deferReadBookStartup(callback) {
  if (typeof window === 'undefined') return undefined;

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 900 });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timer = window.setTimeout(callback, 120);
  return () => window.clearTimeout(timer);
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

const BookCard = memo(function BookCard({ book, saved, onToggleSave }) {
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
            decoding="async"
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
          <button type="button" onClick={() => onToggleSave(book)}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  );
});

const BookRow = memo(function BookRow({ title, books, savedBookIds, onToggleSave }) {
  if (!books?.length) return null;

  return (
    <section className="book-row">
      <h2>{title}</h2>

      <div className="book-row-scroll">
        {books.map((book, index) => {
          const id = getBookId(book);

          return (
            <BookCard
              key={`${title}-${id || getTitle(book)}-${index}`}
              book={book}
              saved={savedBookIds.has(String(id))}
              onToggleSave={onToggleSave}
            />
          );
        })}
      </div>
    </section>
  );
});

const BookGrid = memo(function BookGrid({ title, books, savedBookIds, onToggleSave }) {
  if (!books?.length) return null;

  return (
    <section className="book-row">
      <h2>{title}</h2>

      <div className="book-results-grid">
        {books.map((book, index) => {
          const id = getBookId(book);

          return (
            <BookCard
              key={`${title}-${id || getTitle(book)}-${index}`}
              book={book}
              saved={savedBookIds.has(String(id))}
              onToggleSave={onToggleSave}
            />
          );
        })}
      </div>
    </section>
  );
});

export default function ReadBookPage() {
  const location = useLocation();
  const isPreviewPage = location.pathname === '/preview-books';
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState(isPreviewPage ? 'preview' : 'read');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [hasMoreBrowse, setHasMoreBrowse] = useState(true);
  const [savedBooks, setSavedBooks] = useState(getSavedBooks);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState(() => readSessionCache(READ_BOOK_ROWS_CACHE_KEY, {}));
  const [browseBooks, setBrowseBooks] = useState(() => readSessionCache(READ_BOOK_BROWSE_CACHE_KEY, []));
  const [loadingRows, setLoadingRows] = useState(
    () => Object.keys(readSessionCache(READ_BOOK_ROWS_CACHE_KEY, {})).length === 0
  );

  const loadMoreRef = useRef(null);
  const mountedRef = useRef(true);
  const browseAbort = useRef(null);
  const lastBrowseKeyRef = useRef('');
  const searchAbort = useRef(null);
  const hasLoadedInitialDataRef = useRef(false);

  const cleanQuery = query.trim();
  const cleanAuthorFilter = authorFilter.trim();
  const cleanYearFilter = yearFilter.trim();
  const activeSearchText = cleanQuery;
  const hasActiveFilters = Boolean(activeSearchText || cleanAuthorFilter || cleanYearFilter || categoryFilter);
  const savedBookIds = useMemo(
    () => new Set(savedBooks.map((book) => String(getBookId(book)))),
    [savedBooks]
  );
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      searchAbort.current?.abort();
      browseAbort.current?.abort();
    };
  }, []);

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

  const suggestedBooks = useMemo(() => {
    if (!cleanQuery) return [];

    const words = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

    let pool = allLoadedBooks.length > 0 ? allLoadedBooks : browseBooks;

    const scored = pool
      .map((book) => {
        const text = getSearchText(book);
        let score = 0;

        words.forEach((word) => {
          if (text.includes(word)) score += 3;
          else if (text.includes(word.slice(0, Math.max(3, word.length - 2)))) score += 1;
        });

        return { book, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // fallback: if nothing matches, just show some popular books
    if (scored.length === 0) {
      return pool.slice(0, 6);
    }

    return scored.slice(0, 6).map((item) => item.book);
  }, [allLoadedBooks, browseBooks, cleanQuery]);

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
    const browseKey = JSON.stringify({
      search: categoryFilter,
      author: cleanAuthorFilter,
      year: cleanYearFilter,
      category: categoryFilter,
      page: pageToLoad,
    });

    if (lastBrowseKeyRef.current === browseKey && loadingMore) return;
    lastBrowseKeyRef.current = browseKey;

    browseAbort.current?.abort();
    browseAbort.current = new AbortController();

    setLoadingMore(true);
    setError('');

    try {
      const books = await readBooksApi.getBooks(
        {
          search: categoryFilter,
          author: cleanAuthorFilter,
          year: cleanYearFilter,
          category: categoryFilter,
          page: pageToLoad,
          page_size: SEARCH_PAGE_SIZE,
        },
        { signal: browseAbort.current.signal }
      );

      if (!mountedRef.current) return;

      const safeBooks = Array.isArray(books) ? books : [];

      setBrowseBooks((currentBooks) => {
        const nextBooks = pageToLoad === 1 ? safeBooks : mergeUniqueBooks(currentBooks, safeBooks);

        if (pageToLoad === 1 && !categoryFilter && !cleanAuthorFilter && !cleanYearFilter) {
          writeSessionCache(READ_BOOK_BROWSE_CACHE_KEY, nextBooks);
        }

        return nextBooks;
      });
      setBrowsePage(pageToLoad);
      setHasMoreBrowse(safeBooks.length >= SEARCH_PAGE_SIZE);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'canceled' || err.code === 'ERR_CANCELED') {
        return;
      }

      if (mountedRef.current) setError(err.message || 'Failed to load more books.');
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [categoryFilter, cleanAuthorFilter, cleanYearFilter, loadingMore]);

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

      if (!mountedRef.current) return;

      const safeBooks = Array.isArray(books) ? books : [];

      setSearchResults((currentBooks) => (
        pageToLoad === 1 ? safeBooks : mergeUniqueBooks(currentBooks, safeBooks)
      ));
      setSearchPage(pageToLoad);
      setHasMoreSearch(safeBooks.length >= SEARCH_PAGE_SIZE);
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'canceled' || err.code === 'ERR_CANCELED') {
        return;
      }

      if (mountedRef.current) setError(err.message || 'Search failed.');
    } finally {
      if (mountedRef.current) {
        setSearching(false);
        setLoadingMore(false);
      }
    }
  }, [categoryFilter, cleanAuthorFilter, cleanYearFilter]);

useEffect(() => {
  if (hasLoadedInitialDataRef.current) return undefined;
  hasLoadedInitialDataRef.current = true;

  async function loadRows() {
    const cachedRows = readSessionCache(READ_BOOK_ROWS_CACHE_KEY, {});

    if (Object.keys(cachedRows).length > 0) {
      setRows(cachedRows);
      setLoadingRows(false);
    } else {
      setLoadingRows(true);
    }

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

      if (!mountedRef.current) return;

      const nextRows = Object.fromEntries(
        results.map(([title, books]) => [title, Array.isArray(books) ? books : []])
      );

      writeSessionCache(READ_BOOK_ROWS_CACHE_KEY, nextRows);
      setRows(nextRows);
    } catch (err) {
      if (mountedRef.current) setError(err.message || 'Failed to load books.');
    } finally {
      if (mountedRef.current) setLoadingRows(false);
    }
  }

  return deferReadBookStartup(loadRows);
}, []);

useEffect(() => {
  if (!hasActiveFilters) {
    searchAbort.current?.abort();
    setSearchResults([]);
    setSearchPage(1);
    setHasMoreSearch(false);
    if (browseBooks.length === 0) {
      return deferReadBookStartup(() => loadBrowsePage(1));
    }

    return undefined;
  }

  const timer = window.setTimeout(() => {
    loadSearchPage(activeSearchText || categoryFilter || 'books', 1);
  }, 260);

  return () => window.clearTimeout(timer);
}, [activeSearchText, browseBooks.length, categoryFilter, cleanAuthorFilter, cleanYearFilter, hasActiveFilters, loadBrowsePage, loadSearchPage]);

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

  const handleSubmitSearch = useCallback((event) => {
    event.preventDefault();

    if (hasActiveFilters) {
      loadSearchPage(activeSearchText || categoryFilter || 'books', 1);
    }
  }, [activeSearchText, categoryFilter, hasActiveFilters, loadSearchPage]);

  const clearSearch = useCallback(() => {
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setQuery('');
    setAuthorFilter('');
    setYearFilter('');
    setCategoryFilter('');
    setSearchResults([]);
    setSearchPage(1);
    setHasMoreSearch(false);
    setError('');
    searchAbort.current?.abort();
  }, [isPreviewPage]);

  const runQuickSearch = useCallback((searchText) => {
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setQuery(searchText);
    setCategoryFilter('');
    setAuthorFilter('');
    setYearFilter('');
    searchAbort.current?.abort();
    loadSearchPage(searchText, 1);
  }, [isPreviewPage, loadSearchPage]);

  const toggleSave = useCallback((book) => {
    const id = getBookId(book);
    if (!id) return;

    setSavedBooks((currentSavedBooks) => {
      const exists = currentSavedBooks.some((item) => getBookId(item) === id);
      const updated = exists
        ? currentSavedBooks.filter((item) => getBookId(item) !== id)
        : [book, ...currentSavedBooks];

      saveSavedBooks(updated);
      return updated;
    });
  }, []);


  const applyCategoryFilter = useCallback((value) => {
    setCategoryFilter(value);
    setQuery('');
    setAccessFilter(isPreviewPage ? 'preview' : 'read');
    setAuthorFilter('');
    setYearFilter('');
  }, [isPreviewPage]);


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
          {/* <input
            type="text"
            placeholder="Author"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
          /> */}

          {/* <input
            type="number"
            placeholder="Year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          /> */}

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
{/* 
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
        </div> */}

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


        
{/*         <div className="quick-searches" aria-label="Quick book searches">
          {QUICK_SEARCHES.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => runQuickSearch(item)}
            >
              {item}
            </button>
          ))}
        </div> */}
      </form>
      {error && error !== 'canceled' && error !== 'Canceled' && (
        <p className="read-books-status error">{error}</p>
      )}

      {hasActiveFilters && visibleInstantMatches.length > 0 && visibleSearchResults.length === 0 && (
        <BookRow
          title="Instant matches from your library"
          books={visibleInstantMatches}
          savedBookIds={savedBookIds}
          onToggleSave={toggleSave}
        />
      )}

      {hasActiveFilters && (
        <BookGrid
          title={
            searching
              ? 'Searching the full library...'
              : `${visibleSearchResults.length} result${visibleSearchResults.length === 1 ? '' : 's'} found`
          }
          books={visibleSearchResults}
          savedBookIds={savedBookIds}
          onToggleSave={toggleSave}
        />
      )}

{hasActiveFilters && !searching && visibleSearchResults.length === 0 && !error && (
  <>
    <p className="read-books-status">
      No exact matches found. Showing closest suggestions.
    </p>

    {suggestedBooks.length > 0 && (
      <BookRow
        title="You might be looking for"
        books={suggestedBooks}
        savedBookIds={savedBookIds}
        onToggleSave={toggleSave}
      />
    )}
  </>
)}

      {!hasActiveFilters && visibleReadingHistory.length > 0 && (
        <BookRow
          title="Continue Reading"
          books={visibleReadingHistory}
          savedBookIds={savedBookIds}
          onToggleSave={toggleSave}
        />
      )}

      {!hasActiveFilters && visibleSavedBooks.length > 0 && (
        <BookRow
          title="Saved Books"
          books={visibleSavedBooks}
          savedBookIds={savedBookIds}
          onToggleSave={toggleSave}
        />
      )}

      {loadingRows && <BooksLoading message="Building your book shelves..." />}

      {!loadingRows &&
        !hasActiveFilters &&
        Object.entries(visibleRows).map(([title, books]) => (
          <BookRow
            key={title}
            title={title}
            books={books}
            savedBookIds={savedBookIds}
            onToggleSave={toggleSave}
          />
        ))}

      {!hasActiveFilters && (
        <BookGrid
          title="More Books"
          books={visibleBrowseBooks}
          savedBookIds={savedBookIds}
          onToggleSave={toggleSave}
        />
      )}

      <div ref={loadMoreRef} className="book-load-sentinel" />

      {loadingMore && <BooksLoading message="Loading more discoveries..." />}

      {!hasActiveFilters && !hasMoreBrowse && visibleBrowseBooks.length > 0 && (
        <p className="read-books-status">You have reached the end.</p>
      )}

      {hasActiveFilters && !hasMoreSearch && visibleSearchResults.length > 0 && (
        <p className="read-books-status">No more search results.</p>
      )}
    </section>
  );
}