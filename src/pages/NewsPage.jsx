import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, BriefcaseBusiness, Cpu, FlaskConical, Globe2, HeartPulse, Landmark, Leaf, Newspaper, Search, Trophy } from 'lucide-react';
import { newsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  NEWS_COUNTRIES,
  NEWS_REGIONS,
  getDefaultNewsCountry,
} from '../data/newsLocations';
import './NewsPage.css';
import './LibraryNewsTheme.css';

const CACHE_PREFIX = 'smarty_location_news_v22_';
const CACHE_TTL = 1000 * 60 * 15;
const CACHE_STALE_TTL = 1000 * 60 * 60 * 48;
const PAGE_SIZE = 9;
const SECTION_ICONS = {
  world: Globe2, business: BriefcaseBusiness, technology: Cpu, science: FlaskConical,
  health: HeartPulse, politics: Landmark, environment: Leaf, sports: Trophy,
};

function NewsSectionIcon({ section }) {
  const Icon = SECTION_ICONS[String(section).toLowerCase()] || Newspaper;
  return <Icon size={21} strokeWidth={1.6} aria-hidden="true" />;
}

function BriefingSources({ stories = [], label = 'Briefing sources' }) {
  const links = [...new Map((Array.isArray(stories) ? stories : []).flatMap(story => {
    try {
      const url = new URL(story?.news_link);
      return /^https?:$/.test(url.protocol) ? [[url.href, { ...story, news_link: url.href }]] : [];
    } catch { return []; }
  })).values()];
  if (!links.length) return null;
  const publishers = [...new Set(links.map(story => story.source).filter(Boolean))];
  return (
    <details className="news-summary-sources" aria-label={label}>
      <summary><div><strong>Sources · {links.length}</strong><small>{publishers.slice(0, 3).join(' · ') || 'Original reporting'}</small></div><span aria-hidden="true">+</span></summary>
      <ul>{links.map(story => <li key={story.news_link}>
        <a href={story.news_link} target="_blank" rel="noopener noreferrer">
          {story.title || 'Read original report'}<small>{story.source || 'Original report'} · Opens in a new tab</small>
        </a>
      </li>)}</ul>
    </details>
  );
}

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
      isFresh: age <= CACHE_TTL && (!cached.news.dailySummary?.editionDate
        || cached.news.dailySummary.editionDate === new Date().toISOString().slice(0, 10)),
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
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function readingTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
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

