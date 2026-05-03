import { useMemo, useState } from "react";
import "../GameStyles.css";

const SCENARIOS = [
  {
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
    const success = choice === scenario.correct;

    onComplete({
      success,
      xp: success ? 10 : 0,
      score: success ? 3 : 1,
      message: success
        ? `Strong life judgment. ${scenario.lesson}`
        : `Life lesson: ${scenario.lesson}`,
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
            key={item}
            className={choice === item ? "decision-btn selected" : "decision-btn"}
            onClick={() => setChoice(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <button className="game-main-btn" disabled={!choice} onClick={finish}>
        Make Decision
      </button>
    </div>
  );
}