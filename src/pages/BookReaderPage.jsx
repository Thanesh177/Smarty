import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { readBooksApi } from '../api/client';
import './BookReaderPage.css';

const CHAPTER_SIZE = 6000;

function getProgressKey(bookId) {
  return `book_progress_${bookId}`;
}

function getReaderSettings() {
  try {
    return JSON.parse(localStorage.getItem('reader_settings') || '{}');
  } catch {
    return {};
  }
}

function saveReaderSettings(settings) {
  try {
    localStorage.setItem('reader_settings', JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

function splitIntoChapters(text) {
  const cleanText = text || '';

  const chapterParts = cleanText.split(
    /(?=Chapter\s+\d+|CHAPTER\s+\d+|Chapter\s+[IVXLCDM]+|CHAPTER\s+[IVXLCDM]+)/g
  );

  if (chapterParts.length > 3) {
    return chapterParts.filter((part) => part.trim().length > 200);
  }

  const chunks = [];

  for (let i = 0; i < cleanText.length; i += CHAPTER_SIZE) {
    chunks.push(cleanText.slice(i, i + CHAPTER_SIZE));
  }

  return chunks.length ? chunks : ['No readable content available.'];
}

function addToHistory(bookId, title) {
  try {
    const history = JSON.parse(localStorage.getItem('reading_history') || '[]');
    const cleanTitle = title && !title.startsWith('Book #') ? title : `Book #${bookId}`;

    const updated = [
      { id: bookId, title: cleanTitle, lastReadAt: Date.now() },
      ...history.filter((book) => String(book.id) !== String(bookId)),
    ].slice(0, 20);

    localStorage.setItem('reading_history', JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export default function BookReaderPage() {
  const { bookId } = useParams();
  const savedSettings = getReaderSettings();
  const loadedBookRef = useRef('');

  const [showMenu, setShowMenu] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState(savedSettings.fontSize || 18);
  const [lineHeight, setLineHeight] = useState(savedSettings.lineHeight || 1.8);
  const [theme, setTheme] = useState(savedSettings.theme || 'dark');
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`bookmarks_${bookId}`) || '[]');
    } catch {
      return [];
    }
  });
  const [pageAnimation, setPageAnimation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookTitle, setBookTitle] = useState(`Book #${bookId}`);

  async function loadBookText(forceRefresh = false) {
    setLoading(true);
    setError('');

    try {
      if (!bookId) throw new Error('Book ID is missing.');

      let resolvedTitle = `Book #${bookId}`;
      const isOpenLibraryWork = String(bookId).startsWith('OL') && String(bookId).endsWith('W');

      if (isOpenLibraryWork) {
        try {
          const data = await readBooksApi.getBookById(bookId);
          resolvedTitle = data.title || resolvedTitle;
        } catch {
          // ignore title fetch errors
        }
      }

      setBookTitle(resolvedTitle);
      const fetchedText = await readBooksApi.getBookText(bookId);

      if (!fetchedText || String(fetchedText).trim().length < 80) {
        throw new Error('Readable text is not available for this book. Try another book from the library.');
      }

      addToHistory(bookId, resolvedTitle);
      localStorage.setItem(`book_${bookId}`, JSON.stringify({ id: bookId, title: resolvedTitle }));

      const split = splitIntoChapters(fetchedText);
      const savedProgress = forceRefresh
        ? 0
        : Number(localStorage.getItem(getProgressKey(bookId)) || 0);

      setChapters(split);
      setCurrentChapter(Math.min(savedProgress, split.length - 1));
    } catch (err) {
      const status = err?.response?.status;
      const isOpenLibraryWork = String(bookId).startsWith('OL') && String(bookId).endsWith('W');
      const openLibraryUrl = isOpenLibraryWork ? `https://openlibrary.org/works/${bookId}` : '';

      if (status === 404 || status === 500) {
        setError('Readable text is not available for this book. Try another book from the library.');
      } else {
        setError(err.message || 'Failed to load book.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bookId) return;

    if (loadedBookRef.current === bookId) return;
    loadedBookRef.current = bookId;

    setBookTitle(`Book #${bookId}`);
    loadBookText();
  }, [bookId]);

  useEffect(() => {
    try {
      localStorage.setItem(getProgressKey(bookId), String(currentChapter));
    } catch {
      // ignore storage errors
    }
  }, [bookId, currentChapter]);

  useEffect(() => {
    saveReaderSettings({ fontSize, lineHeight, theme });
  }, [fontSize, lineHeight, theme]);

  const currentText = useMemo(() => {
    if (!chapters.length) return 'No readable content available.';
    return chapters[currentChapter] || 'No readable content available.';
  }, [chapters, currentChapter]);

  const progress = chapters.length
    ? Math.round(((currentChapter + 1) / chapters.length) * 100)
    : 0;

  const estimatedMinutesLeft = Math.max(
    1,
    Math.ceil(
      chapters.slice(currentChapter).join(' ').split(/\s+/).filter(Boolean).length / 220
    )
  );

  const currentChapterWordCount = currentText.split(/\s+/).filter(Boolean).length;
  const isBookmarked = bookmarks.includes(currentChapter);

  function changeChapter(nextChapter, direction) {
    const safeChapter = Math.min(Math.max(nextChapter, 0), chapters.length - 1);

    setPageAnimation(direction === 'next' ? 'page-flip-next' : 'page-flip-prev');

    window.setTimeout(() => {
      setCurrentChapter(safeChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      window.setTimeout(() => {
        setPageAnimation('');
      }, 220);
    }, 120);
  }

  function goToPreviousChapter() {
    if (currentChapter === 0) return;
    changeChapter(currentChapter - 1, 'prev');
  }

  function goToNextChapter() {
    if (currentChapter >= chapters.length - 1) return;
    changeChapter(currentChapter + 1, 'next');
  }

  function toggleBookmark() {
    const exists = bookmarks.includes(currentChapter);

    const updated = exists
      ? bookmarks.filter((item) => item !== currentChapter)
      : [...bookmarks, currentChapter].sort((a, b) => a - b);

    setBookmarks(updated);

    try {
      localStorage.setItem(`bookmarks_${bookId}`, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }

  if (loading) {
    return (
      <div className="reader-loading">
        <div className="reader-loading-card">
          <div className="reader-spinner" />
          <p>Opening your book...</p>
          <span>Preparing a clean reading view</span>
        </div>
      </div>
    );
  }

  if (error) {
    const isOpenLibraryWork = String(bookId).startsWith('OL') && String(bookId).endsWith('W');
    const openLibraryUrl = isOpenLibraryWork ? `https://openlibrary.org/works/${bookId}` : '';

    return (
      <section className={`reader-page reader-theme-${theme}`}>
        <div className="reader-container">
          <div className="reader-error-card reader-surface-card">
            <p className="reader-kicker">LIMITED ACCESS</p>
            <h1>This book can't be fully read here</h1>
            <p className="reader-error">{error}</p>

            <div className="reader-error-alt">
              <p>But you can still:</p>
              <ul>
                <li>📖 View details and editions</li>
                <li>🔍 Find other versions</li>
                <li>📚 Try similar books</li>
              </ul>
            </div>

            <div className="reader-error-actions">
              <button
                type="button"
                className="reader-retry-btn"
                onClick={() => loadBookText(true)}
              >
                Try Again
              </button>

              {openLibraryUrl && (
                <button
                  type="button"
                  className="reader-retry-btn secondary"
                  onClick={() => window.open(openLibraryUrl, '_blank')}
                >
                  View on OpenLibrary
                </button>
              )}

              <button
                type="button"
                className="reader-retry-btn secondary"
                onClick={() => window.history.back()}
              >
                Browse More Books
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`reader-page reader-theme-${theme}`}>
      <div className="reader-container">
        <div className="reader-topbar reader-surface-card">
          <button
            className="menu-btn"
            type="button"
            aria-label="Reader settings"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            Aa
          </button>

          <div className="reader-progress-text">
            <strong>{bookTitle}</strong>
            <span>{progress}% complete · Chapter {currentChapter + 1} of {chapters.length}</span>
          </div>

          <button className="reader-icon-btn" type="button" aria-label="Refresh book" onClick={() => loadBookText(true)}>
            ⟳
          </button>
        </div>

        <section className="reader-hero-card reader-surface-card">
          <div className="reader-hero-copy">
            <p className="reader-kicker">IMMERSIVE READING</p>
            <h1>{bookTitle}</h1>
            <p>
              Chapter {currentChapter + 1}. You are {progress}% through this book with about {estimatedMinutesLeft} min left.
            </p>

            <div className="reader-chip-row">
              <span>📖 {chapters.length} chapters</span>
              <span>⏱ {estimatedMinutesLeft} min left</span>
              <span>📝 {currentChapterWordCount} words</span>
              <span>{isBookmarked ? '🔖 Saved' : '✨ Focus mode'}</span>
            </div>

            <div className="reader-hero-actions">
              <button
                type="button"
                className={`reader-bookmark-btn ${isBookmarked ? 'active' : ''}`}
                onClick={toggleBookmark}
              >
                {isBookmarked ? '🔖 Bookmarked' : '🔖 Add Bookmark'}
              </button>
            </div>
          </div>

          <div className="reader-orbit-progress" style={{ '--reader-progress': `${progress}%` }}>
            <div>
              <strong>{progress}%</strong>
              <span>complete</span>
            </div>
          </div>
        </section>

        {showMenu && (
          <div className="reader-menu reader-surface-card">
            <div className="menu-row">
              <button type="button" onClick={() => setTheme('dark')}>Dark</button>
              <button type="button" onClick={() => setTheme('sepia')}>Sepia</button>
              <button type="button" onClick={() => setTheme('light')}>Light</button>
            </div>

            <div className="menu-group">
              <button type="button" onClick={() => setFontSize((value) => Math.max(14, value - 1))}>
                A-
              </button>
              <span>{fontSize}px</span>
              <button type="button" onClick={() => setFontSize((value) => Math.min(28, value + 1))}>
                A+
              </button>
            </div>

            <div className="menu-row">
              <button type="button" onClick={() => setLineHeight((value) => Math.max(1.4, Number((value - 0.1).toFixed(1))))}>
                Tight
              </button>
              <button type="button" onClick={() => setLineHeight((value) => Math.min(2.4, Number((value + 0.1).toFixed(1))))}>
                Loose
              </button>
              <button type="button" className={isBookmarked ? 'reader-menu-active' : ''} onClick={toggleBookmark}>
                {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
              </button>
            </div>
          </div>
        )}

        <div className="reader-progress">
          <div style={{ width: `${progress}%` }} />
        </div>

        <div className="reader-controls reader-surface-card">
          <button type="button" disabled={currentChapter === 0} onClick={goToPreviousChapter}>
            Previous
          </button>

          <span>
            Chapter {currentChapter + 1} of {chapters.length}
          </span>

          <button
            type="button"
            disabled={currentChapter >= chapters.length - 1}
            onClick={goToNextChapter}
          >
            Next
          </button>
        </div>

        {bookmarks.length > 0 && (
          <div className="bookmark-list reader-surface-card">
            <strong>Saved chapters</strong>
            <div>
              {bookmarks.map((chapter) => (
                <button
                  type="button"
                  key={chapter}
                  onClick={() => changeChapter(chapter, chapter > currentChapter ? 'next' : 'prev')}
                >
                  Chapter {chapter + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="reader-focus-strip reader-surface-card">
          <span>Now reading</span>
          <strong>Chapter {currentChapter + 1}</strong>
          <em>{isBookmarked ? 'Bookmarked' : 'Tap Bookmark to save this point'}</em>
        </div>

        <article
          className={`reader-content reader-surface-card ${pageAnimation}`}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
          }}
        >
          {currentText.split('\n').map((line, index) => (
            <p key={index}>{line.trim() || '\u00A0'}</p>
          ))}
        </article>

        <div className="reader-controls bottom reader-surface-card">
          <button type="button" disabled={currentChapter === 0} onClick={goToPreviousChapter}>
            Previous
          </button>

          <span>
            Chapter {currentChapter + 1} of {chapters.length}
          </span>

          <button
            type="button"
            disabled={currentChapter >= chapters.length - 1}
            onClick={goToNextChapter}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}