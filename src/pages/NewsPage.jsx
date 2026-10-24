import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Check, Cpu, FlaskConical, Globe2, HeartPulse, Landmark, Leaf, Newspaper, RefreshCw, Search, Share2, Trophy } from 'lucide-react';
import { newsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  NEWS_COUNTRIES,
  NEWS_REGIONS,
} from '../data/newsLocations';
import './NewsPage.css';
import './LibraryNewsTheme.css';
import { NewsStoryLink, SavedNewsStories } from '../components/NewsStoryLinks';
import { editorialNewsSections, hasEditorialBriefing } from '../lib/newsAvailability';
import { getNewsCacheKey as getCacheKey, getCachedNews, setCachedNews, newsOutlookParagraphs } from '../lib/newsBriefingCache';
import useNewsPersonalization from '../hooks/useNewsPersonalization';
import { NewsBriefingChoice, NewsFollowButton, NewsUpdatesShelf } from '../components/NewsPersonalization';
import { briefingPlace, readNewsPreference } from '../lib/newsPreferences';
import { normalizeNewsEdition, mergeNewsBriefing, normalizeSavedNews, safeNewsUrl } from '../lib/newsEdition';
import { balancedNewsReports, newsPreviewParagraphs, reportBriefingContext, selectNewsReports } from '../lib/newsReader';
import useNewsReader from '../hooks/useNewsReader';
import NewsReader from '../components/NewsReader';
import NewsLoading from '../components/NewsLoading';
import './NewsCompact.css';

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

const NewsCard = memo(function NewsCard({ article, index, saved, opened, context, onOpen, onToggleSave, onShare, variant = 'grid' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(article.image_link) && !imageFailed;
  const publishedAt = formatPublishedAt(article.published_at);
  const preview = newsPreviewParagraphs(article).join(' ');

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
          {opened && <span className="news-opened-label"><Check size={11} aria-hidden="true" />Opened</span>}
        </div>

        <h3><button type="button" className="news-card-title" onClick={() => onOpen(article)}>{article.title || 'Untitled news'}</button></h3>
        {(preview || context) && <p>{preview || context.summary}</p>}
        {!preview && context && <small className="news-card-context-label">Briefing context · AI-assisted</small>}
        <span className="news-card-source">{article.source || 'News source'}</span>
        <div className="news-card-story-tools"><NewsStoryLink story={article} /><NewsFollowButton story={article}/></div>

        <div className="news-actions">
          <button type="button" className="news-quick-read" onClick={() => onOpen(article)} aria-label={`Quick read: ${article.title}`}>
            Quick read <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={saved}
            aria-label={`${saved ? 'Remove' : 'Save'} ${article.title}`}
            title={saved ? 'Remove from saved reports' : 'Save report'}
            onClick={() => onToggleSave(article)}
          >
            <Bookmark size={17} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-label={`Share ${article.title}`}
            title="Share report"
            onClick={() => onShare(article)}
          >
            <Share2 size={17} aria-hidden="true" />
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
            <p>{paragraphs[0]}</p>
            {paragraphs.length > 1 && <details className="news-brief-more"><summary>Read the full briefing</summary>
              {paragraphs.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </details>}
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
            {summary.analysisStatement || 'Based on available reporting. Developments may change after publication.'}
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

      {(summary.keyTakeaways?.length > 0 || summary.keyThemes?.length > 0) && <details className="news-brief-insight-grid">
        <summary>Key developments <span>{summary.keyTakeaways?.length || summary.keyThemes?.length}</span></summary>
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


      </details>}

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
            <h3>Across today’s reporting</h3>
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
        <p className="news-inline-notice">No recent reports collected for: {summary.unavailableSectors.join(', ')}.</p>
      )}
    </section>
  );
});

