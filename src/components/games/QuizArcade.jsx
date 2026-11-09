import { useLayoutEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Brain, Check, FlaskConical, Gamepad2, Link2, Play, Volume2, VolumeX, X } from 'lucide-react';

const PICKS = [
  { id: 'mind-health', title: 'Memory & focus', description: 'Remember a pattern and put your recall to the test.', Icon: Brain, color: 'iris' },
  { id: 'science-mathematics', title: 'Science lab', description: 'Connect ideas and put an experiment in order.', Icon: FlaskConical, color: 'sky' },
  { id: 'life-sciences', title: 'Life sciences', description: 'Match related ideas and test your recall.', Icon: Link2, color: 'mint' },
];

export function ArcadeEntry({ onOpen, title = 'Smarty Arcade', description = 'Try a subject challenge with questions and mini-games.' }) {
  return <button type="button" className="arcade-entry" onClick={onOpen}>
    <span className="arcade-entry-icon"><Gamepad2 size={22} aria-hidden="true" /></span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <ArrowRight size={19} aria-hidden="true" />
  </button>;
}

export function ArcadeLobby({ onChoose }) {
  return <section className="arcade-lobby" aria-labelledby="arcade-lobby-title">
    <div className="arcade-lobby-screen">
      <div className="arcade-lobby-copy">
        <h1 id="arcade-lobby-title">Smarty Arcade</h1>
        <p>Practice a lesson below, or jump into a challenge that mixes questions and games.</p>
      </div>
      <div className="arcade-pad-art" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span /><span /><span />
      </div>
    </div>
    <div className="arcade-picks" role="group" aria-label="Play a challenge">
      {PICKS.map(({ id, title, description, Icon, color }) => <button type="button" key={id} className={`arcade-pick is-${color}`} onClick={() => onChoose(id)}>
        <span className="arcade-pick-icon"><Icon size={22} aria-hidden="true" /></span>
        <span><strong>{title}</strong><small>{description}</small><span className="sr-only">Start challenge</span></span>
        <Play size={15} aria-hidden="true" />
      </button>)}
    </div>
  </section>;
}

export function ArcadeRecap({ answers, onReview }) {
  if (answers.length === 0) return null;
  return <div className="arcade-recap">
    <ol aria-label="Round outcomes">
      {answers.map((answer, index) => {
        const unsure = answer.confidence === 'unsure';
        const label = answer.isCorrect ? (unsure ? 'Correct, marked unsure' : 'Correct') : (unsure ? 'Incorrect, marked unsure' : 'Incorrect');
        return <li key={index} className={unsure ? 'is-unsure' : answer.isCorrect ? 'is-correct' : 'is-incorrect'}>
          <span className="sr-only">Round {index + 1}: {label}</span>
          <span aria-hidden="true">{index + 1}</span>
          {unsure ? <span aria-hidden="true">?</span> : answer.isCorrect ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        </li>;
      })}
    </ol>
    <button type="button" className="arcade-console-control" onClick={onReview}>Review answers <ArrowRight size={15} aria-hidden="true" /></button>
  </div>;
}

export function ArcadeShell({ backLabel, onBack, actions, wide = false, boss = false, children }) {
  return <div className={`quiz-page quiz-workspace quiz-arcade${wide ? ' quiz-arcade-library' : ''}${boss ? ' is-boss-round' : ''}`}>
    <div className="arcade-console">
      <header className="arcade-console-bar">
        <button type="button" className="arcade-console-control" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> {backLabel}
        </button>
        <span className="arcade-console-brand"><Gamepad2 size={17} aria-hidden="true" /> Smarty Arcade</span>
        <div className="arcade-console-actions">{actions}</div>
      </header>
      {children}
    </div>
  </div>;
}

export function ArcadeProgress({ step, total, label, unit = 'Step' }) {
  if (total < 1) return null;
  return <div className="arcade-round-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} aria-valuetext={`${unit} ${step} of ${total}`}>
    {Array.from({ length: total }, (_, index) => <span aria-hidden="true" key={index} className={index < step - 1 ? 'is-complete' : index === step - 1 ? 'is-current' : undefined} />)}
  </div>;
}

export function ArcadeStage({ subject, round, total, boss = false, survivalTime, onExit, soundEnabled, onToggleSound, children }) {
  const headingRef = useRef(null);
  useLayoutEffect(() => {
    const heading = headingRef.current;
    heading?.closest('.content')?.scrollTo({ top: 0, behavior: 'instant' });
    heading?.focus({ preventScroll: true });
  }, [round, boss]);
  return <ArcadeShell boss={boss} backLabel="Subjects" onBack={onExit} actions={
    <button type="button" className="arcade-console-control arcade-sound" aria-label="Game sound" aria-pressed={soundEnabled} onClick={onToggleSound}>
      {soundEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
    </button>
  }>
    <section className="arcade-screen">
      <div className="arcade-round-header">
        <div><span>{boss ? 'Boss level' : 'Mini-game'}</span><h1 ref={headingRef} tabIndex={-1}>{subject}</h1></div>
        {!boss && <div className="arcade-round-count"><strong>{round}</strong><span> / {total}</span></div>}
      </div>
      {!boss && <ArcadeProgress step={round} total={total} label="Challenge progress" />}
      {survivalTime != null && <p className="arcade-survival-time">Survival <strong>{survivalTime}s</strong></p>}
      {children}
    </section>
  </ArcadeShell>;
}
