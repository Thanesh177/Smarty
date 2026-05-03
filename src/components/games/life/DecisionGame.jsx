import { useState } from "react";
import "../GameStyles.css";
export default function LifeDecisionGame({ onComplete }) {
  const [choice, setChoice] = useState("");

  const outcomes = {
    save: { xp: 10, msg: "You built financial safety." },
    spend: { xp: 2, msg: "Short-term pleasure, long-term risk." },
    invest: { xp: 12, msg: "Smart. Wealth grows over time." },
  };

  const finish = () => {
    const result = outcomes[choice];

    onComplete({
      success: choice === "invest" || choice === "save",
      xp: result.xp,
      score: result.xp,
      message: result.msg,
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
  key={c}
  className={choice === c ? "decision-btn selected" : "decision-btn"}
  onClick={() => setChoice(c)}
>
  {c.toUpperCase()}
</button>
        ))}
      </div>

      <button className="game-main-btn" disabled={!choice} onClick={finish}>
  Decide
</button>
    </div>
  );
}