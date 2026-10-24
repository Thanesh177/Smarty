import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BrainCircuit,
  ChevronRight,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Network,
  X,
} from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LearningJourneyPanel from '../components/learning/LearningJourneyPanel';
import PostAuthor from '../components/PostAuthor';
import { getPostAuthorUsername } from '../lib/postAuthor';
import { getLearningGuide } from '../data/learningGuides';
import { usableDetailedExplanation as getUsableDetailedExplanation, detailedExplanationFromResponse, explanationSections, readingLessonSections, explanationBlocks } from '../lib/explanationFormat';
import { createRequestCache } from '../lib/requestCache';
import { getLearningLevelLabel } from '../lib/learningJourney';
import './PostAiPage.css';
import './PostAiReading.css';

const renderTextBlocks = (value, keyPrefix) => explanationBlocks(value)
  .map((block, index) => {
    if (block.type !== 'p') {
      const List = block.type;
      return (
        <List start={block.start} key={`${keyPrefix}-list-${index}`}>
          {block.items.map((line, lineIndex) => (
            <li key={`${keyPrefix}-${lineIndex}-${line.slice(0, 24)}`}>
              {line}
            </li>
          ))}
        </List>
      );
    }

    return <p key={`${keyPrefix}-paragraph-${index}`}>{block.text}</p>;
  });

const renderFormattedParagraphs = (value, className = 'post-ai-paragraphs') => {
  const text = String(value || '').trim();

  if (!text) return null;

  const isLesson = className === 'post-ai-explanation-paragraphs';
  const sections = isLesson ? readingLessonSections(text) : explanationSections(text);

  return (
    <div className={className}>
      {sections.map((section, index) => {
        const sectionText = section.text;
        if (section.heading) {
          return (
            <section className={`post-ai-text-section is-${section.kind}`} key={`${section.heading}-${index}`}>
              <h3 id={isLesson ? section.id : undefined} tabIndex={isLesson ? -1 : undefined}>{section.heading}</h3>
              <div className="post-ai-text-section-body">
                {renderTextBlocks(sectionText, `section-${index}`)}
              </div>
            </section>
          );
        }
        return <div className={isLesson ? 'post-ai-lesson-opening' : undefined} key={`intro-${index}`}>
          {renderTextBlocks(sectionText, `intro-${index}`)}
        </div>;
      })}
    </div>
  );
};

export default function PostAiPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  return <PostStudyRoom key={`${user?.sub || user?.userId || user?.id || 'guest'}:${postId}`} />;
}