const NewsCard = memo(function NewsCard({ article, index, saved, onToggleSave, onShare, variant = 'grid' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(article.image_link) && !imageFailed;
  const publishedAt = formatPublishedAt(article.published_at);

  return (
    <article className={`news-card news-card--${variant}${variant === 'featured' ? ' featured' : ''}${hasImage ? '' : ' news-card--text'}`}>
      {hasImage ? (
        <img
          src={article.image_link}
          alt=""
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 3 ? 'high' : 'auto'}
          onError={() => setImageFailed(true)}
        />
      ) : null}

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

const SectionTab = memo(function SectionTab({ section, active, count, onSelect }) {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      aria-pressed={active}
      onClick={() => onSelect(section)}
    >
      <span>{section}</span>
      {Number.isFinite(count) && <small>{count}</small>}
    </button>
  );
});

const DailyBrief = memo(function DailyBrief({ summary, locationLabel, onSelectSection, world = false, showSections = true }) {
  if (!summary) return null;
  const titleId = world ? 'world-brief-title' : 'daily-brief-title';
  const paragraphs = summary.overviewParagraphs?.length
    ? summary.overviewParagraphs : [summary.overview];

  return (
    <section className="news-daily-brief" aria-labelledby={titleId}>
      <div className="news-brief-lead">
        <div className="news-brief-copy">
          <span className="news-brief-eyebrow">{summary.eyebrow || "Today's briefing"}</span>
          <h2 id={titleId}>
            {summary.title || `${locationLabel} at a glance`}
          </h2>
          <div className="news-brief-prose">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>

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

      {showSections && summary.sectionDigests?.length > 0 && (
        <details className="news-section-digest" open={world || undefined}>
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
            <p>Read the main developments in each sector, with the original reports linked for more context.</p>
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

                {digest.topStories?.length > 0 && (
                  <ul className="news-digest-sources" aria-label={`${digest.section} source reports`}>
                    {digest.topStories.slice(0, 3).map(story => (
                      <li key={story.id || story.news_link}>
                        <a href={story.news_link} target="_blank" rel="noopener noreferrer">
                          {story.title}<small>{story.source}</small>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

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
      {summary.unavailableSectors?.length > 0 && (
        <p className="news-inline-notice">No verified recent stories available for: {summary.unavailableSectors.join(', ')}.</p>
      )}
    </section>
  );
});

export default function NewsPage({ briefingOnly = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const initialCountry = useMemo(() => {
    if (briefingOnly) return 'GLOBAL';
    const requested = new URLSearchParams(location.search).get('country');
    return NEWS_COUNTRIES.some(item => item.code === requested) ? requested : getDefaultNewsCountry();
  }, []);
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(() => initialCountry === 'GLOBAL' ? '' : getSavedRegion(initialCountry));
  const [newsData, setNewsData] = useState(null);
  const [search, setSearch] = useState(
    () => new URLSearchParams(location.search).get('search') || ''
  );
  const [selectedSection, setSelectedSection] = useState(() => new URLSearchParams(location.search).get('section') || 'All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [saved, setSaved] = useState([]);
  const [actionStatus, setActionStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [comfortableText, setComfortableText] = useState(() => {
    try { return localStorage.getItem('smarty-news-comfortable-text') === 'true'; }
    catch { return false; }
  });

  const loaderRef = useRef(null);
  const newsStoriesRef = useRef(null);
  const summaryHeadingRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const savedStorageKey = useMemo(() => {
    const accountId = user?.userId || user?.sub || user?.id || user?.email || 'guest';
    return `smarty-saved-news-v1-${encodeURIComponent(String(accountId))}`;
  }, [user]);

  useEffect(() => {
    if (briefingOnly) return;
    const params = new URLSearchParams(location.search);
    const incomingSearch = params.get('search');
    if (incomingSearch !== null) setSearch(incomingSearch);
    const requested = params.get('country');
    if (NEWS_COUNTRIES.some(item => item.code === requested)) {
      setCountry(requested);
      setRegion('');
    }
    if (params.get('section')) setSelectedSection(params.get('section'));
  }, [location.search, briefingOnly]);

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
  const sectionCounts = useMemo(() => {
    const counts = new Map(sections.map(([name, items]) => [name, items.length]));
    counts.set('All', sections.reduce((total, [, items]) => total + items.length, 0));
    return counts;
  }, [sections]);
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
        variant={index === 0 && selectedSection === 'All' && !search.trim() ? 'featured' : 'grid'}
        saved={savedLinks.has(article.news_link)}
        onToggleSave={toggleSave}
        onShare={shareArticle}
      />
    )),
    [savedLinks, search, selectedSection, shareArticle, toggleSave, visibleArticles]
  );

  const summarySections = useMemo(() => (
    Array.isArray(newsData?.dailySummary?.sectionDigests)
      ? newsData.dailySummary.sectionDigests.filter(digest => digest.section && digest.summary
        && (!briefingOnly || (newsData.dailySummary.summaryMode === 'editorial' && digest.summaryMode !== 'extractive')))
      : []
  ), [newsData, briefingOnly]);
  const dailyBriefing = newsData?.dailySummary?.summaryMode === 'editorial' ? newsData.dailySummary : null;
  const visibleSummaries = summarySections.filter(
    digest => (selectedSection === 'All' || digest.section === selectedSection)
      && `${digest.section} ${digest.summary} ${digest.context || ''} ${digest.next || ''}`
        .toLowerCase().includes(summarySearch.trim().toLowerCase())
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
  }, [articles.length, loading, selectedSection, search, visibleCount]);

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

  const toggleComfortableText = () => {
    const next = !comfortableText;
    setComfortableText(next);
    try { localStorage.setItem('smarty-news-comfortable-text', String(next)); }
    catch { /* Reading preferences still work for this visit. */ }
  };

  const jumpToSummaries = () => {
    const heading = summaryHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  if (briefingOnly) return (
    <section className={`news-page news-feed-briefing${comfortableText ? ' news-comfortable-text' : ''}`} aria-label="World news feed">
      <div className="news-feed-toolbar">
        <div className="news-feed-heading">
          <span className="news-kicker">Your world briefing</span>
          <strong>{dailyBriefing?.generatedAt ? `Edition published ${formatUpdatedAt(dailyBriefing.generatedAt)}` : lastUpdated ? `Updated ${lastUpdated}` : 'The world today, explained clearly.'}</strong>
        </div>
        {summarySections.length > 0 && <label className="news-summary-search news-toolbar-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Search news summaries" placeholder="Search summaries" value={summarySearch}
            onChange={event => setSummarySearch(event.target.value)} />
        </label>}
        <div className="news-feed-actions">
          <Link to="/news">Open full newsroom <span aria-hidden="true">↗</span></Link>
          <button type="button" className="refresh-news-btn" disabled={loading || refreshing}
            onClick={() => fetchNews('GLOBAL', '', true)}>{refreshing ? 'Refreshing' : 'Refresh'}</button>
        </div>
      </div>
      {loading && <div role="status"><p>Preparing your world briefing…</p><div className="news-summary-feed"><NewsSkeleton /><NewsSkeleton /></div></div>}
      {(error || newsData?.notice || fromCache) && <p className="news-inline-notice" role="status">
        {error || newsData?.notice || 'Showing your latest saved briefing.'}
      </p>}
      {!loading && !newsData && <div className="news-retry" role="alert">
        <h2>The world briefing is unavailable.</h2>
        <button type="button" onClick={() => fetchNews('GLOBAL', '', true)}>Try again</button>
      </div>}
      {newsData && (
        <>
          {dailyBriefing && !summarySearch.trim() && (
            <section className="news-topic-summary" aria-labelledby="news-topic-summary-title">
              <div>
                <span>AI daily briefing · {readingTime((dailyBriefing.overviewParagraphs || [dailyBriefing.overview]).join(' '))}</span>
                <h2 id="news-topic-summary-title">
                  {newsData.dailySummary.title || 'The world today'}
                </h2>
                {(newsData.dailySummary.overviewParagraphs?.length
                  ? newsData.dailySummary.overviewParagraphs
                  : [newsData.dailySummary.overview]).filter(Boolean).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <div className="news-edition-footer">
              <dl>
                <div><dt>Edition</dt><dd>{dailyBriefing.editionDate || 'Daily'}{dailyBriefing.editionDate ? ' UTC' : ''}</dd></div>
                <div><dt>Coverage</dt><dd>Previous 24 hours</dd></div>
                <div><dt>Sections</dt><dd>{summarySections.length}</dd></div>
              </dl>
              {summarySections.length > 0 && <button type="button" className="news-edition-jump" onClick={jumpToSummaries}>
                Explore the sections <ArrowDown size={16} aria-hidden="true" />
              </button>}
              </div>
              <BriefingSources stories={dailyBriefing.highlights} label="Daily overview sources" />
            </section>
          )}
          {dailyBriefing?.keyTakeaways?.length > 0 && !summarySearch.trim() && <section className="news-briefing-takeaways" aria-label="The day in brief">
            <h2>Start here</h2>
            <div>{dailyBriefing.keyTakeaways.slice(0, 3).map((item, index) => <article key={index}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3><p>{item.summary}</p>
            </article>)}</div>
          </section>}

          {summarySections.length > 0 && (
            <nav className="section-tabs news-topic-tabs" aria-label="World news sections">
              {['All', ...summarySections.map(digest => digest.section)].map((section) => (
                <SectionTab
                  key={section}
                  section={section}
                  active={selectedSection === section}
                  onSelect={setSelectedSection}
                />
              ))}
            </nav>
          )}

          <div className="news-stream-heading news-summary-heading">
            <div>
              <span>{summarySearch.trim() ? 'Search results' : selectedSection === 'All' ? 'Latest summaries' : selectedSection}</span>
              <h2 ref={summaryHeadingRef} tabIndex={-1}>{summarySearch.trim() ? 'Matching summaries' : selectedSection === 'All' ? 'The day, section by section' : `${selectedSection} summaries`}</h2>
            </div>
            <div className="news-reading-tools">
              <small aria-live="polite">{visibleSummaries.length} {visibleSummaries.length === 1 ? 'summary' : 'summaries'}</small>
              <button type="button" aria-pressed={comfortableText} onClick={toggleComfortableText}>
                <span aria-hidden="true">Aa</span> Larger text
              </button>
            </div>
          </div>

          {summarySections.length > 0 && (summarySearch || selectedSection !== 'All') && <div className="news-summary-search-row">
            <button type="button" className="news-summary-reset"
              onClick={() => { setSummarySearch(''); setSelectedSection('All'); }}>Show all summaries</button>
          </div>}

          {visibleSummaries.length > 0 ? (
            <div className="news-summary-feed">
              {visibleSummaries.map(digest => (
                <article className="news-summary-post" key={digest.section}>
                  <header>
                    <span className="news-summary-mark"><NewsSectionIcon section={digest.section} /></span>
                    <div><h3>{digest.section}</h3><span>Daily perspective · {readingTime(digest.summary)}</span></div>
                    <span className="news-summary-number" aria-hidden="true">{String(summarySections.indexOf(digest) + 1).padStart(2, '0')}</span>
                  </header>
                  <div className="news-summary-post-copy">
                    {(digest.summaryParagraphs?.length ? digest.summaryParagraphs : digest.summary.split(/\n\s*\n/)).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </div>
                  {(digest.context || digest.next) && <dl className="news-summary-context">
                    {digest.context && <div><dt>Why it matters</dt><dd>{digest.context}</dd></div>}
                    {digest.next && <div><dt>What to watch</dt><dd>{digest.next}</dd></div>}
                  </dl>}
                  <BriefingSources stories={digest.topStories} label={`${digest.section} summary sources`} />
                </article>
              ))}
            </div>
          ) : (
            <div className="news-status" role="status"><p>{summarySections.length ? 'No summaries match your filters. Try another subject or show all summaries.' : 'The AI world briefing is not ready yet. Please try refreshing shortly.'}</p></div>
          )}
          {visibleSummaries.length > 0 && <footer className="news-summary-end">
            <Globe2 size={22} strokeWidth={1.5} aria-hidden="true" />
            <div><strong>You’ve reached the end of this briefing.</strong><p>AI-written from recent reporting. One shared daily edition, not a live news ticker. Some developments may change after publication.</p></div>
          </footer>}
        </>
      )}
    </section>
  );

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
          <h1>The day, in perspective.</h1>
          <p>Start with the day’s briefing, then move through original reporting by place and subject.</p>
          <Link className="news-feed-link" to="/feed?topic=News">Read the world briefing in your feed →</Link>
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
          {country !== 'GLOBAL' && <DailyBrief
            summary={newsData.dailySummary}
            locationLabel={locationLabel}
            onSelectSection={handleBriefSectionSelect}
            showSections={false}
          />}

          <div ref={newsStoriesRef} className="news-story-anchor" aria-hidden="true" />

          <div className="news-discovery-layout">
            {sectionNames.length > 1 && (
              <aside className="news-section-rail" aria-label="News sections">
                <div>
                  <span>Browse by section</span>
                  <strong>Coverage</strong>
                </div>
                <nav className="section-tabs">
                  {sectionNames.map((section) => (
                    <SectionTab
                      key={section}
                      section={section}
                      count={sectionCounts.get(section)}
                      active={selectedSection === section}
                      onSelect={setSelectedSection}
                    />
                  ))}
                </nav>
              </aside>
            )}

            <div className="news-results-column">
              <div className="news-stream-heading">
                <div>
                  <span>{selectedSection === 'All' ? `${locationLabel} · Latest` : locationLabel}</span>
                  <h2>{selectedSection === 'All' ? 'Today’s reporting' : `${selectedSection} stories`}</h2>
                </div>
                <small>{articles.length} {articles.length === 1 ? 'story' : 'stories'}</small>
              </div>
              {(search.trim() || selectedSection !== 'All') && (
                <div className="news-filter-status">
                  <span>{search.trim() ? `Results for “${search.trim()}”` : `${selectedSection} coverage`}</span>
                  <button type="button" onClick={() => { setSearch(''); setSelectedSection('All'); }}>Clear filters</button>
                </div>
              )}

              {visibleArticles.length > 0 ? (
                <>
                  <div className="news-grid">{renderedArticles}</div>
                  <div ref={loaderRef} className="scroll-loader">
                    {visibleCount < articles.length ? (
                      <button type="button" className="news-load-more" onClick={() => setVisibleCount(current => Math.min(current + PAGE_SIZE, articles.length))}>
                        Show more reports
                      </button>
                    ) : 'You’ve reached the end of this edition'}
                  </div>
                </>
              ) : (
                <p className="news-status">No stories match this search.</p>
              )}
            </div>
          </div>

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
