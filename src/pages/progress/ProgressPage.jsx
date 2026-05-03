import { useState } from "react";
import {
  getProgress,
  getWrongQuestions,
  removeWrongQuestion,
} from "../../lib/progressStore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import "./ProgressPage.css";

export default function ProgressPage() {
  const progress = getProgress();
  const [wrong, setWrong] = useState(() => getWrongQuestions());

  const topics = Object.entries(progress);

  const chartData = topics.map(([topicId, item]) => ({
    topic: topicId,
    xp: item.totalXP || 0,
    mastery: item.bestPercent || 0,
  }));

const handleRemoveMistake = (topicId, item) => {
  const updatedWrongQuestions = removeWrongQuestion(topicId, item);
  setWrong(updatedWrongQuestions || getWrongQuestions());
};

  return (
    <main className="quiz-page">


      <section className="progress-dashboard">
        <div className="analytics-card">
          <h3>XP Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <XAxis dataKey="topic" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="xp" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="analytics-card">
          <h3>Weak Questions</h3>

          {Object.entries(wrong).length === 0 ? (
            <p>No weak questions saved yet.</p>
          ) : (
            Object.entries(wrong).map(([topicId, items]) => {
              const safeItems = Array.isArray(items) ? items.slice(-5) : [];

              if (safeItems.length === 0) return null;

              return (
                <div key={topicId} className="mistake-topic-block">
                  <h4>{topicId.replaceAll("_", " ")}</h4>

                  {safeItems.map((item, index) => (
                    <article key={`${item.q}-${index}`} className="mistake-review-card">
<button
  type="button"
  className="remove-mistake-btn"
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemoveMistake(topicId, item);
  }}
  aria-label="Delete mistake question"
>
  🗑️
</button>

                      <span className="mistake-label">Mistake Review</span>

                      <h4>{item.q || item.question || "Saved mistake"}</h4>

                      <div className="mistake-answer-grid">
                        <div>
                          <span>Your answer</span>
                          <strong>{item.selected || "Not saved"}</strong>
                        </div>

                        <div>
                          <span>Correct answer</span>
                          <strong>{item.answer || item.correctAnswer || "Not saved"}</strong>
                        </div>
                      </div>

                      <div className="mistake-explanation">
                        <strong>Explanation</strong>
                        <p>{item.explanation || "Review this concept and try again."}</p>
                      </div>

                      <p className="mistake-tip">
                        💡 Learn it better: explain why the correct answer is right, then retry this topic.
                      </p>
                    </article>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}