import { memo, useCallback, useMemo, useState } from "react";
import {
  getProgress,
  getWrongQuestions,
  removeWrongQuestion,
} from "../../lib/progressStore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import "./ProgressPage.css";

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
        aria-label="Delete mistake question"
      >
        🗑️
      </button>

      <div className="mistake-header">
        <span className="mistake-label">Mistake Review</span>
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
        💡 Learn it better: explain why the correct answer is right, then retry this topic.
      </p>
    </article>
  );
});

const MistakeTopicBlock = memo(function MistakeTopicBlock({ topicId, items, onRemove }) {
  const safeItems = useMemo(
    () => (Array.isArray(items) ? items.slice(-5) : []),
    [items]
  );

  if (safeItems.length === 0) return null;

  return (
    <div className="mistake-topic-block">
      <h4>{topicId.replaceAll("_", " ")}</h4>

      {safeItems.map((item, index) => (
        <MistakeReviewCard
          key={`${item.q || item.question || "mistake"}-${index}`}
          topicId={topicId}
          item={item}
          index={index}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
});

export default function ProgressPage() {
  const progress = useMemo(() => getProgress(), []);
  const [wrong, setWrong] = useState(() => getWrongQuestions());

  const topics = useMemo(() => Object.entries(progress), [progress]);

  const chartData = useMemo(
    () => topics.map(([topicId, item]) => ({
      topic: topicId,
      xp: item.totalXP || 0,
      mastery: item.bestPercent || 0,
    })),
    [topics]
  );

  const handleRemoveMistake = useCallback((topicId, item) => {
    const updatedWrongQuestions = removeWrongQuestion(topicId, item);
    setWrong(updatedWrongQuestions || getWrongQuestions());
  }, []);

  const wrongEntries = useMemo(() => Object.entries(wrong), [wrong]);

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
  <main className="quiz-page progress-page">

      <section className="quiz-hero progress-hero">
        <div>
          <p className="quiz-kicker">PROGRESS</p>
          <h1>Your Learning Dashboard</h1>
          <p>Track your XP growth, identify weak areas, and improve faster.</p>
        </div>
      </section>

      <section className="progress-dashboard">
        <div className="analytics-card fade-in">
          <div className="card-header">
            <h3>XP Growth</h3>
            <span>Track your progress across topics</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <XAxis dataKey="topic" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="xp" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-card fade-in">
          <div className="card-header">
            <h3>Weak Areas</h3>
            <span>Review mistakes and improve</span>
          </div>

          {wrongEntries.length === 0 ? (
            <div className="empty-state">
              <h4>No mistakes yet 🎉</h4>
              <p>You’re doing great. Keep practicing to see insights here.</p>
            </div>
          ) : (
            renderedWeakAreas
          )}
        </div>
      </section>
    </main>
  );
}