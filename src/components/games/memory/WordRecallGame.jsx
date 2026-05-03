import { useEffect, useState } from "react";
import "../GameStyles.css";
const words = ["river", "planet", "mirror", "forest", "signal"];

export default function WordRecallGame({ onComplete }) {
  const [phase, setPhase] = useState("show");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("recall"), 3500);
    return () => clearTimeout(timer);
  }, []);

  const choices = ["river", "planet", "mirror", "forest", "signal", "window", "engine", "flower"];

  const toggle = (word) => {
    if (selected.includes(word)) {
      setSelected(selected.filter((w) => w !== word));
    } else {
      setSelected([...selected, word]);
    }
  };

  const finish = () => {
    const correct = selected.filter((word) => words.includes(word)).length;
    const wrong = selected.filter((word) => !words.includes(word)).length;
    const score = Math.max(0, correct - wrong);

    onComplete({
      success: score >= 4,
      score,
      xp: score * 15,
      message: score >= 4 ? "Strong recall!" : "Review and try again.",
    });
  };

  return (
    <div className="brain-game">
      <p className="game-kicker">RECALL GAME</p>
      <h2>{phase === "show" ? "Memorize these words" : "Pick the words you saw"}</h2>

      {phase === "show" ? (
<div className="word-list">
  {words.map((word) => (
    <span key={word} className="word-chip">
      {word}
    </span>
  ))}
</div>
      ) : (
        <>
<div className="word-list">
  {choices.map((word) => (
    <button
      key={word}
      className={selected.includes(word) ? "word-chip active" : "word-chip"}
      onClick={() => toggle(word)}
    >
      {word}
    </button>
  ))}
</div>

          <button className="game-main-btn" onClick={finish}>
            Submit Recall
          </button>
        </>
      )}
    </div>
  );
}