import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function addToHistory(bookId, title, extra = {}) {
  try {
    const history = JSON.parse(localStorage.getItem('reading_history') || '[]');
    const cleanTitle = title && !title.startsWith('Book #') ? title : `Book #${bookId}`;

    const updated = [
      {
        id: bookId,
        title: cleanTitle,
        cover: extra.cover || extra.coverUrl || '',
        coverUrl: extra.coverUrl || extra.cover || '',
        lastReadAt: Date.now(),
      },
      ...history.filter((book) => String(book.id) !== String(bookId)),
    ].slice(0, 20);

    localStorage.setItem('reading_history', JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

const ReaderParagraph = memo(function ReaderParagraph({ line }) {
  return <p>{line}</p>;
});

const BookmarkButton = memo(function BookmarkButton({ chapter, currentChapter, onChangeChapter }) {
  const handleClick = useCallback(() => {
    onChangeChapter(chapter, chapter > currentChapter ? 'next' : 'prev');
  }, [chapter, currentChapter, onChangeChapter]);

  return (
    <button type="button" onClick={handleClick}>
      Chapter {chapter + 1}
    </button>
  );
});

export default function BookReaderPage() {
  const { bookId } = useParams();
  const savedSettings = useMemo(() => getReaderSettings(), []);
  const loadedBookRef = useRef('');
  const mountedRef = useRef(true);
  const chapterTimerRef = useRef(null);
  const animationTimerRef = useRef(null);

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

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (chapterTimerRef.current) window.clearTimeout(chapterTimerRef.current);
      if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    };
  }, []);

  const loadBookText = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');

    if (chapterTimerRef.current) window.clearTimeout(chapterTimerRef.current);
    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);

    try {
      if (!bookId) throw new Error('Book ID is missing.');

      let resolvedTitle = `Book #${bookId}`;
      let bookMeta = {};
      const isOpenLibraryWork = String(bookId).startsWith('OL') && String(bookId).endsWith('W');

      if (isOpenLibraryWork) {
        try {
          const data = await readBooksApi.getBookById(bookId);
          bookMeta = data || {};
          resolvedTitle = data?.title || resolvedTitle;
        } catch {
          // ignore title fetch errors
        }
      }

      if (!mountedRef.current) return;
      setBookTitle(resolvedTitle);

      const fetchedText = await readBooksApi.getBookText(bookId);
      if (!mountedRef.current) return;

      if (!fetchedText || String(fetchedText).trim().length < 80) {
        throw new Error('Readable text is not available for this book. Try another book from the library.');
      }

      const coverUrl = bookMeta.cover || bookMeta.coverUrl || bookMeta.image || '';
      addToHistory(bookId, resolvedTitle, { cover: coverUrl, coverUrl });

      try {
        localStorage.setItem(
          `book_${bookId}`,
          JSON.stringify({ id: bookId, title: resolvedTitle, cover: coverUrl, coverUrl })
        );
      } catch {
        // ignore storage errors
      }

      const split = splitIntoChapters(fetchedText);
      if (!mountedRef.current) return;

      const savedProgress = forceRefresh
        ? 0
        : Number(localStorage.getItem(getProgressKey(bookId)) || 0);

      setChapters(split);
      setCurrentChapter(Math.min(savedProgress, split.length - 1));
    } catch (err) {
      const status = err?.response?.status;
      const isOpenLibraryWork = String(bookId).startsWith('OL') && String(bookId).endsWith('W');
      const openLibraryUrl = isOpenLibraryWork ? `https://openlibrary.org/works/${bookId}` : '';

      if (!mountedRef.current) return;

      if (status === 404 || status === 500) {
        setError('Readable text is not available for this book. Try another book from the library.');
      } else {
        setError(err.message || 'Failed to load book.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;

    if (loadedBookRef.current === bookId) return;
    loadedBookRef.current = bookId;

    setBookTitle(`Book #${bookId}`);
    try {
      setBookmarks(JSON.parse(localStorage.getItem(`bookmarks_${bookId}`) || '[]'));
    } catch {
      setBookmarks([]);
    }
    loadBookText();
  }, [bookId, loadBookText]);

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

  const chapterWordCounts = useMemo(
    () => chapters.map((chapter) => chapter.split(/\s+/).filter(Boolean).length),
    [chapters]
  );

  const progress = useMemo(
    () => (chapters.length ? Math.round(((currentChapter + 1) / chapters.length) * 100) : 0),
    [chapters.length, currentChapter]
  );

  const estimatedMinutesLeft = useMemo(() => {
    const wordsLeft = chapterWordCounts
      .slice(currentChapter)
      .reduce((total, count) => total + count, 0);

    return Math.max(1, Math.ceil(wordsLeft / 220));
  }, [chapterWordCounts, currentChapter]);

  const currentChapterWordCount = useMemo(
    () => chapterWordCounts[currentChapter] || 0,
    [chapterWordCounts, currentChapter]
  );

  const isBookmarked = useMemo(
    () => bookmarks.includes(currentChapter),
    [bookmarks, currentChapter]
  );

  const currentParagraphs = useMemo(
    () => currentText.split('\n').map((line) => line.trim() || '\u00A0'),
    [currentText]
  );

  const changeChapter = useCallback((nextChapter, direction) => {
    if (!chapters.length) return;

    const safeChapter = Math.min(Math.max(nextChapter, 0), chapters.length - 1);
    if (safeChapter === currentChapter) return;

    if (chapterTimerRef.current) window.clearTimeout(chapterTimerRef.current);
    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);

    setPageAnimation(direction === 'next' ? 'page-flip-next' : 'page-flip-prev');

    chapterTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;

      setCurrentChapter(safeChapter);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      animationTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setPageAnimation('');
      }, 220);
    }, 120);
  }, [chapters.length, currentChapter]);

  const goToPreviousChapter = useCallback(() => {
    if (currentChapter === 0) return;
    changeChapter(currentChapter - 1, 'prev');
  }, [changeChapter, currentChapter]);

  const goToNextChapter = useCallback(() => {
    if (currentChapter >= chapters.length - 1) return;
    changeChapter(currentChapter + 1, 'next');
  }, [changeChapter, chapters.length, currentChapter]);

  const toggleBookmark = useCallback(() => {
    setBookmarks((currentBookmarks) => {
      const exists = currentBookmarks.includes(currentChapter);

      const updated = exists
        ? currentBookmarks.filter((item) => item !== currentChapter)
        : [...currentBookmarks, currentChapter].sort((a, b) => a - b);

      try {
        localStorage.setItem(`bookmarks_${bookId}`, JSON.stringify(updated));
        window.dispatchEvent(new Event('books-info-refresh'));
      } catch {
        // ignore storage errors
      }

      return updated;
    });
  }, [bookId, currentChapter]);

  const toggleMenu = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);

  const refreshBook = useCallback(() => {
    loadBookText(true);
  }, [loadBookText]);

  const openLibraryBook = useCallback((openLibraryUrl) => {
    window.open(openLibraryUrl, '_blank');
  }, []);

  const openCurrentLibraryBook = useCallback(() => {
    const openLibraryUrl = String(bookId).startsWith('OL') && String(bookId).endsWith('W')
      ? `https://openlibrary.org/works/${bookId}`
      : '';

    if (openLibraryUrl) openLibraryBook(openLibraryUrl);
  }, [bookId, openLibraryBook]);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const setDarkTheme = useCallback(() => {
    setTheme('dark');
  }, []);

  const setSepiaTheme = useCallback(() => {
    setTheme('sepia');
  }, []);

  const setLightTheme = useCallback(() => {
    setTheme('light');
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((value) => Math.max(14, value - 1));
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((value) => Math.min(28, value + 1));
  }, []);

  const tightenLineHeight = useCallback(() => {
    setLineHeight((value) => Math.max(1.4, Number((value - 0.1).toFixed(1))));
  }, []);

  const loosenLineHeight = useCallback(() => {
    setLineHeight((value) => Math.min(2.4, Number((value + 0.1).toFixed(1))));
  }, []);

  const renderedParagraphs = useMemo(
    () => currentParagraphs.map((line, index) => (
      <ReaderParagraph key={`${currentChapter}-${index}`} line={line} />
    )),
    [currentChapter, currentParagraphs]
  );

  const renderedBookmarks = useMemo(
    () => bookmarks.map((chapter, index) => (
      <BookmarkButton
        key={`${chapter}-${index}`}
        chapter={chapter}
        currentChapter={currentChapter}
        onChangeChapter={changeChapter}
      />
    )),
    [bookmarks, changeChapter, currentChapter]
  );

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
                onClick={refreshBook}
              >
                Try Again
              </button>

              {openLibraryUrl && (
                <button
                  type="button"
                  className="reader-retry-btn secondary"
                  onClick={openCurrentLibraryBook}
                >
                  View on OpenLibrary
                </button>
              )}

              <button
                type="button"
                className="reader-retry-btn secondary"
                onClick={goBack}
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
            onClick={toggleMenu}
          >
            Aa
          </button>

          <div className="reader-progress-text">
            <strong>{bookTitle}</strong>
            <span>{progress}% complete · Chapter {currentChapter + 1} of {chapters.length}</span>
          </div>

          <button className="reader-icon-btn" type="button" aria-label="Refresh book" disabled={loading} onClick={refreshBook}>
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
                disabled={!chapters.length}
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
              <button type="button" onClick={setDarkTheme}>Dark</button>
              <button type="button" onClick={setSepiaTheme}>Sepia</button>
              <button type="button" onClick={setLightTheme}>Light</button>
            </div>

            <div className="menu-group">
              <button type="button" onClick={decreaseFontSize}>
                A-
              </button>
              <span>{fontSize}px</span>
              <button type="button" onClick={increaseFontSize}>
                A+
              </button>
            </div>

            <div className="menu-row">
              <button type="button" onClick={tightenLineHeight}>
                Tight
              </button>
              <button type="button" onClick={loosenLineHeight}>
                Loose
              </button>
              <button type="button" className={isBookmarked ? 'reader-menu-active' : ''} disabled={!chapters.length} onClick={toggleBookmark}>
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
              {renderedBookmarks}
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
          {renderedParagraphs}
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