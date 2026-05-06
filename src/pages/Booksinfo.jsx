import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LibraryBig } from 'lucide-react';
import './Booksinfo.css';

function getReadingHistory() {
  try {
    return JSON.parse(localStorage.getItem('reading_history') || '[]');
  } catch {
    return [];
  }
}

function getSavedBookTitle(bookId, fallbackBook = {}, historyCache = null) {
  const fallbackTitle = fallbackBook.title || fallbackBook.name;

  if (fallbackTitle && fallbackTitle !== `Book #${bookId}`) {
    return fallbackTitle;
  }

  try {
    const savedBook = JSON.parse(localStorage.getItem(`book_${bookId}`) || '{}');

    if (savedBook.title && savedBook.title !== `Book #${bookId}`) {
      return savedBook.title;
    }
  } catch {
    // ignore
  }

  try {
    const history = historyCache || getReadingHistory();
    const historyBook = history.find((book) => String(book.id) === String(bookId));

    if (historyBook?.title && historyBook.title !== `Book #${bookId}`) {
      return historyBook.title;
    }
  } catch {
    // ignore
  }

  try {
    const bookmarks = JSON.parse(localStorage.getItem(`bookmarks_${bookId}`) || '[]');
    const bookmarkWithTitle = bookmarks.find((bookmark) => bookmark.title || bookmark.bookTitle);
    const bookmarkTitle = bookmarkWithTitle?.title || bookmarkWithTitle?.bookTitle;

    if (bookmarkTitle && bookmarkTitle !== `Book #${bookId}`) {
      return bookmarkTitle;
    }
  } catch {
    // ignore
  }

  return `Book #${bookId}`;
}

function getAllBookmarkedBooks(historyCache = null) {
  const items = [];

  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith('bookmarks_')) return;

    try {
      const bookId = key.replace('bookmarks_', '');
      const bookmarks = JSON.parse(localStorage.getItem(key) || '[]');

      if (bookmarks.length > 0) {
        const cover = getSavedBookCover(bookId, {}, historyCache);

        items.push({
          id: bookId,
          title: getSavedBookTitle(bookId, {}, historyCache),
          count: bookmarks.length,
          cover,
          coverUrl: cover,
        });
      }
    } catch {
      // ignore
    }
  });

  return items;
}

function getTotalBookmarkCount(bookmarkedBooks) {
  return bookmarkedBooks.reduce((total, book) => total + (book.count || 0), 0);
}

function getBookProgress(bookId) {
  const keys = [
    `book_progress_${bookId}`,
    `book-progress-${bookId}`,
    `reader_progress_${bookId}`,
    `reader-progress-${bookId}`,
  ];

  for (const key of keys) {
    const value = Number(localStorage.getItem(key));

    if (!Number.isNaN(value) && value > 0) {
      return Math.min(100, Math.max(0, value));
    }
  }

  return 0;
}

function getSavedBookCover(bookId, fallbackBook = {}, historyCache = null) {
  if (fallbackBook.cover || fallbackBook.coverUrl) {
    return fallbackBook.cover || fallbackBook.coverUrl;
  }

  try {
    const savedBook = JSON.parse(localStorage.getItem(`book_${bookId}`) || '{}');

    if (savedBook.cover || savedBook.coverUrl) {
      return savedBook.cover || savedBook.coverUrl;
    }
  } catch {
    // ignore
  }

  try {
    const history = historyCache || getReadingHistory();
    const historyBook = history.find((book) => String(book.id) === String(bookId));

    if (historyBook?.cover || historyBook?.coverUrl) {
      return historyBook.cover || historyBook.coverUrl;
    }
  } catch {
    // ignore
  }

  return '';
}

