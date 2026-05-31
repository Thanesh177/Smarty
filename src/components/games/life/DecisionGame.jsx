import { useMemo, useState } from "react";
import "../GameStyles.css";
export default function LifeDecisionGame({ onComplete }) {
  const [choice, setChoice] = useState("");

  const outcomes = useMemo(
    () => ({
      save: {
        xp: 10,
        score: 80,
        success: true,
        msg: "You built an emergency fund and improved financial stability.",
      },
      spend: {
        xp: 2,
        score: 30,
        success: false,
        msg: "Immediate gratification feels good, but it limits future flexibility.",
      },
      invest: {
        xp: 12,
        score: 100,
        success: true,
        msg: "Excellent choice. Long-term investing builds wealth through compounding.",
      },
    }),
    []
  );

  const finish = () => {
    const result = outcomes[choice];

    if (!result) return;

    onComplete?.({
      success: result.success,
      xp: result.xp,
      score: result.score,
      message: result.msg,
      category: "financial-literacy",
      decision: choice,
    });
  };

  return (
    <div className="brain-game">
      <p className="game-kicker">LIFE SIM</p>
      <h2>You earn ₹30,000/month</h2>

      <p className="game-hint">What do you do?</p>

      <div className="decision-row">
        {["spend", "save", "invest"].map((c) => (
          <button
            type="button"
            key={c}
            className={choice === c ? "decision-btn selected" : "decision-btn"}
            aria-pressed={choice === c}
            onClick={() => setChoice(c)}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="game-main-btn"
        disabled={!choice}
        onClick={finish}
      >
        Decide
      </button>
    </div>
  );
}