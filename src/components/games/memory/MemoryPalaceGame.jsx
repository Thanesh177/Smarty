import { useEffect, useMemo, useState } from "react";
import "../GameStyles.css";

const ITEM_POOL = [
  "Key",
  "Book",
  "Apple",
  "Clock",
  "River",
  "Train",
  "Ocean",
  "Tiger",
  "Moon",
  "Chair",
  "Car",
  "Tree",
  "Phone",
  "Bottle",
  "Laptop",
  "Bridge",
];

const DISTRACTORS = ["Glass", "Cloud", "Wallet", "Camera", "Planet", "Door"];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function MemoryPalaceGame({ onComplete }) {
  const items = useMemo(() => shuffle(ITEM_POOL).slice(0, 6), []);
  const recallOptions = useMemo(
    () => shuffle([...items, ...shuffle(DISTRACTORS).slice(0, 4)]),
    [items]
  );

  const [phase, setPhase] = useState("study");
  const [selected, setSelected] = useState([]);
  const [timeLeft, setTimeLeft] = useState(6);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (phase !== "study") return undefined;

    const interval = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setPhase("recall");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const toggle = (item) => {
    if (locked) return;

    setSelected((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const finish = () => {
    if (locked) return;

    const correct = selected.filter((item) => items.includes(item)).length;
    const wrong = selected.filter((item) => !items.includes(item)).length;
    const score = Math.max(0, correct - wrong);
    const success = score >= 5;

    setLocked(true);

    setTimeout(() => {
      onComplete({
        success,
        xp: success ? 10 : 0,
        score,
        message: success
          ? `Excellent recall. You remembered ${correct}/${items.length} with strong focus.`
          : `Memory tip: you remembered ${correct}/${items.length}. Link every item to a vivid place, image, or story.`,
      });
    }, 700);
  };

  return (
    <div className="brain-game serious-game memory-palace-game">
      <div className="memory-game-top">
        <div>
          <p className="game-kicker">MEMORY PALACE</p>
          <h2>{phase === "study" ? "Memorize the room" : "Select what you remember"}</h2>
        </div>

        <span className={phase === "study" ? "memory-timer" : "memory-timer recall"}>
          {phase === "study" ? `${timeLeft}s` : `${selected.length}/${items.length}`}
        </span>
      </div>

      <p className="game-hint">
        {phase === "study"
          ? "Build a quick mental story using these objects before time runs out."
          : "Pick only the objects you saw. Wrong picks reduce your score."}
      </p>

      {phase === "study" ? (
        <div className="memory-palace-grid">
          {items.map((item, index) => (
            <div key={item} className="memory-tile study" style={{ animationDelay: `${index * 70}ms` }}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="memory-palace-grid">
            {recallOptions.map((item, index) => (
              <button
                key={item}
                type="button"
                className={selected.includes(item) ? "memory-tile selected" : "memory-tile"}
                style={{ animationDelay: `${index * 45}ms` }}
                onClick={() => toggle(item)}
              >
                <span>{item}</span>
              </button>
            ))}
          </div>

          <p className="game-feedback">{selected.length} selected · aim for accuracy, not guessing.</p>

          <button className="game-main-btn" disabled={selected.length === 0 || locked} onClick={finish}>
            {locked ? "Checking..." : "Submit Recall"}
          </button>
        </>
      )}
    </div>
  );
}