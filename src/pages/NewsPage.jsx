import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newsApi } from '../api/client';
import './NewsPage.css';

const CACHE_PREFIX = 'bbc_latest_news_';
const CACHE_TTL = 1000 * 60 * 15;
const PAGE_SIZE = 9;
const LANGUAGES = ['english'];

function getCacheKey(lang) {
  return `${CACHE_PREFIX}${lang}`;
}

function getCachedNews(lang) {
  try {
    const cached = JSON.parse(localStorage.getItem(getCacheKey(lang)));
    if (!cached) return null;

    const expired = Date.now() - cached.timestamp > CACHE_TTL;
    if (expired) {
      localStorage.removeItem(getCacheKey(lang));
      return null;
    }

    return cached.news;
  } catch {
    return null;
  }
}

function setCachedNews(lang, news) {
  try {
    localStorage.setItem(
      getCacheKey(lang),
      JSON.stringify({
        timestamp: Date.now(),
        news,
      })
    );
  } catch {
    // Ignore cache write failures.
  }
}

function NewsSkeleton() {
  return (
    <div className="news-card skeleton-card">
      <div className="skeleton-image" />
      <div className="news-card-body">
        <div className="skeleton-line small" />
        <div className="skeleton-line large" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

const NewsCard = memo(function NewsCard({
  article,
  index,
  saved,
  onToggleSave,
  onShare,
}) {
  return (
    <article className={`news-card ${index === 0 ? 'featured' : ''}`}>
      {article.image_link ? (
        <img
          src={article.image_link}
          alt={article.title || 'BBC News'}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 2 ? 'high' : 'auto'}
        />
      ) : (
        <div className="missing-news-image">BBC News</div>
      )}

      <div className="news-card-body">
        <span className="section-label">{article.section}</span>

        <h3>{article.title || 'Untitled news'}</h3>

        <p>{article.summary || 'No summary available.'}</p>

        <div className="news-actions">
          <a
            href={article.news_link}
            target="_blank"
            rel="noreferrer"
          >
            Read
          </a>

          <button onClick={() => onToggleSave(article)}>
            {saved ? 'Saved' : 'Save'}
          </button>

          <button onClick={() => onShare(article)}>Share</button>
        </div>
      </div>
    </article>
  );
});

const SectionTab = memo(function SectionTab({ section, active, onSelect }) {
  return (
    <button
      className={active ? 'active' : ''}
      onClick={() => onSelect(section)}
    >
      {section}
    </button>
  );
});

export default function NewsPage() {
  const [news, setNews] = useState({});
  const [language, setLanguage] = useState('english');
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('saved_news') || '[]');
    } catch {
      return [];
    }
  });
  const [lastUpdated, setLastUpdated] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loaderRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const fetchNews = useCallback(async (lang = language, forceRefresh = false) => {
    setError('');
    setVisibleCount(PAGE_SIZE);

    if (!mountedRef.current) return;

    const cachedNews = getCachedNews(lang);

    if (cachedNews && !forceRefresh) {
      if (!mountedRef.current) return;
      setNews(cachedNews);
      setFromCache(true);
      setLoading(false);
      setLastUpdated(new Date().toLocaleString());
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setFromCache(false);

    try {
      const data = await newsApi.getLatestNews(lang);

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setNews(data);
      setCachedNews(lang, data);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      if (lang !== 'english') {
        try {
          const fallbackCached = getCachedNews('english');

          if (fallbackCached && !forceRefresh) {
            setNews(fallbackCached);
            setFromCache(true);
            setSelectedSection('All');
            setLastUpdated(new Date().toLocaleString());
            setError(`${lang.toUpperCase()} news is unavailable right now. Showing English news instead.`);
            return;
          }

          const fallbackData = await newsApi.getLatestNews('english');

          if (!mountedRef.current || requestId !== requestIdRef.current) return;

          setNews(fallbackData);
          setCachedNews('english', fallbackData);
          setFromCache(false);
          setSelectedSection('All');
          setLastUpdated(new Date().toLocaleString());
          setError(`${lang.toUpperCase()} news is unavailable right now. Showing English news instead.`);
          return;
        } catch (fallbackErr) {
          if (mountedRef.current) {
            setError(
              fallbackErr.message ||
                err.message ||
                'Failed to load BBC news. Please try again later.'
            );
          }
          return;
        }
      }

      if (mountedRef.current) {
        setError(err.message || 'Failed to load BBC news. Please try again later.');
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [language]);

  useEffect(() => {
    fetchNews(language);
  }, [fetchNews, language]);

  const sections = useMemo(() => {
    return Object.entries(news).filter(([, value]) => Array.isArray(value));
  }, [news]);

  const sectionNames = useMemo(() => {
    return ['All', ...sections.map(([name]) => name)];
  }, [sections]);

  const articles = useMemo(() => {
    let allArticles = sections.flatMap(([section, items]) =>
      items.map((item) => ({ ...item, section }))
    );

    if (selectedSection !== 'All') {
      allArticles = allArticles.filter(
        (item) => item.section === selectedSection
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      allArticles = allArticles.filter((item) => {
        const text = `${item.title || ''} ${item.summary || ''} ${item.section || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    return allArticles;
  }, [sections, selectedSection, search]);

  const visibleArticles = useMemo(() => {
    return articles.slice(0, visibleCount);
  }, [articles, visibleCount]);

  const savedLinks = useMemo(
    () => new Set(saved.map((item) => item.news_link)),
    [saved]
  );

  const toggleSave = useCallback((article) => {
    setSaved((currentSaved) => {
      const exists = currentSaved.some((item) => item.news_link === article.news_link);

      const updated = exists
        ? currentSaved.filter((item) => item.news_link !== article.news_link)
        : [...currentSaved, article];

      try {
        localStorage.setItem('saved_news', JSON.stringify(updated));
      } catch {
        // Ignore save write failures.
      }

      return updated;
    });
  }, []);

  const shareArticle = useCallback(async (article) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.news_link,
        });
      } else {
        await navigator.clipboard.writeText(article.news_link);
      }
    } catch {
      // user cancelled share
    }
  }, []);

  const renderedArticles = useMemo(
    () => visibleArticles.map((article, index) => (
      <NewsCard
        key={`${article.news_link}-${index}`}
        article={article}
        index={index}
        saved={savedLinks.has(article.news_link)}
        onToggleSave={toggleSave}
        onShare={shareArticle}
      />
    )),
    [savedLinks, shareArticle, toggleSave, visibleArticles]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [language, selectedSection, search]);

  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, articles.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [articles.length]);

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleLanguageChange = useCallback((e) => {
    setLanguage(e.target.value);
    setSelectedSection('All');
  }, []);

  const handleSectionSelect = useCallback((section) => {
    setSelectedSection(section);
  }, []);

  const handleRefreshNews = useCallback(() => {
    fetchNews(language, true);
  }, [fetchNews, language]);

  return (
    <section className="news-page">
      <div className="news-hero">
        <div>
          <span className="news-kicker">News</span>
          <h1>Daily Headlines</h1>
          <p>Latest updates from all around the world</p>

          {lastUpdated && (
            <span className="last-updated">Last updated: {lastUpdated}</span>
          )}
        </div>

        <button
          className="refresh-news-btn"
          onClick={handleRefreshNews}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="news-controls">
        <input
          type="search"
          placeholder="Search news..."
          value={search}
          onChange={handleSearchChange}
        />

        <select
          value={language}
          onChange={handleLanguageChange}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {fromCache && !loading && (
        <p className="cache-note">Showing cached results</p>
      )}

      {!loading && !error && sectionNames.length > 1 && (
        <div className="section-tabs">
          {sectionNames.map((section) => (
            <SectionTab
              key={section}
              section={section}
              active={selectedSection === section}
              onSelect={handleSectionSelect}
            />
          ))}
        </div>
      )}

      {loading && (
        <div className="news-grid">
          {Array.from({ length: 9 }).map((_, index) => (
            <NewsSkeleton key={index} />
          ))}
        </div>
      )}

      {error && <p className="news-status error">{error}</p>}

      {!loading && !error && visibleArticles.length === 0 && (
        <p className="news-status">No news found.</p>
      )}

      {!loading && !error && visibleArticles.length > 0 && (
        <>
          <div className="news-grid">
            {renderedArticles}
          </div>

          <div ref={loaderRef} className="scroll-loader">
            {visibleCount < articles.length
              ? 'Loading more news...'
              : 'You reached the end'}
          </div>
        </>
      )}
    </section>
  );
}