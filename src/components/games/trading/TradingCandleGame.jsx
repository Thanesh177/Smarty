import { useMemo, useState } from "react";
import "../GameStyles.css";

const STARTING_CAPITAL = 5000;

const SCENARIOS = [
  {
    id: "fake-breakout",
    title: "Fake Breakout Trap",
    marketType: "Breakout trap",
    correctAction: "wait",
    correctRisk: "low",
    description:
      "Price spikes above resistance, but volume is weak and the candle closes with a long upper wick.",
    signals: ["Weak volume", "Upper wick", "Resistance zone"],
    chart: [42, 45, 47, 52, 49, 46],
    riskImpact: {
      low: -100,
      medium: -350,
      high: -800,
    },
    actionImpact: {
      buy: -500,
      sell: -250,
      wait: 350,
    },
    lesson:
      "A breakout without volume confirmation is risky. Waiting protects capital from trap moves.",
  },
  {
    id: "strong-momentum",
    title: "Strong Momentum Trend",
    marketType: "Momentum continuation",
    correctAction: "buy",
    correctRisk: "medium",
    description:
      "Price is forming higher highs and higher lows with strong bullish candles and volume confirmation.",
    signals: ["Higher highs", "Strong volume", "Trend support"],
    chart: [30, 33, 35, 38, 42, 46],
    riskImpact: {
      low: 250,
      medium: 650,
      high: -250,
    },
    actionImpact: {
      buy: 500,
      sell: -700,
      wait: 100,
    },
    lesson:
      "When trend structure and volume align, buying with controlled risk can be a high-probability setup.",
  },
  {
    id: "support-bounce",
    title: "Support Bounce Setup",
    marketType: "Bounce setup",
    correctAction: "buy",
    correctRisk: "medium",
    description:
      "Price taps support, rejects lower prices, and buyers step in with increasing volume.",
    signals: ["Support zone", "Buyer reaction", "Volume rising"],
    chart: [55, 51, 48, 47, 51, 55],
    riskImpact: {
      low: 220,
      medium: 600,
      high: -300,
    },
    actionImpact: {
      buy: 450,
      sell: -650,
      wait: 150,
    },
    lesson:
      "Support bounces are stronger when price rejection and buyer volume appear together.",
  },
  {
    id: "resistance-rejection",
    title: "Resistance Rejection",
    marketType: "Reversal setup",
    correctAction: "sell",
    correctRisk: "medium",
    description:
      "Price tests resistance and closes below it with strong selling pressure and fading buyer momentum.",
    signals: ["Resistance", "Rejection candle", "Seller pressure"],
    chart: [44, 48, 52, 55, 53, 48],
    riskImpact: {
      low: 200,
      medium: 620,
      high: -350,
    },
    actionImpact: {
      buy: -600,
      sell: 500,
      wait: 120,
    },
    lesson:
      "A strong rejection at resistance can show sellers are defending the level.",
  },
];

