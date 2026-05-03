import { useState, useEffect } from "react";
import "../GameStyles.css";

export default function MemoryRetentionGame({ onComplete }) {
  const items = ["Apple", "Train", "Ocean", "Tiger", "Moon", "Chair"];
  const [phase, setPhase] = useState("study");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (phase === "study") {
      setTimeout(() => setPhase("recall"), 4000);
    }
  }, [phase]);

  const finish = () => {
    const correct = selected.filter((i) => items.includes(i)).length;
    const success = correct >= 4;

    onComplete({
      success,
      xp: correct * 3,
      score: correct,
      message: `You recalled ${correct}/6. Memory improves with spaced recall.`,
    });
  };

  return (
    <div className="brain-game">
      <p className="game-kicker">MEMORY TRAINING</p>

      {phase === "study" && (
        <>
          <h2>Memorize these</h2>
          <div className="memory-palace-grid">
  {items.map((i) => (
    <div key={i} className="memory-tile study">
      {i}
    </div>
  ))}
</div>
        </>
      )}

      {phase === "recall" && (
        <>
          <h2>Select what you remember</h2>
          <div className="decision-row">
            {[...items, "Car", "Tree", "Phone"].map((i) => (
<button
  className={selected.includes(i) ? "decision-btn selected" : "decision-btn"}                key={i}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(i)
                      ? prev.filter((x) => x !== i)
                      : [...prev, i]
                  )
                }
              >
                {i}
              </button>
            ))}
          </div>

<button className="game-main-btn" onClick={finish}>
  Submit
</button>        </>
      )}
    </div>
  );
}