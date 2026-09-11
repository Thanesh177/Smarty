import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { newsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  NEWS_COUNTRIES,
  NEWS_REGIONS,
  getDefaultNewsCountry,
} from '../data/newsLocations';
import './NewsPage.css';
import './LibraryNewsTheme.css';

const CACHE_PREFIX = 'smarty_location_news_v19_';
const CACHE_TTL = 1000 * 60 * 15;
const CACHE_STALE_TTL = 1000 * 60 * 60 * 48;
const PAGE_SIZE = 9;

function getCacheKey(country, region) {
  return `${CACHE_PREFIX}${country}_${encodeURIComponent(region || 'all')}`;
}

function getCachedNews(country, region) {
  try {
    const key = getCacheKey(country, region);
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    const hasSections = cached?.news?.sections &&
      typeof cached.news.sections === 'object' &&
      Object.values(cached.news.sections).some((items) => Array.isArray(items) && items.length > 0);
    const hasArticles = Array.isArray(cached?.news?.articles) && cached.news.articles.length > 0;
    if (!cached?.news || !cached?.timestamp || (!hasSections && !hasArticles)) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_STALE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return {
      news: cached.news,
      timestamp: cached.timestamp,
      isFresh: age <= CACHE_TTL,
    };
  } catch {
    return null;
  }
}

function setCachedNews(country, region, news) {
  try {
    localStorage.setItem(
      getCacheKey(country, region),
      JSON.stringify({ timestamp: Date.now(), news })
    );
  } catch {
    // News still works if local storage is unavailable.
  }
}

function getSavedRegion(country) {
  try {
    const saved = localStorage.getItem(`smarty-news-region-${country}`) || '';
    return (NEWS_REGIONS[country] || []).includes(saved) ? saved : '';
  } catch {
    return '';
  }
}

function formatUpdatedAt(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatPublishedAt(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const minutes = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7
    ? `${days}d ago`
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed);
}

function NewsSkeleton() {
  return (
    <div className="news-card skeleton-card" aria-hidden="true">
      <div className="skeleton-image" />
      <div className="news-card-body">
        <div className="skeleton-line small" />
        <div className="skeleton-line large" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

const NewsCard = memo(function NewsCard({ article, index, saved, onToggleSave, onShare }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(article.image_link) && !imageFailed;
  const publishedAt = formatPublishedAt(article.published_at);

  return (
    <article className="news-card">
      {hasImage ? (
        <img
          src={article.image_link}
          alt=""
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 3 ? 'high' : 'auto'}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="missing-news-image" aria-hidden="true">
          <span>{article.section || 'Latest'}</span>
        </div>
      )}

      <div className="news-card-body">
        <div className="news-card-meta">
          <span className="section-label">{article.section || 'News'}</span>
          {publishedAt && <time dateTime={article.published_at}>{publishedAt}</time>}
        </div>

        <h3>{article.title || 'Untitled news'}</h3>
        <p>{article.summary || `Current reporting from ${article.source || 'this source'}.`}</p>
        <span className="news-card-source">{article.source || 'News source'}</span>

        <div className="news-actions">
          <a href={article.news_link} target="_blank" rel="noopener noreferrer">
            Read story
          </a>
          <button
            type="button"
            aria-pressed={saved}
            aria-label={`${saved ? 'Remove' : 'Save'} ${article.title}`}
            onClick={() => onToggleSave(article)}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            aria-label={`Share ${article.title}`}
            onClick={() => onShare(article)}
          >
            Share
          </button>
        </div>
      </div>
    </article>
  );
});

const SectionTab = memo(function SectionTab({ section, active, onSelect }) {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      aria-pressed={active}
      onClick={() => onSelect(section)}
    >
      {section}
    </button>
  );
});

