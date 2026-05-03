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
        });
      }
    } catch {
      // ignore
    }
  });

  return items;
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

            const fixedBook = {
              ...book,
              title,
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

  return (
    <main className="books-page">
      <section className="books-hero">
        <div>
          <span className="books-pill">Premium Library</span>
          <h1>Read, save, and continue your books.</h1>
          <p>
            Your personal reading space for classics, bookmarked chapters,
            and books you want to continue later.
          </p>

          <div className="books-actions">
            <button onClick={() => navigate('/read-books')}>
              Read Books
            </button>

            <button className="secondary" onClick={() => navigate('/read-books')}>
              Open Library
            </button>
          </div>
        </div>

        <div className="books-hero-card">
          <div className="book-glow">📚</div>
          <h3>Smarty Library</h3>
          <p>Curated reading, chapter progress, bookmarks, and cached books.</p>
        </div>
      </section>

      <section className="books-grid">

        <article className="books-card">
          <span>Progress</span>
          <h2>Continue Reading</h2>

          {history.length === 0 ? (
            <p>No recent books yet. Start reading to see them here.</p>
          ) : (
            <div className="mini-book-list">
              {history.map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/read-book/${book.id}`)}
                >
                  <strong>{getSavedBookTitle(book.id, book)}</strong>
                  <small>Continue →</small>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="books-card">
          <span>Saved chapters</span>
          <h2>Bookmarks</h2>

          {bookmarkedBooks.length === 0 ? (
            <p>No bookmarked books yet. Bookmark a chapter while reading.</p>
          ) : (
            <div className="mini-book-list">
              {bookmarkedBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/read-book/${book.id}`)}
                >
                  <strong>{book.title}</strong>
                  <small>{book.count} bookmark{book.count > 1 ? 's' : ''}</small>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}