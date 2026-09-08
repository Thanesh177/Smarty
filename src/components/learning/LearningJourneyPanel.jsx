import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, BrainCircuit, Check, ChevronRight, Compass, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getLearningContext,
  getRelatedLearningTopics,
  markLearningProgress,
  readLearningProgress,
} from '../../lib/learningJourney';
import './LearningJourneyPanel.css';

const STAGES = [
  { id: 'read', label: 'Discover', helper: 'Read the idea', icon: BookOpen },
  { id: 'understand', label: 'Understand', helper: 'Go one layer deeper', icon: BrainCircuit },
  { id: 'challenge', label: 'Challenge', helper: 'Prove what stayed', icon: Trophy },
];

export default function LearningJourneyPanel({
  post,
  postId,
  stage = 'read',
  creatorName = '',
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const context = useMemo(() => getLearningContext(post, postId), [post, postId]);
  const relatedTopics = useMemo(() => getRelatedLearningTopics(post), [post]);
  const userId = user?.sub || user?.userId || user?.id || user?.username || '';
  const [progress, setProgress] = useState(() => readLearningProgress(context.postId, userId));

  useEffect(() => {
    if (!context.postId) return;
    setProgress(markLearningProgress(context.postId, userId, stage));
  }, [context.postId, stage, userId]);

  const openLesson = useCallback(() => {
    setProgress(markLearningProgress(context.postId, userId, 'understand'));
    navigate(`/post-ai/${encodeURIComponent(context.postId)}`, {
      state: { post: { ...(post || {}), ...context }, creatorName },
    });
  }, [context, creatorName, navigate, post, userId]);

  const openChallenge = useCallback(() => {
    const params = new URLSearchParams({
      topic: context.topic,
      focus: context.focus,
      postId: context.postId,
    });
    navigate(`/quiz?${params.toString()}`, {
      state: { learningContext: context, post: { ...(post || {}), ...context } },
    });
  }, [context, navigate, post]);

  const openTopic = useCallback((topic) => {
    navigate(`/feed?topic=${encodeURIComponent(topic)}`);
  }, [navigate]);

  const activeIndex = Math.max(0, STAGES.findIndex((item) => item.id === stage));

  return (
    <section className="learning-journey" aria-labelledby={`learning-path-${context.postId}`}>
      <div className="learning-journey-head">
        <div>
          <span className="learning-journey-kicker">Your learning path</span>
          <h2 id={`learning-path-${context.postId}`}>{context.focus}</h2>
          <p>
            Learn the mechanism, clear up questions, then check what you can recall.
          </p>
        </div>
        <span className="learning-journey-topic">{context.topic}</span>
      </div>

      <ol className="learning-journey-steps" aria-label="Lesson progress">
        {STAGES.map((item, index) => {
          const StageIcon = item.icon;
          const isDone = progress[item.id];
          const isCurrent = index === activeIndex;

          return (
            <li
              key={item.id}
              className={`${isDone ? 'is-complete' : ''}${isCurrent ? ' is-current' : ''}`}
            >
              <span className="learning-step-icon" aria-hidden="true">
                {isDone && !isCurrent ? <Check size={15} /> : <StageIcon size={16} />}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.helper}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="learning-journey-actions">
        {stage === 'read' ? (
          <button type="button" className="learning-primary-action" onClick={openLesson}>
            <BrainCircuit size={18} />
            Explain this concept
            <ChevronRight size={17} />
          </button>
        ) : (
          <button type="button" className="learning-primary-action" onClick={openChallenge}>
            <Trophy size={18} />
            Take the focused quiz
            <ChevronRight size={17} />
          </button>
        )}

        {stage === 'read' && (
          <button type="button" className="learning-secondary-action" onClick={openChallenge}>
            Quick challenge
          </button>
        )}
      </div>

      <div className="learning-related">
        <span><Compass size={15} /> Keep exploring</span>
        <div>
          <button type="button" onClick={() => openTopic(context.topic)}>
            More in {context.topic}
          </button>
          {relatedTopics.map((topic) => (
            <button type="button" key={topic} onClick={() => openTopic(topic)}>
              {topic}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