export default function NewsPage({ briefingOnly = false }) {
  const { user } = useAuth();
  const readerAccount = String(user?.userId || user?.sub || user?.id || user?.email || 'guest');
  const reader = useNewsReader(readerAccount);
  const personal = useNewsPersonalization();
  const location = useLocation();
  const initialCountry = useMemo(() => {
    if (briefingOnly) return briefingPlace(readNewsPreference(user?.sub || user?.userId || user?.id || '')).country;
    const requested = new URLSearchParams(location.search).get('country');
    return NEWS_COUNTRIES.some(item => item.code === requested) ? requested : briefingPlace(readNewsPreference(user?.sub || user?.userId || user?.id || '')).country;
  }, []);
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState(() => briefingOnly ? briefingPlace(readNewsPreference(user?.sub || user?.userId || user?.id || '')).region : initialCountry === 'GLOBAL' ? '' : getSavedRegion(initialCountry));
  const [initialCache] = useState(() => getCachedNews(initialCountry, region));
  const [newsData, setNewsData] = useState(initialCache?.news || null);
  const [search, setSearch] = useState(
    () => new URLSearchParams(location.search).get('search') || ''
  );
  const [selectedSection, setSelectedSection] = useState(() => new URLSearchParams(location.search).get('section') || 'All');
  const [reportView, setReportView] = useState('edition');
  const [reportOrder, setReportOrder] = useState('edition');
  const [readerSelection, setReaderSelection] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedState, setSavedState] = useState({ key: '', entries: [] });
  const savedRef = useRef(savedState);
  const [actionStatus, setActionStatus] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => initialCache ? formatUpdatedAt(initialCache.news.generatedAt || initialCache.timestamp) : '');
  const [fromCache, setFromCache] = useState(Boolean(initialCache && !initialCache.isFresh));
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [briefingPending, setBriefingPending] = useState(false);
  const [error, setError] = useState('');
  const [comfortableText, setComfortableText] = useState(() => {
    try { return localStorage.getItem('smarty-news-comfortable-text') === 'true'; }
    catch { return false; }
  });

  const loaderRef = useRef(null);
  const newsStoriesRef = useRef(null);
  const summaryHeadingRef = useRef(null);
  const reportsHeadingRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const loadedLocationRef = useRef(initialCache ? getCacheKey(initialCountry, region) : '');
  const savedStorageKey = useMemo(() => {
    return `smarty-saved-news-v1-${encodeURIComponent(readerAccount)}`;
  }, [readerAccount]);
  const saved = savedState.key === savedStorageKey ? savedState.entries : [];
  const selectedReport = readerSelection?.account === readerAccount ? readerSelection.article : null;

  useEffect(() => { setReaderSelection(null); }, [readerAccount, location.pathname, location.search, country, region]);

  const preferred = briefingPlace(personal.preferences);
  useEffect(() => {
    if (!briefingOnly && NEWS_COUNTRIES.some(item => item.code === new URLSearchParams(location.search).get('country'))) return;
    if (briefingOnly || personal.preferences) { setCountry(preferred.country); setRegion(preferred.region); setSelectedSection('All'); }
  }, [briefingOnly, personal.account, personal.preferences?.chosen, preferred.country, preferred.region]);

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
    const load = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(savedStorageKey) || '[]');
        savedRef.current = { key: savedStorageKey, entries: normalizeSavedNews(stored) };
      } catch {
        savedRef.current = { key: savedStorageKey, entries: [] };
      }
      setSavedState(savedRef.current);
    };
    load();
    setActionStatus('');
    const changed = event => { if (event.key === savedStorageKey || event.key === null) load(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [savedStorageKey]);

  useEffect(() => {
    if (!actionStatus) return undefined;
    const timer = window.setTimeout(() => setActionStatus(''), 2200);
    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  const fetchNews = useCallback(async (targetCountry, targetRegion, forceRefresh = false) => {
    abortControllerRef.current?.abort();
    const nextLocation = getCacheKey(targetCountry, targetRegion);
    const retainReports = forceRefresh && loadedLocationRef.current === nextLocation;
    const cached = getCachedNews(targetCountry, targetRegion);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');
    setRefreshing(false);
    setBriefingPending(false);
    setVisibleCount(PAGE_SIZE);

    if (cached) {
      loadedLocationRef.current = nextLocation;
      setNewsData(cached.news);
      setFromCache(!cached.isFresh);
      setLastUpdated(formatUpdatedAt(cached.news.generatedAt || cached.timestamp));
      setLoading(false);
      if (cached.isFresh && hasEditorialBriefing(cached.news) && !forceRefresh) return;
    } else {
      setFromCache(false);
      if (!retainReports) {
        loadedLocationRef.current = '';
        setNewsData(null);
        setLastUpdated('');
      }
    }

    setLoading(!cached && !retainReports);
    setRefreshing(Boolean(cached) || forceRefresh);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = normalizeNewsEdition(await newsApi.getLatestNews({
        country: targetCountry,
        region: targetRegion,
        lang: 'english',
        signal: controller.signal,
        forceRefresh,
        // Reports have their own shared cache and do not wait for the model.
        view: 'reports',
      }));

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      // A valid same-day briefing stays readable during a manual refresh.
      // Never blend a previous day's summary into newly collected reports.
      const retainedBriefing = hasEditorialBriefing(cached?.news)
        && cached.news.dailySummary.editionDate === new Date().toISOString().slice(0, 10);
      const fastData = retainedBriefing ? mergeNewsBriefing(data, cached.news) : data;
      const availableData = setCachedNews(targetCountry, targetRegion, fastData);
      setNewsData(availableData);
      setLoading(false);
      loadedLocationRef.current = nextLocation;
      setFromCache(data.cacheStatus === 'stale-cache');
      setLastUpdated(formatUpdatedAt(data.generatedAt || Date.now()));
      if (data.notice) setError(data.notice);
      if (forceRefresh || !hasEditorialBriefing(availableData) || !getCachedNews(targetCountry, targetRegion)?.isFresh) {
        setBriefingPending(true);
        setRefreshing(true);
        try {
          const briefing = await newsApi.getLatestNews({ country: targetCountry, region: targetRegion, lang: 'english', signal: controller.signal, forceRefresh });
          if (mountedRef.current && requestId === requestIdRef.current) {
            const merged = setCachedNews(targetCountry, targetRegion, mergeNewsBriefing(availableData, briefing));
            setNewsData(merged);
            setFromCache(merged.cacheStatus === 'stale-cache');
            setLastUpdated(formatUpdatedAt(merged.generatedAt || Date.now()));
            if (!hasEditorialBriefing(merged)) setError('The daily summary is unavailable right now. Original reports are ready below.');
          }
        } catch {
          if (!controller.signal.aborted && mountedRef.current && requestId === requestIdRef.current) setError('Reports are ready. The daily summary is taking longer; you can keep reading.');
        }
      }
    } catch (fetchError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (controller.signal.aborted || fetchError?.name === 'AbortError' || fetchError?.code === 'ERR_CANCELED') {
        return;
      }

      setError(
        cached || retainReports
          ? 'Could not refresh right now. Your latest saved briefing is still available.'
          : fetchError.message || 'Could not load current news. Please try again.'
      );
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setBriefingPending(false);
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
      }
    }
  }, [briefingOnly]);

  useEffect(() => {
    fetchNews(country, region);
  }, [country, fetchNews, region]);

  const sections = useMemo(() => {
    let sectionMap = newsData?.sections || {};
    if (!Object.keys(sectionMap).length && Array.isArray(newsData?.articles)) {
      sectionMap = newsData.articles.reduce((result, article) => {
        const section = article.section || 'World';
        (result[section] ||= []).push(article);
        return result;
      }, Object.create(null));
    }
    return Object.entries(sectionMap).filter(([, items]) => Array.isArray(items) && items.length);
  }, [newsData]);
  const editionArticles = useMemo(() => balancedNewsReports(sections.flatMap(([sectionName, items]) =>
    items.map(item => ({ ...item, section: item.section || sectionName }))
  )), [sections]);
  const sourceArticles = useMemo(() => reportView === 'saved' && !briefingOnly ? [...saved].reverse() : editionArticles,
    [reportView, briefingOnly, saved, editionArticles]);
  const sectionNames = useMemo(() => ['All', ...new Set(sourceArticles.map(article => article.section || 'World'))], [sourceArticles]);
  const sectionCounts = useMemo(() => {
    const counts = new Map();
    for (const article of sourceArticles) {
      if (reportView === 'unopened' && reader.opened.has(article.news_link)) continue;
      counts.set(article.section, (counts.get(article.section) || 0) + 1);
      counts.set('All', (counts.get('All') || 0) + 1);
    }
    return counts;
  }, [sourceArticles, reportView, reader.opened]);
  const articles = useMemo(() => selectNewsReports(sourceArticles, {
    section: selectedSection, search, unopened: reportView === 'unopened', order: reportOrder,
  }, reader.opened), [sourceArticles, search, selectedSection, reportView, reportOrder, reader.opened]);
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
  const openReport = useCallback(article => {
    reader.markOpened(article.news_link);
    setReaderSelection({ account: readerAccount, article });
  }, [readerAccount, reader.markOpened]);
  const closeReport = useCallback(() => setReaderSelection(null), []);
  const nextReports = useMemo(() => selectedReport ? editionArticles.filter(article =>
    article.news_link !== selectedReport.news_link && article.section === selectedReport.section
    && !reader.opened.has(article.news_link)).slice(0, 2) : [], [editionArticles, selectedReport, reader.opened]);

  const toggleSave = useCallback((article) => {
    const current = savedRef.current.key === savedStorageKey ? savedRef.current.entries : [];
    const exists = current.some((item) => item.news_link === article.news_link);
    if (!exists && current.length >= 200) { setActionStatus('Your saved reports are full. Remove a report before saving another.'); return; }
    const updated = exists
      ? current.filter((item) => item.news_link !== article.news_link)
      : [...current, article];

    savedRef.current = { key: savedStorageKey, entries: updated };
    setSavedState(savedRef.current);
    try {
      localStorage.setItem(savedStorageKey, JSON.stringify(updated));
      setActionStatus(exists ? 'Removed from saved reports.' : 'Report saved on this device. Find it under Saved reports.');
    } catch {
      setActionStatus('Updated for this session only. Device storage is unavailable.');
    }
  }, [savedStorageKey]);

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
        opened={reader.opened.has(article.news_link)}
        context={reportBriefingContext(newsData?.dailySummary, article)}
        onOpen={openReport}
        onToggleSave={toggleSave}
        onShare={shareArticle}
      />
    )),
    [savedLinks, search, selectedSection, shareArticle, toggleSave, visibleArticles, reader.opened, openReport, newsData?.dailySummary]
  );

  const summarySections = useMemo(() => (
    briefingOnly ? editorialNewsSections(newsData) : Array.isArray(newsData?.dailySummary?.sectionDigests)
      ? newsData.dailySummary.sectionDigests.filter(digest => digest?.section && typeof digest.summary === 'string' && digest.summary.trim())
      : []
  ), [newsData, briefingOnly]);
  const dailyBriefing = hasEditorialBriefing(newsData) ? newsData.dailySummary : null;
  const visibleSummaries = summarySections.filter(
    digest => selectedSection === 'All' || digest.section === selectedSection
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [country, region, search, selectedSection, reportView, reportOrder]);

  useEffect(() => {
    const available = briefingOnly && summarySections.length ? ['All', ...summarySections.map(digest => digest.section)] : sectionNames;
    if (newsData && !available.includes(selectedSection)) setSelectedSection('All');
  }, [newsData, sectionNames, selectedSection, briefingOnly, summarySections]);

  useEffect(() => {
    if (!loaderRef.current || typeof IntersectionObserver === 'undefined') return undefined;

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
  }, [articles.length, loading, selectedSection, search, visibleCount, reportView]);

  const handlePlaceChange = useCallback(place => {
    setCountry(place.country); setRegion(place.region);
    setReportView('edition');
    setSelectedSection('All'); setSearch('');
  }, []);

  const handleBriefSectionSelect = useCallback((section) => {
    setReportView('edition');
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

  const readerPanel = selectedReport && <NewsReader article={selectedReport}
    saved={savedLinks.has(selectedReport.news_link)} context={reportBriefingContext(dailyBriefing, selectedReport)}
    nextReports={nextReports} comfortableText={comfortableText} status={actionStatus} onToggleText={toggleComfortableText}
    onToggleSave={toggleSave} onShare={shareArticle} onOpen={openReport} onClose={closeReport} returnFocusRef={reportsHeadingRef} />;

  if (briefingOnly) return (
    <section className={`news-page news-compact news-feed-briefing${comfortableText ? ' news-comfortable-text' : ''}`} aria-label="Daily news feed">
      {readerPanel}
      {actionStatus && <p className="news-action-status" role="status" aria-live="polite">{actionStatus}</p>}
      <div className="news-feed-toolbar">
        <div className="news-feed-heading">
          <span className="news-kicker">{country === 'GLOBAL' ? 'Your world briefing' : `Your ${locationLabel} briefing`}</span>
          <strong>{dailyBriefing?.generatedAt ? `Edition published ${formatUpdatedAt(dailyBriefing.generatedAt)}` : lastUpdated ? `Updated ${lastUpdated}` : 'The world today, explained clearly.'}</strong>
        </div>
        <div className="news-feed-actions">
          <Link to="/news">All reports <ArrowUpRight size={14} aria-hidden="true" /></Link>
          <button type="button" className="refresh-news-btn" disabled={loading || refreshing}
            aria-label="Refresh daily briefing" title="Refresh daily briefing" onClick={() => fetchNews(country, region, true)}><RefreshCw size={16} aria-hidden="true" className={refreshing ? 'news-refreshing' : ''}/></button>
        </div>
      </div>
      <div className="news-edition-controls">
        <NewsBriefingChoice personal={personal} activePlace={{country, region}} onChange={handlePlaceChange}/>
        <NewsUpdatesShelf personal={personal}/>
      </div>
      {briefingPending && <NewsLoading kind="briefing" inline />}
      {loading && <NewsLoading kind="briefing" />}
      {(error || newsData?.notice || fromCache) && <p className="news-inline-notice" role="status">
        {error || newsData?.notice || 'Showing your latest saved briefing.'}
      </p>}
      {!loading && !newsData && <div className="news-retry" role="alert">
        <h2>This daily briefing is unavailable.</h2>
        <button type="button" onClick={() => fetchNews(country, region, true)}>Try again</button>
      </div>}
      {newsData && (
        <>
          {dailyBriefing && (
            <section className="news-topic-summary" aria-labelledby="news-topic-summary-title">
              <div>
                <span>AI daily briefing · {readingTime((dailyBriefing.overviewParagraphs || [dailyBriefing.overview]).join(' '))}</span>
                <h2 id="news-topic-summary-title">
                  {newsData.dailySummary.title || 'The world today'}
                </h2>
                {(newsData.dailySummary.overviewParagraphs?.length
                  ? newsData.dailySummary.overviewParagraphs
                  : [newsData.dailySummary.overview]).filter(Boolean).slice(0, 1).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                {newsData.dailySummary.overviewParagraphs?.length > 1 && <details className="news-brief-more">
                  <summary>Read the full briefing</summary>
                  {newsData.dailySummary.overviewParagraphs.slice(1).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </details>}
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
          {dailyBriefing?.keyTakeaways?.length > 0 && <details className="news-briefing-takeaways" aria-label="The day in brief">
            <summary>Key developments <span>{dailyBriefing.keyTakeaways.length}</span></summary>
            <div>{dailyBriefing.keyTakeaways.slice(0, 3).map((item, index) => <article key={index}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{item.title}</h3><p>{item.summary}</p>
            </article>)}</div>
          </details>}

          {summarySections.length > 0 && (
            <nav className="section-tabs news-topic-tabs" aria-label="Daily news sections">
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
              <span>{!summarySections.length ? 'Original reporting' : selectedSection === 'All' ? 'Latest summaries' : selectedSection}</span>
              <h2 ref={summaryHeadingRef} tabIndex={-1}>{!summarySections.length ? 'Latest available reports' : selectedSection === 'All' ? 'The day, section by section' : `${selectedSection} summaries`}</h2>
            </div>
            <div className="news-reading-tools">
              <small aria-live="polite">{summarySections.length ? `${visibleSummaries.length} ${visibleSummaries.length === 1 ? 'summary' : 'summaries'}` : `${articles.length} ${articles.length === 1 ? 'report' : 'reports'}`}</small>
              <button type="button" aria-pressed={comfortableText} onClick={toggleComfortableText}>
                <span aria-hidden="true">Aa</span> Larger text
              </button>
            </div>
          </div>

          {summarySections.length > 0 && selectedSection !== 'All' && <div className="news-summary-search-row">
            <button type="button" className="news-summary-reset"
              onClick={() => setSelectedSection('All')}>Show all summaries</button>
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
                  {newsOutlookParagraphs(digest).length > 0 && <section className="news-summary-context" aria-label="Context and outlook">
                    <h4>What this means and what comes next</h4>
                    {newsOutlookParagraphs(digest).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </section>}
                  <BriefingSources stories={digest.topStories} label={`${digest.section} summary sources`} />
                </article>
              ))}
            </div>
          ) : summarySections.length ? (
            <div className="news-status" role="status"><p>Choose another section or show all summaries.</p></div>
          ) : (
            <section className="news-report-fallback" aria-label="Available news reports">
              <div className="news-status" role="status">
                <h3>Read the latest reports</h3>
                <p>The AI section briefing is temporarily unavailable. These are original reports, not an AI-generated daily summary.</p>
              </div>
              <nav className="section-tabs" aria-label="Available report sections">
                {sectionNames.map(section => <SectionTab key={section} section={section} active={selectedSection === section} onSelect={setSelectedSection} />)}
              </nav>
              <div className="news-grid">{renderedArticles}</div>
              {visibleCount < articles.length && <button type="button" className="news-load-more"
                onClick={() => setVisibleCount(current => Math.min(current + PAGE_SIZE, articles.length))}>Show more reports</button>}
            </section>
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
    <section className="news-page news-compact news-newsroom">
      {readerPanel}
      {actionStatus && (
        <p className="news-action-status" role="status" aria-live="polite">
          {actionStatus}
        </p>
      )}
      <div className="news-hero">
        <div>
          <h1>News<span className="news-heading-place">{locationLabel}</span></h1>
          {lastUpdated && (
            <span className="last-updated">Updated {lastUpdated}</span>
          )}
        </div>

        <div className="news-header-actions"><Link className="news-feed-link" to="/feed?topic=News">Daily briefing <ArrowUpRight size={14} aria-hidden="true" /></Link><button
          type="button"
          className="refresh-news-btn"
          onClick={() => fetchNews(country, region, true)}
          disabled={loading || refreshing}
          aria-label="Refresh current news"
          title="Refresh current news"
        >
          <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'news-refreshing' : ''}/>
        </button></div>
      </div>

      <div className="news-edition-controls">
        <NewsBriefingChoice personal={personal} activePlace={{country, region}} onChange={handlePlaceChange}/>
        <NewsUpdatesShelf personal={personal}/>
        <SavedNewsStories collapsed />
      </div>
      <div className="news-browse-controls">
      <div className="news-controls news-compact-search">
        <label className="news-search-control">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label={reportView === 'saved' ? 'Search saved reports' : 'Search current news'}
            placeholder={reportView === 'saved' ? 'Search your saved reports' : `Search ${locationLabel} news`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

      </div>

      <div className="news-reader-tools">
        <div className="news-reader-views" role="group" aria-label="Report collection">
          {[['edition', 'Latest', editionArticles.length], ['unopened', 'Unopened', editionArticles.filter(article => !reader.opened.has(article.news_link)).length], ['saved', 'Saved reports', saved.length]].map(([value, label, count]) =>
            <button type="button" key={value} aria-pressed={reportView === value} onClick={() => { setReportView(value); setSelectedSection('All'); }}>
              {label}<small>{count}</small>
            </button>)}
        </div>
        <label className="news-report-order">Order<select aria-label="Order reports" value={reportOrder} onChange={event => setReportOrder(event.target.value)}>
          <option value="edition">{reportView === 'saved' ? 'Recently saved' : 'Balanced coverage'}</option><option value="newest">Newest first</option>
        </select></label>
      </div>
      </div>
      {reportView === 'saved' && <p className="news-reader-note">Saved previews from every edition, kept on this device for your account. Original articles need a connection.</p>}
      {reportView === 'unopened' && <p className="news-reader-note">Reports you haven’t opened in Smarty on this device. Opening a quick read marks it as opened.</p>}

      {(fromCache || newsData?.notice) && !loading && (
        <p className="cache-note">
          {newsData?.notice || 'Showing your latest saved briefing.'}
        </p>
      )}

      {error && newsData && (
        <p className="news-inline-notice" role="status">{error}</p>
      )}

      {loading && reportView !== 'saved' && <NewsLoading />}

      {!loading && !newsData && error && reportView !== 'saved' && (
        <div className="news-retry" role="alert">
          <h2>Today’s briefing is unavailable.</h2>
          <p>{error}</p>
          <button type="button" onClick={() => fetchNews(country, region, true)}>
            Try again
          </button>
        </div>
      )}

      {((!loading && newsData) || reportView === 'saved') && (
        <>
          {reportView !== 'saved' && briefingPending && <NewsLoading kind="briefing" inline />}
          {reportView === 'edition' && !search.trim() && dailyBriefing && !briefingPending && <DailyBrief
            summary={dailyBriefing}
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
                  <span>{reportView === 'saved' ? 'Your reading list · On this device' : locationLabel}</span>
                  <h2 ref={reportsHeadingRef} tabIndex={-1}>{reportView === 'saved' ? 'Saved reports' : reportView === 'unopened' ? 'Still to explore' : selectedSection === 'All' ? 'Today’s reporting' : `${selectedSection} stories`}</h2>
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
                    ) : reportView === 'saved' ? 'You’re up to date with your saved reports.' : 'You’ve reached the end of this edition'}
                  </div>
                </>
              ) : (
                <div className="news-reader-empty" role="status">
                  <h3>{search.trim() || selectedSection !== 'All' ? 'No matching reports' : reportView === 'saved' ? 'Keep something worth coming back to.' : reportView === 'unopened' ? 'You’re caught up with this edition.' : 'No reports in this edition yet.'}</h3>
                  <p>{search.trim() || selectedSection !== 'All' ? 'Try another phrase or clear your filters.' : reportView === 'saved' ? 'Tap the bookmark on a report to save its preview here, even when you’re offline.' : reportView === 'unopened' ? 'Browse the full edition again, or switch places to explore more.' : 'Try refreshing or choosing another place.'}</p>
                  <button type="button" onClick={() => { setSearch(''); setSelectedSection('All'); if (!search.trim() && selectedSection === 'All') setReportView('edition'); }}>{search.trim() || selectedSection !== 'All' ? 'Clear filters' : 'Browse latest reports'}</button>
                </div>
              )}
            </div>
          </div>

          {reportView !== 'saved' && <p className="news-provider-note">
            {newsData?.sources?.length > 0 && (
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
          </p>}
        </>
      )}
    </section>
  );
}
