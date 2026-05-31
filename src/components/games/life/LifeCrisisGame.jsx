import { useMemo, useState } from "react";
import "../GameStyles.css";

const SCENARIOS = [
  {
    id: "unexpected-expense",
    title: "Unexpected Expense",
    story: "Your phone breaks and repair costs $300. You have limited savings.",
    choices: [
      "Use emergency savings",
      "Borrow with high interest",
      "Ignore the problem",
    ],
    correct: "Use emergency savings",
    lesson: "Emergency funds protect you from debt traps.",
  },
  {
    id: "friend-pressure",
    title: "Friend Pressure",
    story: "Your friends want an expensive night out, but you are saving money.",
    choices: [
      "Spend everything",
      "Say no and suggest cheaper plan",
      "Use credit card carelessly",
    ],
    correct: "Say no and suggest cheaper plan",
    lesson: "Good decisions protect your goals without ruining relationships.",
  },
];

export default function LifeCrisisGame({ onComplete }) {
  const scenario = useMemo(
    () => SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)],
    []
  );

  const [choice, setChoice] = useState("");

  const finish = () => {
    if (!choice) return;

    const success = choice === scenario.correct;

    onComplete?.({
      success,
      xp: success ? 10 : 2,
      score: success ? 100 : 35,
      message: success
        ? `Strong life judgment. ${scenario.lesson}`
        : `Life lesson: ${scenario.lesson}`,
      category: "life-skills",
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      selectedChoice: choice,
      correctChoice: scenario.correct,
    });
  };

  return (
    <div className="brain-game serious-game">
      <p className="game-kicker">LIFE DECISION SIM</p>
      <h2>{scenario.title}</h2>
      <p className="game-hint">{scenario.story}</p>

      <div className="decision-row">
        {scenario.choices.map((item) => (
          <button
            type="button"
            key={item}
            className={choice === item ? "decision-btn selected" : "decision-btn"}
            aria-pressed={choice === item}
            onClick={() => setChoice(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="game-main-btn"
        disabled={!choice}
        onClick={finish}
      >
        Make Decision
      </button>
    </div>
  );
}