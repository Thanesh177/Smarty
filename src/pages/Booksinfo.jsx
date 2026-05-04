import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Booksinfo.css';

function getReadingHistory() {
  try {
    return JSON.parse(localStorage.getItem('reading_history') || '[]');
  } catch {
    return [];
  }
}

function getSavedBookTitle(bookId, fallbackBook = {}) {
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
    const history = getReadingHistory();
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

function getAllBookmarkedBooks() {
  const items = [];

  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith('bookmarks_')) return;

    try {
      const bookId = key.replace('bookmarks_', '');
      const bookmarks = JSON.parse(localStorage.getItem(key) || '[]');

      if (bookmarks.length > 0) {
        items.push({
          id: bookId,
          title: getSavedBookTitle(bookId),
          count: bookmarks.length,
          cover: getSavedBookCover(bookId),
          coverUrl: getSavedBookCover(bookId),
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

function getSavedBookCover(bookId, fallbackBook = {}) {
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
    const history = getReadingHistory();
    const historyBook = history.find((book) => String(book.id) === String(bookId));

    if (historyBook?.cover || historyBook?.coverUrl) {
      return historyBook.cover || historyBook.coverUrl;
    }
  } catch {
    // ignore
  }

  return '';
}

export default function Booksinfo() {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refreshBooksInfo = () => setRefreshKey((prev) => prev + 1);

    window.addEventListener('focus', refreshBooksInfo);
    window.addEventListener('storage', refreshBooksInfo);

    return () => {
      window.removeEventListener('focus', refreshBooksInfo);
      window.removeEventListener('storage', refreshBooksInfo);
    };
  }, []);

  useEffect(() => {
    async function fixMissingTitles() {
      const currentHistory = getReadingHistory();
      let changed = false;

      const fixedHistory = await Promise.all(
        currentHistory.map(async (book) => {
          if (book.title && !book.title.startsWith('Book #')) {
            return book;
          }

          if (!book.id) {
            return book;
          }

          try {
            const response = await fetch(`https://openlibrary.org/works/${book.id}.json`);

            if (!response.ok) {
              return book;
            }

            const data = await response.json();
            const title = data.title || book.title;

            if (!title || title.startsWith('Book #')) {
              return book;
            }

            changed = true;

            const coverUrl = data.covers?.[0]
              ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
              : book.cover || book.coverUrl || '';

            const fixedBook = {
              ...book,
              title,
              cover: coverUrl,
              coverUrl,
            };

            localStorage.setItem(`book_${book.id}`, JSON.stringify(fixedBook));
            return fixedBook;
          } catch {
            return book;
          }
        })
      );

      if (changed) {
        localStorage.setItem('reading_history', JSON.stringify(fixedHistory));
        setRefreshKey((prev) => prev + 1);
      }
    }

    fixMissingTitles();
  }, [location.pathname]);

  const history = useMemo(() => getReadingHistory(), [refreshKey]);
  const bookmarkedBooks = useMemo(() => getAllBookmarkedBooks(), [refreshKey]);
  const totalBookmarks = useMemo(() => getTotalBookmarkCount(bookmarkedBooks), [bookmarkedBooks]);
  const latestBook = history[0];

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
            <button onClick={() => navigate('/read-books')}>
              Start Reading
            </button>

            <button className="secondary" onClick={() => navigate('/read-books')}>
              Open Library
            </button>
          </div>
        </div>

        <div className="books-hero-card">
          <div className="book-glow">📚</div>
          <h3>{latestBook ? getSavedBookTitle(latestBook.id, latestBook) : 'Ready to read?'}</h3>
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
        <button type="button" onClick={() => navigate('/read-books')}>
          <span>Browse</span>
          <strong>Find something new</strong>
        </button>

        <button
          type="button"
          onClick={() => latestBook ? navigate(`/read-book/${latestBook.id}`) : navigate('/read-books')}
        >
          <span>Continue</span>
          <strong>{latestBook ? getSavedBookTitle(latestBook.id, latestBook) : 'No book yet'}</strong>
        </button>

        <button type="button" onClick={() => navigate('/read-books')}>
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
          <button type="button" onClick={() => navigate('/preview-books')}>
            Preview Only Books
          </button>

          <button className="secondary" type="button" onClick={() => navigate('/read-books')}>
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
              <button type="button" onClick={() => navigate('/read-books')}>Browse Books</button>
            </div>
          ) : (
            <div className="mini-book-list">
              {history.slice(0, 6).map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/read-book/${book.id}`)}
                >
                  <span className="mini-cover" aria-hidden="true">
                    <img
  src={getSavedBookCover(book.id, book) || '/default-book-cover.png'}
  alt=""
  loading="lazy"
  onError={(e) => {
    e.currentTarget.src = '/default-book-cover.png';
  }}
/>
                  </span>

                  <span className="mini-book-info">
                    <strong>{getSavedBookTitle(book.id, book)}</strong>
                    <small>Continue →</small>

                    <span className="book-progress-track">
                      <span style={{ width: `${getBookProgress(book.id)}%` }} />
                    </span>
                  </span>
                </button>
              ))}
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
              <button type="button" onClick={() => navigate('/read-books')}>Find a Book</button>
            </div>
          ) : (
            <div className="mini-book-list">
              {bookmarkedBooks.slice(0, 6).map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/read-book/${book.id}`)}
                >
                  <span className="mini-cover" aria-hidden="true">
                    <img
                      src={getSavedBookCover(book.id, book) || '/default-book-cover.png'}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = '/default-book-cover.png';
                      }}
                    />
                  </span>

                  <span className="mini-book-info">
                    <strong>{book.title}</strong>
                    <small>{book.count} bookmark{book.count > 1 ? 's' : ''}</small>

                    <span className="book-progress-track">
                      <span style={{ width: `${getBookProgress(book.id)}%` }} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}