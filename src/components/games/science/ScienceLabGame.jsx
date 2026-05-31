import { useMemo, useState } from "react";
import "../GameStyles.css";

const SCIENCE_STEPS = [
  "Question",
  "Hypothesis",
  "Experiment",
  "Observation",
  "Conclusion",
];

export default function ScienceLabGame({ onComplete }) {
  const [steps, setSteps] = useState([]);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const correctOrder = SCIENCE_STEPS;
  const options = useMemo(
    () => [...SCIENCE_STEPS].sort(() => Math.random() - 0.5),
    []
  );

  const choose = (step) => {
    if (locked) return;
    // Toggle selection
    if (steps.includes(step)) {
      setSteps(steps.filter((s) => s !== step));
    } else {
      setSteps([...steps, step]);
    }
  };

  const resetOrder = () => {
    if (locked) return;
    setSteps([]);
  };

  const finish = () => {
    if (locked) return;
    // Calculate number of correct positions
    let correctPositions = 0;
    for (let i = 0; i < correctOrder.length; i++) {
      if (steps[i] === correctOrder[i]) correctPositions++;
    }
    const score = Math.round((correctPositions / correctOrder.length) * 100);
    const success = correctPositions >= 4;
    const fb = {
      success,
      correctPositions,
      totalSteps: correctOrder.length,
      score,
      selectedSteps: steps,
    };
    setFeedback(fb);
    setLocked(true);
    onComplete?.({
      success,
      xp: success ? 14 : 4,
      score,
      message: success
        ? "Excellent scientific reasoning."
        : "Scientific investigations follow a structured process.",
      category: "science",
      game: "scientific-method",
      correctPositions,
      totalSteps: correctOrder.length,
      selectedSteps: steps,
    });
  };

  return (
    <div className="brain-game serious-game">
      <p className="game-kicker">SCIENCE LAB SIM</p>
      <h2>Arrange the scientific method</h2>
      <p className="game-hint">
        Select the steps in the order scientists use them.
      </p>

      <div className="decision-row">
        {options.map((step) => (
          <button
            key={step}
            type="button"
            aria-pressed={steps.includes(step)}
            disabled={locked}
            className={steps.includes(step) ? "decision-btn selected" : "decision-btn"}
            onClick={() => choose(step)}
          >
            {step}
          </button>
        ))}
      </div>

      <div className="science-order-box">
        {steps.map((step, index) => (
          <span key={step}>
            {index + 1}. {step}
          </span>
        ))}
      </div>

      {feedback && (
        <div className={feedback.success ? "memory-result success" : "memory-result"}>
          <strong>
            {feedback.correctPositions}/{feedback.totalSteps} positions correct
          </strong>
          <span>{feedback.score}% score</span>
        </div>
      )}

      <div className="memory-game-actions">
        <button
          type="button"
          className="secondary-btn"
          disabled={locked}
          onClick={resetOrder}
        >
          Reset
        </button>

        <button
          type="button"
          className="game-main-btn"
          disabled={steps.length < correctOrder.length || locked}
          onClick={finish}
        >
          Run Experiment
        </button>
      </div>
    </div>
  );
}