import { Link, useNavigate } from 'react-router-dom';
import './Booksinfo.css';

function getReadingHistory() {
  try {
    return JSON.parse(localStorage.getItem('reading_history') || '[]');
  } catch {
    return [];
  }
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
          title: `Book #${bookId}`,
          count: bookmarks.length,
        });
      }
    } catch {
      // ignore
    }
  });

  return items;
}

export default function BooksPage() {
  const navigate = useNavigate();

  const history = getReadingHistory();
  const bookmarkedBooks = getAllBookmarkedBooks();

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
        <article className="books-card featured">
          <span>Start reading</span>
          <h2>Open Library</h2>
          <p>Search and explore free books from your reader library.</p>
          <Link to="/read-books">Browse books →</Link>
        </article>

        <article className="books-card">
          <span>Progress</span>
          <h2>Continue Reading</h2>

          {history.length === 0 ? (
            <p>No recent books yet. Start reading to see them here.</p>
          ) : (
            <div className="mini-book-list">
              {history.slice(0, 5).map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/read-book/${book.id}`)}
                >
                  <strong>{book.title || `Book #${book.id}`}</strong>
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
              {bookmarkedBooks.slice(0, 5).map((book) => (
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