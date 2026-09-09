import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Network,
  Send,
  Workflow,
  X,
} from 'lucide-react';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LearningJourneyPanel from '../components/learning/LearningJourneyPanel';
import './PostAiPage.css';

const getDetailedExplanation = (value) => {
  const text = String(value?.aiDetailedExplanation || '').trim();
  return text && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined'
    ? text
    : '';
};

const isLongDetailedExplanation = (text) => {
  const clean = String(text || '').trim();
  const wordCount = clean.split(/\s+/).filter(Boolean).length;

  return (
    wordCount >= 60 &&
    !clean.toLowerCase().startsWith('simple version:') &&
    !clean.toLowerCase().includes('explain this post like the reader is 15')
  );
};

const renderFormattedParagraphs = (value, className = 'post-ai-paragraphs') => {
  const text = String(value || '').trim();

  if (!text) return null;

  const sectionNames = 'Simple explanation|Why it matters|How it works|Real-life example|Final takeaway';
  const normalized = text
    .replace(/\r/g, '')
    .replace(new RegExp(`\\s+(?=(${sectionNames})\\s*:)`, 'gi'), '\n\n');
  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => {
        const sectionMatch = paragraph.match(
          new RegExp(`^(${sectionNames})\\s*:?\\s*([\\s\\S]*)$`, 'i')
        );

        if (sectionMatch) {
          return (
            <section className="post-ai-text-section" key={`${sectionMatch[1]}-${index}`}>
              <h3>{sectionMatch[1]}</h3>
              {sectionMatch[2] && <p>{sectionMatch[2]}</p>}
            </section>
          );
        }

        const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^[-•*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={`list-${index}`}>
              {lines.map((line, lineIndex) => (
                <li key={`${line.slice(0, 24)}-${lineIndex}`}>
                  {line.replace(/^[-•*]\s+/, '')}
                </li>
              ))}
            </ul>
          );
        }

        return <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>;
      })}
    </div>
  );
};

const getUsableDetailedExplanation = (value) => {
  const text = getDetailedExplanation(value);
  return isLongDetailedExplanation(text) ? text : '';
};

const PostAiMessage = memo(function PostAiMessage({ message }) {
  return (
    <div className={message.role === 'user' ? 'post-ai-msg mine' : 'post-ai-msg'}>
      {renderFormattedParagraphs(message.text, 'post-ai-message-paragraphs')}
    </div>
  );
});

