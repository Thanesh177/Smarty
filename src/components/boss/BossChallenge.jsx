import MemorySequenceGame from "../games/memory/MemorySequenceGame";
import MemoryPalaceGame from "../games/memory/MemoryPalaceGame";
import WordRecallGame from "../games/memory/WordRecallGame";
import PatternMatchGame from "../games/memory/PatternMatchGame";

import TradingCandleGame from "../games/trading/TradingCandleGame";
import MarketSurvivalGame from "../games/trading/MarketSurvivalGame";

import LifeCrisisGame from "../games/life/LifeCrisisGame";
import DecisionGame from "../games/life/DecisionGame";

import ScienceLabGame from "../games/science/ScienceLabGame";

import "../games/GameStyles.css";

export default function BossChallenge({ topicId, onComplete }) {
  const bossMap = {
    memory: <MemoryPalaceGame onComplete={onComplete} />,
    daily: <MemorySequenceGame onComplete={onComplete} />,
    psychology: <WordRecallGame onComplete={onComplete} />,

    trading: <MarketSurvivalGame onComplete={onComplete} />,
    personal_finance: <LifeCrisisGame onComplete={onComplete} />,
    career_skills: <DecisionGame onComplete={onComplete} />,

    physics: <ScienceLabGame onComplete={onComplete} />,
    ai_technology: <ScienceLabGame onComplete={onComplete} />,
    cybersecurity: <DecisionGame onComplete={onComplete} />,

    critical_thinking: <PatternMatchGame onComplete={onComplete} />,
    media_literacy: <PatternMatchGame onComplete={onComplete} />,
    law_rights: <DecisionGame onComplete={onComplete} />,

    animals: <PatternMatchGame onComplete={onComplete} />,
    health_fitness: <LifeCrisisGame onComplete={onComplete} />,
    world_history: <WordRecallGame onComplete={onComplete} />,
    geography_world: <PatternMatchGame onComplete={onComplete} />,
    communication: <DecisionGame onComplete={onComplete} />,
  };

  return (
    <div className="boss-stage">
      <div className="boss-header">
        <p className="game-kicker">BOSS CHALLENGE</p>
        <h2>Prove your mastery</h2>
      </div>

      {bossMap[topicId] || <MemorySequenceGame onComplete={onComplete} />}
    </div>
  );
}