import { useEffect, useMemo, useState } from 'react';
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

  async function loadBookText(forceRefresh = false) {
    setLoading(true);
    setError('');

    try {
      if (!bookId) throw new Error('Book ID is missing.');

      let bookTitle = `Book #${bookId}`;

      try {
        const response = await fetch(`https://openlibrary.org/works/${bookId}.json`);

        if (response.ok) {
          const data = await response.json();
          bookTitle = data.title || bookTitle;
        }
      } catch {
        // ignore title fetch errors
      }

      addToHistory(bookId, bookTitle);
      localStorage.setItem(`book_${bookId}`, JSON.stringify({ id: bookId, title: bookTitle }));

      const fetchedText = await readBooksApi.getBookText(bookId);
      const finalText = fetchedText || 'No content available.';
      const split = splitIntoChapters(finalText);
      const savedProgress = forceRefresh
        ? 0
        : Number(localStorage.getItem(getProgressKey(bookId)) || 0);

      setChapters(split);
      setCurrentChapter(Math.min(savedProgress, split.length - 1));
    } catch (err) {
      setError(err.message || 'Failed to load book.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
    return chapters[currentChapter] || '';
  }, [chapters, currentChapter]);

  const progress = chapters.length
    ? Math.round(((currentChapter + 1) / chapters.length) * 100)
    : 0;

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
        <div>
          <div className="reader-spinner" />
          <p>Loading book...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <section className={`reader-page reader-theme-${theme}`}>
        <div className="reader-container">
          <p className="reader-error">{error}</p>
          <button className="reader-retry-btn" onClick={() => loadBookText(true)}>
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`reader-page reader-theme-${theme}`}>
      <div className="reader-container">
        <div className="reader-topbar">
          <button
            className="menu-btn"
            type="button"
            aria-label="Reader settings"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            ☰
          </button>

          <div className="reader-progress-text">
            Book #{bookId} · {progress}%
          </div>

          <button type="button" aria-label="Refresh book" onClick={() => loadBookText(true)}>
            ⟳
          </button>
        </div>

        {showMenu && (
          <div className="reader-menu">
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
              <button type="button" onClick={toggleBookmark}>
                {bookmarks.includes(currentChapter) ? 'Remove Bookmark' : 'Bookmark'}
              </button>
            </div>
          </div>
        )}

        <div className="reader-progress">
          <div style={{ width: `${progress}%` }} />
        </div>

        <div className="reader-controls">
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
          <div className="bookmark-list">
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
        )}

        <article
          className={`reader-content ${pageAnimation}`}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
          }}
        >
          {currentText.split('\n').map((line, index) => (
            <p key={index}>{line.trim() || '\u00A0'}</p>
          ))}
        </article>

        <div className="reader-controls bottom">
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