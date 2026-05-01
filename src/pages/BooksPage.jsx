import { useEffect, useMemo, useRef, useState } from 'react';
import './BooksPage.css';

const CACHE_PREFIX = 'open_library_books_';
const CACHE_TTL = 1000 * 60 * 30;
const DEFAULT_QUERY = 'psychology';
const PAGE_SIZE = 12;

function getCacheKey(query) {
  return `${CACHE_PREFIX}${query.toLowerCase().trim()}`;
}

function getCachedBooks(query) {
  try {
    const cached = JSON.parse(localStorage.getItem(getCacheKey(query)));

    if (!cached) return null;

    const expired = Date.now() - cached.timestamp > CACHE_TTL;

    if (expired) {
      localStorage.removeItem(getCacheKey(query));
      return null;
    }

    return cached.books;
  } catch {
    return null;
  }
}

function setCachedBooks(query, books) {
  localStorage.setItem(
    getCacheKey(query),
    JSON.stringify({
      timestamp: Date.now(),
      books,
    })
  );
}

function BookSkeleton() {
  return (
    <div className="book-card skeleton-card">
      <div className="skeleton-cover" />
      <div className="book-card-body">
        <div className="skeleton-line large" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  );
}

export default function BooksPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState(DEFAULT_QUERY);
  const [books, setBooks] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');

  const loaderRef = useRef(null);
  const abortRef = useRef(null);

  async function fetchBooks(searchTerm, forceRefresh = false) {
    const cleanQuery = searchTerm.trim();

    if (!cleanQuery) return;

    setError('');
    setVisibleCount(PAGE_SIZE);

    const cachedBooks = getCachedBooks(cleanQuery);

    if (cachedBooks && !forceRefresh) {
      setBooks(cachedBooks);
      setFromCache(true);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFromCache(false);

    try {
      const params = new URLSearchParams({
        q: cleanQuery,
        limit: '60',
        fields:
          'key,title,author_name,first_publish_year,cover_i,edition_count,language',
      });

      const response = await fetch(
        `https://openlibrary.org/search.json?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to load books.');
      }

      const data = await response.json();
      const results = Array.isArray(data.docs) ? data.docs : [];

      setBooks(results);
      setCachedBooks(cleanQuery, results);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchBooks(activeQuery);

    return () => {
      abortRef.current?.abort();
    };
  }, [activeQuery]);

  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, books.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [books.length]);

  const visibleBooks = useMemo(() => {
    return books.slice(0, visibleCount);
  }, [books, visibleCount]);

  return (
    <section className="books-page">
      <div className="books-hero">
        <div>
          <span className="books-kicker">Open Library</span>
          <h1>Discover Books</h1>
          <p>
            Search books from the Internet Archive’s Open Library with cached,
            fast-loading results.
          </p>
        </div>

        <button
          className="refresh-books-btn"
          onClick={() => fetchBooks(activeQuery, true)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="books-search">
        <input
          type="search"
          placeholder="Search books, authors, or subjects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {fromCache && !loading && (
        <p className="cache-note">Showing cached results</p>
      )}

      {loading && (
        <div className="books-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <BookSkeleton key={index} />
          ))}
        </div>
      )}

      {error && <p className="books-status error">{error}</p>}

      {!loading && !error && visibleBooks.length === 0 && (
        <p className="books-status">No books found.</p>
      )}

      {!loading && !error && visibleBooks.length > 0 && (
        <>
          <div className="books-grid">
            {visibleBooks.map((book, index) => {
              const coverUrl = book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : null;

              const bookUrl = book.key
                ? `https://openlibrary.org${book.key}`
                : 'https://openlibrary.org';

              return (
                <article className="book-card" key={`${book.key}-${index}`}>
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={book.title || 'Book cover'}
                      loading="lazy"
                    />
                  ) : (
                    <div className="missing-cover">No Cover</div>
                  )}

                  <div className="book-card-body">
                    <h3>{book.title || 'Untitled Book'}</h3>

                    <p>
                      {book.author_name?.slice(0, 2).join(', ') ||
                        'Unknown author'}
                    </p>

                    <span>
                      {book.first_publish_year
                        ? `First published ${book.first_publish_year}`
                        : 'Publication year unknown'}
                    </span>

                    <a href={bookUrl} target="_blank" rel="noreferrer">
                      View Book
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <div ref={loaderRef} className="scroll-loader">
            {visibleCount < books.length
              ? 'Loading more books...'
              : 'You reached the end'}
          </div>
        </>
      )}
    </section>
  );
}