export default function PostAiPage() {
  const { postId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const messagesRef = useRef(null);
  const premiumCloseRef = useRef(null);
  const { user } = useAuth();

  const postFromState = useMemo(() => location.state?.post || null, [location.state]);
  const creatorName = location.state?.creatorName || 'Smarty creator';

  const [post, setPost] = useState(postFromState);
  const [explanation, setExplanation] = useState(() => getUsableDetailedExplanation(postFromState));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deepPreviewOpen, setDeepPreviewOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);

  const userId = useMemo(
    () => user?.sub || user?.userId || user?.id || user?.username || '',
    [user]
  );

  const title = useMemo(() => post?.title || 'Post explanation', [post]);
  const body = useMemo(() => post?.body || '', [post]);
  const topicLabel = useMemo(
    () => post?.subTopic || post?.subtopic || post?.topic || 'Focused learning',
    [post]
  );

  const readableError = useCallback((err, fallback) => {
    const statusCode = err?.response?.status;
    const apiError = err?.response?.data?.error || err?.response?.data?.message;
    const message = apiError || err?.message || '';
    const lowerMessage = String(message).toLowerCase();

    if (statusCode === 401) {
      return 'Sign in to use the full learning guide and ask follow-up questions.';
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
  const suggestedQuestions = useMemo(() => [
    `Explain the key mechanism in ${topicLabel} step by step.`,
    `Give me a concrete real-world example of ${topicLabel}.`,
    `What is the most common misunderstanding about ${topicLabel}?`,
    'Ask me one question to check what I understood.',
  ], [topicLabel]);
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

  const renderedMessages = useMemo(
    () => messages.map((message, index) => (
      <PostAiMessage
        key={`${message.role || 'msg'}-${index}-${String(message.text || '').slice(0, 16)}`}
        message={message}
      />
    )),
    [messages]
  );

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
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: messages.length > 1 ? 'smooth' : 'auto',
    });
  }, [asking, messages]);

  useEffect(() => {
    async function loadExplanation() {
      try {
        setLoading(true);
        setStatus('');

        const existingDetailedExplanation = getUsableDetailedExplanation(post);

        if (existingDetailedExplanation) {
          setExplanation(existingDetailedExplanation);
          setLoading(false);
          return;
        }

        const detailsPayload = {
          postId,
          id: postId,
          reelId: postId,
          title,
          body,
          topic: post?.topic || '',
          subTopic: post?.subTopic || post?.subtopic || '',
          mode: 'detailed',
        };

        if (!postApi.getPostDetails && !postApi.getAiDetails) {
          throw new Error('Missing detailed AI endpoint. Add postApi.getPostDetails in client.js and point it to /posts/details.');
        }

        const data = postApi.getPostDetails
          ? await postApi.getPostDetails(detailsPayload)
          : await postApi.getAiDetails(detailsPayload);

        if (!mountedRef.current) return;

        const nextExplanationCandidate =
          getUsableDetailedExplanation(data?.post) ||
          String(data?.aiDetailedExplanation || data?.post?.aiDetailedExplanation || data?.explanation || '').trim();

        const nextExplanation = isLongDetailedExplanation(nextExplanationCandidate)
          ? nextExplanationCandidate
          : '';

        if (data?.post) {
          setPost((prev) => ({
            ...(prev || {}),
            ...data.post,
            aiDetailedExplanation: nextExplanation,
          }));
        }

        setExplanation(nextExplanation);

        if (!nextExplanation) {
          setStatus('The learning guide is not available for this post yet.');
        }
      } catch (err) {
        console.error('Load AI explanation failed:', err);
        if (mountedRef.current) {
          setStatus(readableError(err, 'Could not load AI explanation.'));
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    loadExplanation();
  }, [loadAttempt, postId, readableError]);

  const askQuestion = useCallback(async (value) => {
    const cleanQuestion = String(value || '').trim();
    if (!cleanQuestion || asking) return;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: cleanQuestion,
      },
    ]);

    setQuestion('');
    setAsking(true);

    try {
      const data = await postApi.askPostDoubt({
        postId,
        id: postId,
        reelId: postId,
        userId,
        title,
        body,
        explanation: displayExplanation || getUsableDetailedExplanation(post),
        question: cleanQuestion,
      });

      if (!mountedRef.current) return;

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text:
            data?.answer ||
            data?.explanation ||
            data?.text ||
            'I could not answer that right now.',
        },
      ]);
    } catch (err) {
      console.error('Ask doubt failed:', err);

      if (mountedRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: readableError(err, 'Sorry, I could not answer that right now.'),
          },
        ]);
      }
    } finally {
      if (mountedRef.current) setAsking(false);
    }
  }, [asking, body, displayExplanation, post, postId, readableError, title, userId]);

  const askDoubt = useCallback((event) => {
    event.preventDefault();
    askQuestion(question);
  }, [askQuestion, question]);

  const goBack = useCallback(() => {
    const savedScrollY = location.state?.scrollY;

    if (typeof savedScrollY === 'number') {
      sessionStorage.setItem('feedScrollY', String(savedScrollY));
    }

    navigate(-1);
  }, [location.state, navigate]);

  const handleQuestionChange = useCallback((event) => {
    setQuestion(event.target.value);
  }, []);

  const handleQuestionKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askQuestion(question);
    }
  }, [askQuestion, question]);

  return (
    <main className="post-ai-page">
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

          <Link className="post-ai-comments" to={`/comments/${postId}`}>
            <MessageCircle size={17} aria-hidden="true" />
            Discussion
          </Link>
        </nav>

        <header className="post-ai-hero">
          <div className="post-ai-hero-copy">
            <p className="post-ai-eyebrow">
              <BrainCircuit size={15} aria-hidden="true" />
              AI study room
            </p>
            <h1>{title || 'Post explanation'}</h1>
            <div className="post-ai-meta">
              <span>{topicLabel}</span>
              <span>{estimatedMinutes} min guided read</span>
              <span>By {creatorName}</span>
            </div>
          </div>

          <div className="post-ai-signal" aria-hidden="true">
            <span className="post-ai-signal-core"><BrainCircuit size={24} /></span>
            <i /><i /><i />
          </div>
        </header>

        <div className="post-ai-workspace">
          <article className="post-ai-card post-ai-explainer">
            <div className="post-ai-section-head">
              <span className="post-ai-section-icon" aria-hidden="true">
                <Layers3 size={18} />
              </span>
              <div>
                <span className="post-ai-section-kicker">Deep explanation</span>
                <h2>Understand how it works</h2>
              </div>
              <small className={loading ? 'is-working' : ''}>
                {loading ? 'Building guide…' : displayExplanation ? 'Ready' : 'Not available'}
              </small>
            </div>

            {loading ? (
              <div className="post-ai-loading" role="status" aria-live="polite">
                <div className="post-ai-skeleton post-ai-skeleton-title" />
                <div className="post-ai-skeleton" />
                <div className="post-ai-skeleton is-short" />
                <div className="post-ai-skeleton post-ai-skeleton-title" />
                <div className="post-ai-skeleton" />
                <p>Building a focused explanation from this post…</p>
              </div>
            ) : displayExplanation ? (
              renderFormattedParagraphs(
                displayExplanation,
                'post-ai-explanation-paragraphs'
              )
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

          <aside className="post-ai-context" aria-label="Lesson context">
            {body && (
              <article className="post-ai-original">
                <div className="post-ai-context-label">
                  <BookOpen size={16} aria-hidden="true" />
                  <span>Source post</span>
                </div>
                {renderFormattedParagraphs(body, 'post-ai-original-paragraphs')}
              </article>
            )}

            <article className="post-ai-lesson-map">
              <div className="post-ai-context-label">
                <Workflow size={16} aria-hidden="true" />
                <span>Lesson map</span>
              </div>
              <ol>
                <li className="is-complete"><span>01</span><strong>Read the idea</strong></li>
                <li className="is-current"><span>02</span><strong>Build understanding</strong></li>
                <li><span>03</span><strong>Challenge yourself</strong></li>
              </ol>
            </article>
          </aside>
        </div>

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

        <section className="post-ai-chat" aria-labelledby="post-ai-chat-title">
          <div className="post-ai-chat-head">
            <div className="post-ai-section-head">
              <span className="post-ai-section-icon" aria-hidden="true">
                <CircleHelp size={18} />
              </span>
              <div>
                <span className="post-ai-section-kicker">Continue learning</span>
                <h2 id="post-ai-chat-title">Ask what the post leaves open</h2>
              </div>
            </div>
            <p>Use a prompt below or ask in your own words. Answers stay grounded in this lesson.</p>
          </div>

          {messages.length === 0 && (
            <div className="post-ai-prompts" aria-label="Suggested questions">
              {suggestedQuestions.map((suggestion, index) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => askQuestion(suggestion)}
                  disabled={asking}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div
            className="post-ai-messages"
            ref={messagesRef}
            aria-live="polite"
            aria-busy={asking}
          >
            {messages.length === 0 && (
              <p className="post-ai-empty">Your follow-up conversation will appear here.</p>
            )}
            {renderedMessages}
            {asking && (
              <div className="post-ai-thinking" role="status">
                <i /><i /><i />
                Thinking through the lesson
              </div>
            )}
          </div>

          <form className="post-ai-form" onSubmit={askDoubt}>
            <textarea
              rows="1"
              value={question}
              onChange={handleQuestionChange}
              onKeyDown={handleQuestionKeyDown}
              placeholder="Ask about a mechanism, term, or example…"
              disabled={asking}
              aria-label="Ask a follow-up question"
            />

            <button type="submit" disabled={asking || !question.trim()} aria-label="Send question">
              <Send size={17} aria-hidden="true" />
              <span>Ask</span>
            </button>
          </form>
          <small className="post-ai-input-hint">Enter to ask · Shift + Enter for a new line</small>
        </section>
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