function PostStudyRoom() {
  const pageRef = useRef(null);
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  const { postId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const detailRequestsRef = useRef(null);
  if (!detailRequestsRef.current) detailRequestsRef.current = createRequestCache({ maxEntries: 1 });
  const premiumCloseRef = useRef(null);
  const { loading: authLoading } = useAuth();

  const postFromState = useMemo(() => getLearningGuide(postId) || location.state?.post || null, [location.state, postId]);
  const [post, setPost] = useState(postFromState);
  const creatorName = getPostAuthorUsername(post);
  const [explanation, setExplanation] = useState(() => getUsableDetailedExplanation(postFromState));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deepPreviewOpen, setDeepPreviewOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [guideMeta, setGuideMeta] = useState(() => ({
    cached: Boolean(getUsableDetailedExplanation(postFromState)),
    persisted: Boolean(getUsableDetailedExplanation(postFromState)),
  }));

  const title = useMemo(() => post?.title || 'Post explanation', [post]);
  const body = useMemo(() => post?.body || '', [post]);
  const topicLabel = useMemo(
    () => post?.subTopic || post?.subtopic || post?.focus || post?.title || post?.topic || 'this concept',
    [post]
  );

  const readableError = useCallback((err, fallback) => {
    const statusCode = err?.response?.status;
    const apiError = err?.response?.data?.error || err?.response?.data?.message;
    const message = apiError || err?.message || '';
    const lowerMessage = String(message).toLowerCase();

    if (statusCode === 401) {
      return 'Sign in to use the full learning guide.';
    }

    if (
      lowerMessage.includes('resourcenotfoundexception') ||
      lowerMessage.includes('model use case details') ||
      lowerMessage.includes('anthropic') ||
      lowerMessage.includes('bedrock')
    ) {
      return 'The learning guide is temporarily unavailable. You can still read the post and try again shortly.';
    }

    if (statusCode >= 500) {
      return 'The learning guide is temporarily unavailable. Please try again.';
    }

    if (lowerMessage.includes('missing detailed ai endpoint')) {
      return 'The learning guide is not available for this post yet.';
    }

    if (message && statusCode && statusCode < 500) return message;
    return fallback;
  }, []);

  const displayExplanation = useMemo(() => {
    return explanation || getUsableDetailedExplanation(post) || '';
  }, [explanation, post]);
  const estimatedMinutes = useMemo(() => {
    const words = `${body} ${displayExplanation}`.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2, Math.min(12, Math.ceil(words / 180)));
  }, [body, displayExplanation]);
  const lessonJumps = useMemo(() => readingLessonSections(displayExplanation)
    .filter((section) => section.heading).slice(0, 5), [displayExplanation]);
  const deepDiveSteps = useMemo(() => [
    {
      label: 'Mechanism',
      title: `Look inside ${topicLabel}`,
      text: 'Trace the moving parts, causes, and trade-offs that make this idea work.',
    },
    {
      label: 'Connections',
      title: 'Link the surrounding ideas',
      text: `See how ${topicLabel} connects to nearby concepts instead of learning it in isolation.`,
    },
    {
      label: 'Mastery',
      title: 'Apply what you learned',
      text: 'Work through adaptive examples and harder questions that respond to your progress.',
    },
  ], [topicLabel]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!premiumDialogOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPremiumDialogOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    premiumCloseRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      previouslyFocused?.focus?.();
    };
  }, [premiumDialogOpen]);

  useEffect(() => {
    // Wait for account restoration before starting an authenticated guide
    // request. Otherwise the guest room can generate while it is replaced.
    if (authLoading && !postFromState?.isLearningGuide) return;
    let cancelled = false;
    async function loadExplanation() {
      try {
        setLoading(true);
        setStatus('');

        const sourcePost = postFromState || await postApi.getSingleReel(postId);
        if (cancelled || !mountedRef.current) return;
        if (!sourcePost) throw new Error('Post not found.');
        setPost(sourcePost);
        const existingDetailedExplanation = getUsableDetailedExplanation(sourcePost);

        if (existingDetailedExplanation) {
          setExplanation(existingDetailedExplanation);
          setGuideMeta({ cached: true, persisted: true });
          setLoading(false);
          return;
        }

        const detailsPayload = {
          postId,
          id: postId,
          reelId: postId,
          title: sourcePost.title || '',
          body: sourcePost.body || sourcePost.description || '',
          topic: sourcePost.topic || '',
          subTopic: sourcePost.subTopic || sourcePost.subtopic || '',
          mode: 'detailed',
        };

        if (!postApi.getPostDetails && !postApi.getAiDetails) {
          throw new Error('Missing detailed AI endpoint. Add postApi.getPostDetails in client.js and point it to /posts/details.');
        }

        // Share only concurrent requests in this account/post room. The server
        // remains the durable cache; retries and later opens still validate it.
        const data = await detailRequestsRef.current.get('details', () => postApi.getPostDetails
          ? postApi.getPostDetails(detailsPayload)
          : postApi.getAiDetails(detailsPayload), 0);

        if (cancelled || !mountedRef.current) return;

        const nextExplanation = detailedExplanationFromResponse(data);

        if (data?.post) {
          setPost((prev) => ({
            ...(prev || {}),
            ...data.post,
            aiDetailedExplanation: nextExplanation,
            aiDetailedExplanationVersion:
              data?.post?.aiDetailedExplanationVersion || data?.aiDetailedExplanationVersion || 0,
          }));
        }

        setExplanation(nextExplanation);
        setGuideMeta({
          cached: data?.cached === true,
          persisted: data?.persisted !== false && Boolean(nextExplanation),
        });

        if (!nextExplanation) {
          setStatus('The updated deeper lesson is not available yet. Please try again shortly.');
        }
      } catch (err) {
        console.error('Load AI explanation failed:', err);
        if (!cancelled && mountedRef.current) {
          setStatus(readableError(err, 'Could not load AI explanation.'));
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    }

    loadExplanation();
    return () => { cancelled = true; };
  }, [authLoading, loadAttempt, postId, postFromState, readableError]);

  const goBack = useCallback(() => {
    const savedScrollY = location.state?.scrollY;

    if (typeof savedScrollY === 'number') {
      sessionStorage.setItem('feedScrollY', String(savedScrollY));
    }

    navigate(-1);
  }, [location.state, navigate]);

  return (
    <main ref={pageRef} className="post-ai-page is-reading-layout">
      <section className="post-ai-shell">
        <nav className="post-ai-topline" aria-label="Lesson navigation">
          <button type="button" className="post-ai-back" onClick={goBack}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </button>

          <span className="post-ai-progress-label">
            <i aria-hidden="true" />
            Understand · step 2 of 3
          </span>

          {!post?.isLearningGuide && <Link className="post-ai-comments" to={`/comments/${postId}`}>
            <MessageCircle size={17} aria-hidden="true" />
            Discussion
          </Link>}
        </nav>

        <header className="post-ai-hero">
          <div className="post-ai-hero-copy">
            <p className="post-ai-eyebrow">
              <BrainCircuit size={15} aria-hidden="true" />
              {post?.isLearningGuide ? 'Smarty learning guide' : 'Study room'}
            </p>
            <h1>{title || 'Post explanation'}</h1>
            <div className="post-ai-meta">
              <span>{topicLabel}</span>
              {getLearningLevelLabel(post) && <span>{getLearningLevelLabel(post)} · Lesson {post.learningOrder}</span>}
              <span>{estimatedMinutes} min guided read</span>
              <span>By <PostAuthor post={post} /></span>
            </div>
          </div>

          <div className="post-ai-signal" aria-hidden="true">
            <span className="post-ai-signal-core"><BrainCircuit size={24} /></span>
            <i /><i /><i />
          </div>
        </header>

        <section className="post-study-objective" aria-label="Learning objective">
          <span>By the end of this lesson</span>
          <p>{post?.objective || `Explain how ${topicLabel} works, use it in an example, and identify one limit or open question.`}</p>
          <Link to={`/learn?topic=${encodeURIComponent(post?.topic || '')}`}>More in this subject <ChevronRight size={15} /></Link>
        </section>

        <div className="post-ai-workspace">
          <article className="post-ai-card post-ai-explainer">
            <div className="post-ai-section-head">
              <span className="post-ai-section-icon" aria-hidden="true">
                <Layers3 size={18} />
              </span>
              <div>
                <span className="post-ai-section-kicker">Deep explanation</span>
                <h2>See the idea unfold</h2>
              </div>
              <small className={loading ? 'is-working' : ''}>
                {loading
                  ? 'Preparing guide…'
                  : displayExplanation
                    ? guideMeta.cached ? 'Loaded from library' : guideMeta.persisted ? 'Saved to library' : 'Ready'
                    : 'Not available'}
              </small>
            </div>

            {loading ? (
              <div className="post-ai-loading" role="status" aria-live="polite">
                <div className="post-ai-skeleton post-ai-skeleton-title" />
                <div className="post-ai-skeleton" />
                <div className="post-ai-skeleton is-short" />
                <div className="post-ai-skeleton post-ai-skeleton-title" />
                <div className="post-ai-skeleton" />
                <p>Checking your saved guide, then building it only if needed…</p>
              </div>
            ) : displayExplanation ? (
              <>
              {lessonJumps.length > 0 && <nav className="post-ai-reading-nav" aria-label="Explore the explanation">
                {lessonJumps.map((section) => <a key={section.id} href={`#${section.id}`} onClick={(event) => {
                  event.preventDefault();
                  const target = document.getElementById(section.id);
                  target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                  target?.focus({ preventScroll: true });
                }}>{section.heading}</a>)}
              </nav>}
              {renderFormattedParagraphs(
                displayExplanation,
                'post-ai-explanation-paragraphs'
              )}
              </>
            ) : !status ? (
              <p className="post-ai-empty-guide">This post does not have a learning guide yet.</p>
            ) : null}

            {status && (
              <div className="post-ai-status" role="alert">
                <span>{status}</span>
                <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>
                  Try again
                </button>
              </div>
            )}
          </article>

        </div>

        {Array.isArray(post?.sources) && post.sources.length > 0 && <section className="post-study-sources" aria-label="Sources and further reading">
          <span>Check the source. Go deeper.</span>
          {post.sources.filter((source) => /^https?:\/\//i.test(source?.url || '')).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label || source.url}<ChevronRight size={14} /></a>)}
        </section>}

        <section className={`post-ai-deeper${deepPreviewOpen ? ' is-open' : ''}`} aria-labelledby="post-ai-deeper-title">
          <div className="post-ai-deeper-intro">
            <span className="post-ai-premium-label">
              <LockKeyhole size={14} aria-hidden="true" />
              Premium preview
            </span>
            <h2 id="post-ai-deeper-title">Go one layer deeper into {topicLabel}</h2>
            <p>
              Turn this explanation into a guided subject path with connected ideas,
              applied examples, and challenges that grow with you.
            </p>
            <button
              type="button"
              className="post-ai-deeper-toggle"
              onClick={() => setDeepPreviewOpen((current) => !current)}
              aria-expanded={deepPreviewOpen}
              aria-controls="post-ai-deeper-preview"
            >
              {deepPreviewOpen ? 'Close preview' : 'Learn more about this subject'}
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>

          <div
            id="post-ai-deeper-preview"
            className="post-ai-deeper-preview"
            aria-hidden={!deepPreviewOpen}
          >
            <div className="post-ai-depth-line" aria-hidden="true">
              <i /><i /><i />
            </div>

            <div className="post-ai-depth-list">
              {deepDiveSteps.map((item, index) => (
                <article key={item.label}>
                  <span>{String(index + 1).padStart(2, '0')} · {item.label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>

            <div className="post-ai-premium-gate">
              <span className="post-ai-gate-icon" aria-hidden="true">
                <Network size={21} />
              </span>
              <div>
                <span className="post-ai-section-kicker">Continue the path</span>
                <h3>Unlock the complete {topicLabel} deep dive</h3>
                <p>Get the full subject map, unlimited guided follow-ups, and adaptive mastery challenges.</p>
              </div>
              <button
                type="button"
                onClick={() => setPremiumDialogOpen(true)}
                tabIndex={deepPreviewOpen ? 0 : -1}
              >
                Unlock Premium
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <div className="post-ai-journey-wrap">
          <LearningJourneyPanel
            post={post || postFromState || { id: postId, title, body }}
            postId={postId}
            stage="understand"
            creatorName={creatorName}
          />
        </div>

      </section>

      {premiumDialogOpen && createPortal(
        (
          <div
            className="post-ai-premium-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPremiumDialogOpen(false);
            }}
            role="presentation"
          >
            <section
              className="post-ai-premium-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="post-ai-premium-title"
            >
              <button
                ref={premiumCloseRef}
                type="button"
                className="post-ai-premium-close"
                onClick={() => setPremiumDialogOpen(false)}
                aria-label="Close premium preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <span className="post-ai-gate-icon" aria-hidden="true">
                <LockKeyhole size={22} />
              </span>
              <span className="post-ai-premium-label">Smarty Premium</span>
              <h2 id="post-ai-premium-title">Deeper learning is coming soon.</h2>
              <p>
                Premium purchasing is not enabled yet. Your current lessons, quizzes,
                and discussions remain available while we prepare the complete experience.
              </p>
              <button
                type="button"
                className="post-ai-premium-done"
                onClick={() => setPremiumDialogOpen(false)}
              >
                Continue learning
              </button>
            </section>
          </div>
        ),
        document.body
      )}
    </main>
  );
}
