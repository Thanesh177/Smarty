import { useEffect, useId, useMemo, useState } from 'react';
import { BookOpen, BrainCircuit, Check, ChevronRight, CircleHelp, Compass, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { postApi } from '../../api/client';
import useLearningLibrary from '../../hooks/useLearningLibrary';
import { LEARNING_GUIDES } from '../../data/learningGuides';
import { getLearningContext, getRelatedLearningTopics, getLearningNextStep, getLearningQuizLocation,
  markLearningProgress, readLearningProgress, rememberLearningLesson,
  selectNextLessons } from '../../lib/learningJourney';
import './LearningJourneyPanel.css';

const STAGES = [
  { id: 'read', label: 'Discover', helper: 'Read the source', icon: BookOpen },
  { id: 'understand', label: 'Understand', helper: 'Follow the mechanism', icon: BrainCircuit },
  { id: 'challenge', label: 'Apply', helper: 'Check with a quiz', icon: Trophy },
];

export default function LearningJourneyPanel(props) {
  const { user } = useAuth();
  const userId = user?.sub || user?.userId || user?.id || '';
  const context = getLearningContext(props.post, props.postId);
  return <LessonJourney key={userId + ':' + context.postId} {...props} userId={userId} />;
}

function LessonJourney({ post, postId, stage = 'read', creatorName = '', userId }) {
  const navigate = useNavigate();
  const titleId = useId();
  const context = useMemo(() => getLearningContext(post, postId), [post, postId]);
  const relatedTopics = useMemo(() => getRelatedLearningTopics(post), [post]);
  const [progress, setProgress] = useState(() => readLearningProgress(context.postId, userId));
  const [notice, setNotice] = useState('');
  const library = useLearningLibrary(userId);
  useEffect(() => {
    if (context.postId) setProgress(rememberLearningLesson(context, userId));
  }, [context.postId, context.title, context.topic, context.focus, userId]);

  const nextPosts = useQuery({
    queryKey: ['learning-next', userId, context.topic],
    queryFn: () => postApi.getFeed({ limit: 20, topic: context.topic }),
    enabled: Boolean(context.postId) && stage !== 'read', staleTime: 60000, retry: 1,
  });
  const nextLessons = useMemo(() => selectNextLessons([...LEARNING_GUIDES, ...(nextPosts.data?.items || [])], context, library), [nextPosts.data, context, library]);
  const nextStep = getLearningNextStep(progress);
  const openQuiz = () => navigate(getLearningQuizLocation(context), { state: { learningContext: context, post } });
  const completeStep = (step) => {
    const next = markLearningProgress(context.postId, userId, step, context);
    setProgress(next);
    setNotice(next.persisted ? 'Progress saved.' : 'Progress could not be saved on this device.');
  };
  const continueToQuiz = () => {
    if (!progress.understand) completeStep('understand');
    openQuiz();
  };
  if (!context.postId) return null;

  return (
    <section className="learning-journey" aria-labelledby={titleId}>
      <div className="learning-journey-head">
        <div>
          <span className="learning-journey-kicker">Turn this idea into understanding</span>
          <h2 id={titleId}>{context.focus}</h2>
          <p>Read it. Explain why it works. Try using it without looking back.</p>
        </div>
        <Link className="learning-journey-topic" to="/learn">My learning <ChevronRight size={13} /></Link>
      </div>
      <ol className="learning-journey-steps" aria-label="Lesson progress">
        {STAGES.map((item) => {
          const Icon = item.icon;
          return <li key={item.id} className={[progress[item.id] ? 'is-complete' : '', nextStep.stage === item.id ? 'is-current' : ''].join(' ')} aria-current={nextStep.stage === item.id ? 'step' : undefined}>
            <span className="learning-step-icon" aria-hidden="true">{progress[item.id] ? <Check size={16} /> : <Icon size={16} />}</span>
            <span><strong>{item.label}{progress[item.id] ? ' · done' : ''}</strong><small>{item.helper}</small></span>
          </li>;
        })}
      </ol>
      {!progress.read && <button type="button" className="learning-secondary-action" onClick={() => completeStep('read')}><Check size={16} /> I’ve read the source</button>}
      {notice && <p className="learning-save-notice" role="status">{notice}</p>}
      <div className="learning-journey-actions">
        {stage === 'read' ? <button type="button" className="learning-primary-action" onClick={() => navigate('/post-ai/' + encodeURIComponent(context.postId), { state: { post: { ...post, ...context }, creatorName } })}>
          <BrainCircuit size={18} /> Learn this step by step <ChevronRight size={17} />
        </button> : <button type="button" className="learning-primary-action" onClick={continueToQuiz}><Trophy size={18} />{progress.attempts ? 'Practice this concept again' : 'Continue to knowledge check'}<ChevronRight size={17} /></button>}
        {stage === 'read' && <button type="button" className="learning-secondary-action" onClick={openQuiz}>Test what I know</button>}
      </div>
      {progress.lastScore !== null && <p className="learning-score-note">Last check: {progress.lastScore}%. {progress.challenge ? 'Ready to build on this idea.' : 'Revisit the explanation and practice the parts that felt difficult.'}</p>}
      {stage !== 'read' && <div className="learning-next-lessons">
        <span className="learning-journey-kicker">Your next connection</span>
        <h3>Continue from {context.focus}</h3>
        <p className="learning-next-intro">Choose the next idea that answers a question this lesson leaves open. Every path explains the bridge before you enter it.</p>
        {nextLessons.length > 0 && <div className="learning-next-foundation">
          <span>What you have established</span>
          <p>{nextLessons[0].foundation}</p>
        </div>}
        {nextPosts.isPending && nextLessons.length === 0 ? <p role="status">Building your next learning path in {context.topic}…</p> : <div className="learning-next-list">{nextLessons.map(({ post: nextPost, reason, preview, connection, question }, index) => {
          const next = getLearningContext(nextPost);
          return <Link className={`learning-next-card${index === 0 ? ' is-recommended' : ''}`} key={next.postId} to={'/post-ai/' + encodeURIComponent(next.postId)} state={{ post: nextPost }}>
            <span className="learning-next-card-copy">
              <span className="learning-next-card-label">
                <small>{reason}</small>
                {index === 0 && <em>Best next step</em>}
              </span>
              <span className="learning-next-route" aria-label={`From ${context.focus} to ${next.focus}`}>
                <span><b>Now</b>{context.focus}</span>
                <ChevronRight size={15} aria-hidden="true" />
                <span><b>Next</b>{next.focus}</span>
              </span>
              <strong>{next.title}</strong>
              <span className="learning-next-detail"><b>What this adds</b><span>{preview}</span></span>
              <span className="learning-next-detail"><b>Why it connects</b><span>{connection}</span></span>
              <span className="learning-next-question"><CircleHelp size={14} aria-hidden="true" /><span><b>Think before opening</b>{question}</span></span>
            </span>
            <span className="learning-next-open" aria-hidden="true">Continue <ChevronRight size={16} /></span>
          </Link>;
        })}</div>}
        {!nextPosts.isPending && nextLessons.length === 0 && <p>{nextPosts.isError ? 'Suggestions are unavailable right now. Your progress is saved.' : 'You’ve explored the available suggestions. Pick another concept from this subject.'}</p>}
        <Link to={'/learn?topic=' + encodeURIComponent(context.topic)}>Plan my next lesson <ChevronRight size={16} /></Link>
      </div>}
      <div className="learning-related"><span><Compass size={15} /> Branch out</span><div>
        {[context.topic, ...relatedTopics].map((topic) => <button type="button" key={topic} onClick={() => navigate('/learn?topic=' + encodeURIComponent(topic))}>{topic}</button>)}
      </div></div>
    </section>
  );
}
