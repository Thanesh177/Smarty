import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  getProgress,
  getProgressUserId,
  getWrongQuestions,
  removeWrongQuestion,
} from "../../lib/progressStore";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Grid2X2, X } from 'lucide-react';
import { QUIZ_SUBJECTS } from '../../data/quizSubjects.js';
import "./ProgressPage.css";
import '../QuizWorkspace.css';
import './QuizProgress.css';

const subjectTitle = (id) => QUIZ_SUBJECTS.find((subject) => subject.id === id)?.title || id.replaceAll('_', ' ').replaceAll('-', ' ');

const MistakeReviewCard = memo(function MistakeReviewCard({ topicId, item, index, onRemove }) {
  const question = item.q || item.question || "Saved mistake";
  const selectedAnswer = item.selected || "Not saved";
  const correctAnswer = item.answer || item.correctAnswer || "Not saved";
  const explanation = item.explanation || "Review this concept and try again.";

  const handleRemove = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove(topicId, item);
  }, [item, onRemove, topicId]);

  return (
    <article className="mistake-review-card">
      <button
        type="button"
        className="remove-mistake-btn"
        onClick={handleRemove}
        aria-label={`Remove saved question: ${question}`}
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="mistake-header">
        <span className="mistake-label">{item.confidence === 'unsure' ? 'Uncertain answer' : 'Worth another look'}</span>
      </div>

      <h4>{question}</h4>

      <div className="mistake-answer-grid">
        <div>
          <span>Your answer</span>
          <strong>{selectedAnswer}</strong>
        </div>

        <div>
          <span>Correct answer</span>
          <strong>{correctAnswer}</strong>
        </div>
      </div>

      <div className="mistake-explanation">
        <strong>Explanation</strong>
        <p>{explanation}</p>
      </div>

      <p className="mistake-tip">
        Try explaining the reasoning in your own words before your next practice.
      </p>
    </article>
  );
});

const MistakeTopicBlock = memo(function MistakeTopicBlock({ topicId, items, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const safeItems = useMemo(
    () => (Array.isArray(items) ? (expanded ? items : items.slice(-5)) : []),
    [items, expanded]
  );

  if (safeItems.length === 0) return null;

  return (
    <div className="mistake-topic-block">
      <div className="quiz-notebook-subject"><h3>{subjectTitle(topicId)}</h3><span>{items.length} saved</span></div>

      {safeItems.map((item, index) => (
        <MistakeReviewCard
          key={`${item.q || item.question || "mistake"}-${index}`}
          topicId={topicId}
          item={item}
          index={index}
          onRemove={onRemove}
        />
      ))}
      {items.length > 5 && <button type="button" className="quiz-text-control" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show recent questions' : `Show all ${items.length} questions`}</button>}
    </div>
  );
});

export default function ProgressPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const progressUserId = useMemo(() => getProgressUserId(user), [user]);
  const [progress, setProgress] = useState(() => getProgress(progressUserId));
  const [wrong, setWrong] = useState(() => getWrongQuestions(progressUserId));

  useEffect(() => {
    setProgress(getProgress(progressUserId));
    setWrong(getWrongQuestions(progressUserId));
  }, [progressUserId]);

  const topics = useMemo(() => Object.entries(progress).filter(([, item]) => item && (item.attempts > 0 || item.totalXP > 0)), [progress]);

  const handleRemoveMistake = useCallback((topicId, item) => {
    const updatedWrongQuestions = removeWrongQuestion(topicId, item, progressUserId);
    setWrong(updatedWrongQuestions || getWrongQuestions(progressUserId));
  }, [progressUserId]);

  const wrongEntries = useMemo(() => Object.entries(wrong).filter(([, items]) => Array.isArray(items) && items.length), [wrong]);
  const reviewCount = wrongEntries.reduce((sum, [, items]) => sum + items.length, 0);

  const renderedWeakAreas = useMemo(
    () => wrongEntries.map(([topicId, items]) => (
      <MistakeTopicBlock
        key={topicId}
        topicId={topicId}
        items={items}
        onRemove={handleRemoveMistake}
      />
    )),
    [handleRemoveMistake, wrongEntries]
  );

  return (
    <main className="quiz-page quiz-workspace quiz-progress-workspace quiz-notebook-page">
      <div className="quiz-masthead">
        <button type="button" className="quiz-text-control" onClick={() => navigate('/quiz')}><Grid2X2 size={16} aria-hidden="true" /> Quiz library</button>
        <span>Smarty <span aria-hidden="true">/</span> Review notebook</span>
        <button type="button" className="quiz-text-control" onClick={() => navigate('/game-profile')}>Your progress <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
      <header className="quiz-progress-intro">
        <span className="quiz-eyebrow">Understanding takes another look.</span>
        <h1>Keep the questions.<br />Find the connections.</h1>
        <p>Your missed and uncertain answers, with the reasoning worth remembering.</p>
      </header>
      <div className="quiz-notebook-layout">
        <aside className="quiz-notebook-sidebar">
          <div className="quiz-notebook-count"><strong>{reviewCount.toString().padStart(2, '0')}</strong><span>questions saved for review</span></div>
          <button type="button" className="quiz-progress-primary" onClick={() => navigate('/quiz')}>Practice these again <ArrowUpRight size={17} aria-hidden="true" /></button>
          <p>Choose a subject under “Worth another look” in the library to practice saved questions without changing your first-attempt score.</p>
          {topics.length > 0 && <div className="quiz-notebook-record"><h2>Practice record</h2>{topics.map(([id, item]) => <div key={id}><span>{subjectTitle(id)}</span><strong>{Math.min(100, Math.max(0, Number(item.bestPercent) || 0))}%</strong></div>)}<p>Best scores on practice sets. Not a measure of exam readiness.</p></div>}
        </aside>
        <section className="quiz-notebook-main" aria-label="Saved explanations">
          {wrongEntries.length ? renderedWeakAreas : <div className="quiz-progress-empty"><span className="quiz-eyebrow">A clean notebook</span><h2>No questions waiting here.</h2><p>Missed answers and questions you mark as unsure will appear here with their explanations.</p><button type="button" className="quiz-text-control" onClick={() => navigate('/quiz')}>Find your next subject <ArrowUpRight size={16} aria-hidden="true" /></button></div>}
        </section>
      </div>
      <p className="quiz-progress-storage-note">Saved on this device for your account. Removing a question does not change your score.</p>
    </main>
  );
}
