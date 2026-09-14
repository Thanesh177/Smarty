import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Check, Compass, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { postApi } from '../api/client';
import useLearningLibrary from '../hooks/useLearningLibrary';
import { LEARNING_GUIDES } from '../data/learningGuides';
import { getLearningContext, getLearningNextStep, getLearningQuizLocation, getRelatedLearningTopics, normalizeLearningTopic } from '../lib/learningJourney';
import './LearningPage.css';

function LessonLink({ post, progress, index }) {
  const context = getLearningContext(post);
  const minutes = Math.max(2, Math.ceil((context.body + (post.aiDetailedExplanation || '')).split(/\s+/).length / 180));
  return <Link className="learn-lesson" to={'/post-ai/' + encodeURIComponent(context.postId)} state={{ post, creatorName: post.creatorName || post.author || 'Smarty creator' }}>
    <span className="learn-lesson-number" aria-hidden="true">{progress?.challenge ? <Check size={17} /> : String(index + 1).padStart(2, '0')}</span>
    <div><small>{context.topic} · {minutes} min{post.isLearningGuide ? ' · Smarty guide' : ''}</small>
      <h3>{context.title}</h3><p>{post.objective || context.body.slice(0, 150)}</p>
      <span className="learn-lesson-action">{progress ? getLearningNextStep(progress).label : 'Read · explain · practice'} <ArrowRight size={14} /></span>
    </div>
  </Link>;
}

