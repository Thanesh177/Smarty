import { useState } from "react";
import "../GameStyles.css";

export default function ScienceLabGame({ onComplete }) {
  const [steps, setSteps] = useState([]);

  const correctOrder = ["Question", "Hypothesis", "Experiment", "Observation", "Conclusion"];

  const choose = (step) => {
    if (!steps.includes(step)) setSteps([...steps, step]);
  };

  const finish = () => {
    const success = steps.join(",") === correctOrder.join(",");

    onComplete({
      success,
      xp: success ? 10 : 0,
      score: success ? 5 : 2,
      message: success
        ? "Great scientific thinking. You followed the correct method."
        : "Science lesson: strong conclusions need proper experimental order.",
    });
  };

  return (
    <div className="brain-game serious-game">
      <p className="game-kicker">SCIENCE LAB SIM</p>
      <h2>Build the scientific method</h2>
      <p className="game-hint">Choose the steps in the correct order.</p>

      <div className="decision-row">
        {correctOrder.sort().map((step) => (
          <button
            key={step}
            className="decision-btn"
            onClick={() => choose(step)}
          >
            {step}
          </button>
        ))}
      </div>

      <div className="science-order-box">
        {steps.map((step, index) => (
          <span key={step}>{index + 1}. {step}</span>
        ))}
      </div>

      <button className="game-main-btn" disabled={steps.length < 5} onClick={finish}>
        Run Experiment
      </button>
    </div>
  );
}