const MiniBookButton = memo(function MiniBookButton({
  book,
  index,
  history,
  navigate,
  bookmarkMode = false,
}) {
  const title = bookmarkMode
    ? book.title
    : getSavedBookTitle(book.id, book, history);

  const cover = getSavedBookCover(book.id, book, history) || '/default-book-cover.png';
  const progress = getBookProgress(book.id);

  const handleOpen = () => {
    if (book.id) navigate(`/read-book/${book.id}`);
  };

  return (
    <button
      disabled={!book.id}
      onClick={handleOpen}
    >
      <span className="mini-cover" aria-hidden="true">
        <img
          src={cover}
          alt=""
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 2 ? 'high' : 'auto'}
        />
      </span>

      <span className="mini-book-info">
        <strong>{title}</strong>

        {bookmarkMode ? (
          <small>
            {book.count} bookmark{book.count > 1 ? 's' : ''}
          </small>
        ) : (
          <small>Continue →</small>
        )}

        <span className="book-progress-track">
          <span style={{ width: `${progress}%` }} />
        </span>
      </span>
    </button>
  );
});

export default function Booksinfo() {
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const titleAbortRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    mountedRef.current = true;

    const refreshBooksInfo = () => {
      if (mountedRef.current) setRefreshKey((prev) => prev + 1);
    };

    window.addEventListener('focus', refreshBooksInfo);
    window.addEventListener('storage', refreshBooksInfo);
    window.addEventListener('books-info-refresh', refreshBooksInfo);

    return () => {
      mountedRef.current = false;
      titleAbortRef.current?.abort();
      window.removeEventListener('focus', refreshBooksInfo);
      window.removeEventListener('storage', refreshBooksInfo);
      window.removeEventListener('books-info-refresh', refreshBooksInfo);
    };
  }, []);

  useEffect(() => {
    async function fixMissingTitles() {
      const currentHistory = getReadingHistory();
      const booksNeedingTitles = currentHistory.filter(
        (book) => book?.id && (!book.title || book.title.startsWith('Book #'))
      );

      if (booksNeedingTitles.length === 0) return;

      titleAbortRef.current?.abort();
      titleAbortRef.current = new AbortController();

      let changed = false;
      const fixedMap = new Map();

      await Promise.allSettled(
        booksNeedingTitles.slice(0, 8).map(async (book) => {
          try {
            const response = await fetch(`https://openlibrary.org/works/${book.id}.json`, {
              signal: titleAbortRef.current.signal,
            });

            if (!response.ok) return;

            const data = await response.json();
            const title = data.title || book.title;

            if (!title || title.startsWith('Book #')) return;

            const coverUrl = data.covers?.[0]
              ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
              : book.cover || book.coverUrl || '';

            fixedMap.set(String(book.id), {
              ...book,
              title,
              cover: coverUrl,
              coverUrl,
            });
          } catch (err) {
            if (err?.name !== 'AbortError') console.error('Failed to fix book title:', err);
          }
        })
      );

      if (!mountedRef.current || fixedMap.size === 0) return;

      const fixedHistory = currentHistory.map((book) => {
        const fixedBook = fixedMap.get(String(book.id));
        if (!fixedBook) return book;

        changed = true;
        try {
          localStorage.setItem(`book_${book.id}`, JSON.stringify(fixedBook));
        } catch {
          // ignore
        }
        return fixedBook;
      });

      if (changed) {
        try {
          localStorage.setItem('reading_history', JSON.stringify(fixedHistory));
        } catch {
          // ignore
        }
        if (mountedRef.current) setRefreshKey((prev) => prev + 1);
      }
    }

    fixMissingTitles();

    return () => {
      titleAbortRef.current?.abort();
    };
  }, [location.pathname]);

  const history = useMemo(() => getReadingHistory(), [refreshKey]);
  const bookmarkedBooks = useMemo(() => getAllBookmarkedBooks(history), [history]);
  const totalBookmarks = useMemo(() => getTotalBookmarkCount(bookmarkedBooks), [bookmarkedBooks]);
  const latestBook = history[0];
  const latestBookTitle = useMemo(
    () => (latestBook ? getSavedBookTitle(latestBook.id, latestBook, history) : ''),
    [history, latestBook]
  );

  const goReadBooks = useCallback(() => {
    navigate('/read-books');
  }, [navigate]);

  const goPreviewBooks = useCallback(() => {
    navigate('/preview-books');
  }, [navigate]);

  const goContinueReading = useCallback(() => {
    if (latestBook?.id) {
      navigate(`/read-book/${latestBook.id}`);
      return;
    }

    navigate('/read-books');
  }, [latestBook, navigate]);

  const renderedHistoryBooks = useMemo(
    () => history.slice(0, 6).map((book, index) => (
      <MiniBookButton
        key={book.id || `history-${index}`}
        book={book}
        index={index}
        history={history}
        navigate={navigate}
      />
    )),
    [history, navigate]
  );

  const renderedBookmarks = useMemo(
    () => bookmarkedBooks.slice(0, 6).map((book, index) => (
      <MiniBookButton
        key={book.id || `bookmark-${index}`}
        book={book}
        index={index}
        history={history}
        navigate={navigate}
        bookmarkMode
      />
    )),
    [bookmarkedBooks, history, navigate]
  );

  return (
    <main className="books-page">
      <section className="books-hero">
        <div>
          <span className="books-pill">SMARTY LIBRARY</span>
          <h1>Your reading home.</h1>
          <p>
            Continue books, revisit saved chapters, and keep your reading flow in one clean place.
          </p>

          <div className="books-actions">
            <button onClick={goReadBooks}>
              Start Reading
            </button>

            <button className="secondary" onClick={goReadBooks}>
              Open Library
            </button>
          </div>
        </div>

        <div className="books-hero-card">
          <div className="book-glow" aria-hidden="true">
            <LibraryBig size={34} strokeWidth={2.1} />
          </div>
          <h3>{latestBook ? latestBookTitle : 'Ready to read?'}</h3>
          <p>
            {latestBook
              ? 'Your latest book is ready when you are.'
              : 'Start a book and your progress will appear here.'}
          </p>

          <div className="books-stat-row">
            <div>
              <strong>{history.length}</strong>
              <span>Recent</span>
            </div>
            <div>
              <strong>{totalBookmarks}</strong>
              <span>Bookmarks</span>
            </div>
          </div>
        </div>
      </section>
      <section className="books-quick-strip">
        <button type="button" onClick={goReadBooks}>
          <span>Browse</span>
          <strong>Find something new</strong>
        </button>

        <button
          type="button"
          onClick={goContinueReading}
        >
          <span>Continue</span>
          <strong>{latestBook ? latestBookTitle : 'No book yet'}</strong>
        </button>

        <button type="button" onClick={goReadBooks}>
          <span>Library</span>
          <strong>Open book search</strong>
        </button>
      </section>

      <section className="books-discover-panel">
        <div className="books-discover-copy">
          <span className="books-pill">DISCOVER MORE</span>
          <h2>Preview books before you read.</h2>
          <p>
            Some OpenLibrary books cannot be fully read inside Smarty because full text is not available.
            You can still preview details, editions, and availability on the external OpenLibrary website.
          </p>
        </div>

        <div className="books-discover-actions">
          <button type="button" onClick={goPreviewBooks}>
            Preview Only Books
          </button>

          <button className="secondary" type="button" onClick={goReadBooks}>
            Read Now Books
          </button>
        </div>
      </section>

      <section className="books-grid">

        <article className="books-card">
          <span>Progress</span>
          <h2>Continue Reading</h2>

          {history.length === 0 ? (
            <div className="books-empty-state">
              <strong>No recent books yet</strong>
              <p>Choose a book from the library and it will appear here automatically.</p>
              <button type="button" onClick={goReadBooks}>Browse Books</button>
            </div>
          ) : (
            <div className="mini-book-list">
              {renderedHistoryBooks}
            </div>
          )}
        </article>

        <article className="books-card">
          <span>Saved chapters</span>
          <h2>Bookmarks</h2>

          {bookmarkedBooks.length === 0 ? (
            <div className="books-empty-state">
              <strong>No bookmarks yet</strong>
              <p>Save important chapters while reading so you can return to them later.</p>
              <button type="button" onClick={goReadBooks}>Find a Book</button>
            </div>
          ) : (
            <div className="mini-book-list">
              {renderedBookmarks}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}