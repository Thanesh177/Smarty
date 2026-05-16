import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { postApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
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

  const paragraphs = text
    .split(/\n{2,}|(?<=\.\s)(?=(Simple explanation|Why it matters|How it works|Real-life example|Final takeaway)\b)/g)
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .filter((part) => !['Simple explanation', 'Why it matters', 'How it works', 'Real-life example', 'Final takeaway'].includes(part));

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => {
        const isHeading = /^(Simple explanation|Why it matters|How it works|Real-life example|Final takeaway)$/i.test(paragraph);

        return isHeading ? (
          <h3 key={`${paragraph}-${index}`}>{paragraph}</h3>
        ) : (
          <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
        );
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

  const userId = useMemo(
    () => user?.sub || user?.userId || user?.id || user?.username || '',
    [user]
  );

  const title = useMemo(() => post?.title || 'Post explanation', [post]);
  const body = useMemo(() => post?.body || '', [post]);

  const readableError = useCallback((err, fallback) => {
    const statusCode = err?.response?.status;
    const apiError = err?.response?.data?.error || err?.response?.data?.message;
    const message = apiError || err?.message || '';
    const lowerMessage = String(message).toLowerCase();

    if (statusCode === 401) {
      return 'You need to be logged in to ask AI doubts.';
    }

    if (
      lowerMessage.includes('resourcenotfoundexception') ||
      lowerMessage.includes('model use case details') ||
      lowerMessage.includes('anthropic') ||
      lowerMessage.includes('bedrock')
    ) {
      return 'AI is not fully enabled in AWS Bedrock yet. Enable the selected model access in Bedrock, or switch the Lambda to an Amazon Nova model.';
    }

    if (statusCode >= 500) {
      return 'AI service failed on the backend. Check the Lambda logs for the exact error.';
    }

    if (message) return message;
    return fallback;
  }, []);

  const displayExplanation = useMemo(() => {
    return explanation || getUsableDetailedExplanation(post) || '';
  }, [explanation, post]);

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
          setStatus('Detailed explanation was not returned. Check that client.js getPostDetails points to the AI content Lambda route /posts/details, not the simplify Lambda.');
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
  }, [postId, readableError]);

  const askDoubt = useCallback(async (event) => {
    event.preventDefault();

    const cleanQuestion = question.trim();
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
  }, [asking, body, displayExplanation, post, postId, question, readableError, title, userId]);

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

  return (
    <main className="post-ai-page">
      <section className="post-ai-shell">
        <button
          type="button"
          className="post-ai-back"
          onClick={goBack}
        >
          ← Back
        </button>

        <div className="post-ai-header">
          <p>AI Post Guide</p>
          <h1>{title || 'Post explanation'}</h1>
          <span>By {creatorName}</span>
        </div>

        {body && (
          <article className="post-ai-original">
            <strong>Original Post</strong>
            {renderFormattedParagraphs(body, 'post-ai-original-paragraphs')}
          </article>
        )}

        <article className="post-ai-card">
          <div className="post-ai-card-head">
            <span>Detailed AI Explanation</span>
            {loading && <small>Generating...</small>}
          </div>

          {loading ? (
            <div className="post-ai-loading">
              <span />
              <p>AI is explaining this post in detail...</p>
            </div>
          ) : (
            renderFormattedParagraphs(
              displayExplanation || status || 'No explanation available yet.',
              'post-ai-explanation-paragraphs'
            )
          )}

          {status && <div className="post-ai-status">{status}</div>}
        </article>

        <section className="post-ai-chat">
          <div className="post-ai-card-head">
            <span>Ask Doubts</span>
            {asking && <small>Thinking...</small>}
          </div>

          <div className="post-ai-messages">
            {messages.length === 0 && (
              <p className="post-ai-empty">
                Ask anything about this post, like “explain this part simpler” or “give an example”.
              </p>
            )}

            {renderedMessages}
          </div>

          <form className="post-ai-form" onSubmit={askDoubt}>
            <input
              value={question}
              onChange={handleQuestionChange}
              placeholder="Ask a doubt about this post..."
              disabled={asking}
            />

            <button type="submit" disabled={asking || !question.trim()}>
              Ask
            </button>
          </form>
        </section>

        <Link className="post-ai-comments" to={`/comments/${postId}`}>
          Open comments
        </Link>
      </section>
    </main>
  );
}