export default function LearningPage() {
  const pageRef = useRef(null);
  const { user, loading: authLoading } = useAuth();
  const userId = user?.sub || user?.userId || user?.id || '';
  const library = useLearningLibrary(userId);
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') || '';
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [topic]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const topicsQuery = useQuery({ queryKey: ['learning-topics', userId], queryFn: () => postApi.getTopics(), enabled: !authLoading, staleTime: 300000, retry: 1 });
  const postsQuery = useInfiniteQuery({
    queryKey: ['learning-discover', userId, topic],
    queryFn: ({ pageParam }) => postApi.getFeed({ limit: 20, cursor: pageParam, topic: topic || null }),
    initialPageParam: null,
    getNextPageParam: (page, pages, previous, pageParams) => page.nextCursor && !pageParams.includes(page.nextCursor) ? page.nextCursor : undefined,
    enabled: !authLoading, staleTime: 60000, retry: 1,
  });
  const topics = useMemo(() => {
    const raw = topicsQuery.data;
    const items = Array.isArray(raw) ? raw : raw?.topics || raw?.items || [];
    return [...new Set([...LEARNING_GUIDES.map((guide) => guide.topic), ...items.map((item) => typeof item === 'string' ? item : item.name || item.topic || item.label || '').filter(Boolean), topic].filter(Boolean))].sort();
  }, [topicsQuery.data, topic]);
  const byId = useMemo(() => new Map(library.map((item) => [item.postId, item])), [library]);
  const available = useMemo(() => {
    const seen = new Set();
    const candidates = [...LEARNING_GUIDES, ...(postsQuery.data?.pages || []).flatMap((page) => page.items || [])];
    return candidates.filter((post) => {
      const context = getLearningContext(post);
      if (!context.postId || seen.has(context.postId)) return false;
      seen.add(context.postId);
      if (topic && normalizeLearningTopic(context.topic) !== normalizeLearningTopic(topic)) return false;
      if (filter === 'new' && byId.has(context.postId)) return false;
      return (context.title + ' ' + context.focus + ' ' + context.body).toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [postsQuery.data, topic, filter, byId, search]);
  const due = library.filter((item) => item.nextReviewAt && Date.parse(item.nextReviewAt) <= Date.now());
  const unfinished = library.filter((item) => !item.read || !item.understand || !item.challenge);
  const resume = unfinished[0];
  const related = topic ? getRelatedLearningTopics({ topic }, 4) : [];
  const review = (item) => navigate(getLearningQuizLocation(item.context), { state: { learningContext: item.context, reviewLesson: true } });
  const chooseTopic = (value) => { setParams(value ? { topic: value } : {}); setSearch(''); setFilter('all'); };

  return <main ref={pageRef} className="learn-page">
    <nav className="learn-topline"><Link to="/feed?topic=All">← All posts</Link><Link to="/topics">Browse topics <Compass size={15} /></Link></nav>
    <header className="learn-hero">
      <span className="learn-kicker">Your curiosity, connected</span>
      <h1>One idea opens<br /><em>the next.</em></h1>
      <p>Understand the moving parts, try a real example, then see what you can recall. Start small and follow what interests you.</p>
      <div className="learn-stats"><span><strong>{library.length}</strong> started</span><span><strong>{library.filter((item) => item.challenge).length}</strong> quiz checks passed</span><span><strong>{due.length}</strong> ready to revisit</span></div>
    </header>

    {(resume || due.length > 0) && <section className="learn-today" aria-label="Continue your learning">
      {resume && <article><span className="learn-kicker">Pick up where you left off</span><h2>{resume.context.title}</h2><p>{getLearningNextStep(resume).label}</p>
        <Link className="learn-primary" to={'/post-ai/' + encodeURIComponent(resume.postId)}>Continue lesson <ArrowRight size={17} /></Link>
      </article>}
      {due.length > 0 && <article><span className="learn-kicker">Bring it back to mind</span><h2>A little recall goes a long way.</h2>
        {due.slice(0, 3).map((item) => <button className="learn-review-link" key={item.postId} onClick={() => review(item)}><span>{item.context.title}</span><RefreshCw size={16} /></button>)}
        {due.length > 3 && <p>{due.length - 3} more will appear as you finish these reviews.</p>}
      </article>}
    </section>}

    <section className="learn-catalog" aria-labelledby="learn-catalog-title">
      <div className="learn-section-head"><div><span className="learn-kicker">Follow a thread</span><h2 id="learn-catalog-title">{topic || 'Find your next question'}</h2></div><BookOpen size={23} /></div>
      <div className="learn-controls">
        <label><span>Subject</span><select value={topic} onChange={(event) => chooseTopic(event.target.value)}><option value="">All subjects</option>{topics.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="learn-search"><span>Find a concept in loaded lessons</span><div><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try a mechanism, question, or idea" /></div></label>
        <label><span>Show</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All lessons</option><option value="new">Not started yet</option></select></label>
      </div>
      <p className="learn-catalog-note">Each guide includes a mechanism, example, takeaway, and focused questions. Community posts open into their own study room.</p>
      <div className="learn-lessons">{available.map((post, index) => <LessonLink key={getLearningContext(post).postId} post={post} index={index} progress={byId.get(getLearningContext(post).postId)} />)}</div>
      {postsQuery.isPending && <p role="status">Finding more lessons…</p>}
      {postsQuery.isError && <div className="learn-status" role="status"><p>Community posts couldn’t load. Smarty guides are still available.</p><button onClick={() => postsQuery.refetch()}>Try loading posts again</button></div>}
      {!postsQuery.isPending && available.length === 0 && <div className="learn-status"><h3>No matching lessons loaded yet</h3><p>Try a broader search, another subject, or load the next batch.</p><button onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button></div>}
      {postsQuery.hasNextPage && <button className="learn-load-more" disabled={postsQuery.isFetchingNextPage} onClick={() => postsQuery.fetchNextPage()}>{postsQuery.isFetchingNextPage ? 'Loading more…' : 'Discover more lessons'}<ArrowRight size={17} /></button>}
      {related.length > 0 && <div className="learn-branches"><span>Connected subjects</span>{related.map((name) => <button key={name} onClick={() => chooseTopic(name)}>{name}<ArrowRight size={14} /></button>)}</div>}
    </section>

    {library.length > 0 && <section className="learn-notebook" aria-labelledby="learn-notebook-title">
      <span className="learn-kicker">Your learning trail</span><h2 id="learn-notebook-title">Ideas you’ve spent time with.</h2>
      {library.slice(0, 20).map((item) => <details key={item.postId}><summary>{item.context.title}<span>{item.lastScore === null ? 'In progress' : item.lastScore + '% last quiz'}</span></summary>
        {item.note ? <p className="learn-note">{item.note}</p> : <p>No reflection saved yet. Try explaining the idea in your own words.</p>}
        {item.nextReviewAt && <p>Next review: {new Date(item.nextReviewAt).toLocaleDateString()}</p>}
        <Link to={'/post-ai/' + encodeURIComponent(item.postId)}>Return to lesson <ArrowRight size={15} /></Link>
      </details>)}
    </section>}
    <p className="learn-device-note">Your notes and lesson history are saved for this account on this device. They do not sync between devices yet.</p>
  </main>;
}
