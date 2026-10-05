import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUpRight, Bookmark, Check, History, Search, Share2 } from 'lucide-react';
import { newsApi } from '../api/client';
import { cleanStoryQuery, filterStoryReports, groupStoryReports, reportKey, storyPeriod, timelineArticles } from '../lib/newsStories';
import useNewsStoryLibrary from '../hooks/useNewsStoryLibrary';
import './NewsStoryPage.css';

const CACHE_KEY = 'smarty-story-timelines-v1';
const FRESH_MS = 20 * 60 * 1000;
const KEEP_MS = 7 * 86400 * 1000;
function cachedTimeline(key) {
  try {
    const entry = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')[key];
    return entry?.data?.kind === 'story-timeline' && Date.now() - entry.savedAt < KEEP_MS ? entry : null;
  } catch { return null; }
}
function cacheTimeline(key, data) {
  try {
    const entries = Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'))
      .filter(([id, value]) => id !== key && Date.now() - value.savedAt < KEEP_MS)
      .sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 11);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries([[key, { data, savedAt: Date.now() }], ...entries])));
  } catch { /* The shared database remains the durable cache. */ }
}
const dateLabel = value => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));

export default function NewsStoryPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const query = cleanStoryQuery(params.get('q'));
  const { year, month, order } = storyPeriod(params);
  const key = JSON.stringify([query.toLowerCase(), year, month]);
  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState({ key: '', data: null, loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(20);
  const [filter, setFilter] = useState('');
  const [publisher, setPublisher] = useState('');
  const [unopened, setUnopened] = useState(false);
  const [status, setStatus] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [jumpTarget, setJumpTarget] = useState(null);
  const reportNodes = useRef(new Map());
  const { entries, update: updateLibrary } = useNewsStoryLibrary();
  const savedStory = entries.find(entry => entry.query.toLocaleLowerCase() === query.toLocaleLowerCase());
  const opened = useMemo(() => new Set(savedStory?.opened || []), [savedStory]);
  const heading = useRef(null);
  const currentYear = new Date().getUTCFullYear();
  const from = location.state?.from;
  const backTo = typeof from === 'string' && /^\/(news|feed)(\?|$)/.test(from) ? from : '/news';
  const current = result.key === key ? result : { data: null, loading: query.length >= 3, error: '' };
  const articles = useMemo(() => timelineArticles(current.data?.articles, order), [current.data, order]);
  const groups = useMemo(() => groupStoryReports(articles), [articles]);
  const filtered = useMemo(() => filterStoryReports(groups, {text: filter, publisher, unopened}, opened), [groups, filter, publisher, unopened, opened]);
  const publishers = useMemo(() => [...new Set(articles.map(article => article.source || 'Original report'))].sort((a, b) => a.localeCompare(b)), [articles]);
  const openedCount = groups.filter(group => group.reports.some(report => opened.has(reportKey(report)))).length;
  const nextUnopened = filtered.findIndex(group => !group.reports.some(report => opened.has(reportKey(report))));
  const origin = useMemo(() => {
    const item = location.state?.origin;
    if (!item?.title || cleanStoryQuery(item.query).toLocaleLowerCase() !== query.toLocaleLowerCase()) return null;
    try {
      const url = new URL(item.url);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? item : null;
    } catch { return null; }
  }, [location.state, query]);

  useEffect(() => { setDraft(query); setStatus(''); setShareLink(''); }, [query]);
  useEffect(() => { setFilter(''); setPublisher(''); setUnopened(false); }, [key]);
  useEffect(() => { setVisible(20); }, [key, order, filter, publisher, unopened]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!savedStory?.saved || (savedStory.year === year && savedStory.month === month && savedStory.order === order)) return;
    const result = updateLibrary(query, {year, month, order});
    if (!result.ok) setStatus(result.error);
  }, [query, year, month, order, savedStory?.saved, savedStory?.year, savedStory?.month, savedStory?.order, updateLibrary]);
  useEffect(() => {
    if (!jumpTarget) return;
    const node = reportNodes.current.get(jumpTarget);
    if (node) {
      node.scrollIntoView({block:'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      node.querySelector('h2 a')?.focus({preventScroll:true});
      setJumpTarget(null);
    }
  }, [jumpTarget, visible]);
  useEffect(() => {
    if (query.length < 3) return undefined;
    const controller = new AbortController();
    const cached = cachedTimeline(key);
    if (cached && Date.now() - cached.savedAt < FRESH_MS && !attempt) {
      setResult({ key, data: cached.data, loading: false, error: '' });
      return () => controller.abort();
    }
    setResult({ key, data: cached?.data || null, loading: true, error: '' });
    newsApi.getStoryTimeline({ query, year, month, signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (data.cacheStatus !== 'stale-cache') cacheTimeline(key, data);
      setResult({ key, data, loading: false, error: '' });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setResult({ key, data: cached?.data || null, loading: false,
        error: error.response?.data?.error || error.message || 'Could not load this timeline. Please try again.' });
    });
    return () => controller.abort();
  }, [key, query, year, month, attempt]);

  const update = changes => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([name, value]) => next.set(name, value));
    setAttempt(0);
    setParams(next, { state: location.state });
  };

  const jumpTo = index => {
    if (index < 0 || !filtered[index]) return;
    setVisible(count => Math.max(count, Math.ceil((index + 1) / 20) * 20));
    setJumpTarget(filtered[index].groupId);
  };
  const markOpened = article => {
    if (opened.has(reportKey(article))) return;
    const result = updateLibrary(query, {year, month, order, openedId: reportKey(article)});
    if (!result.ok) setStatus(result.error);
  };
  const share = async () => {
    const url = new URL('/news/story', window.location.origin);
    url.search = new URLSearchParams({q: query, year, month, order}).toString();
    try {
      if (navigator.share) { await navigator.share({title: `${query} · Story timeline`, url:url.href}); setStatus('Story link shared.'); }
      else { await navigator.clipboard.writeText(url.href); setStatus('Story link copied.'); }
    } catch (error) {
      if (error.name !== 'AbortError') { setShareLink(url.href); setStatus('Copy the story link below.'); }
    }
  };

  return <section className="news-page news-story-page" aria-labelledby="story-title">
    <Link className="news-story-back" to={backTo}><ArrowLeft size={16} aria-hidden="true" /> Back to news</Link>
    <header className="news-story-hero">
      <span className="news-story-eyebrow"><History size={16} aria-hidden="true" /> Story timeline</span>
      <h1 id="story-title" tabIndex={-1} ref={heading}>{query ? query[0].toLocaleUpperCase() + query.slice(1) : 'Follow a story'}</h1>
      <p>Follow the reporting. Connect the background to what happens next.</p>
      <div className="news-story-actions">
        {filtered.length > 0 && <button type="button" className="news-story-start" onClick={() => jumpTo(nextUnopened >= 0 ? nextUnopened : 0)}><ArrowDown size={16} aria-hidden="true" />{openedCount > 0 && nextUnopened >= 0 ? 'Continue story' : 'Read reports'}</button>}
        <button type="button" aria-pressed={Boolean(savedStory?.saved)} disabled={query.length < 3} onClick={() => {
          const result = updateLibrary(query, {saved: !savedStory?.saved, year, month, order});
          setStatus(result.ok ? savedStory?.saved ? 'Story removed from your saved list.' : 'Story saved. Find it in Saved stories on the News page.' : result.error);
        }}><Bookmark size={16} aria-hidden="true" />{savedStory?.saved ? 'Story saved' : 'Save story'}</button>
        <button type="button" onClick={share} disabled={query.length < 3}><Share2 size={16} aria-hidden="true" />Share timeline</button>
        {year !== 'recent' && <button type="button" onClick={() => update({year:'recent',month:'all',order:'newest'})}>Latest updates</button>}
      </div>
      {origin && <details className="news-story-origin"><summary>Started from this headline</summary>
        <a href={origin.url} target="_blank" rel="noopener noreferrer">{origin.title}<ArrowUpRight size={14} aria-hidden="true" /></a>
        <small>{origin.source || 'Original publisher'} · Related coverage is matched by subject, not a verified event chain.</small>
      </details>}
      {status && <p className="news-story-feedback" role="status">{status}</p>}
      {shareLink && <label className="news-story-share-link">Story link<input readOnly value={shareLink} onFocus={event => event.target.select()} /></label>}
    </header>
    <form className="news-story-search" onSubmit={event => { event.preventDefault(); update({ q: cleanStoryQuery(draft), year: 'recent', month: 'all' }); }}>
      <label htmlFor="story-query">Refine the story</label>
      <div><input id="story-query" type="search" value={draft} onChange={event => setDraft(event.target.value)} maxLength={100} minLength={3} required placeholder="A story, event or subject" />
        <button type="submit" aria-label="Search this story"><Search size={18} aria-hidden="true" /></button></div>
    </form>
    <div className="news-story-controls">
      <label>Coverage<select aria-label="Coverage year" value={year} onChange={event => update({ year: event.target.value, month: 'all' })}>
        <option value="recent">Latest 30 days</option>
        {Array.from({ length: currentYear - 1999 }, (_, i) => currentYear - i).map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      {year !== 'recent' && <label>Month<select aria-label="Coverage month" value={month} onChange={event => update({ month: event.target.value })}>
        <option value="all">Whole year</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value} disabled={Number(year) === currentYear && value > new Date().getUTCMonth() + 1}>
          {new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, value - 1)))}</option>)}
      </select></label>}
      <label>Read in order<select aria-label="Timeline order" value={order} onChange={event => update({ order: event.target.value })}>
        <option value="oldest">Oldest first</option><option value="newest">Latest first</option>
      </select></label>
      <button type="button" onClick={() => setAttempt(value => value + 1)} disabled={current.loading || query.length < 3}>{current.loading ? 'Updating…' : 'Refresh'}</button>
    </div>
    <details className="news-story-coverage"><summary>About this coverage</summary><p>{current.data?.coverageNote || 'Available dated reports, not a complete archive. Choose a year to explore the background, or a month for more detail.'}</p>
      <p>Matching headlines from the same day are grouped together. Saved stories and opened-report progress stay on this device, separately for each account. The news archive is shared across readers.</p></details>
    {current.data?.notice && <p className="news-story-notice" role="status">{current.data.notice}</p>}
    {current.error && <div className="news-story-notice" role="alert"><p>{current.error}</p>
      {current.data && <p>Showing your saved coverage for this period.</p>}
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {query.length < 3 && <p role="status">Enter at least three characters to explore a story.</p>}
    {current.loading && !current.data && <div className="news-story-loading" role="status"><p>Finding the story’s timeline…</p>{[0, 1, 2].map(i => <div key={i} aria-hidden="true" />)}</div>}
    {current.data && <>
      {articles.length > 0 && <div className="news-story-reading-tools">
        <div className="news-story-filter-fields">
          <label>Find in these reports<input type="search" aria-label="Filter timeline reports" placeholder="Keyword or phrase" value={filter} onChange={event => setFilter(event.target.value)} /></label>
          <label>Publisher<select aria-label="Filter by publisher" value={publisher} onChange={event => setPublisher(event.target.value)}>
            <option value="">All publishers ({publishers.length})</option>{publishers.map(name => <option key={name} value={name}>{name}</option>)}
          </select></label>
        </div>
        <div className="news-story-reading-progress">
          <label><input type="checkbox" checked={unopened} onChange={event => setUnopened(event.target.checked)} />Only unopened headlines</label>
          <span>{openedCount} of {groups.length} headlines opened</span>
          <button type="button" disabled={nextUnopened < 0} onClick={() => jumpTo(nextUnopened)}>Next unopened</button>
        </div>
        {groups.length < articles.length && <p className="news-story-dedup-note">{articles.length - groups.length} repeated {articles.length - groups.length === 1 ? 'headline grouped' : 'headlines grouped'}. Other publishers remain available below each headline.</p>}
      </div>}
      <div className="news-story-results-heading" role="status"><strong>{filtered.length} {filtered.length === 1 ? 'headline' : 'headlines'} · {articles.length} available {articles.length === 1 ? 'report' : 'reports'}</strong>
        <span>{current.data.cacheStatus === 'stale-cache' ? 'Saved coverage' : 'Shared story archive'}{current.data.updatedAt && Number.isFinite(Date.parse(current.data.updatedAt)) ? ` · Updated ${dateLabel(current.data.updatedAt)}` : ''}</span></div>
      {filtered.length > 0 && <div className="news-story-jumps" aria-label="Jump through coverage">
        <button type="button" onClick={() => jumpTo(order === 'oldest' ? 0 : filtered.length - 1)}>Earliest in this period</button>
        <button type="button" onClick={() => jumpTo(order === 'newest' ? 0 : filtered.length - 1)}>Most recent report</button>
      </div>}
      {filtered.length ? <ol className="news-story-timeline">{filtered.slice(0, visible).map(article => <li key={article.groupId} ref={node => { if (node) reportNodes.current.set(article.groupId, node); else reportNodes.current.delete(article.groupId); }}>
        <time dateTime={article.published_at}>{dateLabel(article.published_at)}</time>
        <article><span>{article.source || 'Original report'}</span><h2><a href={article.news_link} target="_blank" rel="noopener noreferrer" onClick={() => markOpened(article)} onAuxClick={event => { if (event.button === 1) markOpened(article); }}>{article.title}<ArrowUpRight size={17} aria-hidden="true" /></a></h2>
          <small>{article.reports.some(report => opened.has(reportKey(report))) && <span className="news-story-opened"><Check size={13} aria-hidden="true" />Opened · </span>}Read original reporting · Opens publisher website</small>
          {article.reports.length > 1 && <details className="news-story-other-sources"><summary>{article.reports.length - 1} more {article.reports.length === 2 ? 'report' : 'reports'} with this headline</summary>
            <ul>{article.reports.slice(1).map(report => <li key={report.news_link}><a href={report.news_link} target="_blank" rel="noopener noreferrer" onClick={() => markOpened(report)}>{report.source || 'Original publisher'}<ArrowUpRight size={13} aria-hidden="true" /></a></li>)}</ul>
          </details>}</article>
      </li>)}</ol> : <div className="news-story-empty"><h2>{articles.length ? 'No headlines match these filters.' : 'No reports found for this period.'}</h2>
        <p>{articles.length ? 'Try another publisher, clear your keyword, or include opened headlines.' : 'That does not mean nothing happened. Try another year, choose a month, or use a broader subject.'}</p>
        {articles.length > 0 && <button type="button" onClick={() => {setFilter('');setPublisher('');setUnopened(false);}}>Clear report filters</button>}</div>}
      {visible < filtered.length && <button type="button" className="news-story-more" onClick={() => setVisible(value => value + 20)}>Show more reports ({filtered.length - visible} remaining)</button>}
      <nav className="news-story-year-nav" aria-label="Explore other periods">
        <button type="button" disabled={year !== 'recent' && Number(year) <= 2000} onClick={() => update({ year: String(year === 'recent' ? currentYear - 1 : Number(year) - 1), month: 'all' })}>Earlier year</button>
        {year !== 'recent' && Number(year) < currentYear && <button type="button" onClick={() => update({ year: String(Number(year) + 1), month: 'all' })}>Next year</button>}
      </nav>
    </>}
  </section>;
}