const DailyBrief = memo(function DailyBrief({ summary, locationLabel, onSelectSection }) {
  if (!summary) return null;

  return (
    <section className="news-daily-brief" aria-labelledby="daily-brief-title">
      <div className="news-brief-lead">
        <div className="news-brief-copy">
          <span className="news-brief-eyebrow">{summary.eyebrow || "Today's briefing"}</span>
          <h2 id="daily-brief-title">
            {summary.title || `${locationLabel} at a glance`}
          </h2>
          <p>{summary.overview}</p>

          <dl className="news-brief-stats">
            <div>
              <dt>Stories analyzed</dt>
              <dd>{summary.storyCount || 0}</dd>
            </div>
            <div>
              <dt>Sources</dt>
              <dd>{summary.sourceCount || 0}</dd>
            </div>
            <div>
              <dt>Coverage areas</dt>
              <dd>{summary.sectionCount || summary.sectionDigests?.length || 0}</dd>
            </div>
          </dl>

          <p className="news-analysis-scope">
            <span aria-hidden="true" />
            {summary.analysisStatement || 'The full story collection is included in this digest.'}
          </p>
        </div>

        {summary.highlights?.length > 0 && (
          <div className="news-brief-highlights">
            <span>Leading developments</span>
            <ol>
              {summary.highlights.slice(0, 4).map((highlight, index) => (
                <li key={highlight.id || highlight.news_link || `${highlight.title}-${index}`}>
                  <a href={highlight.news_link} target="_blank" rel="noopener noreferrer">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span className="news-brief-story-copy">
                      <strong>{highlight.title}</strong>
                      <small>{highlight.source || highlight.section}</small>
                    </span>
                    <i aria-hidden="true">↗</i>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="news-brief-insight-grid">
        {summary.keyTakeaways?.length > 0 ? (
          <div className="news-brief-takeaways">
            <header>
              <span className="news-brief-section-kicker">Today’s summary</span>
              <h3>What happened today</h3>
            </header>
            <ol>
              {summary.keyTakeaways.map((takeaway, index) => {
                const sources = [...new Set(
                  (takeaway.stories || []).map((story) => story.source).filter(Boolean)
                )].slice(0, 3);
                return (
                  <li key={`${takeaway.title}-${index}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{takeaway.title}</strong>
                      <p>{takeaway.summary}</p>
                      {sources.length > 0 && <small>{sources.join(' · ')}</small>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : summary.keyThemes?.length > 0 ? (
          <div className="news-brief-themes">
            <div>
              <span className="news-brief-section-kicker">Signals across the day</span>
              <h3>The themes shaping today’s coverage</h3>
            </div>
            <ul>
              {summary.keyThemes.map((theme) => (
                <li key={theme.label}>
                  <strong>{theme.label}</strong>
                  <span>{theme.storyCount} {theme.storyCount === 1 ? 'story' : 'stories'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.coverageBreakdown?.length > 0 && (
          <div className="news-coverage-map" aria-label="Coverage distribution">
            <header>
              <span className="news-brief-section-kicker">Coverage balance</span>
              <h3>Stories by section</h3>
            </header>
            <div className="news-coverage-rows">
              {summary.coverageBreakdown.map((item) => (
                <div key={item.section}>
                  <span>{item.section}</span>
                  <div aria-hidden="true">
                    <i style={{ width: `${Math.max(4, item.share)}%` }} />
                  </div>
                  <strong>{item.storyCount}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {summary.sectionDigests?.length > 0 && (
        <details className="news-section-digest">
          <summary>
            <span>
              <strong>Read the section-by-section briefing</strong>
              <small>{summary.sectionDigests.length} coverage areas</small>
            </span>
            <i aria-hidden="true">+</i>
          </summary>
          <header>
            <span className="news-brief-section-kicker">The deeper read</span>
            <h3>The whole day, in a few minutes</h3>
            <p>Each summary considers every story in that coverage area. Open a section only when you want the full reporting.</p>
          </header>

          <div className="news-section-digest-grid">
            {summary.sectionDigests.map((digest, index) => (
              <article key={digest.section} className="news-section-digest-card">
                <div className="news-digest-card-topline">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{digest.section}</strong>
                  <small>
                    {digest.storyCount} {digest.storyCount === 1 ? 'story' : 'stories'}
                    {' · '}
                    {digest.sourceCount} {digest.sourceCount === 1 ? 'source' : 'sources'}
                  </small>
                </div>

                <p>{digest.summary}</p>

                {digest.themes?.length > 0 && (
                  <div className="news-digest-themes" aria-label={`${digest.section} themes`}>
                    {digest.themes.slice(0, 3).map((theme) => (
                      <span key={theme.label}>{theme.label}</span>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => onSelectSection(digest.section)}>
                  Explore {digest.section.toLowerCase()} stories
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
});

export default function NewsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const initialCountry = useMemo(() => getDefaultNewsCountry(), []);
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(() => getSavedRegion(initialCountry));
  const [newsData, setNewsData] = useState(null);
  const [search, setSearch] = useState(
    () => new URLSearchParams(location.search).get('search') || ''
  );
  const [selectedSection, setSelectedSection] = useState('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [saved, setSaved] = useState([]);
  const [actionStatus, setActionStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loaderRef = useRef(null);
  const newsStoriesRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const savedStorageKey = useMemo(() => {
    const accountId = user?.userId || user?.sub || user?.id || user?.email || 'guest';
    return `smarty-saved-news-v1-${encodeURIComponent(String(accountId))}`;
  }, [user]);

  useEffect(() => {
    const incomingSearch = new URLSearchParams(location.search).get('search');
    if (incomingSearch !== null) setSearch(incomingSearch);
  }, [location.search]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(savedStorageKey) || '[]');
      setSaved(Array.isArray(stored) ? stored : []);
    } catch {
      setSaved([]);
    }
  }, [savedStorageKey]);

  useEffect(() => {
    if (!actionStatus) return undefined;
    const timer = window.setTimeout(() => setActionStatus(''), 2200);
    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  const fetchNews = useCallback(async (targetCountry, targetRegion, forceRefresh = false) => {
    abortControllerRef.current?.abort();
    const cached = getCachedNews(targetCountry, targetRegion);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');
    setRefreshing(false);
    setVisibleCount(PAGE_SIZE);

    if (cached) {
      setNewsData(cached.news);
      setFromCache(!cached.isFresh);
      setLastUpdated(formatUpdatedAt(cached.news.generatedAt || cached.timestamp));
      setLoading(false);
      if (cached.isFresh && !forceRefresh) return;
    } else {
      setFromCache(false);
    }

    setLoading(!cached && !forceRefresh);
    setRefreshing(Boolean(cached) || forceRefresh);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await newsApi.getLatestNews({
        country: targetCountry,
        region: targetRegion,
        lang: 'english',
        signal: controller.signal,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setNewsData(data);
      setCachedNews(targetCountry, targetRegion, data);
      setFromCache(data.cacheStatus === 'stale-cache');
      setLastUpdated(formatUpdatedAt(data.generatedAt || Date.now()));
      if (data.notice) setError(data.notice);
    } catch (fetchError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (controller.signal.aborted || fetchError?.name === 'AbortError' || fetchError?.code === 'ERR_CANCELED') {
        return;
      }

      setError(
        cached
          ? 'Could not refresh right now. Your latest saved briefing is still available.'
          : fetchError.message || 'Could not load current news. Please try again.'
      );
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    fetchNews(country, region);
  }, [country, fetchNews, region]);

  const regionOptions = useMemo(() => NEWS_REGIONS[country] || [], [country]);
  const sections = useMemo(() => {
    let sectionMap = newsData?.sections || {};
    if (!Object.keys(sectionMap).length && Array.isArray(newsData?.articles)) {
      sectionMap = newsData.articles.reduce((result, article) => {
        const section = article.section || 'World';
        (result[section] ||= []).push(article);
        return result;
      }, {});
    }
    return Object.entries(sectionMap).filter(([, items]) => Array.isArray(items) && items.length);
  }, [newsData]);
  const sectionNames = useMemo(() => ['All', ...sections.map(([name]) => name)], [sections]);
  const articles = useMemo(() => {
    let nextArticles = sections.flatMap(([sectionName, items]) =>
      items.map((item) => ({ ...item, section: item.section || sectionName }))
    );

    if (selectedSection !== 'All') {
      nextArticles = nextArticles.filter((item) => item.section === selectedSection);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      nextArticles = nextArticles.filter((item) =>
        `${item.title || ''} ${item.summary || ''} ${item.section || ''} ${item.source || ''}`
          .toLowerCase()
          .includes(query)
      );
    }

    return nextArticles;
  }, [search, sections, selectedSection]);
  const visibleArticles = useMemo(
    () => articles.slice(0, visibleCount),
    [articles, visibleCount]
  );
  const savedLinks = useMemo(
    () => new Set(saved.map((item) => item.news_link)),
    [saved]
  );
  const locationLabel = newsData?.location?.label ||
    NEWS_COUNTRIES.find((item) => item.code === country)?.name ||
    'Worldwide';

  const toggleSave = useCallback((article) => {
    const exists = saved.some((item) => item.news_link === article.news_link);
    const updated = exists
      ? saved.filter((item) => item.news_link !== article.news_link)
      : [...saved, article];

    setSaved(updated);
    try {
      localStorage.setItem(savedStorageKey, JSON.stringify(updated));
    } catch {
      // Keep the in-memory saved state if storage is unavailable.
    }
    setActionStatus(exists ? 'Removed from saved stories.' : 'Story saved.');
  }, [saved, savedStorageKey]);

  const shareArticle = useCallback(async (article) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.news_link,
        });
        setActionStatus('Story shared.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(article.news_link);
        setActionStatus('Story link copied.');
      } else {
        setActionStatus('Sharing is not available on this device.');
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') setActionStatus('Could not share this story.');
    }
  }, []);

  const renderedArticles = useMemo(
    () => visibleArticles.map((article, index) => (
      <NewsCard
        key={article.id || article.news_link || `${article.title}-${index}`}
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
  }, [country, region, search, selectedSection]);

  useEffect(() => {
    if (!loaderRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, articles.length));
        }
      },
      { rootMargin: '320px' }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [articles.length]);

  const handleCountryChange = useCallback((event) => {
    const nextCountry = event.target.value;
    setCountry(nextCountry);
    setRegion('');
    setNewsData(null);
    setSelectedSection('All');
    setSearch('');
    try {
      localStorage.setItem('smarty-news-country', nextCountry);
    } catch {
      // Continue with an in-memory selection.
    }
  }, []);

  const handleRegionChange = useCallback((event) => {
    const nextRegion = event.target.value;
    setRegion(nextRegion);
    setNewsData(null);
    setSelectedSection('All');
    try {
      localStorage.setItem(`smarty-news-region-${country}`, nextRegion);
    } catch {
      // Continue with an in-memory selection.
    }
  }, [country]);

  const handleBriefSectionSelect = useCallback((section) => {
    setSelectedSection(section);
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      newsStoriesRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, []);

  return (
    <section className="news-page">
      {actionStatus && (
        <p className="news-action-status" role="status" aria-live="polite">
          {actionStatus}
        </p>
      )}
      <div className="news-hero">
        <div>
          <span className="news-kicker">Daily intelligence</span>
          <h1>Know what matters, where it matters.</h1>
          <p>Choose a country or state for a focused daily briefing, then explore every story.</p>
          {lastUpdated && (
            <span className="last-updated">Updated at {lastUpdated}</span>
          )}
        </div>

        <button
          type="button"
          className="refresh-news-btn"
          onClick={() => fetchNews(country, region, true)}
          disabled={loading || refreshing}
          aria-label="Refresh current news"
        >
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="news-controls news-location-controls">
        <label className="news-search-control">
          <span>Search</span>
          <input
            type="search"
            aria-label="Search current news"
            placeholder={`Search ${locationLabel} news`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Country</span>
          <select aria-label="News country" value={country} onChange={handleCountryChange}>
            {NEWS_COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>State or region</span>
          <select
            aria-label="News state or region"
            value={region}
            onChange={handleRegionChange}
            disabled={!regionOptions.length}
          >
            <option value="">{regionOptions.length ? 'All states and regions' : 'Countrywide'}</option>
            {regionOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {(fromCache || newsData?.notice) && !loading && (
        <p className="cache-note">
          {newsData?.notice || 'Showing your latest saved briefing.'}
        </p>
      )}

      {error && newsData && (
        <p className="news-inline-notice" role="status">{error}</p>
      )}

      {loading && (
        <div className="news-grid">
          {Array.from({ length: 6 }).map((_, index) => <NewsSkeleton key={index} />)}
        </div>
      )}

      {!loading && !newsData && error && (
        <div className="news-retry" role="alert">
          <h2>Today’s briefing is unavailable.</h2>
          <p>{error}</p>
          <button type="button" onClick={() => fetchNews(country, region, true)}>
            Try again
          </button>
        </div>
      )}

      {!loading && newsData && (
        <>
          <DailyBrief
            summary={newsData.dailySummary}
            locationLabel={locationLabel}
            onSelectSection={handleBriefSectionSelect}
          />

          <div ref={newsStoriesRef} className="news-story-anchor" aria-hidden="true" />

          {sectionNames.length > 1 && (
            <nav className="section-tabs" aria-label="News sections">
              {sectionNames.map((section) => (
                <SectionTab
                  key={section}
                  section={section}
                  active={selectedSection === section}
                  onSelect={setSelectedSection}
                />
              ))}
            </nav>
          )}

          {visibleArticles.length > 0 ? (
            <>
              <div className="news-grid">{renderedArticles}</div>
              <div ref={loaderRef} className="scroll-loader">
                {visibleCount < articles.length ? 'Loading more stories' : 'You are up to date'}
              </div>
            </>
          ) : (
            <p className="news-status">No stories match this search.</p>
          )}

          <p className="news-provider-note">
            {newsData.sources?.length > 0 && (
              <>
                News discovery provided by{' '}
                {newsData.sources.map((source, index) => (
                  <span key={source.url || source.name}>
                    {index > 0 ? ', ' : ''}
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                  </span>
                ))}.
              </>
            )}{' '}
            {country === 'GLOBAL' && 'Worldwide also includes Hacker News and Spaceflight News.'}
          </p>
        </>
      )}
    </section>
  );
}
