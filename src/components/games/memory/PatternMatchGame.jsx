import { useState } from "react";
import "../GameStyles.css";
const correctPairs = {
  gravity: "force",
  neuron: "brain",
  habitat: "animal",
};

export default function PatternMatchGame({ onComplete }) {
  const left = ["gravity", "neuron", "habitat"];
  const right = ["animal", "force", "brain"];

  const [matches, setMatches] = useState({});
  const [active, setActive] = useState(null);

  const chooseLeft = (item) => setActive(item);

  const chooseRight = (item) => {
    if (!active) return;
    setMatches({ ...matches, [active]: item });
    setActive(null);
  };

  const finish = () => {
    const score = Object.entries(matches).filter(
      ([key, value]) => correctPairs[key] === value
    ).length;

    onComplete({
      success: score >= 2,
      score,
      xp: score * 20,
      message: score >= 2 ? "Connections improved!" : "Match patterns again.",
    });
  };

  return (
    <div className="brain-game">
      <p className="game-kicker">MATCH GAME</p>
      <h2>Connect related ideas</h2>

<div className="match-grid">
  <div className="match-column">
    {left.map((item) => (
      <button
        key={item}
        className={active === item ? "match-tile active" : "match-tile"}
        onClick={() => chooseLeft(item)}
      >
        {item}
      </button>
    ))}
  </div>

  <div className="match-column">
    {right.map((item) => {
      const matched = Object.values(matches).includes(item);

      return (
        <button
          key={item}
          className={matched ? "match-tile matched" : "match-tile"}
          onClick={() => chooseRight(item)}
        >
          {item}
        </button>
      );
    })}
  </div>
</div>

      <button className="game-main-btn" onClick={finish}>
        Check Matches
      </button>
    </div>
  );
}