function Sparkline({ values = [] }) {
  const width = 220;
  const height = 86;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="market-mini-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Price movement chart"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMoney(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function getTradeQuality({ action, risk, scenario }) {
  if (action === scenario.correctAction && risk === scenario.correctRisk) {
    return "Excellent execution";
  }

  if (action !== scenario.correctAction) {
    return scenario.correctAction === "wait"
      ? "Too aggressive"
      : "Wrong market direction";
  }

  if (risk === "high") return "Over-risked";
  if (risk === "low" && scenario.correctRisk === "medium") return "Too cautious";

  return "Needs refinement";
}

export default function TradingCandleGame({ onComplete }) {
  const scenario = useMemo(
    () => SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)],
    []
  );

  const [step, setStep] = useState(1);
  const [action, setAction] = useState("");
  const [risk, setRisk] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [locked, setLocked] = useState(false);

  const success =
    action === scenario.correctAction && risk === scenario.correctRisk;

  const estimatedImpact = useMemo(() => {
    if (!action) return 0;
    return scenario.actionImpact[action] || 0;
  }, [action, scenario]);

  const finish = () => {
    if (locked || !action || !risk) return;

    const actionScore = action === scenario.correctAction ? 50 : 0;
    const riskScore = risk === scenario.correctRisk ? 50 : risk === "high" ? 0 : 25;
    const score = actionScore + riskScore;
    const impact =
      (scenario.actionImpact[action] || 0) +
      (scenario.riskImpact[risk] || 0);
    const finalCapital = Math.max(0, STARTING_CAPITAL + impact);
    const quality = getTradeQuality({ action, risk, scenario });

    const result = {
      success,
      score,
      impact,
      finalCapital,
      quality,
    };

    setLocked(true);
    setFeedback(result);

    window.setTimeout(() => {
      onComplete?.({
        success,
        xp: success ? 15 : 5,
        score,
        message: success
          ? `${quality}. ${scenario.lesson}`
          : `${quality}. ${scenario.lesson}`,
        category: "trading",
        game: "candle-decision",
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        selectedAction: action,
        selectedRisk: risk,
        correctAction: scenario.correctAction,
        correctRisk: scenario.correctRisk,
        impact,
        finalCapital,
      });
    }, 900);
  };

  return (
    <div className="brain-game serious-game trading-sim-game">
      <div className="memory-game-top survival-status-row">
        <div>
          <p className="game-kicker">REAL MARKET SIM</p>
          <h2>{scenario.title}</h2>
          <p className="memory-round-label">{scenario.marketType}</p>
        </div>

        <span className="memory-timer recall">
          ${STARTING_CAPITAL.toLocaleString()}
        </span>
      </div>

      <div className="market-scenario-card">
        <Sparkline values={scenario.chart} />

        <div>
          <p className="game-hint">{scenario.description}</p>
          <div className="market-signal-row">
            {scenario.signals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </div>
      </div>

      {step === 1 && (
        <>
          <h3>Step 1: Choose your market action</h3>
          <div className="decision-row market-decision-row">
            {["buy", "sell", "wait"].map((item) => (
              <button
                key={item}
                type="button"
                className={action === item ? "decision-btn selected" : "decision-btn"}
                aria-pressed={action === item}
                disabled={locked}
                onClick={() => setAction(item)}
              >
                <strong>{item.toUpperCase()}</strong>
                <small>
                  {item === "buy"
                    ? "Enter long"
                    : item === "sell"
                      ? "Enter short"
                      : "Protect capital"}
                </small>
              </button>
            ))}
          </div>

          {action && (
            <p className="game-feedback">
              Estimated action impact: {formatMoney(estimatedImpact)}
            </p>
          )}

          <button
            type="button"
            className="game-main-btn"
            disabled={!action || locked}
            onClick={() => setStep(2)}
          >
            Next
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Step 2: Choose risk level</h3>
          <div className="decision-row market-decision-row">
            {["low", "medium", "high"].map((item) => (
              <button
                key={item}
                type="button"
                className={risk === item ? "decision-btn selected" : "decision-btn"}
                aria-pressed={risk === item}
                disabled={locked}
                onClick={() => setRisk(item)}
              >
                <strong>{item.toUpperCase()}</strong>
                <small>
                  {item === "low"
                    ? "Small position"
                    : item === "medium"
                      ? "Balanced risk"
                      : "Aggressive size"}
                </small>
              </button>
            ))}
          </div>

          {feedback && (
            <div className={feedback.success ? "memory-result success" : "memory-result"}>
              <strong>{feedback.quality}</strong>
              <span>
                {formatMoney(feedback.impact)} impact · Final capital ${feedback.finalCapital.toLocaleString()}. {scenario.lesson}
              </span>
            </div>
          )}

          <div className="memory-game-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={locked}
              onClick={() => setStep(1)}
            >
              Back
            </button>

            <button
              type="button"
              className="game-main-btn"
              disabled={!risk || locked}
              onClick={finish}
            >
              Execute Trade
            </button>
          </div>
        </>
      )}
    </div>
  );
}