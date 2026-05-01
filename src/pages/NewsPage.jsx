import { useEffect, useMemo, useRef, useState } from 'react';
import { newsApi } from '../api/client';
import './NewsPage.css';

const CACHE_PREFIX = 'bbc_latest_news_';
const CACHE_TTL = 1000 * 60 * 15;
const PAGE_SIZE = 9;
const LANGUAGES = ['english', 'hindi', 'bengali'];

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
  localStorage.setItem(
    getCacheKey(lang),
    JSON.stringify({
      timestamp: Date.now(),
      news,
    })
  );
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

  async function fetchNews(lang = language, forceRefresh = false) {
    setError('');
    setVisibleCount(PAGE_SIZE);

    const cachedNews = getCachedNews(lang);

    if (cachedNews && !forceRefresh) {
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

      if (requestId !== requestIdRef.current) return;

      setNews(data);
      setCachedNews(lang, data);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err.message || 'Failed to load BBC news.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    fetchNews(language);
  }, [language]);

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
      const q = search.toLowerCase();

      allArticles = allArticles.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.summary?.toLowerCase().includes(q)
      );
    }

    return allArticles;
  }, [sections, selectedSection, search]);

  const visibleArticles = useMemo(() => {
    return articles.slice(0, visibleCount);
  }, [articles, visibleCount]);

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

  function toggleSave(article) {
    const exists = saved.some((item) => item.news_link === article.news_link);

    const updated = exists
      ? saved.filter((item) => item.news_link !== article.news_link)
      : [...saved, article];

    setSaved(updated);
    localStorage.setItem('saved_news', JSON.stringify(updated));
  }

  function isSaved(article) {
    return saved.some((item) => item.news_link === article.news_link);
  }

  async function shareArticle(article) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.news_link,
        });
      } else {
        await navigator.clipboard.writeText(article.news_link);
        alert('News link copied');
      }
    } catch {
      // user cancelled share
    }
  }

  return (
    <section className="news-page">
      <div className="news-hero">
        <div>
          <span className="news-kicker">BBC News</span>
          <h1>Daily Headlines</h1>
          <p>Latest BBC updates with cached, fast-loading results.</p>

          {lastUpdated && (
            <span className="last-updated">Last updated: {lastUpdated}</span>
          )}
        </div>

        <button
          className="refresh-news-btn"
          onClick={() => fetchNews(language, true)}
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
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
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
            <button
              key={section}
              className={selectedSection === section ? 'active' : ''}
              onClick={() => setSelectedSection(section)}
            >
              {section}
            </button>
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
            {visibleArticles.map((article, index) => (
              <article
                className={`news-card ${index === 0 ? 'featured' : ''}`}
                key={`${article.news_link}-${index}`}
              >
                {article.image_link ? (
                  <img
                    src={article.image_link}
                    alt={article.title || 'BBC News'}
                    loading="lazy"
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

                    <button onClick={() => toggleSave(article)}>
                      {isSaved(article) ? 'Saved' : 'Save'}
                    </button>

                    <button onClick={() => shareArticle(article)}>Share</button>
                  </div>
                </div>
              </article>
            ))}
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