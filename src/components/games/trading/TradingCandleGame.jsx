import { useState, useMemo } from "react";
import "../GameStyles.css";

const SCENARIOS = [
  {
    title: "Fake Breakout Trap",
    correctAction: "wait",
    correctRisk: "low",
    description:
      "Price spikes up suddenly but volume is weak. This often traps beginners.",
    outcome: {
      win: "You avoided a fake breakout. Smart discipline.",
      lose: "You got trapped. Price reversed sharply.",
    },
  },
  {
    title: "Strong Momentum Trend",
    correctAction: "buy",
    correctRisk: "medium",
    description:
      "Strong bullish candles with volume confirmation. Trend looks healthy.",
    outcome: {
      win: "You rode the trend. Clean execution.",
      lose: "You hesitated or over-risked. Missed optimal entry.",
    },
  },
];

export default function TradingCandleGame({ onComplete }) {
  const scenario = useMemo(
    () => SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)],
    []
  );

  const [step, setStep] = useState(1);
  const [action, setAction] = useState("");
  const [risk, setRisk] = useState("");

  const success =
    action === scenario.correctAction && risk === scenario.correctRisk;

  const finish = () => {
    onComplete({
      success,
      xp: success ? 15 : 5,
      score: success ? 5 : 2,
      message: success
        ? scenario.outcome.win
        : scenario.outcome.lose + " Learn risk management.",
    });
  };

  return (
<div className="brain-game serious-game trading-sim-game">
      <p className="game-kicker">REAL MARKET SIM</p>
      <h2>{scenario.title}</h2>

      <p className="game-hint">{scenario.description}</p>

      {step === 1 && (
        <>
          <h3>Step 1: What do you do?</h3>
          <div className="decision-row">
            {["buy", "sell", "wait"].map((item) => (
              <button
                key={item}
                className={action === item ? "decision-btn selected" : "decision-btn"}
                onClick={() => setAction(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            className="game-main-btn"
            disabled={!action}
            onClick={() => setStep(2)}
          >
            Next
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Step 2: Choose risk level</h3>
          <div className="decision-row">
            {["low", "medium", "high"].map((r) => (
              <button
                key={r}
                className={risk === r ? "decision-btn selected" : "decision-btn"}
                onClick={() => setRisk(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            className="game-main-btn"
            disabled={!risk}
            onClick={finish}
          >
            Execute Trade
          </button>
        </>
      )}
    </div>
  );
}